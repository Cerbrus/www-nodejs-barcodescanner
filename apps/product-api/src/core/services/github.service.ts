import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { IssueDraft } from '@barcodescanner/shared';

import { AppConfig } from '../../config/app.config';
import { IssueSnapshot, compareVersions, parseVersion } from '../rules/remarks';

export interface CreatedIssue {
    number: number;
    url: string;
}

interface TimelineEvent {
    event: string;
    source?: {
        issue: {
            number: number;
            title: string;
            html_url: string;
            state: string;
            pull_request?: { merged_at?: string | null };
        };
    };
}

interface TagRef {
    ref: string;
    object: { sha: string; type: string };
}

const TAG_PAGE_SIZE = 100;
const MAX_TAG_PAGES = 10;
const READ_TIMEOUT = 5000;
const API_VERSION = '2022-11-28';
const CREATED = 201;

@Injectable()
export class GitHubService {
    private readonly logger = new Logger('GitHub');

    constructor(private readonly config: AppConfig) {}

    public get enabled(): boolean {
        return this.config.githubIssuesToken !== '' && this.config.githubRepository !== '';
    }

    public async createIssue(issue: IssueDraft): Promise<CreatedIssue> {
        if (!this.enabled) {
            throw new ServiceUnavailableException('Sending to GitHub is not set up');
        }

        const answer = await this.post(issue);
        if (answer.status !== CREATED) {
            this.logger.warn(`GitHub refused the issue with status ${answer.status}`);
            throw new BadGatewayException(`GitHub answered ${answer.status}`);
        }

        const created = (await answer.json()) as { number: number; html_url: string };
        this.logger.log(`issue ${created.number} made on GitHub`);

        return { number: created.number, url: created.html_url };
    }

    public async issueSnapshot(number: number): Promise<IssueSnapshot | undefined> {
        const [issue, timeline] = await Promise.all([
            this.get<{ state: string; labels: Array<{ name: string } | string> }>(`issues/${number}`),
            this.get<Array<TimelineEvent>>(`issues/${number}/timeline?per_page=100`)
        ]);
        if (!issue || !timeline) {
            return undefined;
        }

        return {
            state: issue.state === 'closed' ? 'closed' : 'open',
            labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name)),
            pullRequests: timeline
                .flatMap((event) => (event.event === 'cross-referenced' && event.source ? [event.source.issue] : []))
                .filter((pull) => pull.pull_request)
                .map((pull) => ({
                    number: pull.number,
                    title: pull.title,
                    url: pull.html_url,
                    state: pull.state === 'closed' ? ('closed' as const) : ('open' as const),
                    merged: Boolean(pull.pull_request?.merged_at)
                }))
        };
    }

    public async releaseOf(pullNumber: number): Promise<string | undefined> {
        const pull = await this.get<{ merge_commit_sha?: string | null }>(`pulls/${pullNumber}`);
        const tags = pull?.merge_commit_sha ? await this.versionTags() : undefined;
        if (!pull?.merge_commit_sha || !tags?.length) {
            return undefined;
        }

        const contains = async (tag: { sha: string }): Promise<boolean | undefined> => {
            const compared = await this.get<{ status: string }>(`compare/${pull.merge_commit_sha}...${tag.sha}`);

            return compared ? compared.status === 'ahead' || compared.status === 'identical' : undefined;
        };
        let [low, high] = [0, tags.length - 1];
        if (!(await contains(tags[high]))) {
            return undefined;
        }
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            const found = await contains(tags[middle]);
            if (found === undefined) {
                return undefined;
            }
            [low, high] = found ? [low, middle] : [middle + 1, high];
        }

        return tags[low].version;
    }

    private async versionTags(): Promise<Array<{ version: string; sha: string }> | undefined> {
        const refs: Array<TagRef> = [];
        for (let page = 1; page <= MAX_TAG_PAGES; page++) {
            const part = await this.get<Array<TagRef>>(
                `git/matching-refs/tags/v?per_page=${TAG_PAGE_SIZE}&page=${page}`
            );
            if (!part) {
                return undefined;
            }
            refs.push(...part);
            if (part.length < TAG_PAGE_SIZE) {
                break;
            }
        }

        return refs
            .filter((tag) => tag.object.type === 'commit' && parseVersion(tag.ref.replace('refs/tags/', '')))
            .map((tag) => ({ version: tag.ref.replace('refs/tags/v', ''), sha: tag.object.sha }))
            .sort((first, second) => compareVersions(first.version, second.version));
    }

    private async get<T>(path: string): Promise<T | undefined> {
        try {
            const answer = await fetch(`${this.config.githubApiUrl}/repos/${this.config.githubRepository}/${path}`, {
                headers: {
                    Authorization: `Bearer ${this.config.githubIssuesToken}`,
                    Accept: 'application/vnd.github+json',
                    'User-Agent': 'barcodescanner',
                    'X-GitHub-Api-Version': API_VERSION
                },
                signal: AbortSignal.timeout(READ_TIMEOUT)
            });
            if (!answer.ok) {
                this.logger.warn(`GitHub answered ${answer.status} for ${path}`);

                return undefined;
            }

            return (await answer.json()) as T;
        } catch (error) {
            this.logger.warn(`GitHub could not be reached: ${error}`);

            return undefined;
        }
    }

    private async post(issue: IssueDraft): Promise<Response> {
        try {
            return await fetch(`${this.config.githubApiUrl}/repos/${this.config.githubRepository}/issues`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.config.githubIssuesToken}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'barcodescanner',
                    'X-GitHub-Api-Version': API_VERSION
                },
                body: JSON.stringify(issue)
            });
        } catch (error) {
            this.logger.warn(`GitHub could not be reached: ${error}`);
            throw new BadGatewayException('GitHub could not be reached');
        }
    }
}

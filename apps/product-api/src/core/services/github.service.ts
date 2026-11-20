import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { AppConfig } from '../../config/app.config';
import { IssueDraft, IssueSnapshot } from '../rules/remarks';

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
        const issue = await this.get<{ state: string; labels: Array<{ name: string } | string> }>(`issues/${number}`);
        const timeline = await this.get<Array<TimelineEvent>>(`issues/${number}/timeline?per_page=100`);
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

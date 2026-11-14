import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { AppConfig } from '../../config/app.config';
import { IssueDraft } from '../rules/remarks';

export interface CreatedIssue {
    number: number;
    url: string;
}

const API_VERSION = '2022-11-28';
const CREATED = 201;

@Injectable()
export class GitHubService {
    private readonly logger = new Logger('GitHub');

    constructor(private readonly config: AppConfig) {
    }

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

    private async post(issue: IssueDraft): Promise<Response> {
        try {
            return await fetch(`${this.config.githubApiUrl}/repos/${this.config.githubRepository}/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.githubIssuesToken}`,
                    'Accept': 'application/vnd.github+json',
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

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { Injectable } from '@nestjs/common';

import { LogService } from './log.service';
import { AppConfig } from '../../config/app.config';
import { buildPolicy, contentPolicyMode, inlineScriptHashes, policyHeaders, readReports } from '../rules/content-policy';

export const POLICY_REPORT_PATH = '/api/v1/csp-reports';

const REPEAT_AFTER_MILLISECONDS = 60 * 60 * 1000;
const MAX_LINES_PER_HOUR = 60;

@Injectable()
export class ContentPolicyService {
    public readonly headers: Record<string, string>;

    private readonly lastLogged = new Map<string, number>();
    private readonly mode: ReturnType<typeof contentPolicyMode>;

    constructor(
        private readonly config: AppConfig,
        private readonly logs: LogService
    ) {
        this.mode = contentPolicyMode(config.contentPolicyMode);
        this.headers = policyHeaders(this.mode, buildPolicy(this.pageScriptHashes(), POLICY_REPORT_PATH));
    }

    public report(body: unknown, now = Date.now()): void {
        for (const [key, logged] of this.lastLogged) {
            if (now - logged >= REPEAT_AFTER_MILLISECONDS) {
                this.lastLogged.delete(key);
            }
        }

        for (const report of readReports(body)) {
            const key = `${report.directive} ${report.blocked}`;
            if (this.lastLogged.has(key) || this.lastLogged.size >= MAX_LINES_PER_HOUR) {
                continue;
            }

            this.lastLogged.set(key, now);
            const outcome = this.mode === 'enforce' ? 'blocked' : 'would block';
            this.logs.add('phone', 'warning', `content policy ${outcome} ${report.blocked} (${report.directive}) on ${report.page || 'unknown page'}`);
        }
    }

    private pageScriptHashes(): Array<string> {
        const page = join(this.config.frontendPath, 'index.html');

        return existsSync(page) ? inlineScriptHashes(readFileSync(page, 'utf-8')) : [];
    }
}

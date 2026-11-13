import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { AppConfig } from '../../config/app.config';
import { SESSION_COOKIE, Session, isAllowedEmail, newSession, parseCookies, signSession, verifySession } from '../rules/session';

const SECRET_BYTES = 48;

@Injectable()
export class SessionService {
    private readonly logger = new Logger('Auth');
    private storedSecret?: string;

    constructor(private readonly config: AppConfig) {
        if (!config.loginEnabled) {
            this.logger.warn('GOOGLE_CLIENT_ID is not set: login is off and the API is open to whoever can reach it');
            return;
        }

        if (config.missingLoginSettings.length) {
            this.logger.warn(`login is on but these settings are empty: ${config.missingLoginSettings.join(', ')}`);
        }
        this.logger.log(`login is on for ${config.allowedEmails.length} Google account(s)`);
    }

    public get secret(): string {
        if (this.storedSecret) {
            return this.storedSecret;
        }

        const path = this.config.sessionSecretPath;
        if (existsSync(path)) {
            this.storedSecret = readFileSync(path, 'utf-8').trim();
        } else {
            this.storedSecret = randomBytes(SECRET_BYTES).toString('base64url');
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, this.storedSecret, { mode: 0o600 });
            this.logger.log(`new session secret written to ${path}`);
        }

        return this.storedSecret;
    }

    public isAllowed(email: string): boolean {
        return isAllowedEmail(email, this.config.allowedEmails);
    }

    public issue(email: string): string {
        return signSession(newSession(email, new Date()), this.secret);
    }

    public read(cookieHeader?: string): Session | undefined {
        const session = verifySession(parseCookies(cookieHeader)[SESSION_COOKIE], this.secret, new Date());

        return session && this.isAllowed(session.email) ? session : undefined;
    }
}

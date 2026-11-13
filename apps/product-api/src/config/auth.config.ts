import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthConfig {
    public readonly clientId = process.env['GOOGLE_CLIENT_ID'] ?? '';
    public readonly clientSecret = process.env['GOOGLE_CLIENT_SECRET'] ?? '';
    public readonly publicUrl = (process.env['PUBLIC_URL'] ?? '').replace(/\/+$/, '');
    public readonly agentToken = process.env['AGENT_TOKEN'] ?? '';
    public readonly allowedEmails = (process.env['ALLOWED_EMAILS'] ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email);

    public readonly enabled = this.clientId !== '';

    private readonly logger = new Logger('Auth');
    private readonly secretPath =
        process.env['SESSION_SECRET_PATH'] ?? join(dirname(process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'app.db')), 'session-secret');

    private secret?: string;

    constructor() {
        if (!this.enabled) {
            this.logger.warn('GOOGLE_CLIENT_ID is not set: login is off and the API is open to whoever can reach it');
            return;
        }

        const missing = [
            ['GOOGLE_CLIENT_SECRET', this.clientSecret],
            ['PUBLIC_URL', this.publicUrl],
            ['ALLOWED_EMAILS', this.allowedEmails.join()],
            ['AGENT_TOKEN', this.agentToken]
        ].filter(([, value]) => !value);
        if (missing.length) {
            this.logger.warn(`login is on but these settings are empty: ${missing.map(([name]) => name).join(', ')}`);
        }
        this.logger.log(`login is on for ${this.allowedEmails.length} Google account(s)`);
    }

    public get redirectUri(): string {
        return `${this.publicUrl}/api/v1/auth/google/callback`;
    }

    public get sessionSecret(): string {
        if (this.secret) {
            return this.secret;
        }

        if (existsSync(this.secretPath)) {
            this.secret = readFileSync(this.secretPath, 'utf-8').trim();
        } else {
            this.secret = randomBytes(48).toString('base64url');
            mkdirSync(dirname(this.secretPath), { recursive: true });
            writeFileSync(this.secretPath, this.secret, { mode: 0o600 });
            this.logger.log(`new session secret written to ${this.secretPath}`);
        }

        return this.secret;
    }
}

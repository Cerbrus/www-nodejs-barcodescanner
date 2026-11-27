import { dirname, join } from 'path';

import { Injectable } from '@nestjs/common';

const DEFAULT_PORT = 3020;
const DEFAULT_CONNECTORS = 'ah,off';
const DEFAULT_PUSH_SUBJECT = 'mailto:admin@example.com';
const DEFAULT_GITHUB_API = 'https://api.github.com';
const DEFAULT_GITHUB_REPOSITORY = 'Cerbrus/www-nodejs-barcodescanner';
const DEFAULT_GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

const setting = (name: string): string | undefined => process.env[name] || undefined;
const list = (value: string): Array<string> =>
    value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part);

@Injectable()
export class AppConfig {
    public readonly port = Number(setting('PORT')) || DEFAULT_PORT;
    public readonly development = setting('ENVIRONMENT') === 'development';

    public readonly version = setting('APP_VERSION') ?? 'dev';
    public readonly commit = setting('APP_COMMIT');
    public readonly builtAt = setting('APP_BUILT');

    public readonly databasePath = setting('DATABASE_PATH') ?? join(process.cwd(), 'data', 'app.db');
    public readonly dataFolder = dirname(this.databasePath);
    public readonly logFile = setting('LOG_PATH') ?? join(this.dataFolder, 'logs', 'app.log');
    public readonly pushKeysPath = setting('PUSH_KEYS_PATH') ?? join(this.dataFolder, 'push-keys.json');
    public readonly announcedVersionPath =
        setting('ANNOUNCED_VERSION_PATH') ?? join(this.dataFolder, 'announced-version');

    public readonly sessionSecretPath = setting('SESSION_SECRET_PATH') ?? join(this.dataFolder, 'session-secret');
    public readonly seedPath = setting('SEED_PATH') ?? join(process.cwd(), 'data', 'seed-items.json');
    public readonly iconsPath = setting('ICONS_PATH') ?? join(process.cwd(), 'data', 'icons');
    public readonly frontendPath = setting('FRONTEND_PATH') ?? join(__dirname, 'public');

    public readonly connectors = list(setting('CONNECTORS') ?? DEFAULT_CONNECTORS);
    public readonly pushSubject = setting('PUSH_SUBJECT') ?? DEFAULT_PUSH_SUBJECT;

    public readonly googleClientId = setting('GOOGLE_CLIENT_ID') ?? '';
    public readonly googleClientSecret = setting('GOOGLE_CLIENT_SECRET') ?? '';
    public readonly publicUrl = (setting('PUBLIC_URL') ?? '').replace(/\/+$/, '');
    public readonly agentToken = setting('AGENT_TOKEN') ?? '';
    public readonly allowedEmails = list(setting('ALLOWED_EMAILS') ?? '').map((email) => email.toLowerCase());
    public readonly ownerEmail = (setting('OWNER_EMAIL') ?? this.allowedEmails[0] ?? '').toLowerCase();
    public readonly loginEnabled = this.googleClientId !== '';
    public readonly contentPolicyMode = setting('CSP_MODE');

    public readonly githubIssuesToken = setting('GITHUB_ISSUES_TOKEN') ?? '';
    public readonly githubRepository = setting('GITHUB_REPOSITORY') ?? DEFAULT_GITHUB_REPOSITORY;
    public readonly githubApiUrl = (setting('GITHUB_API_URL') ?? DEFAULT_GITHUB_API).replace(/\/+$/, '');

    public readonly geminiApiKey = setting('GEMINI_API_KEY') ?? '';
    public readonly geminiModel = setting('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
    public readonly geminiApiUrl = (setting('GEMINI_API_URL') ?? DEFAULT_GEMINI_API).replace(/\/+$/, '');

    public get redirectUri(): string {
        return `${this.publicUrl}/api/v1/auth/google/callback`;
    }

    public get missingLoginSettings(): Array<string> {
        return [
            ['GOOGLE_CLIENT_SECRET', this.googleClientSecret],
            ['PUBLIC_URL', this.publicUrl],
            ['ALLOWED_EMAILS', this.allowedEmails.join()],
            ['AGENT_TOKEN', this.agentToken]
        ]
            .filter(([, value]) => !value)
            .map(([name]) => name);
    }
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import webpush, { WebPushError } from 'web-push';

import { BarcodeEntity, PushSubscriptionEntity } from '../data/entities';

interface VapidKeys {
    publicKey: string;
    privateKey: string;
}

export interface PushSubscriptionInput {
    endpoint: string;
    p256dh: string;
    auth: string;
    language?: string;
    origin?: string;
}

export interface PushMessage {
    title: string;
    body: string;
    url: string;
    tag: string;
}

export interface PushResult {
    sent: number;
    failed: number;
}

type Texts = Record<'unknownTitle' | 'unknownNamed' | 'unknownBare' | 'testTitle' | 'testBody', string>;

const TIME_TO_LIVE_SECONDS = 24 * 60 * 60;
const DECLARATIVE_PUSH_MARKER = 8030;
const GONE_STATUS_CODES = [404, 410];
const DEFAULT_LANGUAGE = 'nl';
const TEXTS: Record<string, Texts> = {
    nl: {
        unknownTitle: 'Onbekend product gescand',
        unknownNamed: '{title} ({code}) heeft nog geen naam op de lijst.',
        unknownBare: 'Barcode {code} heeft nog geen naam.',
        testTitle: 'Boodschappen',
        testBody: 'Meldingen werken.'
    },
    en: {
        unknownTitle: 'Unknown product scanned',
        unknownNamed: '{title} ({code}) has no name on the list yet.',
        unknownBare: 'Barcode {code} has no name yet.',
        testTitle: 'Shopping list',
        testBody: 'Notifications work.'
    }
};

@Injectable()
export class PushService {
    private readonly logger = new Logger(PushService.name);
    private readonly keysPath =
        process.env['PUSH_KEYS_PATH'] ?? join(dirname(process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'app.db')), 'push-keys.json');

    private readonly subject = process.env['PUSH_SUBJECT'] || 'mailto:admin@example.com';

    private keys?: VapidKeys;

    constructor(
        @InjectRepository(PushSubscriptionEntity) private readonly subscriptions: Repository<PushSubscriptionEntity>,
        @InjectRepository(BarcodeEntity) private readonly barcodes: Repository<BarcodeEntity>
    ) {
    }

    public get publicKey(): string {
        return this.vapidKeys().publicKey;
    }

    public async subscribe(input: PushSubscriptionInput): Promise<void> {
        await this.subscriptions.save({ ...input, language: input.language ?? DEFAULT_LANGUAGE, createdAt: new Date() });
        this.logger.log(`push: device subscribed (${await this.subscriptions.count()} in total)`);
    }

    public async unsubscribe(endpoint: string): Promise<void> {
        await this.subscriptions.delete({ endpoint });
        this.logger.log('push: device unsubscribed');
    }

    public async notifyUnknownBarcode(code: string, title?: string): Promise<void> {
        try {
            const result = await this.send((texts) => ({
                title: texts.unknownTitle,
                body: (title ? texts.unknownNamed : texts.unknownBare).replace('{title}', title ?? '').replace('{code}', code),
                url: '/#/inbox',
                tag: `barcode-${code}`
            }));
            if (result.sent || result.failed) {
                this.logger.log(`push for ${code}: ${result.sent} sent, ${result.failed} failed`);
            }
        } catch (error) {
            this.logger.warn(`push for ${code} failed: ${error}`);
        }
    }

    public sendTest(): Promise<PushResult> {
        return this.send((texts) => ({ title: texts.testTitle, body: texts.testBody, url: '/#/system', tag: 'test' }));
    }

    private async send(compose: (texts: Texts) => PushMessage): Promise<PushResult> {
        const subscriptions = await this.subscriptions.find();
        if (!subscriptions.length) {
            return { sent: 0, failed: 0 };
        }

        const keys = this.vapidKeys();
        const badge = await this.barcodes.countBy({ catalogItemId: IsNull() });
        const outcomes = await Promise.all(
            subscriptions.map(async ({ endpoint, p256dh, auth, language, origin }) => {
                const payload = JSON.stringify(this.payload(compose(TEXTS[language] ?? TEXTS[DEFAULT_LANGUAGE]), badge, language, origin));
                try {
                    await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload, {
                        TTL: TIME_TO_LIVE_SECONDS,
                        vapidDetails: { subject: this.subject, ...keys }
                    });
                    return true;
                } catch (error) {
                    await this.handleFailure(endpoint, error);
                    return false;
                }
            })
        );
        const sent = outcomes.filter((ok) => ok).length;

        return { sent, failed: outcomes.length - sent };
    }

    private payload(message: PushMessage, badge: number, language: string, origin?: string): object {
        if (!origin) {
            return { ...message, badge };
        }

        return {
            web_push: DECLARATIVE_PUSH_MARKER,
            notification: {
                title: message.title,
                body: message.body,
                navigate: new URL(message.url, origin).href,
                tag: message.tag,
                lang: language,
                silent: false,
                app_badge: String(badge)
            }
        };
    }

    private async handleFailure(endpoint: string, error: unknown): Promise<void> {
        const host = new URL(endpoint).host;
        if (error instanceof WebPushError && GONE_STATUS_CODES.includes(error.statusCode)) {
            await this.subscriptions.delete({ endpoint });
            this.logger.log(`push: subscription at ${host} has expired and was removed`);
            return;
        }

        const detail = error instanceof WebPushError ? `${error.statusCode} ${error.body}`.trim() : String(error);
        this.logger.warn(`push to ${host} failed: ${detail}`);
    }

    private vapidKeys(): VapidKeys {
        if (this.keys) {
            return this.keys;
        }

        if (existsSync(this.keysPath)) {
            this.keys = JSON.parse(readFileSync(this.keysPath, 'utf-8')) as VapidKeys;
        } else {
            this.keys = webpush.generateVAPIDKeys();
            mkdirSync(dirname(this.keysPath), { recursive: true });
            writeFileSync(this.keysPath, JSON.stringify(this.keys), { mode: 0o600 });
            this.logger.log(`push: new key pair written to ${this.keysPath}`);
        }

        return this.keys;
    }
}

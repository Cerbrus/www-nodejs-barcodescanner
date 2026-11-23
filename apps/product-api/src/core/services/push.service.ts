import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebPushError, generateVAPIDKeys, sendNotification } from 'web-push';

import { AppConfig } from '../../config/app.config';
import { PushSubscriptionEntity } from '../../data/entities';
import { BarcodeService } from './barcode.service';

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

type Texts = Record<
    | 'unknownTitle'
    | 'unknownNamed'
    | 'unknownBare'
    | 'recipeTitle'
    | 'recipeUnknown'
    | 'testTitle'
    | 'testBody'
    | 'remarkBug'
    | 'remarkWish'
    | 'remarkNote',
    string
>;
type Audience = 'everyone' | 'owner';

const TIME_TO_LIVE_SECONDS = 24 * 60 * 60;
const DECLARATIVE_PUSH_MARKER = 8030;
const GONE_STATUS_CODES = [404, 410];
const DEFAULT_LANGUAGE = 'nl';
const REMARK_PREVIEW_LENGTH = 120;
const TEXTS: Record<string, Texts> = {
    nl: {
        unknownTitle: 'Onbekend product gescand',
        unknownNamed: '{title} ({code}) heeft nog geen naam op de lijst.',
        unknownBare: 'Barcode {code} heeft nog geen naam.',
        recipeTitle: 'Recept {title}',
        recipeUnknown: '{count} van de producten in de code bestaan niet meer. De rest staat op de lijst.',
        testTitle: 'Boodschappen',
        testBody: 'Meldingen werken.',
        remarkBug: 'Nieuwe foutmelding',
        remarkWish: 'Nieuwe wens',
        remarkNote: 'Nieuwe notitie'
    },
    en: {
        unknownTitle: 'Unknown product scanned',
        unknownNamed: '{title} ({code}) has no name on the list yet.',
        unknownBare: 'Barcode {code} has no name yet.',
        recipeTitle: 'Recipe {title}',
        recipeUnknown: '{count} of the products in the code no longer exist. The rest is on the list.',
        testTitle: 'Shopping list',
        testBody: 'Notifications work.',
        remarkBug: 'New bug report',
        remarkWish: 'New wish',
        remarkNote: 'New note'
    }
};

@Injectable()
export class PushService {
    private readonly logger = new Logger(PushService.name);
    private keys?: VapidKeys;

    constructor(
        @InjectRepository(PushSubscriptionEntity) private readonly subscriptions: Repository<PushSubscriptionEntity>,
        private readonly barcodes: BarcodeService,
        private readonly config: AppConfig
    ) {}

    public get publicKey(): string {
        return this.vapidKeys().publicKey;
    }

    public async subscribe(input: PushSubscriptionInput, account?: string): Promise<void> {
        await this.subscriptions.save({
            ...input,
            language: input.language ?? DEFAULT_LANGUAGE,
            account: account ?? null,
            createdAt: new Date()
        });
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
                body: (title ? texts.unknownNamed : texts.unknownBare)
                    .replace('{title}', title ?? '')
                    .replace('{code}', code),
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

    public async notifyRecipePartial(title: string, unknown: number): Promise<void> {
        try {
            await this.send((texts) => ({
                title: texts.recipeTitle.replace('{title}', title),
                body: texts.recipeUnknown.replace('{count}', String(unknown)),
                url: '/#/history',
                tag: `recipe-${title}`
            }));
        } catch (error) {
            this.logger.warn(`push for recipe "${title}" failed: ${error}`);
        }
    }

    public async notifyOwnerOfRemark(id: number, kind: 'bug' | 'wish' | 'note', text: string): Promise<void> {
        const title: Record<typeof kind, keyof Texts> = { bug: 'remarkBug', wish: 'remarkWish', note: 'remarkNote' };
        try {
            const result = await this.send(
                (texts) => ({
                    title: texts[title[kind]],
                    body: text.slice(0, REMARK_PREVIEW_LENGTH),
                    url: '/#/remarks',
                    tag: `remark-${id}`
                }),
                'owner'
            );
            if (result.sent || result.failed) {
                this.logger.log(`push for remark ${id}: ${result.sent} sent, ${result.failed} failed`);
            }
        } catch (error) {
            this.logger.warn(`push for remark ${id} failed: ${error}`);
        }
    }

    public sendTest(): Promise<PushResult> {
        return this.send((texts) => ({ title: texts.testTitle, body: texts.testBody, url: '/#/system', tag: 'test' }));
    }

    private async send(compose: (texts: Texts) => PushMessage, audience: Audience = 'everyone'): Promise<PushResult> {
        const subscriptions = (await this.subscriptions.find()).filter(
            (subscription) => audience === 'everyone' || this.belongsToOwner(subscription.account)
        );
        if (!subscriptions.length) {
            return { sent: 0, failed: 0 };
        }

        const keys = this.vapidKeys();
        const badge = await this.barcodes.inboxCount();
        const outcomes = await Promise.all(
            subscriptions.map(async ({ endpoint, p256dh, auth, language, origin }) => {
                const payload = JSON.stringify(
                    this.payload(compose(TEXTS[language] ?? TEXTS[DEFAULT_LANGUAGE]), badge, language, origin)
                );
                try {
                    await sendNotification({ endpoint, keys: { p256dh, auth } }, payload, {
                        TTL: TIME_TO_LIVE_SECONDS,
                        vapidDetails: { subject: this.config.pushSubject, ...keys }
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

    private belongsToOwner(account?: string | null): boolean {
        return !this.config.loginEnabled || !account || account.toLowerCase() === this.config.ownerEmail;
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

        if (existsSync(this.config.pushKeysPath)) {
            this.keys = JSON.parse(readFileSync(this.config.pushKeysPath, 'utf-8')) as VapidKeys;
        } else {
            this.keys = generateVAPIDKeys();
            mkdirSync(dirname(this.config.pushKeysPath), { recursive: true });
            writeFileSync(this.config.pushKeysPath, JSON.stringify(this.keys), { mode: 0o600 });
            this.logger.log(`push: new key pair written to ${this.config.pushKeysPath}`);
        }

        return this.keys;
    }
}

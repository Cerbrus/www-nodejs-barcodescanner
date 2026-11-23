import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    MessageEvent,
    OnApplicationBootstrap
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Sound, SoundBlock, SoundStep } from '@barcodescanner/shared';

import { AppConfig } from '../../config/app.config';
import { FeedbackSettingEntity, SoundEntity } from '../../data/entities';
import {
    DEFAULT_SOUND_IDS,
    FEEDBACK_EVENTS,
    FeedbackEvent,
    MAX_NAME_LENGTH,
    NO_SOUND,
    cleanBlocks,
    soundProblem,
    toSteps
} from '../rules/sounds';
import { EventsService } from './events.service';

export interface FeedbackSettings {
    events: Array<{ event: FeedbackEvent; soundId: string; steps: Array<SoundStep> }>;
    sounds: Array<Sound>;
}

function toSound({ id, name, blocks }: SoundEntity): Sound {
    return { id, ...(name ? { name } : {}), blocks, steps: toSteps(blocks) };
}

function checked(blocks: Array<SoundBlock>): Array<SoundBlock> {
    const problem = soundProblem(blocks);
    if (problem) {
        throw new BadRequestException(problem);
    }

    return cleanBlocks(blocks);
}

function cleanName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) {
        throw new BadRequestException(`A name has 1 to ${MAX_NAME_LENGTH} characters`);
    }

    return trimmed;
}

function isNewer(version: string, than: string): boolean {
    const [parts, others] = [version, than].map((text) => text.split('.').map(Number));
    const at = parts.findIndex((part, index) => part !== (others[index] ?? 0));

    return at >= 0 && !(parts[at] <= (others[at] ?? 0));
}

@Injectable()
export class FeedbackService implements OnApplicationBootstrap {
    private readonly logger = new Logger('Feedback');
    private versionToAnnounce?: string;

    constructor(
        @InjectRepository(FeedbackSettingEntity) private readonly settings: Repository<FeedbackSettingEntity>,
        @InjectRepository(SoundEntity) private readonly sounds: Repository<SoundEntity>,
        private readonly events: EventsService,
        private readonly config: AppConfig
    ) {}

    public onApplicationBootstrap(): void {
        const { version, announcedVersionPath } = this.config;
        const announced = existsSync(announcedVersionPath) ? readFileSync(announcedVersionPath, 'utf8').trim() : '';
        if (version === 'dev') {
            return;
        }

        if (!announced) {
            this.rememberAnnounced(version);
        } else if (isNewer(version, announced)) {
            this.versionToAnnounce = version;
            this.logger.log(`version ${version} is new; the scanner announces it when it connects`);
        }
    }

    public async takeUpdateAnnouncement(): Promise<MessageEvent | undefined> {
        const version = this.versionToAnnounce;
        if (!version) {
            return undefined;
        }

        this.versionToAnnounce = undefined;
        this.rememberAnnounced(version);
        const steps = (await this.getSettings()).events.find(({ event }) => event === 'updated')?.steps ?? [];
        this.logger.log(`version ${version} announced at the scanner`);

        return steps.length ? { type: 'feedback', data: { name: 'updated', steps } } : undefined;
    }

    public async getSettings(): Promise<FeedbackSettings> {
        const stored = new Map((await this.settings.find()).map((setting) => [setting.event, setting.soundId]));
        const sounds = (await this.sounds.find({ order: { createdAt: 'ASC', id: 'ASC' } })).map(toSound);

        return {
            events: FEEDBACK_EVENTS.map((event) => {
                const chosen = stored.get(event) ?? DEFAULT_SOUND_IDS[event];
                const sound = sounds.find(({ id }) => id === chosen);

                return { event, soundId: sound?.id ?? NO_SOUND, steps: sound?.steps ?? [] };
            }),
            sounds
        };
    }

    public async setSound(event: FeedbackEvent, soundId: string): Promise<FeedbackSettings> {
        if (soundId !== NO_SOUND) {
            await this.findSound(soundId);
        }

        await this.settings.save({ event, soundId });
        this.logger.log(`sound for "${event}" set to "${soundId}"`);
        this.events.emit('feedback_settings', { event, soundId });

        return this.getSettings();
    }

    public async createSound(name: string, blocks: Array<SoundBlock>): Promise<FeedbackSettings> {
        const id = randomUUID().slice(0, 8);
        await this.sounds.insert({ id, name: cleanName(name), blocks: checked(blocks), createdAt: new Date() });
        this.logger.log(`sound "${id}" created`);

        return this.getSettings();
    }

    public async changeSound(
        id: string,
        name: string | undefined,
        blocks: Array<SoundBlock>
    ): Promise<FeedbackSettings> {
        await this.findSound(id);
        await this.sounds.update(id, {
            ...(name === undefined ? {} : { name: cleanName(name) }),
            blocks: checked(blocks)
        });
        this.logger.log(`sound "${id}" changed`);
        this.events.emit('feedback_settings', { soundId: id });

        return this.getSettings();
    }

    public async deleteSound(id: string): Promise<FeedbackSettings> {
        await this.findSound(id);
        const usedBy = (await this.getSettings()).events
            .filter(({ soundId }) => soundId === id)
            .map(({ event }) => event);
        if (usedBy.length) {
            throw new ConflictException(`Sound "${id}" is used for ${usedBy.join(', ')}`);
        }

        await this.sounds.delete(id);
        this.logger.log(`sound "${id}" deleted`);

        return this.getSettings();
    }

    public async test(soundId: string): Promise<void> {
        const sound = await this.findSound(soundId);
        this.logger.log(`test sound "${sound.id}" sent to the scanner`);
        this.events.emit('feedback', { name: sound.id, steps: sound.steps });
    }

    public testBlocks(blocks: Array<SoundBlock>): void {
        this.events.emit('feedback', { name: 'draft', steps: toSteps(checked(blocks)) });
    }

    private rememberAnnounced(version: string): void {
        mkdirSync(dirname(this.config.announcedVersionPath), { recursive: true });
        writeFileSync(this.config.announcedVersionPath, version);
    }

    private async findSound(id: string): Promise<Sound> {
        const sound = await this.sounds.findOneBy({ id });
        if (!sound) {
            throw new BadRequestException(`Unknown sound "${id}"`);
        }

        return toSound(sound);
    }
}

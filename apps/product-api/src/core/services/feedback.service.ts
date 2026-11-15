import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import { BadRequestException, Injectable, Logger, MessageEvent, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppConfig } from '../../config/app.config';
import { FeedbackSettingEntity } from '../../data/entities';
import { DEFAULT_SOUND_IDS, FEEDBACK_EVENTS, FeedbackEvent, NO_SOUND, SOUNDS, Sound, SoundStep } from '../rules/sounds';
import { EventsService } from './events.service';

export interface FeedbackSettings {
    events: Array<{ event: FeedbackEvent; soundId: string; steps: Array<SoundStep> }>;
    sounds: Array<Sound>;
}

@Injectable()
export class FeedbackService implements OnApplicationBootstrap {
    private readonly logger = new Logger('Feedback');
    private versionToAnnounce?: string;

    constructor(
        @InjectRepository(FeedbackSettingEntity) private readonly settings: Repository<FeedbackSettingEntity>,
        private readonly events: EventsService,
        private readonly config: AppConfig
    ) {}

    public onApplicationBootstrap(): void {
        const { version, announcedVersionPath } = this.config;
        const announced = existsSync(announcedVersionPath) ? readFileSync(announcedVersionPath, 'utf8').trim() : '';
        if (version !== 'dev' && version !== announced) {
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
        mkdirSync(dirname(this.config.announcedVersionPath), { recursive: true });
        writeFileSync(this.config.announcedVersionPath, version);
        const steps = (await this.getSettings()).events.find(({ event }) => event === 'updated')?.steps ?? [];
        this.logger.log(`version ${version} announced at the scanner`);

        return steps.length ? { type: 'feedback', data: { name: 'updated', steps } } : undefined;
    }

    public async getSettings(): Promise<FeedbackSettings> {
        const stored = new Map((await this.settings.find()).map((setting) => [setting.event, setting.soundId]));

        return {
            events: FEEDBACK_EVENTS.map((event) => {
                const chosen = stored.get(event) ?? DEFAULT_SOUND_IDS[event];
                const sound = SOUNDS.find(({ id }) => id === chosen);

                return { event, soundId: sound?.id ?? NO_SOUND, steps: sound?.steps ?? [] };
            }),
            sounds: SOUNDS
        };
    }

    public async setSound(event: FeedbackEvent, soundId: string): Promise<FeedbackSettings> {
        if (soundId !== NO_SOUND) {
            this.findSound(soundId);
        }

        await this.settings.save({ event, soundId });
        this.logger.log(`sound for "${event}" set to "${soundId}"`);
        this.events.emit('feedback_settings', { event, soundId });

        return this.getSettings();
    }

    public test(soundId: string): void {
        const sound = this.findSound(soundId);
        this.logger.log(`test sound "${sound.id}" sent to the scanner`);
        this.events.emit('feedback', { name: sound.id, steps: sound.steps });
    }

    private findSound(soundId: string): Sound {
        const sound = SOUNDS.find(({ id }) => id === soundId);
        if (!sound) {
            throw new BadRequestException(`Unknown sound "${soundId}"`);
        }

        return sound;
    }
}

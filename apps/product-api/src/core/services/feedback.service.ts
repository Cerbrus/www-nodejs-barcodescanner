import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EventsService } from './events.service';
import { FeedbackSettingEntity } from '../../data/entities';
import { DEFAULT_SOUND_IDS, FEEDBACK_EVENTS, FeedbackEvent, NO_SOUND, SOUNDS, Sound, SoundStep } from '../rules/sounds';

export interface FeedbackSettings {
    events: Array<{ event: FeedbackEvent; soundId: string; steps: Array<SoundStep> }>;
    sounds: Array<Sound>;
}

@Injectable()
export class FeedbackService {
    private readonly logger = new Logger('Feedback');

    constructor(
        @InjectRepository(FeedbackSettingEntity) private readonly settings: Repository<FeedbackSettingEntity>,
        private readonly events: EventsService
    ) {
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

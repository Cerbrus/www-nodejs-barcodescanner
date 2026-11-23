import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { SettingEntity } from '../../data/entities';
import { EventsService } from './events.service';

const SHOPPING_MODE = 'shopping_mode';

@Injectable()
export class SettingService {
    constructor(
        @InjectRepository(SettingEntity) private readonly settings: Repository<SettingEntity>,
        private readonly events: EventsService
    ) {}

    public async shoppingMode(manager?: EntityManager): Promise<boolean> {
        const repository = manager ? manager.getRepository(SettingEntity) : this.settings;

        return (await repository.findOneBy({ key: SHOPPING_MODE }))?.value === 'on';
    }

    public async setShoppingMode(on: boolean): Promise<boolean> {
        await this.settings.save({ key: SHOPPING_MODE, value: on ? 'on' : 'off' });
        this.events.emit('shopping_mode', { on });

        return on;
    }
}

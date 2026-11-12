import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CatalogItemEntity, ListEntryEntity, ListState } from '../data/entities';
import { EventsService } from '../events/events.service';
import { EntrySnapshot } from '../scan/scan-rules';

export interface ListEntryChange {
    state?: ListState;
    quantity?: number;
    note?: string;
}

@Injectable()
export class ListService {
    constructor(
        @InjectRepository(ListEntryEntity) private readonly entries: Repository<ListEntryEntity>,
        @InjectRepository(CatalogItemEntity) private readonly items: Repository<CatalogItemEntity>,
        private readonly events: EventsService
    ) {
    }

    public getEntries(): Promise<Array<ListEntryEntity>> {
        return this.entries.find({
            relations: { catalogItem: { section: true } },
            order: { updatedAt: 'DESC' }
        });
    }

    public async getSnapshot(catalogItemId: number): Promise<EntrySnapshot | undefined> {
        const entry = await this.entries.findOneBy({ catalogItemId });
        return entry ? { state: entry.state, quantity: entry.quantity } : undefined;
    }

    public async setSnapshot(catalogItemId: number, snapshot?: EntrySnapshot | null): Promise<void> {
        if (snapshot) {
            await this.entries.upsert(
                { catalogItemId, state: snapshot.state, quantity: snapshot.quantity, updatedAt: new Date() },
                ['catalogItemId']
            );
        } else {
            await this.entries.delete({ catalogItemId });
        }

        this.events.emit('list', { catalogItemId });
    }

    public async remove(catalogItemId: number): Promise<void> {
        await this.setSnapshot(catalogItemId, undefined);
    }

    public async change(catalogItemId: number, change: ListEntryChange): Promise<ListEntryEntity> {
        if (!(await this.items.existsBy({ id: catalogItemId }))) {
            throw new NotFoundException(`Catalog item ${catalogItemId} does not exist`);
        }

        const current = await this.entries.findOneBy({ catalogItemId });
        const state = change.state ?? current?.state ?? 'to_buy';
        const quantity = state === 'recent' ? 0 : Math.max(1, change.quantity ?? current?.quantity ?? 1);

        await this.entries.save({
            catalogItemId,
            state,
            quantity,
            note: change.note ?? current?.note ?? '',
            updatedAt: new Date()
        });
        this.events.emit('list', { catalogItemId });

        return this.entries.findOneOrFail({
            where: { catalogItemId },
            relations: { catalogItem: { section: true } }
        });
    }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { EventsService } from './events.service';
import { CatalogItemEntity, ListEntryEntity, ListState } from '../../data/entities';
import { EntrySnapshot } from '../rules/scan-rules';

export interface ListEntryChange {
    state?: ListState;
    quantity?: number;
    note?: string;
}

export interface OfflineChange extends ListEntryChange {
    catalogItemId: number;
    changedAt: Date;
}

export interface OfflineResult {
    applied: number;
    skipped: Array<number>;
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

    public async getSnapshot(catalogItemId: number, manager?: EntityManager): Promise<EntrySnapshot | undefined> {
        const entry = await this.in(manager).findOneBy({ catalogItemId });
        return entry ? { state: entry.state, quantity: entry.quantity } : undefined;
    }

    public async writeSnapshot(catalogItemId: number, snapshot: EntrySnapshot | undefined, manager?: EntityManager): Promise<void> {
        if (snapshot) {
            await this.in(manager).upsert(
                { catalogItemId, state: snapshot.state, quantity: snapshot.quantity, updatedAt: new Date() },
                ['catalogItemId']
            );
        } else {
            await this.in(manager).delete({ catalogItemId });
        }
    }

    public async remove(catalogItemId: number): Promise<void> {
        await this.writeSnapshot(catalogItemId, undefined);
        this.events.emit('list', { catalogItemId });
    }

    public async applyOffline(changes: Array<OfflineChange>): Promise<OfflineResult> {
        const skipped = new Set<number>();
        const lastServerChange = new Map<number, number>();
        let applied = 0;

        for (const { catalogItemId, changedAt, ...change } of changes) {
            if (!lastServerChange.has(catalogItemId)) {
                const current = await this.entries.findOneBy({ catalogItemId });
                lastServerChange.set(catalogItemId, current?.updatedAt.getTime() ?? 0);
            }
            const changedOnServerSince = (lastServerChange.get(catalogItemId) ?? 0) > changedAt.getTime();
            if (changedOnServerSince || !(await this.items.existsBy({ id: catalogItemId }))) {
                skipped.add(catalogItemId);
                continue;
            }

            await this.change(catalogItemId, change);
            applied++;
        }

        return { applied, skipped: [...skipped] };
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

    private in(manager?: EntityManager): Repository<ListEntryEntity> {
        return manager ? manager.getRepository(ListEntryEntity) : this.entries;
    }
}

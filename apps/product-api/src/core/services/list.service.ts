import { randomUUID } from 'crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ListState } from '@barcodescanner/shared';

import { CatalogItemEntity, ListEntryEntity } from '../../data/entities';
import { EntrySnapshot } from '../rules/scan-rules';
import { EventsService } from './events.service';

export interface ListEntryChange {
    catalogItemId?: number;
    state?: ListState;
    quantity?: number;
    note?: string;
}

export interface OfflineChange extends ListEntryChange {
    id?: string;
    changedAt: Date;
}

export interface OfflineResult {
    applied: number;
    skipped: Array<string>;
}

export function cleanNote(note?: string | null): string {
    return (note ?? '').trim();
}

@Injectable()
export class ListService {
    constructor(
        @InjectRepository(ListEntryEntity) private readonly entries: Repository<ListEntryEntity>,
        @InjectRepository(CatalogItemEntity) private readonly items: Repository<CatalogItemEntity>,
        private readonly events: EventsService
    ) {}

    public getEntries(): Promise<Array<ListEntryEntity>> {
        return this.entries.find({
            relations: { catalogItem: { section: true } },
            order: { updatedAt: 'DESC' }
        });
    }

    public async getSnapshot(
        catalogItemId: number,
        note: string,
        manager?: EntityManager
    ): Promise<EntrySnapshot | undefined> {
        const entry = await this.in(manager).findOneBy({ catalogItemId, note: cleanNote(note) });
        return entry ? { state: entry.state, quantity: entry.quantity } : undefined;
    }

    public async writeSnapshot(
        catalogItemId: number,
        note: string,
        snapshot: EntrySnapshot | undefined,
        manager?: EntityManager
    ): Promise<void> {
        const entries = this.in(manager);
        const variant = { catalogItemId, note: cleanNote(note) };
        const current = await entries.findOneBy(variant);

        if (!snapshot) {
            await entries.delete(variant);
        } else if (current) {
            await entries.update(current.id, { ...snapshot, updatedAt: new Date() });
        } else {
            await entries.insert({ id: randomUUID(), ...variant, ...snapshot, updatedAt: new Date() });
        }
    }

    public async remove(id: string): Promise<void> {
        await this.entries.delete({ id });
        this.events.emit('list', { entryId: id });
    }

    public async applyOffline(changes: Array<OfflineChange>): Promise<OfflineResult> {
        const skipped = new Set<string>();
        const lastServerChange = new Map<string, number>();
        let applied = 0;

        for (const { id, changedAt, ...change } of changes) {
            const current = id
                ? await this.entries.findOneBy({ id })
                : await this.entries.findOneBy({ catalogItemId: change.catalogItemId, note: cleanNote(change.note) });
            const entryId = id ?? current?.id ?? randomUUID();
            if (!lastServerChange.has(entryId)) {
                lastServerChange.set(entryId, current?.updatedAt.getTime() ?? 0);
            }
            const changedOnServerSince = (lastServerChange.get(entryId) ?? 0) > changedAt.getTime();
            const catalogItemId = current?.catalogItemId ?? change.catalogItemId;
            if (
                changedOnServerSince ||
                !catalogItemId ||
                !(await this.items.existsBy({ id: catalogItemId, draft: false }))
            ) {
                skipped.add(entryId);
                continue;
            }

            await this.change(entryId, { ...change, catalogItemId });
            applied++;
        }

        return { applied, skipped: [...skipped] };
    }

    public async change(id: string, change: ListEntryChange): Promise<ListEntryEntity> {
        const savedId = await this.entries.manager.transaction(async (manager) => {
            const entries = manager.getRepository(ListEntryEntity);
            const current = await entries.findOneBy({ id });
            const catalogItemId = current?.catalogItemId ?? change.catalogItemId;
            if (
                !catalogItemId ||
                !(await manager.getRepository(CatalogItemEntity).existsBy({ id: catalogItemId, draft: false }))
            ) {
                throw new NotFoundException(`List entry ${id} does not exist`);
            }

            const note = change.note === undefined ? (current?.note ?? '') : cleanNote(change.note);
            const variant = await entries.findOneBy({ catalogItemId, note });
            const target = variant && variant.id !== id ? variant : current;
            const state = change.state ?? current?.state ?? variant?.state ?? 'to_buy';
            const quantity =
                state === 'recent' ? 0 : Math.max(1, change.quantity ?? (current ?? variant)?.quantity ?? 1);

            if (current && variant && variant.id !== id) {
                await entries.delete({ id });
                const merged =
                    state === 'to_buy' && variant.state === 'to_buy' ? variant.quantity + quantity : quantity;
                await entries.update(variant.id, {
                    state: state === 'to_buy' ? 'to_buy' : variant.state,
                    quantity: state === 'to_buy' ? merged : variant.quantity,
                    updatedAt: new Date()
                });

                return variant.id;
            }

            const entryId = target?.id ?? id;
            await entries.save({ id: entryId, catalogItemId, note, state, quantity, updatedAt: new Date() });

            return entryId;
        });
        this.events.emit('list', { entryId: savedId });

        return this.entries.findOneOrFail({ where: { id: savedId }, relations: { catalogItem: { section: true } } });
    }

    private in(manager?: EntityManager): Repository<ListEntryEntity> {
        return manager ? manager.getRepository(ListEntryEntity) : this.entries;
    }
}

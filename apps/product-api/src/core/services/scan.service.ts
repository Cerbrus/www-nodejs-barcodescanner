import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Not, Repository } from 'typeorm';

import { BarcodeService } from './barcode.service';
import { CatalogService } from './catalog.service';
import { ConnectorService } from './connector.service';
import { EventsService } from './events.service';
import { ListService } from './list.service';
import { PushService } from './push.service';
import { BarcodeEntity, ProductSuggestion, ScanEntity, ScanResult, ScanSource } from '../../data/entities';
import { TransactionRunner } from '../../data/transaction.runner';
import { addOneToEntry, decideScan } from '../rules/scan-rules';

export interface ScanOutcome {
    scanId: number;
    code: string;
    result: ScanResult;
    catalogItemId?: number;
    itemName?: string;
    quantity?: number;
}

interface RegisteredScan {
    outcome: ScanOutcome;
    suggestions?: Array<ProductSuggestion>;
}

@Injectable()
export class ScanService {
    private readonly logger = new Logger(ScanService.name);

    constructor(
        @InjectRepository(ScanEntity) private readonly scans: Repository<ScanEntity>,
        private readonly transactions: TransactionRunner,
        private readonly barcodes: BarcodeService,
        private readonly catalog: CatalogService,
        private readonly list: ListService,
        private readonly connectors: ConnectorService,
        private readonly events: EventsService,
        private readonly push: PushService
    ) {
    }

    public async register(code: string, source: ScanSource): Promise<ScanOutcome> {
        const { outcome, suggestions } = await this.transactions.run((manager) => this.write(code, source, manager));

        this.logger.log(`scan ${code} from ${source}: ${outcome.result}${outcome.itemName ? ` (${outcome.itemName})` : ''}`);
        if (outcome.result === 'ignored') {
            return outcome;
        }

        if (outcome.result === 'needs_name') {
            void this.followUpUnknown(code, source, suggestions);
        }
        this.events.emit('scan', { ...outcome, source });

        return outcome;
    }

    public async nameBarcode(code: string, catalogItemId: number): Promise<BarcodeEntity> {
        await this.catalog.getItem(catalogItemId);
        const applied = await this.transactions.run(async (manager) => {
            await this.barcodes.link(code, catalogItemId, manager);

            return this.applyPending(code, catalogItemId, manager);
        });

        this.logger.log(`barcode ${code} linked to item ${catalogItemId}, ${applied} waiting scan(s) applied`);
        this.events.emit('barcode', { code, catalogItemId });

        return this.barcodes.get(code);
    }

    public async discardBarcode(code: string): Promise<void> {
        const barcode = await this.barcodes.get(code);
        await this.transactions.run(async (manager) => {
            await manager.getRepository(ScanEntity).update({ code, result: 'needs_name', undoneAt: IsNull() }, { undoneAt: new Date() });
            if (!barcode.catalogItemId) {
                await this.barcodes.remove(code, manager);
            }
        });

        this.logger.log(`scan ${code}: waiting scans discarded`);
        this.events.emit('barcode', { code, discarded: true });
    }

    public async undo(): Promise<ScanEntity | undefined> {
        const undone = await this.transactions.run(async (manager) => {
            const scans = manager.getRepository(ScanEntity);
            const scan = await scans.findOne({
                where: { undoneAt: IsNull(), result: Not('ignored') },
                order: { createdAt: 'DESC', id: 'DESC' }
            });
            if (!scan) {
                return undefined;
            }

            if (scan.catalogItemId && scan.result !== 'needs_name') {
                await this.undoListChange(scan, manager);
            }
            await this.barcodes.uncountScan(scan.code, manager);
            scan.undoneAt = new Date();

            return scans.save(scan);
        });

        if (undone) {
            this.events.emit('scan', { scanId: undone.id, code: undone.code, result: undone.result, undone: true });
        }

        return undone;
    }

    public async repeatLookup(code: string): Promise<BarcodeEntity> {
        const barcode = await this.barcodes.get(code);
        await this.fetchSuggestions(code, barcode.suggestions);

        return this.barcodes.get(code);
    }

    public history(limit: number): Promise<Array<ScanEntity>> {
        return this.scans.find({ order: { createdAt: 'DESC', id: 'DESC' }, take: limit });
    }

    private async write(code: string, source: ScanSource, manager: EntityManager): Promise<RegisteredScan> {
        const scans = manager.getRepository(ScanEntity);
        const now = new Date();
        const previous = await scans.findOne({
            where: { code, result: Not('ignored') },
            order: { createdAt: 'DESC', id: 'DESC' }
        });
        const barcode = await this.barcodes.findOrCreate(code, manager);
        const catalogItemId = barcode.catalogItemId ?? undefined;
        const entry = catalogItemId ? await this.list.getSnapshot(catalogItemId, manager) : undefined;
        const decision = decideScan({ now, previousScanOfCodeAt: previous?.createdAt, catalogItemId, entry });

        const scan = await scans.save({
            code,
            source,
            result: decision.result,
            createdAt: now,
            catalogItemId: catalogItemId ?? null,
            previousState: entry?.state ?? null,
            previousQuantity: entry?.quantity ?? null
        });
        if (decision.result !== 'ignored') {
            await this.barcodes.countScan(barcode, now, manager);
            if (catalogItemId && decision.entry) {
                await this.list.writeSnapshot(catalogItemId, decision.entry, manager);
            }
        }

        return {
            outcome: {
                scanId: scan.id,
                code,
                result: decision.result,
                catalogItemId,
                itemName: barcode.catalogItem?.name,
                quantity: decision.entry?.quantity
            },
            suggestions: barcode.suggestions
        };
    }

    private async applyPending(code: string, catalogItemId: number, manager: EntityManager): Promise<number> {
        const scans = manager.getRepository(ScanEntity);
        const pending = await scans.find({
            where: { code, result: 'needs_name', undoneAt: IsNull() },
            order: { createdAt: 'ASC', id: 'ASC' }
        });

        for (const scan of pending) {
            const snapshot = await this.list.getSnapshot(catalogItemId, manager);
            const { result, entry } = addOneToEntry(snapshot);
            await scans.update(scan.id, {
                result,
                catalogItemId,
                previousState: snapshot?.state ?? null,
                previousQuantity: snapshot?.quantity ?? null
            });
            await this.list.writeSnapshot(catalogItemId, entry, manager);
        }

        return pending.length;
    }

    private async undoListChange(scan: ScanEntity, manager: EntityManager): Promise<void> {
        const catalogItemId = scan.catalogItemId as number;
        const current = await this.list.getSnapshot(catalogItemId, manager);

        if (scan.result === 'incremented' && current?.state === 'to_buy' && current.quantity > 1) {
            await this.list.writeSnapshot(catalogItemId, { state: 'to_buy', quantity: current.quantity - 1 }, manager);
            return;
        }

        const previous = scan.previousState ? { state: scan.previousState, quantity: scan.previousQuantity ?? 0 } : undefined;
        await this.list.writeSnapshot(catalogItemId, previous, manager);
    }

    private async followUpUnknown(code: string, source: ScanSource, known?: Array<ProductSuggestion>): Promise<void> {
        const suggestions = known ?? (await this.fetchSuggestions(code));
        if (source === 'handheld') {
            await this.push.notifyUnknownBarcode(code, suggestions?.[0]?.title);
        }
    }

    private async fetchSuggestions(code: string, keep: Array<ProductSuggestion> = []): Promise<Array<ProductSuggestion> | undefined> {
        try {
            const { suggestions, failed } = await this.connectors.lookupAll(code);
            const kept = keep.filter((known) => failed.includes(known.connectorId));
            const all = [...kept, ...suggestions];
            const found = suggestions.map((s) => `${s.connectorId} "${s.title}"`).join(', ') || 'no result';
            this.logger.log(`lookup ${code}: ${found}${failed.length ? `; no answer from ${failed.join(', ')}` : ''}`);
            await this.barcodes.storeLookup(code, all, failed);

            return all;
        } catch (error) {
            this.logger.warn(`Storing suggestions for ${code} failed: ${error}`);

            return undefined;
        }
    }
}

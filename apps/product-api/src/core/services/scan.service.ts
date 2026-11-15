import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Not, Repository } from 'typeorm';

import { BarcodeEntity, ProductSuggestion, ScanEntity, ScanResult, ScanSource } from '../../data/entities';
import { TransactionRunner } from '../../data/transaction.runner';
import { addOneToEntry, decideScan } from '../rules/scan-rules';
import { BarcodeService } from './barcode.service';
import { CatalogService } from './catalog.service';
import { ConnectorService } from './connector.service';
import { EventsService } from './events.service';
import { ListService, cleanNote } from './list.service';
import { PushService } from './push.service';

export interface ScanOutcome {
    scanId: number;
    code: string;
    result: ScanResult;
    catalogItemId?: number;
    itemName?: string;
    note?: string;
    quantity?: number;
}

const MAX_HELD_MILLISECONDS = 60 * 60 * 1000;

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
    ) {}

    public async register(code: string, source: ScanSource, scannedAt?: Date): Promise<ScanOutcome> {
        const at = this.acceptedTime(scannedAt);
        const { outcome, suggestions } = await this.transactions.run((manager) =>
            this.write(code, source, at, manager)
        );

        const name = outcome.note ? `${outcome.itemName}, ${outcome.note}` : outcome.itemName;
        this.logger.log(`scan ${code} from ${source}: ${outcome.result}${name ? ` (${name})` : ''}`);
        if (outcome.result === 'ignored') {
            return outcome;
        }

        if (outcome.result === 'needs_name') {
            void this.followUpUnknown(code, source, suggestions);
        }
        this.events.emit('scan', { ...outcome, source });

        return outcome;
    }

    public async nameBarcode(code: string, catalogItemId: number, note = ''): Promise<BarcodeEntity> {
        await this.catalog.getItem(catalogItemId);
        const variant = cleanNote(note);
        const applied = await this.transactions.run(async (manager) => {
            await this.barcodes.link(code, catalogItemId, variant, manager);

            return this.applyPending(code, catalogItemId, variant, manager);
        });

        this.logger.log(`barcode ${code} linked to item ${catalogItemId}, ${applied} waiting scan(s) applied`);
        this.events.emit('barcode', { code, catalogItemId });

        return this.barcodes.get(code);
    }

    public async discardBarcode(code: string): Promise<void> {
        const barcode = await this.barcodes.get(code);
        await this.transactions.run(async (manager) => {
            await manager
                .getRepository(ScanEntity)
                .update({ code, result: 'needs_name', undoneAt: IsNull() }, { undoneAt: new Date() });
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

    public async lastScanAt(source: ScanSource): Promise<Date | undefined> {
        const scan = await this.scans.findOne({ where: { source }, order: { createdAt: 'DESC', id: 'DESC' } });

        return scan?.createdAt;
    }

    public history(limit: number): Promise<Array<ScanEntity>> {
        return this.scans.find({ order: { createdAt: 'DESC', id: 'DESC' }, take: limit });
    }

    private async write(code: string, source: ScanSource, now: Date, manager: EntityManager): Promise<RegisteredScan> {
        const scans = manager.getRepository(ScanEntity);
        const previous = await scans.findOne({
            where: { code, result: Not('ignored') },
            order: { createdAt: 'DESC', id: 'DESC' }
        });
        const barcode = await this.barcodes.findOrCreate(code, manager);
        const catalogItemId = barcode.catalogItemId ?? undefined;
        const note = catalogItemId ? cleanNote(barcode.note) : '';
        const entry = catalogItemId ? await this.list.getSnapshot(catalogItemId, note, manager) : undefined;
        const decision = decideScan({ now, previousScanOfCodeAt: previous?.createdAt, catalogItemId, entry });

        const scan = await scans.save({
            code,
            source,
            result: decision.result,
            createdAt: now,
            catalogItemId: catalogItemId ?? null,
            note: catalogItemId ? note : null,
            previousState: entry?.state ?? null,
            previousQuantity: entry?.quantity ?? null
        });
        if (decision.result !== 'ignored') {
            await this.barcodes.countScan(barcode, now, manager);
            if (catalogItemId && decision.entry) {
                await this.list.writeSnapshot(catalogItemId, note, decision.entry, manager);
            }
        }

        return {
            outcome: {
                scanId: scan.id,
                code,
                result: decision.result,
                catalogItemId,
                itemName: barcode.catalogItem?.name,
                note: note || undefined,
                quantity: decision.entry?.quantity
            },
            suggestions: barcode.suggestions
        };
    }

    private acceptedTime(scannedAt?: Date): Date {
        const now = new Date();
        const age = scannedAt ? now.getTime() - scannedAt.getTime() : 0;

        return scannedAt && age >= 0 && age <= MAX_HELD_MILLISECONDS ? scannedAt : now;
    }

    private async applyPending(
        code: string,
        catalogItemId: number,
        note: string,
        manager: EntityManager
    ): Promise<number> {
        const scans = manager.getRepository(ScanEntity);
        const pending = await scans.find({
            where: { code, result: 'needs_name', undoneAt: IsNull() },
            order: { createdAt: 'ASC', id: 'ASC' }
        });

        for (const scan of pending) {
            const snapshot = await this.list.getSnapshot(catalogItemId, note, manager);
            const { result, entry } = addOneToEntry(snapshot);
            await scans.update(scan.id, {
                result,
                catalogItemId,
                note,
                previousState: snapshot?.state ?? null,
                previousQuantity: snapshot?.quantity ?? null
            });
            await this.list.writeSnapshot(catalogItemId, note, entry, manager);
        }

        return pending.length;
    }

    private async undoListChange(scan: ScanEntity, manager: EntityManager): Promise<void> {
        const catalogItemId = scan.catalogItemId as number;
        const note = scan.note ?? '';
        const current = await this.list.getSnapshot(catalogItemId, note, manager);

        if (scan.result === 'incremented' && current?.state === 'to_buy' && current.quantity > 1) {
            const lessOne = { state: 'to_buy' as const, quantity: current.quantity - 1 };
            await this.list.writeSnapshot(catalogItemId, note, lessOne, manager);
            return;
        }

        const previous = scan.previousState
            ? { state: scan.previousState, quantity: scan.previousQuantity ?? 0 }
            : undefined;
        await this.list.writeSnapshot(catalogItemId, note, previous, manager);
    }

    private async followUpUnknown(code: string, source: ScanSource, known?: Array<ProductSuggestion>): Promise<void> {
        const suggestions = known ?? (await this.fetchSuggestions(code));
        if (source === 'handheld') {
            await this.push.notifyUnknownBarcode(code, suggestions?.[0]?.title);
        }
    }

    private async fetchSuggestions(
        code: string,
        keep: Array<ProductSuggestion> = []
    ): Promise<Array<ProductSuggestion> | undefined> {
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

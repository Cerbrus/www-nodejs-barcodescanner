import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { addOneToEntry, decideScan } from './scan-rules';
import { ConnectorService } from '../connectors/connectors.module';
import { BarcodeEntity, ScanEntity, ScanResult, ScanSource } from '../data/entities';
import { EventsService } from '../events/events.service';
import { ListService } from '../list/list.service';

export interface ScanOutcome {
    scanId: number;
    code: string;
    result: ScanResult;
    catalogItemId?: number;
    itemName?: string;
    quantity?: number;
}

@Injectable()
export class ScanService {
    private readonly logger = new Logger(ScanService.name);

    constructor(
        @InjectRepository(ScanEntity) private readonly scans: Repository<ScanEntity>,
        @InjectRepository(BarcodeEntity) private readonly barcodes: Repository<BarcodeEntity>,
        private readonly list: ListService,
        private readonly connectors: ConnectorService,
        private readonly events: EventsService
    ) {
    }

    public async register(code: string, source: ScanSource): Promise<ScanOutcome> {
        const now = new Date();
        const previous = await this.scans.findOne({
            where: { code, result: Not('ignored') },
            order: { createdAt: 'DESC', id: 'DESC' }
        });
        const barcode = await this.findOrCreateBarcode(code);
        const catalogItemId = barcode.catalogItemId ?? undefined;
        const entry = catalogItemId ? await this.list.getSnapshot(catalogItemId) : undefined;
        const decision = decideScan({ now, previousScanOfCodeAt: previous?.createdAt, catalogItemId, entry });

        const scan = await this.scans.save({
            code,
            source,
            result: decision.result,
            createdAt: now,
            catalogItemId: catalogItemId ?? null,
            previousState: entry?.state ?? null,
            previousQuantity: entry?.quantity ?? null
        });
        const outcome: ScanOutcome = {
            scanId: scan.id,
            code,
            result: decision.result,
            catalogItemId,
            itemName: barcode.catalogItem?.name,
            quantity: decision.entry?.quantity
        };

        if (decision.result === 'ignored') {
            return outcome;
        }

        await this.barcodes.update({ code }, { scanCount: barcode.scanCount + 1, lastScannedAt: now });
        if (catalogItemId && decision.entry) {
            await this.list.setSnapshot(catalogItemId, decision.entry);
        }
        if (decision.result === 'needs_name' && !barcode.suggestions) {
            void this.fetchSuggestions(code);
        }
        this.events.emit('scan', outcome);

        return outcome;
    }

    public async applyPending(code: string, catalogItemId: number): Promise<number> {
        const pending = await this.scans.find({
            where: { code, result: 'needs_name', undoneAt: IsNull() },
            order: { createdAt: 'ASC', id: 'ASC' }
        });

        for (const scan of pending) {
            const snapshot = await this.list.getSnapshot(catalogItemId);
            const { result, entry } = addOneToEntry(snapshot);
            await this.scans.update(scan.id, {
                result,
                catalogItemId,
                previousState: snapshot?.state ?? null,
                previousQuantity: snapshot?.quantity ?? null
            });
            await this.list.setSnapshot(catalogItemId, entry);
        }

        return pending.length;
    }

    public async undo(): Promise<ScanEntity | undefined> {
        const scan = await this.scans.findOne({
            where: { undoneAt: IsNull(), result: Not('ignored') },
            order: { createdAt: 'DESC', id: 'DESC' }
        });
        if (!scan) {
            return undefined;
        }

        if (scan.catalogItemId && scan.result !== 'needs_name') {
            await this.undoListChange(scan);
        }

        const barcode = await this.barcodes.findOneBy({ code: scan.code });
        if (barcode) {
            await this.barcodes.update({ code: scan.code }, { scanCount: Math.max(0, barcode.scanCount - 1) });
        }
        scan.undoneAt = new Date();
        await this.scans.save(scan);
        this.events.emit('scan', { scanId: scan.id, code: scan.code, result: scan.result, undone: true });

        return scan;
    }

    public history(limit: number): Promise<Array<ScanEntity>> {
        return this.scans.find({ order: { createdAt: 'DESC', id: 'DESC' }, take: limit });
    }

    private async undoListChange(scan: ScanEntity): Promise<void> {
        const catalogItemId = scan.catalogItemId as number;
        const current = await this.list.getSnapshot(catalogItemId);

        if (scan.result === 'incremented' && current?.state === 'to_buy' && current.quantity > 1) {
            await this.list.setSnapshot(catalogItemId, { state: 'to_buy', quantity: current.quantity - 1 });
            return;
        }

        const previous = scan.previousState
            ? { state: scan.previousState, quantity: scan.previousQuantity ?? 0 }
            : undefined;
        await this.list.setSnapshot(catalogItemId, previous);
    }

    private async findOrCreateBarcode(code: string): Promise<BarcodeEntity> {
        const existing = await this.barcodes.findOne({ where: { code }, relations: { catalogItem: true } });
        return existing ?? this.barcodes.save({ code, scanCount: 0 });
    }

    private async fetchSuggestions(code: string): Promise<void> {
        try {
            const suggestions = await this.connectors.lookupAll(code);
            await this.barcodes.update({ code }, { suggestions });
            this.events.emit('barcode', { code, suggestions: suggestions.length });
        } catch (error) {
            this.logger.warn(`Storing suggestions for ${code} failed: ${error}`);
        }
    }
}

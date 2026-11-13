import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';

import { EventsService } from './events.service';
import { BarcodeEntity, ProductSuggestion } from '../../data/entities';

@Injectable()
export class BarcodeService {
    constructor(
        @InjectRepository(BarcodeEntity) private readonly barcodes: Repository<BarcodeEntity>,
        private readonly events: EventsService
    ) {
    }

    public getAll(unmappedOnly: boolean): Promise<Array<BarcodeEntity>> {
        return this.barcodes.find({
            where: unmappedOnly ? { catalogItemId: IsNull() } : {},
            relations: { catalogItem: true },
            order: { lastScannedAt: 'DESC' }
        });
    }

    public async get(code: string, manager?: EntityManager): Promise<BarcodeEntity> {
        const barcode = await this.in(manager).findOne({ where: { code }, relations: { catalogItem: true } });
        if (!barcode) {
            throw new NotFoundException(`Barcode ${code} is unknown`);
        }

        return barcode;
    }

    public inboxCount(): Promise<number> {
        return this.barcodes.countBy({ catalogItemId: IsNull() });
    }

    public async findOrCreate(code: string, manager?: EntityManager): Promise<BarcodeEntity> {
        const existing = await this.in(manager).findOne({ where: { code }, relations: { catalogItem: true } });

        return existing ?? this.in(manager).save({ code, scanCount: 0 });
    }

    public async countScan(barcode: BarcodeEntity, at: Date, manager?: EntityManager): Promise<void> {
        await this.in(manager).update({ code: barcode.code }, { scanCount: barcode.scanCount + 1, lastScannedAt: at });
    }

    public async uncountScan(code: string, manager?: EntityManager): Promise<void> {
        const barcode = await this.in(manager).findOneBy({ code });
        if (barcode) {
            await this.in(manager).update({ code }, { scanCount: Math.max(0, barcode.scanCount - 1) });
        }
    }

    public async link(code: string, catalogItemId: number, manager?: EntityManager): Promise<void> {
        await this.in(manager).upsert({ code, catalogItemId }, ['code']);
    }

    public async unlink(code: string): Promise<void> {
        await this.get(code);
        await this.barcodes.update({ code }, { catalogItemId: null });
        this.events.emit('barcode', { code, catalogItemId: null });
    }

    public async remove(code: string, manager?: EntityManager): Promise<void> {
        await this.in(manager).delete({ code });
    }

    public async storeLookup(code: string, suggestions: Array<ProductSuggestion>, failed: Array<string>): Promise<void> {
        await this.barcodes.update({ code }, { suggestions, lookupFailed: failed });
        this.events.emit('barcode', { code, suggestions: suggestions.length, failed: failed.length });
    }

    private in(manager?: EntityManager): Repository<BarcodeEntity> {
        return manager ? manager.getRepository(BarcodeEntity) : this.barcodes;
    }
}

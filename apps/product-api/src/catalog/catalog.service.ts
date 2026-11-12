import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';

import { BarcodeEntity, CatalogItemEntity, SectionEntity } from '../data/entities';
import { EventsService } from '../events/events.service';
import { ScanService } from '../scan/scan.service';

export interface CatalogItemInput {
    name?: string;
    sectionId?: string;
    icon?: string;
    emoji?: string;
}

@Injectable()
export class CatalogService {
    constructor(
        @InjectRepository(SectionEntity) private readonly sections: Repository<SectionEntity>,
        @InjectRepository(CatalogItemEntity) private readonly items: Repository<CatalogItemEntity>,
        @InjectRepository(BarcodeEntity) private readonly barcodes: Repository<BarcodeEntity>,
        private readonly scans: ScanService,
        private readonly events: EventsService
    ) {
    }

    public getSections(): Promise<Array<SectionEntity>> {
        return this.sections.find({ order: { sortOrder: 'ASC' } });
    }

    public getItems(search?: string): Promise<Array<CatalogItemEntity>> {
        return this.items.find({
            where: search ? { name: Like(`%${search}%`) } : {},
            order: { name: 'ASC' }
        });
    }

    public async getItem(id: number): Promise<CatalogItemEntity> {
        const item = await this.items.findOne({ where: { id }, relations: { section: true, barcodes: true } });
        if (!item) {
            throw new NotFoundException(`Catalog item ${id} does not exist`);
        }

        return item;
    }

    public async createItem(input: Required<Pick<CatalogItemInput, 'name' | 'sectionId'>> & CatalogItemInput): Promise<CatalogItemEntity> {
        await this.assertValid(input);
        const item = await this.items.save({ ...input, custom: true });
        this.events.emit('catalog', { catalogItemId: item.id });

        return item;
    }

    public async updateItem(id: number, input: CatalogItemInput): Promise<CatalogItemEntity> {
        await this.getItem(id);
        await this.assertValid(input, id);
        await this.items.update(id, input);
        this.events.emit('catalog', { catalogItemId: id });

        return this.getItem(id);
    }

    public async deleteItem(id: number): Promise<void> {
        await this.getItem(id);
        await this.items.delete(id);
        this.events.emit('catalog', { catalogItemId: id, deleted: true });
    }

    public getBarcodes(unmappedOnly: boolean): Promise<Array<BarcodeEntity>> {
        return this.barcodes.find({
            where: unmappedOnly ? { catalogItemId: IsNull() } : {},
            relations: { catalogItem: true },
            order: { lastScannedAt: 'DESC' }
        });
    }

    public async getBarcode(code: string): Promise<BarcodeEntity> {
        const barcode = await this.barcodes.findOne({ where: { code }, relations: { catalogItem: true } });
        if (!barcode) {
            throw new NotFoundException(`Barcode ${code} is unknown`);
        }

        return barcode;
    }

    public async mapBarcode(code: string, catalogItemId: number): Promise<BarcodeEntity> {
        await this.getItem(catalogItemId);
        await this.barcodes.upsert({ code, catalogItemId }, ['code']);
        await this.scans.applyPending(code, catalogItemId);
        this.events.emit('barcode', { code, catalogItemId });

        return this.getBarcode(code);
    }

    public async unmapBarcode(code: string): Promise<void> {
        await this.getBarcode(code);
        await this.barcodes.update({ code }, { catalogItemId: null });
        this.events.emit('barcode', { code, catalogItemId: null });
    }

    private async assertValid(input: CatalogItemInput, ownId?: number): Promise<void> {
        if (input.sectionId && !(await this.sections.existsBy({ id: input.sectionId }))) {
            throw new NotFoundException(`Section ${input.sectionId} does not exist`);
        }

        if (input.name) {
            const sameName = await this.items.findOneBy({ name: input.name });
            if (sameName && sameName.id !== ownId) {
                throw new ConflictException(`A catalog item named "${input.name}" already exists`);
            }
        }
    }
}

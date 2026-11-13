import { readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';

import { EventsService } from './events.service';
import { ScanService } from './scan.service';
import { BarcodeEntity, CatalogItemEntity, SectionEntity } from '../../data/entities';

export interface CatalogItemInput {
    name?: string;
    sectionId?: string;
    icon?: string;
    emoji?: string;
}

@Injectable()
export class CatalogService {
    private readonly iconsPath = process.env['ICONS_PATH'] ?? join(process.cwd(), 'data', 'icons');
    private readonly seedPath = process.env['SEED_PATH'] ?? join(process.cwd(), 'data', 'seed-items.json');
    private seedIcons?: Map<string, string>;

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

    public async discardBarcode(code: string): Promise<void> {
        const barcode = await this.getBarcode(code);
        await this.scans.discardPending(code);
        if (!barcode.catalogItemId) {
            await this.barcodes.delete({ code });
        }
        this.events.emit('barcode', { code, discarded: true });
    }

    public async getIconNames(): Promise<Array<string>> {
        try {
            const files = await readdir(this.iconsPath);
            return files
                .filter((file) => file.endsWith('.png'))
                .map((file) => file.slice(0, -'.png'.length))
                .sort();
        } catch {
            return [];
        }
    }

    public defaultIcon(name: string): string | undefined {
        this.seedIcons ??= this.readSeedIcons();
        return this.seedIcons.get(name.toLowerCase());
    }

    private readSeedIcons(): Map<string, string> {
        try {
            const seed = JSON.parse(readFileSync(this.seedPath, 'utf-8')) as { items: Array<{ name: string; icon?: string }> };
            return new Map(seed.items.flatMap(({ name, icon }) => (icon ? [[name.toLowerCase(), icon] as const] : [])));
        } catch {
            return new Map();
        }
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

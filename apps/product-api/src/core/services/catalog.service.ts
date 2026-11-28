import { readFileSync } from 'fs';
import { readdir } from 'fs/promises';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Like, QueryFailedError, Repository } from 'typeorm';

import { AppConfig } from '../../config/app.config';
import { CatalogItemEntity, SectionEntity } from '../../data/entities';
import { EventsService } from './events.service';

export interface CatalogItemInput {
    name?: string;
    sectionId?: string;
    icon?: string;
    emoji?: string;
    stocked?: boolean;
}

export type NewCatalogItem = Required<Pick<CatalogItemInput, 'name' | 'sectionId'>> &
    CatalogItemInput & { draft?: boolean };

const usedElsewhere = (error: unknown): boolean =>
    error instanceof QueryFailedError &&
    ['SQLITE_CONSTRAINT_FOREIGNKEY', 'SQLITE_CONSTRAINT_TRIGGER'].includes(
        (error.driverError as { code?: string }).code ?? ''
    );

@Injectable()
export class CatalogService {
    private seedIcons?: Map<string, string>;

    constructor(
        @InjectRepository(SectionEntity) private readonly sections: Repository<SectionEntity>,
        @InjectRepository(CatalogItemEntity) private readonly items: Repository<CatalogItemEntity>,
        private readonly events: EventsService,
        private readonly config: AppConfig
    ) {}

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

    public async unknownIds(ids: Array<number>, manager?: EntityManager): Promise<Array<number>> {
        const items = manager ? manager.getRepository(CatalogItemEntity) : this.items;
        const known = new Set((await items.find({ where: { id: In(ids) }, select: { id: true } })).map(({ id }) => id));

        return [...new Set(ids)].filter((id) => !known.has(id));
    }

    public async notForList(ids: Array<number>, manager?: EntityManager): Promise<Array<number>> {
        const items = manager ? manager.getRepository(CatalogItemEntity) : this.items;
        const listable = new Set(
            (await items.find({ where: { id: In(ids), draft: false }, select: { id: true } })).map(({ id }) => id)
        );

        return [...new Set(ids)].filter((id) => !listable.has(id));
    }

    public async createItem(input: NewCatalogItem): Promise<CatalogItemEntity> {
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

    public async confirmDraft(id: number): Promise<CatalogItemEntity> {
        await this.getItem(id);
        await this.items.update(id, { draft: false });
        this.events.emit('catalog', { catalogItemId: id });

        return this.getItem(id);
    }

    public async deleteItem(id: number): Promise<void> {
        await this.getItem(id);
        try {
            await this.items.delete(id);
        } catch (error) {
            if (usedElsewhere(error)) {
                throw new ConflictException(`Catalog item ${id} is used by a recipe`);
            }
            throw error;
        }
        this.events.emit('catalog', { catalogItemId: id, deleted: true });
    }

    public async removeReplaced(id: number, manager: EntityManager): Promise<void> {
        await manager.getRepository(CatalogItemEntity).delete(id);
    }

    public async getIconNames(): Promise<Array<string>> {
        try {
            const files = await readdir(this.config.iconsPath);
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
            const seed = JSON.parse(readFileSync(this.config.seedPath, 'utf-8')) as {
                items: Array<{ name: string; icon?: string }>;
            };
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

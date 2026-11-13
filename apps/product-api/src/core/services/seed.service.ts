import { existsSync, readFileSync } from 'fs';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AppConfig } from '../../config/app.config';
import { CatalogItemEntity, ListEntryEntity, ListState, SectionEntity } from '../../data/entities';

interface SeedFile {
    sections: Array<{ id: string; name: string; order: number; emoji?: string }>;
    items: Array<{ name: string; sectionId: string; icon: string | null; custom: boolean; emoji?: string }>;
    list: Array<{ name: string; state: ListState; note: string }>;
}

@Injectable()
export class SeedService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SeedService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly config: AppConfig
    ) {
    }

    public async onApplicationBootstrap(): Promise<void> {
        if (await this.dataSource.getRepository(SectionEntity).count()) {
            return;
        }
        if (!existsSync(this.config.seedPath)) {
            this.logger.warn(`No seed file at ${this.config.seedPath}; the catalog starts empty`);
            return;
        }

        const seed = JSON.parse(readFileSync(this.config.seedPath, 'utf-8')) as SeedFile;
        await this.dataSource.transaction(async (manager) => {
            await manager.insert(
                SectionEntity,
                seed.sections.map(({ id, name, order, emoji }) => ({ id, name, sortOrder: order, emoji }))
            );
            const items = await manager.save(
                CatalogItemEntity,
                seed.items.map(({ icon, ...item }) => ({ ...item, icon: icon ?? undefined }))
            );
            const idByName = new Map(items.map((item) => [item.name, item.id]));
            const now = new Date();
            await manager.insert(
                ListEntryEntity,
                seed.list
                    .filter((entry) => idByName.has(entry.name))
                    .map((entry) => ({
                        catalogItemId: idByName.get(entry.name) as number,
                        state: entry.state,
                        quantity: entry.state === 'to_buy' ? 1 : 0,
                        note: entry.note,
                        updatedAt: now
                    }))
            );
        });
        this.logger.log(`Seeded ${seed.sections.length} sections, ${seed.items.length} items, ${seed.list.length} list entries`);
    }
}

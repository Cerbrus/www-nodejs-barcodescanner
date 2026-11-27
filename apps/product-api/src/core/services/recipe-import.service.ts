import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';

import { RecipeIngredient } from '@barcodescanner/shared';

import { RecipeEntity } from '../../data/entities';
import {
    IMPORT_SCHEMA,
    NewProduct,
    PAGE_SCHEMA,
    freeName,
    holdsLink,
    importPrompt,
    pagePrompt,
    readImport,
    readPage,
    withSource
} from '../rules/recipe-import';
import { CatalogService } from './catalog.service';
import { GeminiService } from './gemini.service';
import { RecipeService } from './recipe.service';

const LINK_ATTEMPTS = 2;

@Injectable()
export class RecipeImportService {
    private readonly logger = new Logger(RecipeImportService.name);

    constructor(
        private readonly gemini: GeminiService,
        private readonly catalog: CatalogService,
        private readonly recipes: RecipeService
    ) {}

    public get available(): boolean {
        return this.gemini.enabled;
    }

    public async import(source: string): Promise<RecipeEntity> {
        const choices = {
            products: (await this.catalog.getItems()).map(({ id, name }) => ({ id, name })),
            sections: (await this.catalog.getSections()).map(({ id, name }) => ({ id, name })),
            icons: await this.catalog.getIconNames()
        };
        const text = holdsLink(source) ? await this.pageOf(source) : source;
        const answer = text
            ? await this.gemini.ask({ input: importPrompt(text, choices), schema: IMPORT_SCHEMA, readLinks: false })
            : undefined;
        const read = readImport(answer?.value, choices);
        if (!read) {
            throw new UnprocessableEntityException('No recipe could be read from this');
        }

        const drafts = new Map<string, number>();
        const ingredients: Array<RecipeIngredient> = [];
        for (const { catalogItemId, product, quantity, note } of read.rows) {
            ingredients.push({ catalogItemId: catalogItemId ?? (await this.draftOf(product, drafts)), quantity, note });
        }
        const recipe = await this.recipes.create({
            name: freeName(
                read.name,
                (await this.recipes.getAll()).map(({ name }) => name)
            ),
            description: withSource(read.description, source),
            ingredients
        });
        this.logger.log(`recipe "${recipe.name}" imported, ${drafts.size} draft product(s) made`);

        return recipe;
    }

    private async pageOf(source: string): Promise<string | undefined> {
        for (let attempt = 0; attempt < LINK_ATTEMPTS; attempt++) {
            const { value, linkRead } = await this.gemini.ask({
                input: pagePrompt(source),
                schema: PAGE_SCHEMA,
                readLinks: true
            });
            if (linkRead) {
                return readPage(value);
            }
            this.logger.warn('the answer was made without reading the link');
        }

        return undefined;
    }

    private async draftOf(product: NewProduct | undefined, made: Map<string, number>): Promise<number> {
        const { name, sectionId, icon, emoji } = product as NewProduct;
        const key = name.toLowerCase();
        const known = made.get(key);
        if (known) {
            return known;
        }

        const draft = await this.catalog.createItem({
            name,
            sectionId,
            icon: this.catalog.defaultIcon(name) ?? icon,
            emoji,
            draft: true
        });
        made.set(key, draft.id);

        return draft.id;
    }
}

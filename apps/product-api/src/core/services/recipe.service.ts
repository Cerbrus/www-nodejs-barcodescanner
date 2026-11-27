import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import {
    DEFAULT_RECIPE_CATEGORY,
    RecipeCategory,
    RecipeContent,
    RecipeIngredient,
    cleanIngredients,
    readRecipeCode,
    writeRecipeCode
} from '@barcodescanner/shared';

import { RecipeEntity, RecipeIngredientEntity, RecipeOfferEntity } from '../../data/entities';
import { TransactionRunner } from '../../data/transaction.runner';
import { CatalogService } from './catalog.service';
import { EventsService } from './events.service';

export interface RecipeInput {
    name: string;
    description?: string;
    category?: RecipeCategory;
    sourceUrl?: string;
    ingredients: Array<RecipeIngredient>;
}

export interface RecipeOffer {
    id: number;
    name: string;
    createdAt: Date;
    products: number;
    unknown: Array<number>;
    nameTaken: boolean;
}

const codeOf = (recipe: RecipeContent): string =>
    writeRecipeCode({ name: recipe.name.trim(), ingredients: cleanIngredients(recipe.ingredients) });

@Injectable()
export class RecipeService {
    constructor(
        @InjectRepository(RecipeEntity) private readonly recipes: Repository<RecipeEntity>,
        @InjectRepository(RecipeIngredientEntity) private readonly ingredients: Repository<RecipeIngredientEntity>,
        @InjectRepository(RecipeOfferEntity) private readonly offers: Repository<RecipeOfferEntity>,
        private readonly transactions: TransactionRunner,
        private readonly catalog: CatalogService,
        private readonly events: EventsService
    ) {}

    public getAll(): Promise<Array<RecipeEntity>> {
        return this.recipes.find({
            relations: { ingredients: true },
            order: { name: 'ASC', ingredients: { position: 'ASC' } }
        });
    }

    public async get(id: number): Promise<RecipeEntity> {
        const recipe = await this.recipes.findOne({
            where: { id },
            relations: { ingredients: true },
            order: { ingredients: { position: 'ASC' } }
        });
        if (!recipe) {
            throw new NotFoundException(`Recipe ${id} does not exist`);
        }

        return recipe;
    }

    public async create(input: RecipeInput): Promise<RecipeEntity> {
        const id = await this.transactions.run(async (manager) => {
            const { name, description } = await this.checked(input, manager);
            const now = new Date();
            const recipe = await manager.getRepository(RecipeEntity).save({
                name,
                description,
                category: input.category ?? DEFAULT_RECIPE_CATEGORY,
                sourceUrl: input.sourceUrl?.trim() ?? '',
                createdAt: now,
                updatedAt: now
            });
            await this.writeIngredients(recipe.id, input.ingredients, manager);

            return recipe.id;
        });
        await this.forgetOffersOf(id);
        this.events.emit('recipe', { recipeId: id });

        return this.get(id);
    }

    public async update(id: number, input: RecipeInput): Promise<RecipeEntity> {
        const { category, sourceUrl } = await this.get(id);
        await this.transactions.run(async (manager) => {
            const { name, description } = await this.checked(input, manager, id);
            await manager.getRepository(RecipeEntity).update(id, {
                name,
                description,
                category: input.category ?? category,
                sourceUrl: input.sourceUrl?.trim() ?? sourceUrl,
                updatedAt: new Date()
            });
            await manager.getRepository(RecipeIngredientEntity).delete({ recipeId: id });
            await this.writeIngredients(id, input.ingredients, manager);
        });
        await this.forgetOffersOf(id);
        this.events.emit('recipe', { recipeId: id });

        return this.get(id);
    }

    public async delete(id: number): Promise<void> {
        await this.get(id);
        await this.recipes.delete(id);
        this.events.emit('recipe', { recipeId: id, deleted: true });
    }

    public async offerIfUnknown(recipe: RecipeContent): Promise<boolean> {
        const code = codeOf(recipe);
        if ((await this.codes()).has(code)) {
            return false;
        }
        if (!(await this.offers.existsBy({ code }))) {
            await this.offers.insert({ code, name: recipe.name.trim(), createdAt: new Date() });
            this.events.emit('recipe', { offered: true });
        }

        return true;
    }

    public async keepIfUnknown(recipe: RecipeContent): Promise<void> {
        const code = codeOf(recipe);
        if ((await this.codes()).has(code)) {
            return;
        }
        if (await this.recipes.existsBy({ name: recipe.name.trim() })) {
            await this.offerIfUnknown(recipe);
            return;
        }

        await this.createFrom(recipe);
        await this.offers.delete({ code });
    }

    public async getOffers(): Promise<Array<RecipeOffer>> {
        const names = new Set((await this.recipes.find({ select: { name: true } })).map(({ name }) => name));
        const offers = await this.offers.find({ order: { createdAt: 'DESC', id: 'DESC' } });

        return Promise.all(
            offers.map(async ({ id, name, code, createdAt }) => {
                const ids = (readRecipeCode(code)?.ingredients ?? []).map(({ catalogItemId }) => catalogItemId);

                return {
                    id,
                    name,
                    createdAt,
                    products: ids.length,
                    unknown: await this.catalog.unknownIds(ids),
                    nameTaken: names.has(name)
                };
            })
        );
    }

    public async saveOffer(id: number): Promise<RecipeEntity> {
        const offer = await this.offer(id);
        const recipe = readRecipeCode(offer.code);
        if (!recipe) {
            throw new BadRequestException(`Recipe offer ${id} cannot be read`);
        }
        const saved = await this.createFrom(recipe);
        await this.offers.delete(id);
        this.events.emit('recipe', { recipeId: saved.id });

        return saved;
    }

    public async dropOffer(id: number): Promise<void> {
        await this.offer(id);
        await this.offers.delete(id);
        this.events.emit('recipe', { offered: false });
    }

    public async countUsing(catalogItemId: number): Promise<number> {
        const rows = await this.ingredients.find({ where: { catalogItemId }, select: { recipeId: true } });

        return new Set(rows.map(({ recipeId }) => recipeId)).size;
    }

    public async replaceDraft(id: number, targetId: number): Promise<void> {
        const [draft, target] = [await this.catalog.getItem(id), await this.catalog.getItem(targetId)];
        if (!draft.draft) {
            throw new ConflictException(`Catalog item ${id} is not a draft`);
        }
        if (target.draft) {
            throw new ConflictException(`Catalog item ${targetId} is a draft itself`);
        }

        const recipeIds = await this.transactions.run(async (manager) => {
            const rows = manager.getRepository(RecipeIngredientEntity);
            const using = new Set(
                (await rows.find({ where: { catalogItemId: id }, select: { recipeId: true } })).map(
                    ({ recipeId }) => recipeId
                )
            );
            for (const recipeId of using) {
                const ingredients = await rows.find({ where: { recipeId }, order: { position: 'ASC' } });
                await rows.delete({ recipeId });
                await this.writeIngredients(
                    recipeId,
                    ingredients.map(({ catalogItemId, quantity, note, text }) => ({
                        catalogItemId: catalogItemId === id ? targetId : catalogItemId,
                        quantity,
                        note,
                        text
                    })),
                    manager
                );
                await manager.getRepository(RecipeEntity).update(recipeId, { updatedAt: new Date() });
            }
            await this.catalog.removeReplaced(id, manager);

            return [...using];
        });
        for (const recipeId of recipeIds) {
            await this.forgetOffersOf(recipeId);
            this.events.emit('recipe', { recipeId });
        }
        this.events.emit('catalog', { catalogItemId: id, deleted: true });
    }

    private async createFrom(recipe: RecipeContent): Promise<RecipeEntity> {
        const unknown = await this.catalog.unknownIds(recipe.ingredients.map(({ catalogItemId }) => catalogItemId));

        return this.create({
            name: recipe.name,
            ingredients: recipe.ingredients.filter(({ catalogItemId }) => !unknown.includes(catalogItemId))
        });
    }

    private async offer(id: number): Promise<RecipeOfferEntity> {
        const offer = await this.offers.findOneBy({ id });
        if (!offer) {
            throw new NotFoundException(`Recipe offer ${id} does not exist`);
        }

        return offer;
    }

    private async codes(): Promise<Set<string>> {
        return new Set(
            (await this.getAll()).map(({ name, ingredients }) =>
                codeOf({
                    name,
                    ingredients: (ingredients ?? []).map(({ catalogItemId, quantity, note }) => ({
                        catalogItemId,
                        quantity,
                        note
                    }))
                })
            )
        );
    }

    private async forgetOffersOf(id: number): Promise<void> {
        const { name, ingredients } = await this.get(id);
        await this.offers.delete({
            code: codeOf({
                name,
                ingredients: (ingredients ?? []).map(({ catalogItemId, quantity, note }) => ({
                    catalogItemId,
                    quantity,
                    note
                }))
            })
        });
    }

    private async checked(
        input: RecipeInput,
        manager: EntityManager,
        ownId?: number
    ): Promise<{ name: string; description: string }> {
        const name = input.name.trim();
        if (!name) {
            throw new BadRequestException('A recipe needs a name');
        }
        const sameName = await manager.getRepository(RecipeEntity).findOneBy({ name });
        if (sameName && sameName.id !== ownId) {
            throw new ConflictException(`A recipe named "${name}" already exists`);
        }
        const unknown = await this.catalog.unknownIds(
            input.ingredients.map(({ catalogItemId }) => catalogItemId),
            manager
        );
        if (unknown.length) {
            throw new NotFoundException(`Catalog item ${unknown.join(', ')} does not exist`);
        }

        return { name, description: (input.description ?? '').trim() };
    }

    private async writeIngredients(
        recipeId: number,
        ingredients: Array<RecipeIngredient>,
        manager: EntityManager
    ): Promise<void> {
        const rows = cleanIngredients(ingredients).map((ingredient, position) => ({
            ...ingredient,
            text: ingredient.text ?? '',
            recipeId,
            position
        }));
        if (rows.length) {
            await manager.getRepository(RecipeIngredientEntity).insert(rows);
        }
    }
}

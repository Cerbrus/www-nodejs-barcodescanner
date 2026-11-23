import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { RecipeIngredient, cleanIngredients } from '@barcodescanner/shared';

import { RecipeEntity, RecipeIngredientEntity } from '../../data/entities';
import { TransactionRunner } from '../../data/transaction.runner';
import { CatalogService } from './catalog.service';
import { EventsService } from './events.service';

export interface RecipeInput {
    name: string;
    description?: string;
    ingredients: Array<RecipeIngredient>;
}

@Injectable()
export class RecipeService {
    constructor(
        @InjectRepository(RecipeEntity) private readonly recipes: Repository<RecipeEntity>,
        @InjectRepository(RecipeIngredientEntity) private readonly ingredients: Repository<RecipeIngredientEntity>,
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
            const recipe = await manager
                .getRepository(RecipeEntity)
                .save({ name, description, createdAt: now, updatedAt: now });
            await this.writeIngredients(recipe.id, input.ingredients, manager);

            return recipe.id;
        });
        this.events.emit('recipe', { recipeId: id });

        return this.get(id);
    }

    public async update(id: number, input: RecipeInput): Promise<RecipeEntity> {
        await this.get(id);
        await this.transactions.run(async (manager) => {
            const { name, description } = await this.checked(input, manager, id);
            await manager.getRepository(RecipeEntity).update(id, { name, description, updatedAt: new Date() });
            await manager.getRepository(RecipeIngredientEntity).delete({ recipeId: id });
            await this.writeIngredients(id, input.ingredients, manager);
        });
        this.events.emit('recipe', { recipeId: id });

        return this.get(id);
    }

    public async delete(id: number): Promise<void> {
        await this.get(id);
        await this.recipes.delete(id);
        this.events.emit('recipe', { recipeId: id, deleted: true });
    }

    public async countUsing(catalogItemId: number): Promise<number> {
        const rows = await this.ingredients.find({ where: { catalogItemId }, select: { recipeId: true } });

        return new Set(rows.map(({ recipeId }) => recipeId)).size;
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
            recipeId,
            position
        }));
        if (rows.length) {
            await manager.getRepository(RecipeIngredientEntity).insert(rows);
        }
    }
}

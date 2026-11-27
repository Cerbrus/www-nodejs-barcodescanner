import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { CatalogItemEntity } from './catalog-item.entity';
import { RecipeEntity } from './recipe.entity';

@Entity('recipe_ingredient')
@Unique('uq_recipe_ingredient_variant', ['recipeId', 'catalogItemId', 'note'])
export class RecipeIngredientEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({ type: 'integer' })
    public recipeId: number;

    @ManyToOne(() => RecipeEntity, (recipe) => recipe.ingredients, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'recipe_id' })
    public recipe?: RecipeEntity;

    @Column({ type: 'integer' })
    public catalogItemId: number;

    @ManyToOne(() => CatalogItemEntity, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'catalog_item_id' })
    public catalogItem?: CatalogItemEntity;

    @Column({ type: 'integer', default: 1 })
    public quantity: number;

    @Column({ type: 'text', default: '' })
    public note: string;

    @Column({ type: 'integer' })
    public position: number;
}

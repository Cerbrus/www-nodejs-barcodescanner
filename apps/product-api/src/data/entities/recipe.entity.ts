import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { RecipeCategory } from '@barcodescanner/shared';

import { RecipeIngredientEntity } from './recipe-ingredient.entity';

@Entity('recipe')
export class RecipeEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({ type: 'varchar', unique: true })
    public name: string;

    @Column({ type: 'text', default: '' })
    public description: string;

    @Column({ type: 'varchar', default: 'other' })
    public category: RecipeCategory;

    @Column({ type: 'varchar', default: '' })
    public sourceUrl: string;

    @Column({ type: 'datetime' })
    public createdAt: Date;

    @Column({ type: 'datetime' })
    public updatedAt: Date;

    @OneToMany(() => RecipeIngredientEntity, (ingredient) => ingredient.recipe)
    public ingredients?: Array<RecipeIngredientEntity>;
}

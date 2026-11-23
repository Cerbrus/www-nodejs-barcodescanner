import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recipe_offer')
export class RecipeOfferEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({ type: 'text', unique: true })
    public code: string;

    @Column({ type: 'varchar' })
    public name: string;

    @Column({ type: 'datetime' })
    public createdAt: Date;
}

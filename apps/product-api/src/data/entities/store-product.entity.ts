import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProductEntity } from './product.entity';

export enum StoreType {
    AH = 'AH',
    Lidl = 'Lidl',
    Jumbo = 'Jumbo',
    Dirk = 'Dirk',
    Aldi = 'Aldi',
}

@Entity('store_products')
export class StoreProductEntity {
    @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'store_products_pkey' })
    id: string;

    @ManyToOne(() => ProductEntity, p => p.storeProducts, { onDelete: 'CASCADE' })
    @JoinColumn({
        name: 'productId',
        referencedColumnName: 'id',
        foreignKeyConstraintName: 'store_products_product_id_fkey'
    })
    product: ProductEntity;

    @Column({ type: 'enum', enum: StoreType })
    type: StoreType;

    @Column({ type: 'jsonb' })
    data: string;
}

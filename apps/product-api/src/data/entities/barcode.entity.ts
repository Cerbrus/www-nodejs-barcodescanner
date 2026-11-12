import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ProductEntity } from './product.entity';

@Entity('barcodes')
export class BarcodeEntity {
    @PrimaryColumn({ primaryKeyConstraintName: 'barcodes_pkey', type: 'varchar', length: 40 })
    barcode: string;

    @Column({ type: 'int', default: 0 })
    scanCount: number;

    @ManyToOne(() => ProductEntity, (p) => p.barcodes, { onDelete: 'CASCADE' })
    @JoinColumn({
        name: 'productId',
        referencedColumnName: 'id',
        foreignKeyConstraintName: 'barcodes_product_id_fkey'
    })
    product: ProductEntity;
}

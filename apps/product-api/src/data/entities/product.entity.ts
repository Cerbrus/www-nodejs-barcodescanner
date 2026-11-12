import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BarcodeEntity } from './barcode.entity';
import { StoreProductEntity } from './store-product.entity';

@Entity('products')
export class ProductEntity {
    @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'products_pkey' })
    id: string;

    @Column()
    genericName: string;

    @OneToMany(() => BarcodeEntity, (barcode) => barcode.product, { cascade: true })
    barcodes: Array<BarcodeEntity>;

    @OneToMany(() => StoreProductEntity, (stroreProduct) => stroreProduct.product, { cascade: true })
    storeProducts: Array<StoreProductEntity>;
}

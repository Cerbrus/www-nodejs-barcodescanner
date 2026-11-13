import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { CatalogItemEntity } from './catalog-item.entity';
import { ProductSuggestion } from './product-suggestion';

@Entity('barcode')
export class BarcodeEntity {
    @PrimaryColumn({ type: 'varchar' })
    public code: string;

    @Column({ type: 'integer', nullable: true })
    public catalogItemId?: number | null;

    @ManyToOne(() => CatalogItemEntity, (item) => item.barcodes, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'catalog_item_id' })
    public catalogItem?: CatalogItemEntity | null;

    @Column({ type: 'simple-json', nullable: true })
    public suggestions?: Array<ProductSuggestion>;

    @Column({ type: 'simple-json', nullable: true })
    public lookupFailed?: Array<string>;

    @Column({ type: 'integer', default: 0 })
    public scanCount: number;

    @Column({ type: 'datetime', nullable: true })
    public lastScannedAt?: Date;
}

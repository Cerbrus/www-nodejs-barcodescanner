import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

import { ProductSuggestion } from '../connectors/connector.model';

export type ListState = 'to_buy' | 'recent';
export type ScanSource = 'handheld' | 'phone';
export type ScanResult = 'added' | 'incremented' | 'needs_name' | 'ignored';

@Entity('section')
export class SectionEntity {
    @PrimaryColumn({ type: 'varchar' })
    public id: string;

    @Column({ type: 'varchar' })
    public name: string;

    @Column({ type: 'integer' })
    public sortOrder: number;

    @Column({ type: 'varchar', nullable: true })
    public emoji?: string;
}

@Entity('catalog_item')
export class CatalogItemEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({ type: 'varchar', unique: true })
    public name: string;

    @Column({ type: 'varchar' })
    public sectionId: string;

    @ManyToOne(() => SectionEntity)
    @JoinColumn({ name: 'section_id' })
    public section?: SectionEntity;

    @Column({ type: 'text', nullable: true })
    public icon?: string;

    @Column({ type: 'text', nullable: true })
    public emoji?: string;

    @Column({ type: 'boolean', default: false })
    public custom: boolean;

    @OneToMany(() => BarcodeEntity, (barcode) => barcode.catalogItem)
    public barcodes?: Array<BarcodeEntity>;
}

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

    @Column({ type: 'integer', default: 0 })
    public scanCount: number;

    @Column({ type: 'datetime', nullable: true })
    public lastScannedAt?: Date;
}

@Entity('list_entry')
export class ListEntryEntity {
    @PrimaryColumn({ type: 'integer' })
    public catalogItemId: number;

    @OneToOne(() => CatalogItemEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'catalog_item_id' })
    public catalogItem?: CatalogItemEntity;

    @Column({ type: 'varchar' })
    public state: ListState;

    @Column({ type: 'integer', default: 0 })
    public quantity: number;

    @Column({ type: 'text', default: '' })
    public note: string;

    @Column({ type: 'datetime' })
    public updatedAt: Date;
}

@Entity('scan')
export class ScanEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({ type: 'varchar' })
    public code: string;

    @Column({ type: 'varchar' })
    public source: ScanSource;

    @Column({ type: 'varchar' })
    public result: ScanResult;

    @Column({ type: 'datetime' })
    public createdAt: Date;

    @Column({ type: 'datetime', nullable: true })
    public undoneAt?: Date | null;

    @Column({ type: 'integer', nullable: true })
    public catalogItemId?: number | null;

    @Column({ type: 'varchar', nullable: true })
    public previousState?: ListState | null;

    @Column({ type: 'integer', nullable: true })
    public previousQuantity?: number | null;
}

export const Entities = [SectionEntity, CatalogItemEntity, BarcodeEntity, ListEntryEntity, ScanEntity];

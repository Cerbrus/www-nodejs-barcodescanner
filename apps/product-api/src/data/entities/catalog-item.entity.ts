import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { BarcodeEntity } from './barcode.entity';
import { SectionEntity } from './section.entity';

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

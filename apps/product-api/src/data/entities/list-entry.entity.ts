import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { CatalogItemEntity } from './catalog-item.entity';
import { ListState } from './types';

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

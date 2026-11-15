import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';

import { CatalogItemEntity } from './catalog-item.entity';
import { ListState } from './types';

@Entity('list_entry')
@Unique('uq_list_entry_variant', ['catalogItemId', 'note'])
export class ListEntryEntity {
    @PrimaryColumn({ type: 'varchar' })
    public id: string;

    @Column({ type: 'integer' })
    public catalogItemId: number;

    @ManyToOne(() => CatalogItemEntity, { onDelete: 'CASCADE' })
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

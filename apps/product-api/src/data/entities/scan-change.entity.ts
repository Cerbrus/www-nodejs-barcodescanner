import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { ListState } from '@barcodescanner/shared';

import { ScanEntity } from './scan.entity';

@Entity('scan_change')
export class ScanChangeEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({ type: 'integer' })
    public scanId: number;

    @ManyToOne(() => ScanEntity, (scan) => scan.changes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'scan_id' })
    public scan?: ScanEntity;

    @Column({ type: 'integer' })
    public catalogItemId: number;

    @Column({ type: 'text', default: '' })
    public note: string;

    @Column({ type: 'integer' })
    public quantity: number;

    @Column({ type: 'varchar', nullable: true })
    public previousState?: ListState | null;

    @Column({ type: 'integer', nullable: true })
    public previousQuantity?: number | null;
}

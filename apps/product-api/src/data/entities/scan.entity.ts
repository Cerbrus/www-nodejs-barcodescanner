import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { ListState, ScanResult, ScanSource } from './types';

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

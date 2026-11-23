import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ListState, ScanResult, ScanSource } from '@barcodescanner/shared';

import { ScanChangeEntity } from './scan-change.entity';

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

    @Column({ type: 'text', nullable: true })
    public note?: string | null;

    @Column({ type: 'varchar', nullable: true })
    public previousState?: ListState | null;

    @Column({ type: 'integer', nullable: true })
    public previousQuantity?: number | null;

    @Column({ type: 'text', nullable: true })
    public title?: string | null;

    @OneToMany(() => ScanChangeEntity, (change) => change.scan)
    public changes?: Array<ScanChangeEntity>;
}

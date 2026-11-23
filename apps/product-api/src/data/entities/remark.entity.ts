import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { RemarkContext, RemarkKind, RemarkTarget } from '@barcodescanner/shared';

@Entity('remark')
export class RemarkEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({ type: 'varchar' })
    public kind: RemarkKind;

    @Column({ type: 'text' })
    public text: string;

    @Column({ type: 'varchar', default: 'open' })
    public state: 'open' | 'closed' | 'rejected';

    @Column({ type: 'varchar', default: '' })
    public page: string;

    @Column({ type: 'simple-json', nullable: true })
    public target?: RemarkTarget | null;

    @Column({ type: 'simple-json', nullable: true })
    public context?: RemarkContext | null;

    @Column({ type: 'varchar' })
    public account: string;

    @Column({ type: 'datetime' })
    public createdAt: Date;

    @Column({ type: 'datetime', nullable: true })
    public closedAt?: Date | null;

    @Column({ type: 'integer', nullable: true })
    public issueNumber?: number | null;

    @Column({ type: 'varchar', nullable: true })
    public issueUrl?: string | null;
}

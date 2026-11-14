import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface RemarkTargetData {
    component?: string;
    label?: string;
    text?: string;
    path?: string;
}

export interface RemarkContextData {
    version?: string;
    commit?: string;
    userAgent?: string;
    viewport?: string;
    language?: string;
    theme?: string;
    installed?: boolean;
    online?: boolean;
    waitingChanges?: number;
    recentMessages?: Array<string>;
}

@Entity('remark')
export class RemarkEntity {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({ type: 'varchar' })
    public kind: 'bug' | 'wish' | 'note';

    @Column({ type: 'text' })
    public text: string;

    @Column({ type: 'varchar', default: 'open' })
    public state: 'open' | 'closed';

    @Column({ type: 'varchar', default: '' })
    public page: string;

    @Column({ type: 'simple-json', nullable: true })
    public target?: RemarkTargetData | null;

    @Column({ type: 'simple-json', nullable: true })
    public context?: RemarkContextData | null;

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

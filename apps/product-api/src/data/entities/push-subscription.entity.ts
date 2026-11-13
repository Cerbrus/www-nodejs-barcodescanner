import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('push_subscription')
export class PushSubscriptionEntity {
    @PrimaryColumn({ type: 'varchar' })
    public endpoint: string;

    @Column({ type: 'varchar' })
    public p256dh: string;

    @Column({ type: 'varchar' })
    public auth: string;

    @Column({ type: 'varchar', default: 'nl' })
    public language: string;

    @Column({ type: 'varchar', nullable: true })
    public origin?: string;

    @Column({ type: 'datetime' })
    public createdAt: Date;
}

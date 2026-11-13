import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('feedback_setting')
export class FeedbackSettingEntity {
    @PrimaryColumn({ type: 'varchar' })
    public event: string;

    @Column({ type: 'varchar' })
    public soundId: string;
}

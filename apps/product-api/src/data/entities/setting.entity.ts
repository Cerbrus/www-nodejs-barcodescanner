import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('setting')
export class SettingEntity {
    @PrimaryColumn({ type: 'varchar' })
    public key: string;

    @Column({ type: 'text' })
    public value: string;
}

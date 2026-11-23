import { Column, Entity, PrimaryColumn } from 'typeorm';

import { SoundBlock } from '@barcodescanner/shared';

@Entity('sound')
export class SoundEntity {
    @PrimaryColumn({ type: 'varchar' })
    public id: string;

    @Column({ type: 'text', nullable: true })
    public name?: string | null;

    @Column({ type: 'simple-json' })
    public blocks: Array<SoundBlock>;

    @Column({ type: 'datetime' })
    public createdAt: Date;
}

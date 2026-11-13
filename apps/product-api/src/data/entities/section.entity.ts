import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('section')
export class SectionEntity {
    @PrimaryColumn({ type: 'varchar' })
    public id: string;

    @Column({ type: 'varchar' })
    public name: string;

    @Column({ type: 'integer' })
    public sortOrder: number;

    @Column({ type: 'varchar', nullable: true })
    public emoji?: string;
}

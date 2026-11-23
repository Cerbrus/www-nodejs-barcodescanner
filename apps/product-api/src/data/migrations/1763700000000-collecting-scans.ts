import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollectingScans1763700000000 implements MigrationInterface {
    public name = 'CollectingScans1763700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scan" ADD COLUMN "collecting" boolean NOT NULL DEFAULT (0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "scan" DROP COLUMN "collecting"');
    }
}

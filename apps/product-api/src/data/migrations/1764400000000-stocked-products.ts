import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockedProducts1764400000000 implements MigrationInterface {
    public name = 'StockedProducts1764400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "catalog_item" ADD COLUMN "stocked" boolean NOT NULL DEFAULT (0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "catalog_item" DROP COLUMN "stocked"');
    }
}

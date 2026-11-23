import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShoppingMode1763700000000 implements MigrationInterface {
    public name = 'ShoppingMode1763700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "setting" (
                "key" varchar PRIMARY KEY NOT NULL,
                "value" text NOT NULL
            )
        `);
        await queryRunner.query(`ALTER TABLE "scan" ADD COLUMN "collecting" boolean NOT NULL DEFAULT (0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "scan" DROP COLUMN "collecting"');
        await queryRunner.query('DROP TABLE "setting"');
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecipeSourceUrl1764200000000 implements MigrationInterface {
    public name = 'RecipeSourceUrl1764200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe" ADD COLUMN "source_url" varchar NOT NULL DEFAULT ('')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "recipe" DROP COLUMN "source_url"');
    }
}

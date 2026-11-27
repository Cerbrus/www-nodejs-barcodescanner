import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecipeCategory1764100000000 implements MigrationInterface {
    public name = 'RecipeCategory1764100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe" ADD COLUMN "category" varchar NOT NULL DEFAULT ('other')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "recipe" DROP COLUMN "category"');
    }
}

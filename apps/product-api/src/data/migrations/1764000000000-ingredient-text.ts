import { MigrationInterface, QueryRunner } from 'typeorm';

export class IngredientText1764000000000 implements MigrationInterface {
    public name = 'IngredientText1764000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_ingredient" ADD COLUMN "text" text NOT NULL DEFAULT ('')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "recipe_ingredient" DROP COLUMN "text"');
    }
}

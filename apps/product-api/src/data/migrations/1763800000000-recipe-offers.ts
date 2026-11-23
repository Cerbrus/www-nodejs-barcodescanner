import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecipeOffers1763800000000 implements MigrationInterface {
    public name = 'RecipeOffers1763800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "recipe_offer" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "code" text NOT NULL,
                "name" varchar NOT NULL,
                "created_at" datetime NOT NULL,
                CONSTRAINT "uq_recipe_offer_code" UNIQUE ("code")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "recipe_offer"');
    }
}

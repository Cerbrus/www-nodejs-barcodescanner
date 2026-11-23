import { MigrationInterface, QueryRunner } from 'typeorm';

export class Recipes1763600000000 implements MigrationInterface {
    public name = 'Recipes1763600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "recipe" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "name" varchar NOT NULL,
                "description" text NOT NULL DEFAULT (''),
                "created_at" datetime NOT NULL,
                "updated_at" datetime NOT NULL,
                CONSTRAINT "uq_recipe_name" UNIQUE ("name")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "recipe_ingredient" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "recipe_id" integer NOT NULL,
                "catalog_item_id" integer NOT NULL,
                "quantity" integer NOT NULL DEFAULT (1),
                "note" text NOT NULL DEFAULT (''),
                "position" integer NOT NULL,
                CONSTRAINT "uq_recipe_ingredient_variant" UNIQUE ("recipe_id", "catalog_item_id", "note"),
                CONSTRAINT "fk_recipe_ingredient_recipe" FOREIGN KEY ("recipe_id")
                    REFERENCES "recipe" ("id") ON DELETE CASCADE,
                CONSTRAINT "fk_recipe_ingredient_catalog_item" FOREIGN KEY ("catalog_item_id")
                    REFERENCES "catalog_item" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_recipe_ingredient_catalog_item" ON "recipe_ingredient" ("catalog_item_id")`
        );
        await queryRunner.query(`
            CREATE TABLE "scan_change" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "scan_id" integer NOT NULL,
                "catalog_item_id" integer NOT NULL,
                "note" text NOT NULL DEFAULT (''),
                "quantity" integer NOT NULL,
                "previous_state" varchar,
                "previous_quantity" integer,
                CONSTRAINT "fk_scan_change_scan" FOREIGN KEY ("scan_id") REFERENCES "scan" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_scan_change_scan" ON "scan_change" ("scan_id")`);
        await queryRunner.query('ALTER TABLE "scan" ADD COLUMN "title" text');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "scan" DROP COLUMN "title"');
        await queryRunner.query('DROP TABLE "scan_change"');
        await queryRunner.query('DROP TABLE "recipe_ingredient"');
        await queryRunner.query('DROP TABLE "recipe"');
    }
}

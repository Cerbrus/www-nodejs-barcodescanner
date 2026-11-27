import { MigrationInterface, QueryRunner } from 'typeorm';

const COLUMNS = '"id", "recipe_id", "catalog_item_id", "quantity", "note", "position"';

export class DraftProducts1763900000000 implements MigrationInterface {
    public name = 'DraftProducts1763900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "catalog_item" ADD COLUMN "draft" boolean NOT NULL DEFAULT (0)`);
        await this.rebuildIngredients(queryRunner, 'RESTRICT');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await this.rebuildIngredients(queryRunner, 'CASCADE');
        await queryRunner.query('ALTER TABLE "catalog_item" DROP COLUMN "draft"');
    }

    private async rebuildIngredients(queryRunner: QueryRunner, onProductDelete: 'RESTRICT' | 'CASCADE'): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "recipe_ingredient_new" (
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
                    REFERENCES "catalog_item" ("id") ON DELETE ${onProductDelete}
            )
        `);
        await queryRunner.query(
            `INSERT INTO "recipe_ingredient_new" (${COLUMNS}) SELECT ${COLUMNS} FROM "recipe_ingredient"`
        );
        await queryRunner.query('DROP TABLE "recipe_ingredient"');
        await queryRunner.query('ALTER TABLE "recipe_ingredient_new" RENAME TO "recipe_ingredient"');
        await queryRunner.query(
            `CREATE INDEX "idx_recipe_ingredient_catalog_item" ON "recipe_ingredient" ("catalog_item_id")`
        );
    }
}

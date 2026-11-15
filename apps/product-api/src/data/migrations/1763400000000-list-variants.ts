import { MigrationInterface, QueryRunner } from 'typeorm';

export class ListVariants1763400000000 implements MigrationInterface {
    public name = 'ListVariants1763400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "list_entry_new" (
                "id" varchar PRIMARY KEY NOT NULL,
                "catalog_item_id" integer NOT NULL,
                "note" text NOT NULL DEFAULT (''),
                "state" varchar NOT NULL,
                "quantity" integer NOT NULL DEFAULT (0),
                "updated_at" datetime NOT NULL,
                CONSTRAINT "uq_list_entry_variant" UNIQUE ("catalog_item_id", "note"),
                CONSTRAINT "fk_list_entry_catalog_item" FOREIGN KEY ("catalog_item_id")
                    REFERENCES "catalog_item" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            INSERT INTO "list_entry_new" ("id", "catalog_item_id", "note", "state", "quantity", "updated_at")
            SELECT lower(hex(randomblob(16))), "catalog_item_id", trim("note"), "state", "quantity", "updated_at"
            FROM "list_entry"
        `);
        await queryRunner.query('DROP TABLE "list_entry"');
        await queryRunner.query('ALTER TABLE "list_entry_new" RENAME TO "list_entry"');
        await queryRunner.query(`ALTER TABLE "barcode" ADD COLUMN "note" text NOT NULL DEFAULT ('')`);
        await queryRunner.query('ALTER TABLE "scan" ADD COLUMN "note" text');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "scan" DROP COLUMN "note"');
        await queryRunner.query('ALTER TABLE "barcode" DROP COLUMN "note"');
        await queryRunner.query(`
            CREATE TABLE "list_entry_old" (
                "catalog_item_id" integer PRIMARY KEY NOT NULL,
                "state" varchar NOT NULL,
                "quantity" integer NOT NULL DEFAULT (0),
                "note" text NOT NULL DEFAULT (''),
                "updated_at" datetime NOT NULL,
                CONSTRAINT "fk_list_entry_catalog_item" FOREIGN KEY ("catalog_item_id")
                    REFERENCES "catalog_item" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            INSERT INTO "list_entry_old" ("catalog_item_id", "state", "quantity", "note", "updated_at")
            SELECT "catalog_item_id", "state", "quantity", "note", "updated_at" FROM "list_entry" AS "entry"
            WHERE "entry"."id" = (
                SELECT "latest"."id" FROM "list_entry" AS "latest"
                WHERE "latest"."catalog_item_id" = "entry"."catalog_item_id"
                ORDER BY "latest"."state" = 'to_buy' DESC, "latest"."updated_at" DESC
                LIMIT 1
            )
        `);
        await queryRunner.query('DROP TABLE "list_entry"');
        await queryRunner.query('ALTER TABLE "list_entry_old" RENAME TO "list_entry"');
    }
}

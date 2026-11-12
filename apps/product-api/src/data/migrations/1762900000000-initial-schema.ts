import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1762900000000 implements MigrationInterface {
    public name = 'InitialSchema1762900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "section" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" varchar NOT NULL,
                "sort_order" integer NOT NULL,
                "emoji" varchar
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "catalog_item" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "name" varchar NOT NULL,
                "section_id" varchar NOT NULL,
                "icon" text,
                "emoji" text,
                "custom" boolean NOT NULL DEFAULT (0),
                CONSTRAINT "uq_catalog_item_name" UNIQUE ("name"),
                CONSTRAINT "fk_catalog_item_section" FOREIGN KEY ("section_id") REFERENCES "section" ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "barcode" (
                "code" varchar PRIMARY KEY NOT NULL,
                "catalog_item_id" integer,
                "suggestions" text,
                "scan_count" integer NOT NULL DEFAULT (0),
                "last_scanned_at" datetime,
                CONSTRAINT "fk_barcode_catalog_item" FOREIGN KEY ("catalog_item_id")
                    REFERENCES "catalog_item" ("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "list_entry" (
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
            CREATE TABLE "scan" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "code" varchar NOT NULL,
                "source" varchar NOT NULL,
                "result" varchar NOT NULL,
                "created_at" datetime NOT NULL,
                "undone_at" datetime,
                "catalog_item_id" integer,
                "previous_state" varchar,
                "previous_quantity" integer
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_scan_created_at" ON "scan" ("created_at")`);
        await queryRunner.query(`CREATE INDEX "idx_scan_code" ON "scan" ("code")`);
        await queryRunner.query(`CREATE INDEX "idx_barcode_catalog_item" ON "barcode" ("catalog_item_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "scan"`);
        await queryRunner.query(`DROP TABLE "list_entry"`);
        await queryRunner.query(`DROP TABLE "barcode"`);
        await queryRunner.query(`DROP TABLE "catalog_item"`);
        await queryRunner.query(`DROP TABLE "section"`);
    }
}

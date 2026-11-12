import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSetup1760897692333 implements MigrationInterface {
    name = 'InitialSetup1760897692333'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."store_products_type_enum" AS ENUM('AH', 'Lidl', 'Jumbo', 'Dirk', 'Aldi')`);
        await queryRunner.query(`CREATE TABLE "store_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."store_products_type_enum" NOT NULL, "data" jsonb NOT NULL, "productId" uuid, CONSTRAINT "store_products_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "generic_name" character varying NOT NULL, CONSTRAINT "products_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "barcodes" ("barcode" character varying(40) NOT NULL, "scan_count" integer NOT NULL DEFAULT '0', "productId" uuid, CONSTRAINT "barcodes_pkey" PRIMARY KEY ("barcode"))`);
        await queryRunner.query(`ALTER TABLE "store_products" ADD CONSTRAINT "store_products_product_id_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_product_id_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "barcodes" DROP CONSTRAINT "barcodes_product_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "store_products" DROP CONSTRAINT "store_products_product_id_fkey"`);
        await queryRunner.query(`DROP TABLE "barcodes"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TABLE "store_products"`);
        await queryRunner.query(`DROP TYPE "public"."store_products_type_enum"`);
    }

}

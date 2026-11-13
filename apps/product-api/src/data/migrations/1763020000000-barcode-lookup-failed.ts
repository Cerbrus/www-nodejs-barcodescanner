import { MigrationInterface, QueryRunner } from 'typeorm';

export class BarcodeLookupFailed1763020000000 implements MigrationInterface {
    public name = 'BarcodeLookupFailed1763020000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "barcode" ADD COLUMN "lookup_failed" text');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "barcode" DROP COLUMN "lookup_failed"');
    }
}

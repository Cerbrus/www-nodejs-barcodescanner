import { MigrationInterface, QueryRunner } from 'typeorm';

export class Remark1763200000000 implements MigrationInterface {
    public name = 'Remark1763200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "remark" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "kind" varchar NOT NULL,
                "text" text NOT NULL,
                "state" varchar NOT NULL DEFAULT ('open'),
                "page" varchar NOT NULL DEFAULT (''),
                "target" text,
                "context" text,
                "account" varchar NOT NULL,
                "created_at" datetime NOT NULL,
                "closed_at" datetime,
                "issue_number" integer,
                "issue_url" varchar
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_remark_account_created_at" ON "remark" ("account", "created_at")`);
        await queryRunner.query(`ALTER TABLE "push_subscription" ADD COLUMN "account" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "push_subscription" DROP COLUMN "account"`);
        await queryRunner.query('DROP INDEX "idx_remark_account_created_at"');
        await queryRunner.query('DROP TABLE "remark"');
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushOrigin1763000000000 implements MigrationInterface {
    public name = 'PushOrigin1763000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "push_subscription" ADD COLUMN "origin" varchar');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "push_subscription" DROP COLUMN "origin"');
    }
}

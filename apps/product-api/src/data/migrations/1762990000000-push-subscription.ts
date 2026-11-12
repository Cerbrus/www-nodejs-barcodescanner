import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushSubscription1762990000000 implements MigrationInterface {
    public name = 'PushSubscription1762990000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "push_subscription" (
                "endpoint" varchar PRIMARY KEY NOT NULL,
                "p256dh" varchar NOT NULL,
                "auth" varchar NOT NULL,
                "language" varchar NOT NULL DEFAULT ('nl'),
                "created_at" datetime NOT NULL
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "push_subscription"');
    }
}

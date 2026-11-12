import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackSetting1763010000000 implements MigrationInterface {
    public name = 'FeedbackSetting1763010000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "feedback_setting" (
                "event" varchar PRIMARY KEY NOT NULL,
                "sound_id" varchar NOT NULL
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "feedback_setting"');
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecipePicture1764300000000 implements MigrationInterface {
    public name = 'RecipePicture1764300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe" ADD COLUMN "picture" varchar NOT NULL DEFAULT ('')`);
        await queryRunner.query(`ALTER TABLE "recipe" ADD COLUMN "picture_source" varchar NOT NULL DEFAULT ('')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "recipe" DROP COLUMN "picture_source"');
        await queryRunner.query('ALTER TABLE "recipe" DROP COLUMN "picture"');
    }
}

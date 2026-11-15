import { MigrationInterface, QueryRunner } from 'typeorm';

const EMOJIS: Array<[string, string]> = [
    ['Vijgen', '🍇'],
    ['Kaneel', '🪵'],
    ['Tofu', '🧈'],
    ['Aluminium Folie', '🥡'],
    ['Vershoudfolie', '🫙'],
    ['Condooms', '🎈'],
    ['Wattenschijfjes', '⚪'],
    ['Wattenstaafjes', '🦴']
];

export class MissingEmojis1763300000000 implements MigrationInterface {
    public name = 'MissingEmojis1763300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const [name, emoji] of EMOJIS) {
            await queryRunner.query(
                `UPDATE "catalog_item" SET "emoji" = ? WHERE "name" = ? AND ("emoji" IS NULL OR "emoji" = '')`,
                [emoji, name]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const [name, emoji] of EMOJIS) {
            await queryRunner.query(`UPDATE "catalog_item" SET "emoji" = NULL WHERE "name" = ? AND "emoji" = ?`, [
                name,
                emoji
            ]);
        }
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

const beep = (ms: number): object => ({ kind: 'beep', ms });
const pause = (ms: number): object => ({ kind: 'pause', ms });
const trill = (rate: number, ms: number): object => ({ kind: 'trill', ms, rate });
const buzz = (rate: number, ms: number): object => ({ kind: 'buzz', ms, rate });

const STARTERS: Array<[string, Array<object>]> = [
    ['tick', [beep(20)]],
    ['blip', [beep(50)]],
    ['beep', [beep(80)]],
    ['long', [beep(450)]],
    ['double', [beep(60), pause(70), beep(60)]],
    ['triple', [beep(80), pause(70), beep(80), pause(70), beep(80)]],
    ['longShort', [beep(300), pause(60), beep(60)]],
    ['shortShortLong', [beep(60), pause(60), beep(60), pause(60), beep(300)]],
    ['shortTrill', [trill(20, 300)]],
    ['trill8', [trill(8, 900)]],
    ['rough500', [buzz(500, 600)]]
];

export class SoundPresets1763500000000 implements MigrationInterface {
    public name = 'SoundPresets1763500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "sound" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" text,
                "blocks" text NOT NULL,
                "created_at" datetime NOT NULL
            )
        `);
        const start = Date.parse('2026-11-15T00:00:00.000Z');
        for (const [index, [id, blocks]] of STARTERS.entries()) {
            await queryRunner.query(
                'INSERT INTO "sound" ("id", "name", "blocks", "created_at") VALUES (?, NULL, ?, ?)',
                [
                    id,
                    JSON.stringify(blocks),
                    new Date(start + index * 1000).toISOString().replace('T', ' ').replace('Z', '')
                ]
            );
        }
        const kept = STARTERS.map(() => '?').join(', ');
        await queryRunner.query(
            `DELETE FROM "feedback_setting" WHERE "sound_id" <> 'none' AND "sound_id" NOT IN (${kept})`,
            STARTERS.map(([id]) => id)
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "sound"');
    }
}

import 'reflect-metadata';

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { DataSource, DataSourceOptions } from 'typeorm';

import { databaseOptions } from '../data/database';
import { MissingEmojis1763300000000 } from '../data/migrations/1763300000000-missing-emojis';
import { ListVariants1763400000000 } from '../data/migrations/1763400000000-list-variants';
import { SoundPresets1763500000000 } from '../data/migrations/1763500000000-sound-presets';

const folder = mkdtempSync(join(tmpdir(), 'barcodescanner-migrations-'));

describe('migrations', () => {
    let database: DataSource;

    const emojiOf = async (name: string): Promise<string | null> =>
        (
            (await database.query('SELECT "emoji" FROM "catalog_item" WHERE "name" = ?', [name])) as Array<{
                emoji: string | null;
            }>
        )[0].emoji;

    before(async () => {
        database = new DataSource(databaseOptions(join(folder, 'migrations.db')) as DataSourceOptions);
        await database.initialize();
        await database.runMigrations();
        await database.query(
            `INSERT INTO "section" ("id", "name", "sort_order") VALUES ('huishouden', 'Huishouden', 1)`
        );
        await database.query(
            `INSERT INTO "catalog_item" ("name", "section_id", "emoji") VALUES ('Tofu', 'huishouden', NULL), ('Kaneel', 'huishouden', '🍂'), ('Condooms', 'huishouden', '')`
        );
    });

    after(async () => {
        await database.destroy();
        rmSync(folder, { recursive: true, force: true });
    });

    it('gives the products without an emoji the approved one and keeps a chosen emoji', async () => {
        const runner = database.createQueryRunner();
        await new MissingEmojis1763300000000().up(runner);
        await runner.release();

        assert.equal(await emojiOf('Tofu'), '🧈');
        assert.equal(await emojiOf('Condooms'), '🎈');
        assert.equal(await emojiOf('Kaneel'), '🍂');
    });

    it('takes only its own emojis back', async () => {
        const runner = database.createQueryRunner();
        await new MissingEmojis1763300000000().down(runner);
        await runner.release();

        assert.equal(await emojiOf('Tofu'), null);
        assert.equal(await emojiOf('Kaneel'), '🍂');
    });

    it('gives every list entry its own id and trims its note, and goes back to one entry per product', async () => {
        const runner = database.createQueryRunner();
        await new ListVariants1763400000000().down(runner);
        await database.query(
            `INSERT INTO "list_entry" ("catalog_item_id", "state", "quantity", "note", "updated_at")
            SELECT "id", 'to_buy', 2, ' extra ', '2026-11-15 12:00:00' FROM "catalog_item" WHERE "name" = 'Tofu'`
        );
        await new ListVariants1763400000000().up(runner);

        const [entry] = (await database.query('SELECT "id", "note", "quantity" FROM "list_entry"')) as Array<{
            id: string;
            note: string;
            quantity: number;
        }>;
        assert.match(entry.id, /^[0-9a-f]{32}$/);
        assert.deepEqual([entry.note, entry.quantity], ['extra', 2]);
        await database.query(
            `INSERT INTO "list_entry" ("id", "catalog_item_id", "state", "quantity", "note", "updated_at")
            SELECT 'second', "catalog_item_id", 'recent', 0, 'ander', '2026-11-15 13:00:00' FROM "list_entry"`
        );
        await assert.rejects(
            database.query(
                `INSERT INTO "list_entry" ("id", "catalog_item_id", "state", "quantity", "note", "updated_at")
                SELECT 'third', "catalog_item_id", 'recent', 0, 'ander', '2026-11-15 13:00:00' FROM "list_entry" LIMIT 1`
            )
        );
        assert.deepEqual(await database.query('SELECT "note" FROM "barcode"'), []);

        await new ListVariants1763400000000().down(runner);
        assert.deepEqual(await database.query('SELECT "note", "quantity" FROM "list_entry"'), [
            { note: 'extra', quantity: 2 }
        ]);
        await new ListVariants1763400000000().up(runner);
        await runner.release();
    });

    it('fills the starting sounds and drops settings that point to a sound that is gone', async () => {
        const runner = database.createQueryRunner();
        await new SoundPresets1763500000000().down(runner);
        await database.query(
            `INSERT INTO "feedback_setting" ("event", "sound_id") VALUES ('added', 'soft5'), ('error', 'trill8'), ('ignored', 'none')`
        );
        await new SoundPresets1763500000000().up(runner);
        await runner.release();

        const sounds = (await database.query('SELECT "id", "blocks" FROM "sound" ORDER BY "created_at"')) as Array<{
            id: string;
            blocks: string;
        }>;
        assert.equal(sounds.length, 11);
        assert.deepEqual(JSON.parse(sounds.find((sound) => sound.id === 'trill8')?.blocks ?? '[]'), [
            { kind: 'trill', ms: 900, rate: 8 }
        ]);
        assert.deepEqual(await database.query('SELECT "event", "sound_id" FROM "feedback_setting" ORDER BY "event"'), [
            { event: 'error', sound_id: 'trill8' },
            { event: 'ignored', sound_id: 'none' }
        ]);
    });
});

import 'reflect-metadata';

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { DataSource, DataSourceOptions } from 'typeorm';

import { databaseOptions } from '../data/database';
import { MissingEmojis1763300000000 } from '../data/migrations/1763300000000-missing-emojis';

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
});

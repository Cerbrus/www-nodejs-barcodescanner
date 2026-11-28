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
import { Recipes1763600000000 } from '../data/migrations/1763600000000-recipes';
import { CollectingScans1763700000000 } from '../data/migrations/1763700000000-collecting-scans';
import { RecipeOffers1763800000000 } from '../data/migrations/1763800000000-recipe-offers';
import { DraftProducts1763900000000 } from '../data/migrations/1763900000000-draft-products';
import { IngredientText1764000000000 } from '../data/migrations/1764000000000-ingredient-text';
import { RecipeCategory1764100000000 } from '../data/migrations/1764100000000-recipe-category';
import { RecipeSourceUrl1764200000000 } from '../data/migrations/1764200000000-recipe-source-url';
import { RecipePicture1764300000000 } from '../data/migrations/1764300000000-recipe-picture';
import { StockedProducts1764400000000 } from '../data/migrations/1764400000000-stocked-products';

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

    it('adds the draft mark of a product and keeps a product that a recipe uses, and takes both away again', async () => {
        const columns = async (): Promise<Array<string>> =>
            ((await database.query('PRAGMA table_info("catalog_item")')) as Array<{ name: string }>).map(
                ({ name }) => name
            );
        const useVanilla = async (): Promise<void> => {
            await database.query(`INSERT INTO "catalog_item" ("name", "section_id") VALUES ('Vanille', 'huishouden')`);
            await database.query(
                `INSERT INTO "recipe" ("name", "created_at", "updated_at") VALUES ('Taart', '2026-11-27 12:00:00', '2026-11-27 12:00:00')`
            );
            await database.query(
                `INSERT INTO "recipe_ingredient" ("recipe_id", "catalog_item_id", "position")
                SELECT "recipe"."id", "catalog_item"."id", 0 FROM "recipe", "catalog_item"
                WHERE "recipe"."name" = 'Taart' AND "catalog_item"."name" = 'Vanille'`
            );
        };
        const deleteVanilla = `DELETE FROM "catalog_item" WHERE "name" = 'Vanille'`;
        const ingredients = (): Promise<Array<{ id: number }>> =>
            database.query('SELECT "id" FROM "recipe_ingredient"');

        const ingredientColumns = async (): Promise<Array<string>> =>
            ((await database.query('PRAGMA table_info("recipe_ingredient")')) as Array<{ name: string }>).map(
                ({ name }) => name
            );

        await useVanilla();
        const runner = database.createQueryRunner();
        await new IngredientText1764000000000().down(runner);
        assert.ok(!(await ingredientColumns()).includes('text'));
        await new DraftProducts1763900000000().down(runner);
        assert.ok(!(await columns()).includes('draft'));
        assert.equal((await ingredients()).length, 1);
        await new DraftProducts1763900000000().up(runner);
        await new IngredientText1764000000000().up(runner);
        await runner.release();

        assert.ok((await ingredientColumns()).includes('text'));
        assert.deepEqual(await database.query('SELECT "text" FROM "recipe_ingredient"'), [{ text: '' }]);

        assert.ok((await columns()).includes('draft'));
        assert.equal((await ingredients()).length, 1);
        await assert.rejects(database.query(deleteVanilla));
        await database.query(`DELETE FROM "recipe" WHERE "name" = 'Taart'`);
        assert.deepEqual(await ingredients(), []);
        await database.query(deleteVanilla);
    });

    it('files every recipe under other and gives it an empty source link, and takes both columns away again', async () => {
        const columns = async (): Promise<Array<string>> =>
            ((await database.query('PRAGMA table_info("recipe")')) as Array<{ name: string }>).map(({ name }) => name);
        const soup = '1. Roer.\n\n[example.com](https://example.com/soep)';
        const runner = database.createQueryRunner();
        await new RecipeSourceUrl1764200000000().down(runner);
        await new RecipeCategory1764100000000().down(runner);

        assert.ok(!(await columns()).some((name) => name === 'category' || name === 'source_url'));

        await database.query(
            'INSERT INTO "recipe" ("name", "description", "created_at", "updated_at") VALUES (?, ?, ?, ?)',
            ['Soep', soup, '2026-11-27 20:00:00', '2026-11-27 20:00:00']
        );
        await new RecipeCategory1764100000000().up(runner);
        await new RecipeSourceUrl1764200000000().up(runner);
        await runner.release();

        assert.deepEqual(await database.query('SELECT "description", "category", "source_url" FROM "recipe"'), [
            { description: soup, category: 'other', source_url: '' }
        ]);
        await database.query('DELETE FROM "recipe"');
    });

    it('marks no product as always in the house, and takes the column away again', async () => {
        const columns = async (): Promise<Array<string>> =>
            ((await database.query('PRAGMA table_info("catalog_item")')) as Array<{ name: string }>).map(
                ({ name }) => name
            );
        const runner = database.createQueryRunner();
        await new StockedProducts1764400000000().down(runner);

        assert.ok(!(await columns()).includes('stocked'));

        await new StockedProducts1764400000000().up(runner);
        await runner.release();

        assert.deepEqual(await database.query('SELECT DISTINCT "stocked" FROM "catalog_item"'), [{ stocked: 0 }]);
    });

    it('gives every recipe an empty picture and picture source, and takes both columns away again', async () => {
        const columns = async (): Promise<Array<string>> =>
            ((await database.query('PRAGMA table_info("recipe")')) as Array<{ name: string }>).map(({ name }) => name);
        const runner = database.createQueryRunner();
        await new RecipePicture1764300000000().down(runner);

        assert.ok(!(await columns()).some((name) => name === 'picture' || name === 'picture_source'));

        await database.query('INSERT INTO "recipe" ("name", "created_at", "updated_at") VALUES (?, ?, ?)', [
            'Soep',
            '2026-11-28 00:00:00',
            '2026-11-28 00:00:00'
        ]);
        await new RecipePicture1764300000000().up(runner);
        await runner.release();

        assert.deepEqual(await database.query('SELECT "picture", "picture_source" FROM "recipe"'), [
            { picture: '', picture_source: '' }
        ]);
        await database.query('DELETE FROM "recipe"');
    });

    it('adds the table of offered recipes, with a code only once, and takes it away again', async () => {
        const offer = `INSERT INTO "recipe_offer" ("code", "name", "created_at") VALUES ('R1;Soep;7', 'Soep', '2026-11-23 16:00:00')`;
        const runner = database.createQueryRunner();
        await new RecipeOffers1763800000000().down(runner);
        await assert.rejects(database.query(offer));
        await new RecipeOffers1763800000000().up(runner);
        await runner.release();

        await database.query(offer);
        await assert.rejects(database.query(offer));
        assert.deepEqual(await database.query('SELECT "name" FROM "recipe_offer"'), [{ name: 'Soep' }]);
    });

    it('adds the recipe tables and the title of a scan, and takes them away again', async () => {
        const tables = (): Promise<Array<{ name: string }>> =>
            database.query(
                `SELECT "name" FROM "sqlite_master" WHERE "type" = 'table' AND "name" IN ('recipe', 'recipe_ingredient', 'scan_change') ORDER BY "name"`
            );
        const insertRecipe = `INSERT INTO "recipe" ("name", "created_at", "updated_at") VALUES ('Soep', '2026-11-23 12:00:00', '2026-11-23 12:00:00')`;
        const runner = database.createQueryRunner();
        await new Recipes1763600000000().down(runner);
        assert.deepEqual(await tables(), []);
        await new Recipes1763600000000().up(runner);
        await runner.release();
        assert.deepEqual(await tables(), [{ name: 'recipe' }, { name: 'recipe_ingredient' }, { name: 'scan_change' }]);

        await database.query(insertRecipe);
        await assert.rejects(database.query(insertRecipe));
        await database.query(
            `INSERT INTO "recipe_ingredient" ("recipe_id", "catalog_item_id", "position")
            SELECT "recipe"."id", "catalog_item"."id", 0 FROM "recipe", "catalog_item" WHERE "catalog_item"."name" = 'Kaneel'`
        );
        assert.deepEqual(await database.query('SELECT "quantity", "note" FROM "recipe_ingredient"'), [
            { quantity: 1, note: '' }
        ]);
        await database.query(`DELETE FROM "catalog_item" WHERE "name" = 'Kaneel'`);
        assert.deepEqual(await database.query('SELECT "id" FROM "recipe_ingredient"'), []);
        await database.query(
            `INSERT INTO "scan" ("code", "source", "result", "created_at", "title") VALUES ('R1;Soep', 'app', 'recipe', '2026-11-23 12:00:00', 'Soep')`
        );
        assert.deepEqual(await database.query('SELECT "title" FROM "scan"'), [{ title: 'Soep' }]);
    });

    it('adds the collecting mark of a scan, and takes it away again', async () => {
        const runner = database.createQueryRunner();
        await new CollectingScans1763700000000().down(runner);
        const columns = async (): Promise<Array<string>> =>
            ((await database.query('PRAGMA table_info("scan")')) as Array<{ name: string }>).map(({ name }) => name);
        assert.ok(!(await columns()).includes('collecting'));
        await new CollectingScans1763700000000().up(runner);
        await runner.release();

        assert.ok((await columns()).includes('collecting'));
        await database.query(
            `INSERT INTO "scan" ("code", "source", "result", "created_at") VALUES ('87654321', 'phone', 'added', '2026-11-23 12:00:00')`
        );
        assert.deepEqual(await database.query(`SELECT "collecting" FROM "scan" WHERE "code" = '87654321'`), [
            { collecting: 0 }
        ]);
    });
});

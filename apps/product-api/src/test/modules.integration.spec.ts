import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';

import {
    ConflictException,
    INestApplicationContext,
    Module,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductSuggestion } from '@barcodescanner/shared';

import { AppConfig } from '../config/app.config';
import { AppConfigModule } from '../config/config.module';
import { ProductConnector } from '../core/connectors/connector.model';
import { CoreModule } from '../core/core.module';
import { DEBOUNCE_MILLISECONDS } from '../core/rules/scan-rules';
import { BarcodeService } from '../core/services/barcode.service';
import { CatalogService } from '../core/services/catalog.service';
import { ConnectorService } from '../core/services/connector.service';
import { EventsService } from '../core/services/events.service';
import { FeedbackService } from '../core/services/feedback.service';
import { Answer, GeminiService, Question } from '../core/services/gemini.service';
import { ListService } from '../core/services/list.service';
import { NamingService } from '../core/services/naming.service';
import { RecipeImportService } from '../core/services/recipe-import.service';
import { RecipeService } from '../core/services/recipe.service';
import { ScanService } from '../core/services/scan.service';
import { FeedbackSettingEntity, SoundEntity } from '../data/entities';
import { testFolder } from './test-env';

const folder = testFolder;
const CODE = '8710400335481';

@Module({ imports: [AppConfigModule, CoreModule] })
class TestModule {}

async function checkFeedbackSettings(feedback: FeedbackService): Promise<void> {
    const before = await feedback.getSettings();
    assert.equal(before.events.find((row) => row.event === 'added')?.soundId, 'beep');
    assert.equal(before.events.find((row) => row.event === 'ignored')?.soundId, 'none');

    await feedback.setSound('added', 'trill8');
    await feedback.setSound('error', 'none');
    const after = await feedback.getSettings();
    assert.equal(after.events.find((row) => row.event === 'added')?.soundId, 'trill8');
    assert.equal(after.events.find((row) => row.event === 'added')?.steps[0].kind, 'gate');
    assert.deepEqual(after.events.find((row) => row.event === 'error')?.steps, []);
    assert.equal(after.events.find((row) => row.event === 'needs_name')?.soundId, 'long');

    await assert.rejects(feedback.setSound('added', 'does-not-exist'));
}

async function checkSoundPresets(feedback: FeedbackService, events: EventsService): Promise<void> {
    const starters = (await feedback.getSettings()).sounds;
    assert.deepEqual(
        starters.map((sound) => sound.id),
        [
            'tick',
            'blip',
            'beep',
            'long',
            'double',
            'triple',
            'longShort',
            'shortShortLong',
            'shortTrill',
            'trill8',
            'rough500'
        ]
    );
    assert.deepEqual(starters.find((sound) => sound.id === 'double')?.steps, [
        { kind: 'on', seconds: 0.06 },
        { kind: 'off', seconds: 0.07 },
        { kind: 'on', seconds: 0.06 }
    ]);

    const blocks = [
        { kind: 'beep' as const, ms: 40, rate: 9 },
        { kind: 'pause' as const, ms: 50 },
        { kind: 'buzz' as const, ms: 200, rate: 300 }
    ];
    const created = (await feedback.createSound(' Fanfare ', blocks)).sounds.at(-1);
    assert.equal(created?.name, 'Fanfare');
    assert.deepEqual(created?.blocks[0], { kind: 'beep', ms: 40 });
    assert.deepEqual(created?.steps.at(-1), { kind: 'gate', hz: 300, duty: 50, seconds: 0.2 });

    const emitted: Array<string> = [];
    const watch = events.stream().subscribe((event) => emitted.push(String(event.type)));
    await feedback.setSound('needs_name', created?.id as string);
    await feedback.changeSound(created?.id as string, undefined, [{ kind: 'trill', ms: 500, rate: 12 }]);
    feedback.testBlocks([{ kind: 'beep', ms: 100 }]);
    watch.unsubscribe();
    const changed = await feedback.getSettings();
    assert.equal(changed.sounds.at(-1)?.name, 'Fanfare');
    assert.equal(changed.events.find((row) => row.event === 'needs_name')?.steps[0].hz, 12);
    assert.deepEqual(emitted, ['feedback_settings', 'feedback_settings', 'feedback']);

    await assert.rejects(feedback.deleteSound(created?.id as string), /used for needs_name/);
    await assert.rejects(feedback.deleteSound('double'), /used for incremented/);
    await assert.rejects(feedback.createSound('Te lang', [{ kind: 'beep', ms: 1010 }]), /at most 1000 ms/);
    const many = Array.from({ length: 50 }, (_, index) => ({
        kind: index % 2 ? ('pause' as const) : ('beep' as const),
        ms: 20
    }));
    const manyMade = (await feedback.createSound('Mitrailleur', many)).sounds.at(-1);
    assert.equal(manyMade?.blocks.length, 50);
    await feedback.deleteSound(manyMade?.id as string);
    await assert.rejects(feedback.createSound('Stil', [{ kind: 'pause', ms: 100 }]), /makes sound/);
    await assert.rejects(feedback.createSound('Te snel', [{ kind: 'trill', ms: 100, rate: 41 }]), /rate from 4 to 40/);
    await assert.rejects(feedback.createSound('Krom', [{ kind: 'beep', ms: 15 }]), /10 ms steps/);
    await assert.rejects(feedback.createSound('  ', [{ kind: 'beep', ms: 10 }]), /name/);

    await feedback.setSound('needs_name', 'long');
    assert.equal((await feedback.deleteSound(created?.id as string)).sounds.length, starters.length);
}

async function entryIdOf(list: ListService, catalogItemId: number, note = ''): Promise<string> {
    const entry = (await list.getEntries()).find((row) => row.catalogItemId === catalogItemId && row.note === note);
    assert.ok(entry);

    return entry.id;
}

async function checkRemoveFromList(list: ListService, catalogItemId: number): Promise<void> {
    const id = randomUUID();
    await list.change(id, { catalogItemId, note: 'om te wissen', state: 'to_buy', quantity: 2 });
    assert.equal((await list.getSnapshot(catalogItemId, 'om te wissen'))?.quantity, 2);

    await list.remove(id);
    assert.equal(await list.getSnapshot(catalogItemId, 'om te wissen'), undefined);
    assert.equal(
        (await list.getEntries()).some((entry) => entry.id === id),
        false
    );

    await list.remove(id);
}

describe('scan flow against a real database', () => {
    let app: INestApplicationContext;
    let scans: ScanService;
    let catalog: CatalogService;
    let barcodes: BarcodeService;
    let list: ListService;
    let recipes: RecipeService;
    let milkId: number;

    const otherProducts = async (): Promise<Array<number>> => {
        const items = await catalog.getItems();

        return ['Boter', 'Eieren'].map((name) => items.find((item) => item.name === name)?.id as number);
    };

    before(async () => {
        app = await NestFactory.createApplicationContext(TestModule, { logger: false });
        await app.init();
        recipes = app.get(RecipeService);
        scans = app.get(ScanService);
        catalog = app.get(CatalogService);
        barcodes = app.get(BarcodeService);
        list = app.get(ListService);
    });

    after(async () => {
        await app.close();
        rmSync(folder, { recursive: true, force: true });
    });

    it('seeds sections, items and the current list', async () => {
        const items = await catalog.getItems();
        const milk = items.find((item) => item.name === 'Melk');
        assert.equal((await catalog.getSections()).length, 13);
        assert.equal(items.length, 358);
        assert.equal(items.find((item) => item.name === 'Wattenstaafjes')?.emoji, '🦴');
        assert.equal((await list.getEntries()).length, 16);
        assert.ok(milk);
        milkId = milk.id;
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'to_buy', quantity: 1 });
    });

    it('puts an unknown barcode in the inbox and ignores a double read', async () => {
        assert.equal((await scans.register(CODE, 'handheld')).result, 'needs_name');
        assert.equal((await scans.register(CODE, 'handheld')).result, 'ignored');
        assert.deepEqual(
            (await barcodes.getAll(true)).map((barcode) => barcode.code),
            [CODE]
        );
        assert.equal((await barcodes.get(CODE)).scanCount, 1);
    });

    it('applies the waiting scan when the barcode gets its item', async () => {
        await scans.nameBarcode(CODE, milkId);
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'to_buy', quantity: 2 });
        assert.equal((await barcodes.getAll(true)).length, 0);
        assert.equal((await catalog.getItem(milkId)).barcodes?.length, 1);
    });

    it('undoes the latest scan', async () => {
        const undone = await scans.undo();
        assert.equal(undone?.code, CODE);
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'to_buy', quantity: 1 });
    });

    it('re-adds a checked-off item on the next scan and counts up after that', async () => {
        await list.change(await entryIdOf(list, milkId), { state: 'recent' });
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'recent', quantity: 0 });

        await wait(DEBOUNCE_MILLISECONDS + 100);
        const added = await scans.register(CODE, 'phone');
        assert.deepEqual([added.result, added.quantity, added.itemName], ['added', 1, 'Melk']);

        await wait(DEBOUNCE_MILLISECONDS + 100);
        const incremented = await scans.register(CODE, 'phone');
        assert.deepEqual([incremented.result, incremented.quantity], ['incremented', 2]);
    });

    it('returns a detached barcode to the inbox', async () => {
        await barcodes.unlink(CODE);
        assert.deepEqual(
            (await barcodes.getAll(true)).map((barcode) => barcode.code),
            [CODE]
        );
        assert.deepEqual(
            (await scans.history(10)).map((scan) => scan.result),
            ['incremented', 'added', 'ignored', 'incremented']
        );
    });

    it('moves a product scanned as collected from the list to recent, and adds nothing', async () => {
        const code = '8712345678920';
        const nextScan = async (collecting: boolean): Promise<string> => {
            await wait(DEBOUNCE_MILLISECONDS + 100);
            return (await scans.register(code, 'phone', { collecting })).result;
        };

        assert.equal((await scans.register(code, 'phone', { collecting: true })).result, 'needs_name');
        await scans.nameBarcode(code, milkId);
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'recent', quantity: 0 });
        assert.equal((await scans.history(1))[0].result, 'collected');

        assert.equal(await nextScan(true), 'not_on_list');
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'recent', quantity: 0 });
        await scans.undo();
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'recent', quantity: 0 });
        await scans.undo();
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'to_buy', quantity: 2 });

        assert.equal(await nextScan(true), 'collected');
        await scans.undo();
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'to_buy', quantity: 2 });

        assert.equal(await nextScan(false), 'incremented');
        await scans.undo();
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'to_buy', quantity: 2 });
        await barcodes.unlink(code);
        await scans.discardBarcode(code);
    });

    it('keeps a chosen sound per event and falls back to the default', () =>
        checkFeedbackSettings(app.get(FeedbackService)));

    it('keeps sounds as presets made of blocks, within limits, and keeps one in use', () =>
        checkSoundPresets(app.get(FeedbackService), app.get(EventsService)));

    it('announces a newer version once at the scanner, with the chosen sound, not after a restart, a rollback or a first install', async () => {
        const path = join(folder, 'announced-version');
        const feedback = app.get(FeedbackService);
        const service = (version: string): FeedbackService => {
            const started = new FeedbackService(
                app.get(getRepositoryToken(FeedbackSettingEntity)),
                app.get(getRepositoryToken(SoundEntity)),
                app.get(EventsService),
                { version, announcedVersionPath: path } as AppConfig
            );
            started.onApplicationBootstrap();

            return started;
        };

        await feedback.setSound('updated', 'trill8');
        assert.equal(await service('1.2.2').takeUpdateAnnouncement(), undefined);
        assert.equal(readFileSync(path, 'utf8'), '1.2.2');

        const first = service('1.2.3');
        const announcement = await first.takeUpdateAnnouncement();
        assert.equal(announcement?.type, 'feedback');
        assert.equal((announcement?.data as { name: string }).name, 'updated');
        assert.equal((announcement?.data as { steps: Array<{ kind: string }> }).steps[0].kind, 'gate');
        assert.equal(readFileSync(path, 'utf8'), '1.2.3');
        assert.equal(await first.takeUpdateAnnouncement(), undefined);

        assert.equal(await service('1.2.3').takeUpdateAnnouncement(), undefined);
        assert.equal(await service('dev').takeUpdateAnnouncement(), undefined);
        assert.equal(await service('1.2.2').takeUpdateAnnouncement(), undefined);
        assert.equal(await service('1.1.99').takeUpdateAnnouncement(), undefined);
        assert.equal(readFileSync(path, 'utf8'), '1.2.3');
        assert.notEqual(await service('1.2.10').takeUpdateAnnouncement(), undefined);
        assert.notEqual(await service('1.10.0').takeUpdateAnnouncement(), undefined);

        await feedback.setSound('updated', 'none');
        assert.equal(await service('1.10.1').takeUpdateAnnouncement(), undefined);
        assert.equal(readFileSync(path, 'utf8'), '1.10.1');
    });

    it('plays the sound of an added product for a recipe whose own default sound is gone, until one is chosen', async () => {
        const feedback = app.get(FeedbackService);
        const soundOf = async (name: string): Promise<string | undefined> =>
            (await feedback.getSettings()).events.find(({ event }) => event === name)?.soundId;
        assert.equal(await soundOf('recipe'), 'trill8');

        await feedback.setSound('added', 'beep');
        await app.get<Repository<SoundEntity>>(getRepositoryToken(SoundEntity)).delete('trill8');
        assert.equal(await soundOf('recipe'), 'beep');

        await feedback.setSound('recipe', 'none');
        assert.equal(await soundOf('recipe'), 'none');
    });

    it('removes an entry from the list altogether', () => checkRemoveFromList(list, milkId));

    it('remembers which lookup source gave no answer, and fills it in on a repeat', async () => {
        const connectors = app.get(ConnectorService) as unknown as { connectors: Array<ProductConnector> };
        let supermarketDown = true;
        const askSupermarket = (): Promise<ProductSuggestion> =>
            supermarketDown
                ? Promise.reject(new Error('timeout'))
                : Promise.resolve({ connectorId: 'ah', title: 'AH Pindakaas', category: 'Ontbijtgranen, beleg' });
        const askOpenData = (): Promise<ProductSuggestion> =>
            Promise.resolve({ connectorId: 'off', title: 'Peanut butter' });
        connectors.connectors = [
            { id: 'ah', lookup: askSupermarket },
            { id: 'off', lookup: askOpenData }
        ];

        await scans.register('8712345678906', 'handheld');
        await wait(100);
        const first = await barcodes.get('8712345678906');
        assert.deepEqual(first.lookupFailed, ['ah']);
        assert.deepEqual(
            first.suggestions?.map((suggestion) => suggestion.connectorId),
            ['off']
        );
        const naming = app.get(NamingService);
        assert.deepEqual((await naming.getWithProposal('8712345678906')).proposal, { name: 'Peanut butter', note: '' });

        supermarketDown = false;
        const second = await scans.repeatLookup('8712345678906');
        assert.deepEqual(second.lookupFailed, []);
        assert.deepEqual(second.suggestions?.map((suggestion) => suggestion.connectorId).sort(), ['ah', 'off']);
        assert.equal(
            second.suggestions?.find((suggestion) => suggestion.connectorId === 'ah')?.sectionId,
            'graanproducten'
        );
        const proposal = (await naming.getWithProposal('8712345678906')).proposal;
        assert.deepEqual([proposal?.name, proposal?.note, typeof proposal?.catalogItemId], ['Pindakaas', '', 'number']);

        connectors.connectors = [];
        await scans.discardBarcode('8712345678906');
    });

    it('scans a barcode that carries a variant onto the entry with that note, and undoes it there', async () => {
        const code = '8712345678913';
        assert.equal((await scans.register(code, 'phone')).result, 'needs_name');
        await scans.nameBarcode(code, milkId, ' Volkoren ');
        assert.equal((await barcodes.get(code)).note, 'Volkoren');
        assert.deepEqual(await list.getSnapshot(milkId, 'Volkoren'), { state: 'to_buy', quantity: 1 });

        await wait(DEBOUNCE_MILLISECONDS + 100);
        const again = await scans.register(code, 'phone');
        assert.deepEqual([again.result, again.note, again.quantity], ['incremented', 'Volkoren', 2]);

        await scans.undo();
        assert.deepEqual(await list.getSnapshot(milkId, 'Volkoren'), { state: 'to_buy', quantity: 1 });
        await scans.undo();
        assert.equal(await list.getSnapshot(milkId, 'Volkoren'), undefined);
        assert.equal((await list.getSnapshot(milkId, ''))?.state, 'to_buy');
    });

    it('writes nothing when a scan fails halfway', async () => {
        const before = {
            scans: (await scans.history(100)).length,
            entry: await list.getSnapshot(milkId, ''),
            count: (await barcodes.get(CODE)).scanCount
        };
        await scans.nameBarcode(CODE, milkId);
        const mapped = { entry: await list.getSnapshot(milkId, ''), count: (await barcodes.get(CODE)).scanCount };
        const original = list.writeSnapshot.bind(list);
        list.writeSnapshot = (): Promise<void> => Promise.reject(new Error('disk full'));

        await wait(DEBOUNCE_MILLISECONDS + 100);
        await assert.rejects(scans.register(CODE, 'phone'), /disk full/);
        list.writeSnapshot = original;

        assert.equal((await scans.history(100)).length, before.scans);
        assert.deepEqual(await list.getSnapshot(milkId, ''), mapped.entry);
        assert.equal((await barcodes.get(CODE)).scanCount, mapped.count);
    });

    it('keeps a recipe with its ingredients in order, and refuses a second of that name or an unknown product', async () => {
        const [butterId, eggsId] = await otherProducts();
        const made = await recipes.create({
            name: ' Pannenkoeken ',
            description: ' **Beslag** een uur laten rusten ',
            ingredients: [
                { catalogItemId: eggsId, quantity: 2, note: ' scharrel ' },
                { catalogItemId: milkId, quantity: 1, note: '' },
                { catalogItemId: eggsId, quantity: 1, note: 'scharrel' }
            ]
        });

        assert.deepEqual(
            [made.name, made.description, made.category],
            ['Pannenkoeken', '**Beslag** een uur laten rusten', 'other']
        );
        assert.deepEqual(
            made.ingredients?.map(({ catalogItemId, quantity, note }) => [catalogItemId, quantity, note]),
            [
                [eggsId, 3, 'scharrel'],
                [milkId, 1, '']
            ]
        );
        await assert.rejects(recipes.create({ name: 'Pannenkoeken', ingredients: [] }), /already exists/);
        await assert.rejects(
            recipes.create({ name: 'Lucht', ingredients: [{ catalogItemId: 999999, quantity: 1, note: '' }] }),
            /999999 does not exist/
        );

        const changed = await recipes.update(made.id, {
            name: 'Pannenkoeken',
            ingredients: [
                { catalogItemId: butterId, quantity: 1, note: '' },
                { catalogItemId: milkId, quantity: 2, note: '' }
            ]
        });
        assert.deepEqual(
            changed.ingredients?.map(({ catalogItemId, quantity }) => [catalogItemId, quantity]),
            [
                [butterId, 1],
                [milkId, 2]
            ]
        );
        assert.equal(changed.description, '');
        assert.equal(changed.category, 'other');

        const filed = await recipes.update(made.id, { name: 'Pannenkoeken', category: 'dinner', ingredients: [] });
        assert.equal(filed.category, 'dinner');
        assert.equal((await recipes.update(made.id, { name: 'Pannenkoeken', ingredients: [] })).category, 'dinner');
        await recipes.update(made.id, {
            name: 'Pannenkoeken',
            ingredients: [{ catalogItemId: milkId, quantity: 2, note: '' }]
        });
        assert.equal((await recipes.getAll()).length, 1);
        assert.equal(await recipes.countUsing(milkId), 1);
    });

    it('puts a recipe on the list as one scan and takes it back in one undo', async () => {
        const [butterId] = await otherProducts();
        await list.writeSnapshot(butterId, '', undefined);
        await list.writeSnapshot(milkId, '', { state: 'to_buy', quantity: 1 });

        const outcome = await scans.addRecipe(
            {
                name: 'Pannenkoeken',
                ingredients: [
                    { catalogItemId: butterId, quantity: 1, note: '' },
                    { catalogItemId: milkId, quantity: 2, note: '' }
                ]
            },
            'app'
        );
        assert.deepEqual(
            [outcome.result, outcome.title, outcome.added, outcome.unknown, outcome.code],
            ['recipe', 'Pannenkoeken', 2, [], `R1;Pannenkoeken;${butterId};${milkId}*2`]
        );
        assert.deepEqual(await list.getSnapshot(butterId, ''), { state: 'to_buy', quantity: 1 });
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'to_buy', quantity: 3 });

        const [latest] = await scans.history(1);
        assert.deepEqual([latest.source, latest.title, latest.changes?.length], ['app', 'Pannenkoeken', 2]);

        await list.writeSnapshot(milkId, '', { state: 'to_buy', quantity: 4 });
        const undone = await scans.undo();
        assert.equal(undone?.id, outcome.scanId);
        assert.equal(await list.getSnapshot(butterId, ''), undefined);
        assert.deepEqual(await list.getSnapshot(milkId, ''), { state: 'to_buy', quantity: 2 });
        await list.writeSnapshot(milkId, '', { state: 'to_buy', quantity: 1 });
    });

    it('adds what it knows of a recipe that holds an unknown product', async () => {
        const [butterId] = await otherProducts();
        const outcome = await scans.addRecipe(
            {
                name: 'Half',
                ingredients: [
                    { catalogItemId: 999999, quantity: 1, note: 'weg' },
                    { catalogItemId: butterId, quantity: 2, note: 'roomboter' }
                ]
            },
            'app'
        );

        assert.deepEqual([outcome.result, outcome.added, outcome.unknown], ['recipe_partial', 1, [999999]]);
        assert.deepEqual(await list.getSnapshot(butterId, 'roomboter'), { state: 'to_buy', quantity: 2 });
        await scans.undo();
        assert.equal(await list.getSnapshot(butterId, 'roomboter'), undefined);
    });

    it('refuses to delete a product that a recipe uses, and deletes it once it is taken out', async () => {
        const made = await catalog.createItem({ name: 'Vanillestokje', sectionId: 'zuivel' });
        const [recipe] = await recipes.getAll();
        await recipes.update(recipe.id, {
            name: recipe.name,
            ingredients: [
                { catalogItemId: made.id, quantity: 1, note: '' },
                { catalogItemId: milkId, quantity: 1, note: '' }
            ]
        });
        assert.equal(await recipes.countUsing(made.id), 1);

        await assert.rejects(catalog.deleteItem(made.id), ConflictException);
        assert.equal((await recipes.get(recipe.id)).ingredients?.length, 2);

        await recipes.update(recipe.id, {
            name: recipe.name,
            ingredients: [{ catalogItemId: milkId, quantity: 1, note: '' }]
        });
        await catalog.deleteItem(made.id);
        await assert.rejects(catalog.getItem(made.id), NotFoundException);
    });

    it('keeps a draft product off the list and away from barcodes, and leaves it out of a recipe on the list', async () => {
        const code = '8712345678944';
        const draft = await catalog.createItem({ name: 'Zalmflakes', sectionId: 'zuivel', draft: true });
        const [recipe] = await recipes.getAll();
        await recipes.update(recipe.id, {
            name: recipe.name,
            ingredients: [
                { catalogItemId: draft.id, quantity: 1, note: '150g' },
                { catalogItemId: milkId, quantity: 1, note: 'recept' }
            ]
        });

        await assert.rejects(list.change(randomUUID(), { catalogItemId: draft.id }), NotFoundException);
        assert.equal((await scans.register(code, 'phone')).result, 'needs_name');
        await assert.rejects(scans.nameBarcode(code, draft.id), ConflictException);
        await scans.discardBarcode(code);

        const { ingredients = [] } = await recipes.get(recipe.id);
        const outcome = await scans.addRecipe({ name: recipe.name, ingredients }, 'app');
        assert.deepEqual([outcome.result, outcome.added, outcome.unknown], ['recipe_partial', 1, [draft.id]]);
        assert.equal(await list.getSnapshot(draft.id, '150g'), undefined);
        await scans.undo();
        assert.equal(await list.getSnapshot(milkId, 'recept'), undefined);
    });

    it('replaces a draft by another product in every recipe, quantities added, and confirms another draft', async () => {
        const draft = (await catalog.getItems('Zalmflakes'))[0];
        const [recipe] = await recipes.getAll();
        await recipes.update(recipe.id, {
            name: recipe.name,
            ingredients: [
                { catalogItemId: draft.id, quantity: 2, note: 'recept' },
                { catalogItemId: milkId, quantity: 1, note: 'recept' },
                { catalogItemId: draft.id, quantity: 1, note: '150g' }
            ]
        });
        await assert.rejects(recipes.replaceDraft(milkId, draft.id), ConflictException);

        await recipes.replaceDraft(draft.id, milkId);
        assert.deepEqual(
            (await recipes.get(recipe.id)).ingredients?.map(({ catalogItemId, quantity, note }) => [
                catalogItemId,
                quantity,
                note
            ]),
            [
                [milkId, 3, 'recept'],
                [milkId, 1, '150g']
            ]
        );
        await assert.rejects(catalog.getItem(draft.id), NotFoundException);

        const other = await catalog.createItem({ name: 'Veldsla', sectionId: 'zuivel', draft: true });
        assert.equal((await catalog.confirmDraft(other.id)).draft, false);
        await list.change(randomUUID(), { catalogItemId: other.id });
        assert.equal((await list.getSnapshot(other.id, ''))?.state, 'to_buy');
        await catalog.deleteItem(other.id);
        await recipes.delete(recipe.id);
        assert.equal((await recipes.getAll()).length, 0);
    });

    it('undoes the scans of a product that was deleted since, and leaves the list alone', async () => {
        const code = '8712345678937';
        const made = await catalog.createItem({ name: 'Kaneelstokje', sectionId: 'zuivel' });
        assert.equal((await scans.register(code, 'phone')).result, 'needs_name');
        await scans.nameBarcode(code, made.id, '');
        await wait(DEBOUNCE_MILLISECONDS + 100);
        assert.equal((await scans.register(code, 'phone')).result, 'incremented');
        await catalog.deleteItem(made.id);

        assert.equal((await scans.undo())?.code, code);
        assert.equal((await scans.undo())?.code, code);
        assert.equal(await list.getSnapshot(made.id, ''), undefined);
        await scans.discardBarcode(code);
    });

    it('imports a recipe from what the AI service answers, with a draft for a product the app has not', async () => {
        const imports = app.get(RecipeImportService);
        const asked: Array<Question> = [];
        const blank = {
            line: '',
            productId: 0,
            newName: '',
            sectionId: '',
            icon: '',
            emoji: '',
            quantity: 1,
            note: ''
        };
        let answer: object = {
            found: true,
            name: 'Zalmwraps',
            description: '1. Rol op.',
            category: 'lunch',
            ingredients: [
                { ...blank, line: '500 ml melk', productId: milkId, newName: 'Melk', note: '500ml' },
                {
                    ...blank,
                    newName: 'zalmflakes',
                    sectionId: 'vlees-vis',
                    icon: 'bestaat-niet',
                    emoji: '🐟',
                    note: '150g'
                },
                { ...blank, line: '2 zalmflakes', productId: milkId, newName: 'Zalmflakes', quantity: 2 },
                { ...blank, productId: 999999 }
            ]
        };
        let linkRead = true;
        let page: object = { found: true, recipe: 'Zalmwraps\n500 ml melk\nzalmflakes' };
        app.get(GeminiService).ask = (question: Question): Promise<Answer> => {
            asked.push(question);

            return Promise.resolve({ value: question.readLinks ? page : answer, linkRead });
        };

        const recipe = await imports.import('https://example.com/recept/zalmwraps');
        const [draft] = await catalog.getItems('Zalmflakes');
        assert.deepEqual(
            asked.map(({ readLinks }) => readLinks),
            [true, false]
        );
        assert.match(asked[0].input, /example\.com\/recept\/zalmwraps/);
        assert.match(asked[1].input, /<recipe>\nZalmwraps\n500 ml melk\nzalmflakes\n<\/recipe>/);
        assert.ok(asked[1].input.includes(`${milkId}\tMelk`));
        assert.deepEqual(
            [draft.draft, draft.sectionId, draft.icon ?? undefined, draft.emoji],
            [true, 'vlees-vis', undefined, '🐟']
        );
        assert.deepEqual(
            recipe.ingredients?.map(({ catalogItemId, quantity, note }) => [catalogItemId, quantity, note]),
            [
                [milkId, 1, '500ml'],
                [draft.id, 1, '150g'],
                [draft.id, 2, '']
            ]
        );
        assert.deepEqual(
            recipe.ingredients?.map(({ text }) => text),
            ['500 ml melk', '', '2 zalmflakes']
        );

        assert.deepEqual(
            [recipe.description, recipe.sourceUrl],
            ['1. Rol op.', 'https://example.com/recept/zalmwraps']
        );
        assert.equal(recipe.category, 'lunch');

        const again = await imports.import('Zalmwraps: 500 ml melk, zalmflakes');
        assert.deepEqual([again.description, again.sourceUrl], ['1. Rol op.', '']);
        assert.equal(asked[2].readLinks, false);
        assert.equal(again.name, 'Zalmwraps (2)');
        assert.equal((await catalog.getItems('Zalmflakes')).length, 1);

        linkRead = false;
        await assert.rejects(imports.import('https://example.com/recept/verzonnen'), UnprocessableEntityException);
        assert.equal(asked.length, 5);
        assert.equal((await recipes.getAll()).length, 2);

        linkRead = true;
        page = { found: false, recipe: '' };
        await assert.rejects(imports.import('https://example.com/geen-recept'), UnprocessableEntityException);
        assert.equal(asked.length, 6);

        answer = { found: false, name: '', description: '', ingredients: [] };
        await assert.rejects(imports.import('geen recept'), UnprocessableEntityException);

        await recipes.delete(recipe.id);
        await recipes.delete(again.id);
        await catalog.deleteItem(draft.id);
    });

    it('handles scans that arrive at the same moment one after the other', async () => {
        await wait(DEBOUNCE_MILLISECONDS + 100);
        const start = (await list.getSnapshot(milkId, ''))?.quantity ?? 0;
        const results = await Promise.all([scans.register(CODE, 'phone'), scans.register(CODE, 'handheld')]);

        assert.equal(results.filter((outcome) => outcome.result === 'ignored').length, 1);
        assert.equal(results.filter((outcome) => outcome.result !== 'ignored').length, 1);
        assert.equal((await list.getSnapshot(milkId, ''))?.quantity, start + 1);
    });
});

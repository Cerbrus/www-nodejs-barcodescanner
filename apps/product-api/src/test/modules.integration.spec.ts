import 'reflect-metadata';


import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';

import { INestApplicationContext, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { testFolder } from './test-env';
import { AppConfigModule } from '../config/config.module';
import { CoreModule } from '../core/core.module';
import { DEBOUNCE_MILLISECONDS } from '../core/rules/scan-rules';
import { BarcodeService } from '../core/services/barcode.service';
import { CatalogService } from '../core/services/catalog.service';
import { FeedbackService } from '../core/services/feedback.service';
import { ListService } from '../core/services/list.service';
import { ScanService } from '../core/services/scan.service';

const folder = testFolder;
const CODE = '8710400335481';

@Module({ imports: [AppConfigModule, CoreModule] })
class TestModule {
}

async function checkFeedbackSettings(feedback: FeedbackService): Promise<void> {
    const before = await feedback.getSettings();
    assert.equal(before.events.find((row) => row.event === 'added')?.soundId, 'beep');
    assert.equal(before.events.find((row) => row.event === 'ignored')?.soundId, 'none');

    await feedback.setSound('added', 'trill15');
    await feedback.setSound('error', 'none');
    const after = await feedback.getSettings();
    assert.equal(after.events.find((row) => row.event === 'added')?.soundId, 'trill15');
    assert.equal(after.events.find((row) => row.event === 'added')?.steps[0].kind, 'gate');
    assert.deepEqual(after.events.find((row) => row.event === 'error')?.steps, []);
    assert.equal(after.events.find((row) => row.event === 'needs_name')?.soundId, 'long');

    await assert.rejects(feedback.setSound('added', 'does-not-exist'));
}

async function checkRemoveFromList(list: ListService, catalogItemId: number): Promise<void> {
    await list.change(catalogItemId, { state: 'to_buy', quantity: 2 });
    assert.equal((await list.getSnapshot(catalogItemId))?.quantity, 2);

    await list.remove(catalogItemId);
    assert.equal(await list.getSnapshot(catalogItemId), undefined);
    assert.equal((await list.getEntries()).some((entry) => entry.catalogItemId === catalogItemId), false);

    await list.remove(catalogItemId);
}

describe('scan flow against a real database', () => {
    let app: INestApplicationContext;
    let scans: ScanService;
    let catalog: CatalogService;
    let barcodes: BarcodeService;
    let list: ListService;
    let milkId: number;

    before(async () => {
        app = await NestFactory.createApplicationContext(TestModule, { logger: false });
        await app.init();
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
        assert.equal((await list.getEntries()).length, 16);
        assert.ok(milk);
        milkId = milk.id;
        assert.deepEqual(await list.getSnapshot(milkId), { state: 'to_buy', quantity: 1 });
    });

    it('puts an unknown barcode in the inbox and ignores a double read', async () => {
        assert.equal((await scans.register(CODE, 'handheld')).result, 'needs_name');
        assert.equal((await scans.register(CODE, 'handheld')).result, 'ignored');
        assert.deepEqual((await barcodes.getAll(true)).map((barcode) => barcode.code), [CODE]);
        assert.equal((await barcodes.get(CODE)).scanCount, 1);
    });

    it('applies the waiting scan when the barcode gets its item', async () => {
        await scans.nameBarcode(CODE, milkId);
        assert.deepEqual(await list.getSnapshot(milkId), { state: 'to_buy', quantity: 2 });
        assert.equal((await barcodes.getAll(true)).length, 0);
        assert.equal((await catalog.getItem(milkId)).barcodes?.length, 1);
    });

    it('undoes the latest scan', async () => {
        const undone = await scans.undo();
        assert.equal(undone?.code, CODE);
        assert.deepEqual(await list.getSnapshot(milkId), { state: 'to_buy', quantity: 1 });
    });

    it('re-adds a checked-off item on the next scan and counts up after that', async () => {
        await list.change(milkId, { state: 'recent' });
        assert.deepEqual(await list.getSnapshot(milkId), { state: 'recent', quantity: 0 });

        await wait(DEBOUNCE_MILLISECONDS + 100);
        const added = await scans.register(CODE, 'phone');
        assert.deepEqual([added.result, added.quantity, added.itemName], ['added', 1, 'Melk']);

        await wait(DEBOUNCE_MILLISECONDS + 100);
        const incremented = await scans.register(CODE, 'phone');
        assert.deepEqual([incremented.result, incremented.quantity], ['incremented', 2]);
    });

    it('returns a detached barcode to the inbox', async () => {
        await barcodes.unlink(CODE);
        assert.deepEqual((await barcodes.getAll(true)).map((barcode) => barcode.code), [CODE]);
        assert.deepEqual(
            (await scans.history(10)).map((scan) => scan.result),
            ['incremented', 'added', 'ignored', 'incremented']
        );
    });

    it('keeps a chosen sound per event and falls back to the default', () => checkFeedbackSettings(app.get(FeedbackService)));

    it('removes an entry from the list altogether', () => checkRemoveFromList(list, milkId));

    it('writes nothing when a scan fails halfway', async () => {
        const before = { scans: (await scans.history(100)).length, entry: await list.getSnapshot(milkId), count: (await barcodes.get(CODE)).scanCount };
        await scans.nameBarcode(CODE, milkId);
        const mapped = { entry: await list.getSnapshot(milkId), count: (await barcodes.get(CODE)).scanCount };
        const original = list.writeSnapshot.bind(list);
        list.writeSnapshot = (): Promise<void> => Promise.reject(new Error('disk full'));

        await wait(DEBOUNCE_MILLISECONDS + 100);
        await assert.rejects(scans.register(CODE, 'phone'), /disk full/);
        list.writeSnapshot = original;

        assert.equal((await scans.history(100)).length, before.scans);
        assert.deepEqual(await list.getSnapshot(milkId), mapped.entry);
        assert.equal((await barcodes.get(CODE)).scanCount, mapped.count);
    });

    it('handles scans that arrive at the same moment one after the other', async () => {
        await wait(DEBOUNCE_MILLISECONDS + 100);
        const start = (await list.getSnapshot(milkId))?.quantity ?? 0;
        const results = await Promise.all([scans.register(CODE, 'phone'), scans.register(CODE, 'handheld')]);

        assert.equal(results.filter((outcome) => outcome.result === 'ignored').length, 1);
        assert.equal(results.filter((outcome) => outcome.result !== 'ignored').length, 1);
        assert.equal((await list.getSnapshot(milkId))?.quantity, start + 1);
    });
});

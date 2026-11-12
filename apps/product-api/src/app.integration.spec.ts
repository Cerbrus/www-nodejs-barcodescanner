import 'reflect-metadata';

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';

import { INestApplicationContext, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatalogModule } from './catalog/catalog.module';
import { CatalogService } from './catalog/catalog.service';
import { databaseOptions } from './data/database';
import { SeedService } from './data/seed.service';
import { EventsModule } from './events/events.module';
import { FeedbackModule } from './feedback/feedback.module';
import { FeedbackService } from './feedback/feedback.service';
import { ListModule } from './list/list.module';
import { ListService } from './list/list.service';
import { DEBOUNCE_MILLISECONDS } from './scan/scan-rules';
import { ScanModule } from './scan/scan.module';
import { ScanService } from './scan/scan.service';

const folder = mkdtempSync(join(tmpdir(), 'barcodescanner-test-'));
const CODE = '8710400335481';

process.env['CONNECTORS'] = 'none';
process.env['SEED_PATH'] = join(process.cwd(), 'data', 'seed-items.json');

@Module({
    imports: [
        TypeOrmModule.forRoot(databaseOptions(join(folder, 'test.db'))),
        EventsModule,
        ListModule,
        ScanModule,
        CatalogModule,
        FeedbackModule
    ],
    providers: [SeedService]
})
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

describe('scan flow against a real database', () => {
    let app: INestApplicationContext;
    let scans: ScanService;
    let catalog: CatalogService;
    let list: ListService;
    let milkId: number;

    before(async () => {
        app = await NestFactory.createApplicationContext(TestModule, { logger: false });
        await app.init();
        scans = app.get(ScanService);
        catalog = app.get(CatalogService);
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
        assert.deepEqual((await catalog.getBarcodes(true)).map((barcode) => barcode.code), [CODE]);
        assert.equal((await catalog.getBarcode(CODE)).scanCount, 1);
    });

    it('applies the waiting scan when the barcode gets its item', async () => {
        await catalog.mapBarcode(CODE, milkId);
        assert.deepEqual(await list.getSnapshot(milkId), { state: 'to_buy', quantity: 2 });
        assert.equal((await catalog.getBarcodes(true)).length, 0);
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
        await catalog.unmapBarcode(CODE);
        assert.deepEqual((await catalog.getBarcodes(true)).map((barcode) => barcode.code), [CODE]);
        assert.deepEqual(
            (await scans.history(10)).map((scan) => scan.result),
            ['incremented', 'added', 'ignored', 'incremented']
        );
    });

    it('keeps a chosen sound per event and falls back to the default', () => checkFeedbackSettings(app.get(FeedbackService)));
});

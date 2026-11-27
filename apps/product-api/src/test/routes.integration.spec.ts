import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import sharp from 'sharp';

import { ApiModule } from '../api/api.module';
import { configureApi } from '../api/configure-api';
import { AppConfigModule } from '../config/config.module';
import { SESSION_COOKIE } from '../core/rules/session';
import { SessionService } from '../core/services/session.service';
import { testFolder } from './test-env';

const SITE = 'https://shopping.example.com';
const OWNER = 'owner@example.com';
const GUEST = 'guest@example.com';
const AGENT_TOKEN = 'agent-token-for-tests';
const UNKNOWN_CODE = '8710400335481';

process.env['GOOGLE_CLIENT_ID'] = 'test-client';
process.env['GOOGLE_CLIENT_SECRET'] = 'test-secret';
process.env['PUBLIC_URL'] = SITE;
process.env['ALLOWED_EMAILS'] = `${OWNER}, ${GUEST}`;
process.env['AGENT_TOKEN'] = AGENT_TOKEN;

interface Answer<T> {
    status: number;
    body: T;
}

@Module({ imports: [AppConfigModule, ApiModule] })
class TestModule {}

describe('data routes over HTTP', () => {
    let app: NestExpressApplication;
    let base: string;
    let asUser: Record<string, string>;
    let asGuest: Record<string, string>;
    let milkId: number;
    const asAgent = { 'x-agent-token': AGENT_TOKEN };

    async function call<T = unknown>(
        method: string,
        path: string,
        headers: Record<string, string>,
        body?: unknown
    ): Promise<Answer<T>> {
        const answer = await fetch(`${base}${path}`, {
            method,
            headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const text = await answer.text();

        return { status: answer.status, body: (text ? JSON.parse(text) : undefined) as T };
    }

    before(async () => {
        app = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
        configureApi(app);
        await app.listen(0, '127.0.0.1');
        base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;
        asUser = { cookie: `${SESSION_COOKIE}=${app.get(SessionService).issue(OWNER)}` };
        asGuest = { cookie: `${SESSION_COOKIE}=${app.get(SessionService).issue(GUEST)}` };

        const catalog = await call<Array<{ id: number; name: string }>>('GET', '/catalog', asUser);
        milkId = catalog.body.find((item) => item.name === 'Melk')?.id as number;
        assert.ok(milkId);
    });

    after(async () => {
        await app.close();
        rmSync(testFolder, { recursive: true, force: true });
    });

    it('refuses a scan whose code is not a barcode', async () => {
        assert.equal((await call('POST', '/scans', asUser, { code: 'abc' })).status, 400);
        assert.equal((await call('POST', '/scans', asUser, {})).status, 400);
    });

    it('records a scan from a browser as a phone scan, whatever the request claims', async () => {
        const scan = await call<{ result: string }>('POST', '/scans', asUser, {
            code: UNKNOWN_CODE,
            source: 'handheld'
        });
        const history = await call<Array<{ code: string; source: string }>>('GET', '/scans?limit=1', asUser);

        assert.equal(scan.status, 201);
        assert.equal(scan.body.result, 'needs_name');
        assert.equal(history.body[0].source, 'phone');
    });

    it('records a scan from the agent as a handheld scan', async () => {
        const scan = await call<{ result: string }>('POST', '/scans', asAgent, { code: '87654321' });
        const history = await call<Array<{ code: string; source: string }>>('GET', '/scans?limit=1', asUser);

        assert.equal(scan.status, 201);
        assert.deepEqual([history.body[0].code, history.body[0].source], ['87654321', 'handheld']);
    });

    it('takes the time of a held scan from the agent, and from nobody else', async () => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const longAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const timeOf = async (code: string): Promise<string> => {
            const history = await call<Array<{ code: string; createdAt: string }>>('GET', '/scans?limit=50', asUser);

            return history.body.find((scan) => scan.code === code)?.createdAt ?? '';
        };
        const isRecent = (time: string): boolean => Date.now() - new Date(time).getTime() < 5000;

        await call('POST', '/scans', asAgent, { code: '11112222', scannedAt: fiveMinutesAgo });
        assert.equal(await timeOf('11112222'), fiveMinutesAgo);

        await call('POST', '/scans', asAgent, { code: '11113333', scannedAt: longAgo });
        assert.ok(isRecent(await timeOf('11113333')));

        await call('POST', '/scans', asUser, { code: '11114444', scannedAt: fiveMinutesAgo });
        assert.ok(isRecent(await timeOf('11114444')));

        assert.equal((await call('POST', '/scans', asAgent, { code: '11115555', scannedAt: 'yesterday' })).status, 400);
    });

    it('counts two held scans of one product that are delivered together', async () => {
        const at = (secondsAgo: number): string => new Date(Date.now() - secondsAgo * 1000).toISOString();
        const first = await call<{ result: string }>('POST', '/scans', asAgent, {
            code: '11116666',
            scannedAt: at(40)
        });
        const second = await call<{ result: string }>('POST', '/scans', asAgent, {
            code: '11116666',
            scannedAt: at(30)
        });

        assert.deepEqual([first.body.result, second.body.result], ['needs_name', 'needs_name']);
        const barcode = await call<{ scanCount: number }>('GET', '/barcodes/11116666', asUser);
        assert.equal(barcode.body.scanCount, 2);
    });

    it('names a barcode, which puts the waiting scan on the list, and undoes it', async () => {
        const inbox = await call<Array<{ code: string }>>('GET', '/barcodes?unmapped=true', asUser);
        assert.ok(inbox.body.some((barcode) => barcode.code === UNKNOWN_CODE));

        assert.equal((await call('PUT', `/barcodes/${UNKNOWN_CODE}`, asUser, { catalogItemId: 'one' })).status, 400);
        assert.equal((await call('PUT', `/barcodes/${UNKNOWN_CODE}`, asUser, { catalogItemId: 999999 })).status, 404);
        assert.equal((await call('PUT', `/barcodes/${UNKNOWN_CODE}`, asUser, { catalogItemId: milkId })).status, 200);

        const list = await call<Array<{ catalogItemId: number; state: string; quantity: number }>>(
            'GET',
            '/list',
            asUser
        );
        const milk = list.body.find((entry) => entry.catalogItemId === milkId);
        assert.equal(milk?.state, 'to_buy');
        assert.equal(milk?.quantity, 2);
    });

    it('checks changes to the list', async () => {
        type Entry = { id: string; catalogItemId: number; note: string; state: string; quantity: number };
        const entries = async (): Promise<Array<Entry>> => (await call<Array<Entry>>('GET', '/list', asUser)).body;
        const milk = (await entries()).find((entry) => entry.catalogItemId === milkId && entry.note === '') as Entry;

        assert.equal((await call('PATCH', `/list/${milk.id}`, asUser, { state: 'bought' })).status, 400);
        assert.equal((await call('PATCH', `/list/${milk.id}`, asUser, { quantity: 0 })).status, 400);
        assert.equal((await call('PATCH', '/list/not an id', asUser, { state: 'to_buy' })).status, 400);
        assert.equal((await call('PATCH', `/list/${randomUUID()}`, asUser, { state: 'to_buy' })).status, 404);
        assert.equal(
            (await call('PATCH', `/list/${randomUUID()}`, asUser, { catalogItemId: 999999, state: 'to_buy' })).status,
            404
        );
        assert.equal((await call('PATCH', `/list/${milk.id}`, asUser, { quantity: 3, note: ' halfvol ' })).status, 200);

        const plain = randomUUID();
        await call('PATCH', `/list/${plain}`, asUser, { catalogItemId: milkId, state: 'to_buy', quantity: 2 });
        const variants = (await entries()).filter((entry) => entry.catalogItemId === milkId);
        assert.deepEqual(variants.map((entry) => [entry.note, entry.quantity]).sort(), [
            ['', 2],
            ['halfvol', 3]
        ]);

        const merged = await call<Entry>('PATCH', `/list/${plain}`, asUser, { note: 'halfvol' });
        assert.deepEqual([merged.body.id, merged.body.quantity], [milk.id, 5]);
        assert.equal((await entries()).filter((entry) => entry.catalogItemId === milkId).length, 1);

        assert.equal((await call('DELETE', `/list/${milk.id}`, asUser)).status, 204);
    });

    it('applies changes made offline in order, unless the server changed the entry later', async () => {
        const butter = (await call<Array<{ id: number; name: string }>>('GET', '/catalog', asUser)).body.find(
            (item) => item.name === 'Boter'
        )?.id as number;
        const at = (secondsAgo: number): string => new Date(Date.now() - secondsAgo * 1000).toISOString();
        type Entry = { id: string; catalogItemId: number; note: string; state: string; quantity: number };
        type Sent = { applied: number; skipped: Array<string> };
        const entryOf = async (id: string): Promise<Entry | undefined> =>
            (await call<Array<Entry>>('GET', '/list', asUser)).body.find((entry) => entry.id === id);
        const id = randomUUID();

        await call('PATCH', `/list/${id}`, asUser, { catalogItemId: butter, state: 'to_buy', quantity: 1 });
        const sent = await call<Sent>('POST', '/list/offline-changes', asUser, {
            changes: [
                { id, quantity: 3, changedAt: at(-2) },
                { id, state: 'recent', changedAt: at(-3) },
                { id: randomUUID(), catalogItemId: 999999, state: 'to_buy', changedAt: at(-3) }
            ]
        });
        assert.deepEqual([sent.status, sent.body.applied, sent.body.skipped.length], [200, 2, 1]);
        assert.equal((await entryOf(id))?.state, 'recent');

        await call('PATCH', `/list/${id}`, asUser, { state: 'to_buy', quantity: 2 });
        const late = await call<Sent>('POST', '/list/offline-changes', asUser, {
            changes: [{ id, state: 'recent', changedAt: at(600) }]
        });
        assert.deepEqual([late.body.applied, late.body.skipped], [0, [id]]);
        assert.deepEqual([(await entryOf(id))?.state, (await entryOf(id))?.quantity], ['to_buy', 2]);

        await new Promise((resolve) => setTimeout(resolve, 1100));
        const twice = await call<Sent>('POST', '/list/offline-changes', asUser, {
            changes: [
                { id, quantity: 3, changedAt: at(0.6) },
                { catalogItemId: butter, quantity: 4, changedAt: at(0.3) }
            ]
        });
        assert.deepEqual([twice.body.applied, twice.body.skipped], [2, []]);
        assert.equal((await entryOf(id))?.quantity, 4);

        const added = randomUUID();
        await call('POST', '/list/offline-changes', asUser, {
            changes: [{ id: added, catalogItemId: butter, note: 'ongezouten', state: 'to_buy', changedAt: at(0) }]
        });
        assert.deepEqual([(await entryOf(added))?.note, (await entryOf(added))?.quantity], ['ongezouten', 1]);

        assert.equal(
            (
                await call('POST', '/list/offline-changes', asUser, {
                    changes: [{ id, state: 'gone', changedAt: at(1) }]
                })
            ).status,
            400
        );
        assert.equal(
            (await call('POST', '/list/offline-changes', asUser, { changes: [{ quantity: 2, changedAt: at(1) }] }))
                .status,
            400
        );
        assert.equal((await call('POST', '/list/offline-changes', asAgent, { changes: [] })).status, 403);
    });

    it('checks new and changed products', async () => {
        assert.equal((await call('POST', '/catalog', asUser, { sectionId: 'zuivel' })).status, 400);
        assert.equal((await call('POST', '/catalog', asUser, { name: 'Melk', sectionId: 'zuivel' })).status, 409);
        assert.equal(
            (await call('POST', '/catalog', asUser, { name: 'Winterpeen', sectionId: 'nowhere' })).status,
            404
        );

        const created = await call<{ id: number; custom: boolean }>('POST', '/catalog', asUser, {
            name: 'Winterpeen',
            sectionId: 'fruit-groenten'
        });
        assert.equal(created.status, 201);
        assert.equal(created.body.custom, true);

        assert.equal((await call('PATCH', `/catalog/${created.body.id}`, asUser, { name: 'Melk' })).status, 409);

        const replacement = `/catalog/${created.body.id}/replacement`;
        const confirmation = `/catalog/${created.body.id}/confirmation`;
        assert.equal((await call('POST', replacement, asGuest, { catalogItemId: created.body.id })).status, 403);
        assert.equal((await call('POST', confirmation, asGuest)).status, 403);
        assert.equal((await call('POST', replacement, asUser, {})).status, 400);
        assert.equal((await call('POST', replacement, asUser, { catalogItemId: created.body.id })).status, 409);
        assert.equal((await call<{ draft: boolean }>('POST', confirmation, asUser)).body.draft, false);

        assert.equal((await call('DELETE', `/catalog/${created.body.id}`, asUser)).status, 204);
        assert.equal((await call('GET', `/catalog/${created.body.id}`, asUser)).status, 404);
    });

    it('checks recipes and puts one on the list', async () => {
        const ingredient = { catalogItemId: milkId, quantity: 2, note: 'vol' };
        for (const refused of [
            { ingredients: [ingredient] },
            { name: '   ', ingredients: [ingredient] },
            { name: 'x'.repeat(81), ingredients: [ingredient] },
            { name: 'Vla' },
            { name: 'Vla', ingredients: [{ ...ingredient, quantity: 0 }] },
            { name: 'Vla', ingredients: [{ ...ingredient, quantity: 100 }] },
            { name: 'Vla', ingredients: [{ catalogItemId: milkId, quantity: 1 }] },
            { name: 'Vla', ingredients: Array.from({ length: 61 }, () => ingredient) }
        ]) {
            assert.equal((await call('POST', '/recipes', asUser, refused)).status, 400, JSON.stringify(refused));
        }
        assert.equal(
            (
                await call('POST', '/recipes', asUser, {
                    name: 'Vla',
                    ingredients: [{ catalogItemId: 999999, quantity: 1, note: '' }]
                })
            ).status,
            404
        );

        assert.equal(
            (await call('POST', '/recipes', asUser, { name: 'Vla', category: 'toetje', ingredients: [] })).status,
            400
        );

        assert.equal(
            (
                await call('POST', '/recipes', asUser, {
                    name: 'Vla',
                    sourceUrl: 'javascript:alert(1)',
                    ingredients: []
                })
            ).status,
            400
        );

        const made = await call<{
            id: number;
            category: string;
            ingredients: Array<{ quantity: number; note: string }>;
        }>('POST', '/recipes', asGuest, {
            name: 'Vla',
            description: 'Roeren.',
            category: 'dessert',
            ingredients: [ingredient]
        });
        assert.equal(made.status, 201);
        assert.equal(made.body.category, 'dessert');
        assert.deepEqual(
            made.body.ingredients.map(({ quantity, note }) => [quantity, note]),
            [[2, 'vol']]
        );
        assert.equal((await call('POST', '/recipes', asUser, { name: 'Vla', ingredients: [] })).status, 409);
        assert.equal((await call<{ recipeCount: number }>('GET', `/catalog/${milkId}`, asUser)).body.recipeCount, 1);

        assert.equal((await call('POST', '/recipes/additions', asUser, { name: 'Vla', ingredients: [] })).status, 400);
        const added = await call<{ result: string; added: number; scanId: number }>(
            'POST',
            '/recipes/additions',
            asGuest,
            { name: 'Vla', ingredients: [ingredient] }
        );
        assert.deepEqual([added.status, added.body.result, added.body.added], [201, 'recipe', 1]);
        const entries = await call<Array<{ catalogItemId: number; note: string; quantity: number }>>(
            'GET',
            '/list',
            asUser
        );
        assert.equal(entries.body.find((entry) => entry.catalogItemId === milkId && entry.note === 'vol')?.quantity, 2);
        const history = await call<Array<{ id: number; title: string; source: string; changes: Array<unknown> }>>(
            'GET',
            '/scans?limit=1',
            asUser
        );
        assert.deepEqual(
            [history.body[0].id, history.body[0].title, history.body[0].source, history.body[0].changes.length],
            [added.body.scanId, 'Vla', 'app', 1]
        );
        assert.equal((await call('POST', '/scans/undo', asUser)).status, 201);

        assert.equal((await call('PATCH', '/recipes/999999', asUser, { name: 'Niets', ingredients: [] })).status, 404);
        assert.equal(
            (await call('PATCH', `/recipes/${made.body.id}`, asUser, { name: 'Vanillevla', ingredients: [] })).status,
            200
        );
        assert.equal((await call('GET', '/recipes', asAgent)).status, 403);
        assert.equal((await call('DELETE', `/recipes/${made.body.id}`, asUser)).status, 204);
        assert.equal((await call('GET', `/recipes/${made.body.id}`, asUser)).status, 404);
        assert.deepEqual((await call('GET', '/recipes', asUser)).body, []);
    });

    it('takes a picture for a recipe, serves it in two sizes and removes it', async () => {
        const made = await call<{ id: number; picture: string }>('POST', '/recipes', asGuest, {
            name: 'Tosti',
            ingredients: []
        });
        const path = `/recipes/${made.body.id}/picture`;
        const send = (body: BodyInit, type: string, headers = asGuest): Promise<Response> =>
            fetch(`${base}${path}`, { method: 'PUT', headers: { ...headers, 'content-type': type }, body });
        const photo = await sharp({ create: { width: 900, height: 900, channels: 4, background: '#33669980' } })
            .png()
            .toBuffer();

        assert.equal(made.body.picture, '');
        assert.equal((await call('GET', path, asGuest)).status, 404);
        assert.equal((await send(photo, 'image/png', asAgent)).status, 403);
        assert.equal((await send(photo, 'application/octet-stream')).status, 400);
        assert.equal((await send('geen plaatje', 'image/png')).status, 400);
        assert.equal((await send(Buffer.alloc(10 * 1024 * 1024 + 1), 'image/png')).status, 413);
        assert.equal(
            (await fetch(`${base}/recipes/999999/picture`, { method: 'PUT', headers: asGuest, body: photo })).status,
            400
        );

        const kept = await send(photo, 'image/png');
        const { picture, pictureSource } = (await kept.json()) as { picture: string; pictureSource: string };
        assert.equal(kept.status, 200);
        assert.match(picture, /^[0-9a-f]{12}$/);
        assert.equal(pictureSource, '');

        for (const [query, width, height] of [
            ['', 600, 450],
            ['?size=small', 600, 450],
            ['?size=large', 900, 900]
        ] as Array<[string, number, number]>) {
            const answer = await fetch(`${base}${path}${query}`, { headers: asGuest });
            const facts = await sharp(Buffer.from(await answer.arrayBuffer())).metadata();
            assert.equal(answer.status, 200);
            assert.equal(answer.headers.get('content-type'), 'image/jpeg');
            assert.equal(answer.headers.get('cache-control'), 'private, max-age=31536000, immutable');
            assert.deepEqual([facts.format, facts.width, facts.height], ['jpeg', width, height], query);
        }
        assert.equal((await fetch(`${base}${path}`)).status, 401);

        assert.equal((await call('DELETE', path, asGuest)).status, 204);
        assert.equal((await call('GET', path, asGuest)).status, 404);
        assert.equal((await call<{ picture: string }>('GET', `/recipes/${made.body.id}`, asGuest)).body.picture, '');
        assert.equal((await call('DELETE', '/recipes/999999/picture', asGuest)).status, 404);
        assert.equal((await call('DELETE', `/recipes/${made.body.id}`, asGuest)).status, 204);
    });

    it('takes a recipe code from the handheld scanner, offers an unknown recipe once, and keeps or drops the offer', async () => {
        const code = `R1;Wentelteefjes;${milkId}*2:kaneel;999999`;
        for (const refused of ['R2;Later;1', 'R1;;1', 'R1;Kapot;vijf', `R1;Te lang;${'9'.repeat(2100)}`]) {
            assert.equal((await call('POST', '/scans', asAgent, { code: refused })).status, 400, refused);
        }

        const scanned = await call<{ result: string; title: string; added: number; unknown: Array<number> }>(
            'POST',
            '/scans',
            asAgent,
            { code }
        );
        assert.deepEqual(
            [scanned.status, scanned.body.result, scanned.body.title, scanned.body.added, scanned.body.unknown],
            [201, 'recipe_partial', 'Wentelteefjes', 1, [999999]]
        );
        const entries = await call<Array<{ catalogItemId: number; note: string; quantity: number }>>(
            'GET',
            '/list',
            asUser
        );
        assert.equal(
            entries.body.find((entry) => entry.catalogItemId === milkId && entry.note === 'kaneel')?.quantity,
            2
        );
        const history = await call<Array<{ source: string; title: string }>>('GET', '/scans?limit=1', asUser);
        assert.deepEqual([history.body[0].source, history.body[0].title], ['handheld', 'Wentelteefjes']);

        assert.equal((await call('POST', '/scans', asGuest, { code })).status, 201);
        type Offer = { id: number; name: string; products: number; unknown: Array<number>; nameTaken: boolean };
        const offers = await call<Array<Offer>>('GET', '/recipes/offers', asGuest);
        assert.deepEqual(
            offers.body.map(({ name, products, unknown, nameTaken }) => [name, products, unknown, nameTaken]),
            [['Wentelteefjes', 2, [999999], false]]
        );
        assert.equal((await call('GET', '/recipes/offers', asAgent)).status, 403);

        const saved = await call<{ id: number; name: string; ingredients: Array<{ note: string }> }>(
            'POST',
            `/recipes/offers/${offers.body[0].id}/save`,
            asGuest
        );
        assert.deepEqual(
            [saved.status, saved.body.name, saved.body.ingredients.map(({ note }) => note)],
            [201, 'Wentelteefjes', ['kaneel']]
        );
        assert.deepEqual((await call('GET', '/recipes/offers', asUser)).body, []);
        assert.equal((await call('POST', `/recipes/offers/${offers.body[0].id}/save`, asUser)).status, 404);

        assert.equal(
            (await call('POST', '/scans', asAgent, { code: `R1;Wentelteefjes;${milkId}*2:kaneel` })).status,
            201
        );
        assert.deepEqual((await call('GET', '/recipes/offers', asUser)).body, []);

        assert.equal((await call('POST', '/scans', asAgent, { code })).status, 201);
        const again = await call<Array<Offer>>('GET', '/recipes/offers', asUser);
        assert.deepEqual(
            again.body.map(({ name, nameTaken }) => [name, nameTaken]),
            [['Wentelteefjes', true]]
        );
        assert.equal((await call('POST', `/recipes/offers/${again.body[0].id}/save`, asUser)).status, 409);
        assert.equal((await call('DELETE', `/recipes/offers/${again.body[0].id}`, asUser)).status, 204);
        assert.equal((await call('DELETE', `/recipes/offers/${again.body[0].id}`, asUser)).status, 404);

        for (let scan = 0; scan < 4; scan++) {
            assert.equal((await call('POST', '/scans/undo', asUser)).status, 201);
        }
        assert.equal((await call('DELETE', `/recipes/${saved.body.id}`, asUser)).status, 204);
    });

    it('takes the ticked products of a recipe code read by the camera, and offers the recipe or keeps it at once', async () => {
        const code = `R1;Camerarecept;${milkId}*2;999999`;
        const chosen = { name: 'Camerarecept', ingredients: [{ catalogItemId: milkId, quantity: 2, note: '' }] };
        for (const refused of ['R1;;1', 'R2;Later;1', 'geen code']) {
            assert.equal(
                (await call('POST', '/recipes/additions', asUser, { ...chosen, code: refused })).status,
                400,
                refused
            );
        }

        const added = await call<{ result: string; added: number }>('POST', '/recipes/additions', asUser, {
            ...chosen,
            code
        });
        assert.deepEqual([added.status, added.body.result, added.body.added], [201, 'recipe', 1]);
        const history = await call<Array<{ source: string; title: string }>>('GET', '/scans?limit=1', asUser);
        assert.deepEqual([history.body[0].source, history.body[0].title], ['phone', 'Camerarecept']);
        type Offer = { id: number; name: string; nameTaken: boolean };
        const offered = await call<Array<Offer>>('GET', '/recipes/offers', asUser);
        assert.deepEqual(
            offered.body.map(({ name, nameTaken }) => [name, nameTaken]),
            [['Camerarecept', false]]
        );

        assert.equal((await call('POST', '/recipes/additions', asUser, { ...chosen, code, save: true })).status, 201);
        assert.deepEqual((await call('GET', '/recipes/offers', asUser)).body, []);
        type Kept = { id: number; name: string; ingredients: Array<{ catalogItemId: number; quantity: number }> };
        const kept = (await call<Array<Kept>>('GET', '/recipes', asUser)).body.find(
            ({ name }) => name === 'Camerarecept'
        );
        assert.deepEqual(
            kept?.ingredients.map(({ catalogItemId, quantity }) => [catalogItemId, quantity]),
            [[milkId, 2]]
        );

        assert.equal((await call('POST', '/recipes/additions', asUser, { ...chosen, code, save: true })).status, 201);
        const again = await call<Array<Offer>>('GET', '/recipes/offers', asUser);
        assert.deepEqual(
            again.body.map(({ name, nameTaken }) => [name, nameTaken]),
            [['Camerarecept', true]]
        );

        assert.equal((await call('POST', '/recipes/additions', asUser, chosen)).status, 201);
        const plain = await call<Array<{ source: string }>>('GET', '/scans?limit=1', asUser);
        assert.equal(plain.body[0].source, 'app');

        for (let scan = 0; scan < 4; scan++) {
            assert.equal((await call('POST', '/scans/undo', asUser)).status, 201);
        }
        assert.equal((await call('DELETE', `/recipes/offers/${again.body[0].id}`, asUser)).status, 204);
        assert.equal((await call('DELETE', `/recipes/${kept?.id}`, asUser)).status, 204);
    });

    it('takes a recipe addition made without a connection at its own time, and only once when it is sent twice', async () => {
        const addedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const addition = {
            name: 'Offline recept',
            ingredients: [{ catalogItemId: milkId, quantity: 3, note: 'later' }],
            addedAt
        };
        const quantity = async (): Promise<number | undefined> =>
            (
                await call<Array<{ catalogItemId: number; note: string; quantity: number }>>('GET', '/list', asUser)
            ).body.find((entry) => entry.catalogItemId === milkId && entry.note === 'later')?.quantity;
        assert.equal(
            (await call('POST', '/recipes/additions', asUser, { ...addition, addedAt: 'gisteren' })).status,
            400
        );

        const first = await call<{ scanId: number; added: number }>('POST', '/recipes/additions', asUser, addition);
        const second = await call<{ scanId: number; added: number }>('POST', '/recipes/additions', asUser, addition);
        assert.deepEqual([first.status, second.status, second.body.added], [201, 201, 1]);
        assert.equal(second.body.scanId, first.body.scanId);
        assert.equal(await quantity(), 3);
        const history = await call<Array<{ id: number; createdAt: string }>>('GET', '/scans?limit=50', asUser);
        assert.equal(history.body.find(({ id }) => id === first.body.scanId)?.createdAt, addedAt);

        const later = await call<{ scanId: number }>('POST', '/recipes/additions', asUser, {
            ...addition,
            addedAt: new Date(Date.now() - 60 * 1000).toISOString()
        });
        assert.notEqual(later.body.scanId, first.body.scanId);
        assert.equal(await quantity(), 6);

        for (let scan = 0; scan < 2; scan++) {
            assert.equal((await call('POST', '/scans/undo', asUser)).status, 201);
        }
    });

    it('answers 404 for a barcode it has never seen', async () => {
        assert.equal((await call('GET', '/barcodes/00000000', asUser)).status, 404);
    });

    it('checks the choice of a sound', async () => {
        assert.equal((await call('PUT', '/feedback/settings/party', asUser, { soundId: 'tick' })).status, 400);
        assert.equal((await call('PUT', '/feedback/settings/added', asUser, { soundId: 'kazoo' })).status, 400);
        assert.equal((await call('PUT', '/feedback/settings/added', asUser, { soundId: 'tick' })).status, 200);
    });

    it('checks sounds made of blocks', async () => {
        const sound = (blocks: unknown, name = 'Test'): Promise<{ status: number }> =>
            call('POST', '/feedback/sounds', asUser, { name, blocks });
        assert.equal((await sound([{ kind: 'kazoo', ms: 100 }])).status, 400);
        assert.equal((await sound([{ kind: 'beep', ms: 'long' }])).status, 400);
        assert.equal((await sound(Array.from({ length: 101 }, () => ({ kind: 'beep', ms: 10 })))).status, 400);
        assert.equal((await sound([{ kind: 'beep', ms: 100 }], 'x'.repeat(41))).status, 400);

        const made = await call<{ sounds: Array<{ id: string; name?: string }> }>('POST', '/feedback/sounds', asUser, {
            name: 'Toeter',
            blocks: [{ kind: 'buzz', ms: 300, rate: 400 }]
        });
        const id = made.body.sounds.find((preset) => preset.name === 'Toeter')?.id as string;
        assert.equal(made.status, 201);
        assert.equal(
            (await call('PUT', `/feedback/sounds/${id}`, asUser, { blocks: [{ kind: 'beep', ms: 30 }] })).status,
            200
        );
        assert.equal(
            (await call('POST', '/feedback/test-blocks', asUser, { blocks: [{ kind: 'beep', ms: 30 }] })).status,
            202
        );
        assert.equal((await call('POST', '/feedback/test-blocks', asUser, { blocks: [] })).status, 400);
        assert.equal((await call('DELETE', '/feedback/sounds/tick', asUser)).status, 409);
        assert.equal((await call('DELETE', `/feedback/sounds/${id}`, asUser)).status, 200);
        assert.equal((await call('DELETE', `/feedback/sounds/${id}`, asUser)).status, 400);
    });

    it('keeps the agent to its own four routes', async () => {
        assert.equal((await call('GET', '/feedback/settings', asAgent)).status, 200);
        assert.equal(
            (await call('POST', '/logs', asAgent, { level: 'info', message: 'scanner connected' })).status,
            204
        );

        assert.equal((await call('GET', '/list', asAgent)).status, 403);
        assert.equal((await call('GET', '/catalog', asAgent)).status, 403);
        assert.equal((await call('DELETE', `/catalog/${milkId}`, asAgent)).status, 403);
        assert.equal((await call('POST', '/scans/undo', asAgent)).status, 403);
        assert.equal((await call('PUT', '/feedback/settings/added', asAgent, { soundId: 'none' })).status, 403);
    });

    it('shows whether the agent and its scanner are there', async () => {
        const silent = await call<{ agentOnline: boolean; scanner?: string }>('GET', '/agent/status', asUser);
        assert.deepEqual([silent.body.agentOnline, silent.body.scanner], [false, undefined]);

        assert.equal((await call('POST', '/agent/status', asAgent, { scanner: 'sleeping' })).status, 400);
        assert.equal(
            (await call('POST', '/agent/status', asAgent, { scanner: 'connected', device: 'HID 0581:011c' })).status,
            204
        );
        const connected = await call<{
            agentOnline: boolean;
            scanner: string;
            device: string;
            lastHandheldScanAt?: string;
        }>('GET', '/agent/status', asUser);
        assert.deepEqual(
            [connected.body.agentOnline, connected.body.scanner, connected.body.device],
            [true, 'connected', 'HID 0581:011c']
        );
        assert.ok(connected.body.lastHandheldScanAt);

        await call('POST', '/agent/status', asAgent, { scanner: 'waiting' });
        assert.equal((await call<{ scanner: string }>('GET', '/agent/status', asUser)).body.scanner, 'waiting');
        assert.equal((await call('GET', '/agent/status', asAgent)).status, 403);
    });

    it('keeps the system parts for the owner and the list for everyone on the allowlist', async () => {
        const me = await call<{ owner: boolean; email: string }>('GET', '/auth/me', asGuest);
        assert.deepEqual([me.body.owner, me.body.email], [false, GUEST]);
        assert.equal((await call<{ owner: boolean }>('GET', '/auth/me', asUser)).body.owner, true);

        for (const [method, path, body] of [
            ['GET', '/logs', undefined],
            ['GET', '/scans', undefined],
            ['GET', '/agent/status', undefined],
            ['GET', '/feedback/settings', undefined],
            ['PUT', '/feedback/settings/added', { soundId: 'tick' }],
            ['POST', '/feedback/test', { soundId: 'tick' }],
            ['POST', '/feedback/test-blocks', { blocks: [{ kind: 'beep', ms: 20 }] }],
            ['POST', '/push/test', undefined]
        ] as Array<[string, string, unknown]>) {
            assert.equal((await call(method, path, asGuest, body)).status, 403, `${method} ${path} as guest`);
            assert.ok((await call(method, path, asUser, body)).status < 300, `${method} ${path} as owner`);
        }

        const source = { source: 'https://example.com/recept' };
        assert.equal((await call('POST', '/recipes/imports', asGuest, source)).status, 403);
        assert.equal((await call('POST', '/recipes/imports', asUser, { source: ' ' })).status, 400);
        assert.equal((await call('POST', '/recipes/imports', asUser, source)).status, 503);
        for (const session of [asGuest, asUser]) {
            assert.deepEqual((await call('GET', '/recipes/imports', session)).body, { available: false });
        }

        assert.equal((await call('GET', '/list', asGuest)).status, 200);
        assert.equal((await call('GET', '/catalog', asGuest)).status, 200);
        assert.equal((await call('POST', '/scans', asGuest, { code: '22223333' })).status, 201);
        assert.equal((await call('POST', '/scans/undo', asGuest)).status, 201);
        assert.equal((await call('GET', '/push/key', asGuest)).status, 200);
        assert.equal((await call('GET', '/feedback/settings', asAgent)).status, 200);
    });

    it('labels log lines by who sent them', async () => {
        await call('POST', '/logs', asUser, { level: 'info', message: 'notification tapped' });
        const lines = await call<Array<{ source: string; message: string }>>('GET', '/logs?limit=10', asUser);

        assert.equal(lines.body.find((line) => line.message === 'scanner connected')?.source, 'agent');
        assert.equal(lines.body.find((line) => line.message === 'notification tapped')?.source, 'phone');
        assert.equal((await call('POST', '/logs', asUser, { level: 'loud', message: 'x' })).status, 400);
    });
});

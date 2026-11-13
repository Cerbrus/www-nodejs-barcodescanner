import 'reflect-metadata';


import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { testFolder } from './test-env';
import { ApiModule } from '../api/api.module';
import { configureApi } from '../api/configure-api';
import { AppConfigModule } from '../config/config.module';
import { SESSION_COOKIE } from '../core/rules/session';
import { SessionService } from '../core/services/session.service';

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
class TestModule {
}

describe('data routes over HTTP', () => {
    let app: INestApplication;
    let base: string;
    let asUser: Record<string, string>;
    let asGuest: Record<string, string>;
    let milkId: number;
    const asAgent = { 'x-agent-token': AGENT_TOKEN };

    async function call<T = unknown>(method: string, path: string, headers: Record<string, string>, body?: unknown): Promise<Answer<T>> {
        const answer = await fetch(`${base}${path}`, {
            method,
            headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const text = await answer.text();

        return { status: answer.status, body: (text ? JSON.parse(text) : undefined) as T };
    }

    before(async () => {
        app = await NestFactory.create(TestModule, { logger: false });
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
        const scan = await call<{ result: string }>('POST', '/scans', asUser, { code: UNKNOWN_CODE, source: 'handheld' });
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
        const first = await call<{ result: string }>('POST', '/scans', asAgent, { code: '11116666', scannedAt: at(40) });
        const second = await call<{ result: string }>('POST', '/scans', asAgent, { code: '11116666', scannedAt: at(30) });

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

        const list = await call<Array<{ catalogItemId: number; state: string; quantity: number }>>('GET', '/list', asUser);
        const milk = list.body.find((entry) => entry.catalogItemId === milkId);
        assert.equal(milk?.state, 'to_buy');
        assert.equal(milk?.quantity, 2);
    });

    it('checks changes to the list', async () => {
        assert.equal((await call('PATCH', `/list/${milkId}`, asUser, { state: 'bought' })).status, 400);
        assert.equal((await call('PATCH', `/list/${milkId}`, asUser, { quantity: 0 })).status, 400);
        assert.equal((await call('PATCH', '/list/999999', asUser, { state: 'to_buy' })).status, 404);
        assert.equal((await call('PATCH', `/list/${milkId}`, asUser, { quantity: 3, note: 'halfvol' })).status, 200);
        assert.equal((await call('DELETE', `/list/${milkId}`, asUser)).status, 204);
    });

    it('applies changes made offline in order, unless the server changed the entry later', async () => {
        const butter = (await call<Array<{ id: number; name: string }>>('GET', '/catalog', asUser)).body.find((item) => item.name === 'Boter')?.id as number;
        const at = (secondsAgo: number): string => new Date(Date.now() - secondsAgo * 1000).toISOString();
        type Entry = { catalogItemId: number; state: string; quantity: number };
        const entryOf = async (id: number): Promise<Entry | undefined> =>
            (await call<Array<Entry>>('GET', '/list', asUser)).body.find((entry) => entry.catalogItemId === id);

        await call('PATCH', `/list/${butter}`, asUser, { state: 'to_buy', quantity: 1 });
        const sent = await call<{ applied: number; skipped: Array<number> }>('POST', '/list/offline-changes', asUser, {
            changes: [
                { catalogItemId: butter, quantity: 3, changedAt: at(-2) },
                { catalogItemId: butter, state: 'recent', changedAt: at(-3) },
                { catalogItemId: 999999, state: 'to_buy', changedAt: at(-3) }
            ]
        });
        assert.deepEqual([sent.status, sent.body.applied, sent.body.skipped], [200, 2, [999999]]);
        assert.equal((await entryOf(butter))?.state, 'recent');

        await call('PATCH', `/list/${butter}`, asUser, { state: 'to_buy', quantity: 2 });
        const late = await call<{ applied: number; skipped: Array<number> }>('POST', '/list/offline-changes', asUser, {
            changes: [{ catalogItemId: butter, state: 'recent', changedAt: at(600) }]
        });
        assert.deepEqual([late.body.applied, late.body.skipped], [0, [butter]]);
        assert.deepEqual([(await entryOf(butter))?.state, (await entryOf(butter))?.quantity], ['to_buy', 2]);

        await new Promise((resolve) => setTimeout(resolve, 1100));
        const twice = await call<{ applied: number; skipped: Array<number> }>('POST', '/list/offline-changes', asUser, {
            changes: [
                { catalogItemId: butter, quantity: 3, changedAt: at(0.6) },
                { catalogItemId: butter, quantity: 4, changedAt: at(0.3) }
            ]
        });
        assert.deepEqual([twice.body.applied, twice.body.skipped], [2, []]);
        assert.equal((await entryOf(butter))?.quantity, 4);

        assert.equal((await call('POST', '/list/offline-changes', asUser, { changes: [{ catalogItemId: butter, state: 'gone', changedAt: at(1) }] })).status, 400);
        assert.equal((await call('POST', '/list/offline-changes', asAgent, { changes: [] })).status, 403);
    });

    it('checks new and changed products', async () => {
        assert.equal((await call('POST', '/catalog', asUser, { sectionId: 'zuivel' })).status, 400);
        assert.equal((await call('POST', '/catalog', asUser, { name: 'Melk', sectionId: 'zuivel' })).status, 409);
        assert.equal((await call('POST', '/catalog', asUser, { name: 'Winterpeen', sectionId: 'nowhere' })).status, 404);

        const created = await call<{ id: number; custom: boolean }>('POST', '/catalog', asUser, { name: 'Winterpeen', sectionId: 'fruit-groenten' });
        assert.equal(created.status, 201);
        assert.equal(created.body.custom, true);

        assert.equal((await call('PATCH', `/catalog/${created.body.id}`, asUser, { name: 'Melk' })).status, 409);
        assert.equal((await call('DELETE', `/catalog/${created.body.id}`, asUser)).status, 204);
        assert.equal((await call('GET', `/catalog/${created.body.id}`, asUser)).status, 404);
    });

    it('answers 404 for a barcode it has never seen', async () => {
        assert.equal((await call('GET', '/barcodes/00000000', asUser)).status, 404);
    });

    it('checks the choice of a sound', async () => {
        assert.equal((await call('PUT', '/feedback/settings/party', asUser, { soundId: 'tick' })).status, 400);
        assert.equal((await call('PUT', '/feedback/settings/added', asUser, { soundId: 'kazoo' })).status, 400);
        assert.equal((await call('PUT', '/feedback/settings/added', asUser, { soundId: 'tick' })).status, 200);
    });

    it('keeps the agent to its own four routes', async () => {
        assert.equal((await call('GET', '/feedback/settings', asAgent)).status, 200);
        assert.equal((await call('POST', '/logs', asAgent, { level: 'info', message: 'scanner connected' })).status, 204);

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
        assert.equal((await call('POST', '/agent/status', asAgent, { scanner: 'connected', device: 'HID 0581:011c' })).status, 204);
        const connected = await call<{ agentOnline: boolean; scanner: string; device: string; lastHandheldScanAt?: string }>('GET', '/agent/status', asUser);
        assert.deepEqual([connected.body.agentOnline, connected.body.scanner, connected.body.device], [true, 'connected', 'HID 0581:011c']);
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
            ['POST', '/push/test', undefined]
        ] as Array<[string, string, unknown]>) {
            assert.equal((await call(method, path, asGuest, body)).status, 403, `${method} ${path} as guest`);
            assert.ok((await call(method, path, asUser, body)).status < 300, `${method} ${path} as owner`);
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

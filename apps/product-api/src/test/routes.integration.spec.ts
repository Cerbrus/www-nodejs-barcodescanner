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
const AGENT_TOKEN = 'agent-token-for-tests';
const UNKNOWN_CODE = '8710400335481';

process.env['GOOGLE_CLIENT_ID'] = 'test-client';
process.env['GOOGLE_CLIENT_SECRET'] = 'test-secret';
process.env['PUBLIC_URL'] = SITE;
process.env['ALLOWED_EMAILS'] = OWNER;
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

    it('labels log lines by who sent them', async () => {
        await call('POST', '/logs', asUser, { level: 'info', message: 'notification tapped' });
        const lines = await call<Array<{ source: string; message: string }>>('GET', '/logs?limit=10', asUser);

        assert.equal(lines.body.find((line) => line.message === 'scanner connected')?.source, 'agent');
        assert.equal(lines.body.find((line) => line.message === 'notification tapped')?.source, 'phone');
        assert.equal((await call('POST', '/logs', asUser, { level: 'loud', message: 'x' })).status, 400);
    });
});

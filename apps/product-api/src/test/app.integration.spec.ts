import 'reflect-metadata';


import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { testFolder } from './test-env';
import { configureApi } from '../api/configure-api';
import { AppModule } from '../app.module';

const frontend = join(testFolder, 'public');

mkdirSync(frontend, { recursive: true });
writeFileSync(join(frontend, 'index.html'), '<title>Boodschappen</title><script>start()</script>');
process.env['FRONTEND_PATH'] = frontend;
process.env['ICONS_PATH'] = join(process.cwd(), 'data', 'icons');
process.env['APP_VERSION'] = '9.9.9';

describe('the whole app module', () => {
    let app: NestExpressApplication;
    let site: string;

    before(async () => {
        app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
        configureApi(app);
        await app.listen(0, '127.0.0.1');
        site = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });

    after(async () => {
        await app.close();
        rmSync(testFolder, { recursive: true, force: true });
    });

    it('reports its health and version', async () => {
        const health = (await (await fetch(`${site}/api/v1/health`)).json()) as { status: string; version: string };

        assert.deepEqual([health.status, health.version], ['ok', '9.9.9']);
    });

    it('serves the web app for the root and for unknown pages', async () => {
        assert.match(await (await fetch(`${site}/`)).text(), /Boodschappen/);
        assert.match(await (await fetch(`${site}/list`)).text(), /Boodschappen/);
    });

    it('serves the icons, and answers 404 for one that does not exist', async () => {
        const icon = await fetch(`${site}/icons/milk.png`);

        assert.equal(icon.status, 200);
        assert.equal(icon.headers.get('content-type'), 'image/png');
        assert.equal((await fetch(`${site}/icons/no-such-icon.png`)).status, 404);
    });

    it('forbids framing and type guessing on pages, icons and API answers', async () => {
        for (const path of ['/', '/list', '/icons/milk.png', '/api/v1/health', '/api/v1/no-such-route']) {
            const headers = (await fetch(`${site}${path}`)).headers;

            assert.equal(headers.get('x-frame-options'), 'DENY', path);
            assert.equal(headers.get('x-content-type-options'), 'nosniff', path);
            assert.equal(headers.get('content-security-policy'), "frame-ancestors 'none'", path);
            assert.equal(headers.get('referrer-policy'), 'same-origin', path);
        }
    });

    it('sends the full content policy as report-only, with the hash of the inline script', async () => {
        for (const path of ['/', '/icons/milk.png', '/api/v1/health']) {
            const policy = (await fetch(`${site}${path}`)).headers.get('content-security-policy-report-only') ?? '';

            assert.match(policy, /default-src 'self'/, path);
            assert.match(policy, /script-src 'self' 'sha256-[A-Za-z0-9+/=]+';/, path);
            assert.match(policy, /report-uri \/api\/v1\/csp-reports$/, path);
        }
    });

    it('writes a policy report to the log once, and ignores what is not a report', async () => {
        const report = JSON.stringify({ 'csp-report': { 'effective-directive': 'img-src', 'blocked-uri': 'http://x.example/a.png', 'document-uri': `${site}/` } });
        const send = async (body: string, type: string): Promise<number> =>
            (await fetch(`${site}/api/v1/csp-reports`, { method: 'POST', headers: { 'content-type': type }, body })).status;

        assert.equal(await send(report, 'application/csp-report'), 204);
        assert.equal(await send(report, 'application/csp-report'), 204);
        assert.equal(await send('{"other":1}', 'application/json'), 204);

        const lines = (await (await fetch(`${site}/api/v1/logs`)).json()) as Array<{ level: string; message: string }>;
        const reported = lines.filter((line) => line.message.includes('content policy'));

        assert.equal(reported.length, 1);
        assert.equal(reported[0].level, 'warning');
        assert.match(reported[0].message, /would block http:\/\/x\.example\/a\.png \(img-src\)/);
    });

    it('keeps API paths out of the web app fallback', async () => {
        assert.equal((await fetch(`${site}/api/v1/no-such-route`)).status, 404);
        assert.equal((await fetch(`${site}/api/v1/list`)).status, 200);
    });
});

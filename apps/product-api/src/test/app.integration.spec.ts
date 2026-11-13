import 'reflect-metadata';


import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { testFolder } from './test-env';
import { configureApi } from '../api/configure-api';
import { AppModule } from '../app.module';

const frontend = join(testFolder, 'public');

mkdirSync(frontend, { recursive: true });
writeFileSync(join(frontend, 'index.html'), '<title>Boodschappen</title>');
process.env['FRONTEND_PATH'] = frontend;
process.env['ICONS_PATH'] = join(process.cwd(), 'data', 'icons');
process.env['APP_VERSION'] = '9.9.9';

describe('the whole app module', () => {
    let app: INestApplication;
    let site: string;

    before(async () => {
        app = await NestFactory.create(AppModule, { logger: false });
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

    it('keeps API paths out of the web app fallback', async () => {
        assert.equal((await fetch(`${site}/api/v1/no-such-route`)).status, 404);
        assert.equal((await fetch(`${site}/api/v1/list`)).status, 200);
    });
});

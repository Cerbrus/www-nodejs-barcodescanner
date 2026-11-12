import 'reflect-metadata';

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { Controller, Get, INestApplication, Module, Post, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AuthConfig } from './auth.config';
import { Public } from './auth.guard';
import { AuthModule } from './auth.module';
import { SESSION_COOKIE, newSession, signSession } from './session';

const folder = mkdtempSync(join(tmpdir(), 'barcodescanner-auth-'));
const SITE = 'https://shopping.example.com';
const OWNER = 'owner@example.com';
const AGENT_TOKEN = 'agent-token-for-tests';

process.env['GOOGLE_CLIENT_ID'] = 'test-client';
process.env['GOOGLE_CLIENT_SECRET'] = 'test-secret';
process.env['PUBLIC_URL'] = SITE;
process.env['ALLOWED_EMAILS'] = `Someone@Example.com, ${OWNER}`;
process.env['AGENT_TOKEN'] = AGENT_TOKEN;
process.env['SESSION_SECRET_PATH'] = join(folder, 'session-secret');

@Controller({ path: 'things', version: '1' })
class ThingController {
    @Get()
    public read(): { ok: boolean } {
        return { ok: true };
    }

    @Post()
    public write(): { ok: boolean } {
        return { ok: true };
    }

    @Public()
    @Get('open')
    public open(): { ok: boolean } {
        return { ok: true };
    }
}

@Module({ imports: [AuthModule], controllers: [ThingController] })
class TestModule {
}

describe('login guard over HTTP', () => {
    let app: INestApplication;
    let base: string;
    let secret: string;

    const cookieFor = (email: string): string => `${SESSION_COOKIE}=${signSession(newSession(email, new Date()), secret)}`;
    const status = async (path: string, init?: RequestInit): Promise<number> => (await fetch(`${base}${path}`, { redirect: 'manual', ...init })).status;

    before(async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        app.setGlobalPrefix('api');
        app.enableVersioning({ type: VersioningType.URI });
        await app.listen(0, '127.0.0.1');
        base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;
        secret = app.get(AuthConfig).sessionSecret;
    });

    after(async () => {
        await app.close();
        rmSync(folder, { recursive: true, force: true });
    });

    it('refuses a request without a session', async () => {
        assert.equal(await status('/things'), 401);
        assert.equal(await status('/things', { method: 'POST' }), 401);
    });

    it('lets public routes through', async () => {
        assert.equal(await status('/things/open'), 200);
    });

    it('accepts the session of an allowed account', async () => {
        assert.equal(await status('/things', { headers: { cookie: cookieFor(OWNER) } }), 200);
    });

    it('refuses a valid session of an account that is no longer allowed', async () => {
        assert.equal(await status('/things', { headers: { cookie: cookieFor('stranger@example.com') } }), 401);
    });

    it('refuses a session signed with another secret', async () => {
        const forged = `${SESSION_COOKIE}=${signSession(newSession(OWNER, new Date()), 'another-secret')}`;

        assert.equal(await status('/things', { headers: { cookie: forged } }), 401);
    });

    it('accepts the hardware agent by its token and refuses a wrong one', async () => {
        assert.equal(await status('/things', { method: 'POST', headers: { 'x-agent-token': AGENT_TOKEN } }), 201);
        assert.equal(await status('/things', { method: 'POST', headers: { 'x-agent-token': 'wrong' } }), 401);
    });

    it('refuses a change that comes from another site', async () => {
        const headers = { cookie: cookieFor(OWNER) };

        assert.equal(await status('/things', { method: 'POST', headers: { ...headers, origin: 'https://evil.example.com' } }), 403);
        assert.equal(await status('/things', { method: 'POST', headers: { ...headers, origin: SITE } }), 201);
    });

    it('reports the login state', async () => {
        const anonymous = (await (await fetch(`${base}/auth/me`)).json()) as { enabled: boolean; authenticated: boolean };
        const owner = (await (await fetch(`${base}/auth/me`, { headers: { cookie: cookieFor(OWNER) } })).json()) as { email?: string };

        assert.deepEqual(anonymous, { enabled: true, authenticated: false });
        assert.equal(owner.email, OWNER);
    });

    it('sends the browser to Google with a state cookie, and refuses a callback without it', async () => {
        const start = await fetch(`${base}/auth/google`, { redirect: 'manual' });
        const target = new URL(start.headers.get('location') ?? '');

        assert.equal(start.status, 302);
        assert.equal(target.host, 'accounts.google.com');
        assert.equal(target.searchParams.get('redirect_uri'), `${SITE}/api/v1/auth/google/callback`);
        assert.match(start.headers.get('set-cookie') ?? '', /oauth_state=.+HttpOnly.+Secure/i);

        const callback = await fetch(`${base}/auth/google/callback?code=abc&state=guess`, { redirect: 'manual' });
        assert.equal(callback.status, 302);
        assert.equal(callback.headers.get('location'), '/#/login?error=failed');
        assert.doesNotMatch(callback.headers.get('set-cookie') ?? '', /session=/);
    });
});

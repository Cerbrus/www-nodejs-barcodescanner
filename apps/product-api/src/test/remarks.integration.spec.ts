import 'reflect-metadata';

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { Server, createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';

import { ApiModule } from '../api/api.module';
import { configureApi } from '../api/configure-api';
import { AppConfig } from '../config/app.config';
import { AppConfigModule } from '../config/config.module';
import { SESSION_COOKIE } from '../core/rules/session';
import { RemarkService } from '../core/services/remark.service';
import { SessionService } from '../core/services/session.service';
import { RemarkEntity } from '../data/entities';
import { testFolder } from './test-env';

const SITE = 'https://shopping.example.com';
const OWNER = 'owner@example.com';
const GUEST = 'guest@example.com';
const OTHER = 'other@example.com';
const TOKEN = 'token-for-tests';

interface Answer<T> {
    status: number;
    body: T;
}

interface Remark {
    id: number;
    kind: string;
    text: string;
    state: string;
    account: string;
    page: string;
    target?: Record<string, string>;
    context?: Record<string, unknown>;
    issueNumber?: number;
    issueUrl?: string;
    progress?: { stage: string; pullRequest?: { number: number; title: string; url: string } };
}

interface ReceivedIssue {
    path: string;
    authorization?: string;
    body: { title: string; body: string; labels: Array<string> };
}

@Module({ imports: [AppConfigModule, ApiModule] })
class TestModule {}

describe('remarks over HTTP', () => {
    let app: NestExpressApplication;
    let github: Server;
    let base: string;
    let asOwner: Record<string, string>;
    let asGuest: Record<string, string>;
    let asOther: Record<string, string>;
    let githubStatus = 201;
    let githubIssue: Record<string, unknown> = { state: 'open', labels: [{ name: 'investigate' }] };
    let githubTimeline: Array<unknown> = [];
    let githubReads = 0;
    const mergeCommit = 'abc';
    let taggedVersions: Array<string> = [];
    const received: Array<ReceivedIssue> = [];

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

    const githubAnswer = (url: string): unknown => {
        if (url.includes('/timeline')) {
            return githubTimeline;
        }
        if (url.includes('/pulls/')) {
            return { merge_commit_sha: mergeCommit };
        }
        if (url.includes('/git/matching-refs/')) {
            return taggedVersions.map((version) => ({
                ref: `refs/tags/v${version}`,
                object: { sha: `sha-${version}`, type: 'commit' }
            }));
        }
        if (url.includes('/compare/')) {
            const tagged = taggedVersions.indexOf(url.split('...')[1].replace('sha-', ''));
            const mergedIn = taggedVersions.indexOf('1.1.132');

            return { status: tagged >= mergedIn ? 'ahead' : 'behind' };
        }

        return githubIssue;
    };

    const write = async (headers: Record<string, string>, remark: object): Promise<number> =>
        (await call<{ id: number }>('POST', '/remarks', headers, remark)).body.id;
    const listed = async (headers: Record<string, string>): Promise<Array<Remark>> =>
        (await call<{ remarks: Array<Remark> }>('GET', '/remarks', headers)).body.remarks;

    before(async () => {
        github = createServer((request, response) => {
            let text = '';
            request.on('data', (part) => (text += part));
            request.on('end', () => {
                if (request.method === 'GET') {
                    githubReads++;
                    response.writeHead(githubStatus === 201 ? 200 : githubStatus, {
                        'content-type': 'application/json'
                    });
                    response.end(JSON.stringify(githubAnswer(request.url ?? '')));

                    return;
                }
                received.push({
                    path: request.url ?? '',
                    authorization: request.headers.authorization,
                    body: JSON.parse(text)
                });
                response.writeHead(githubStatus, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ number: 12, html_url: 'https://github.example/issues/12' }));
            });
        });
        await new Promise<void>((resolve) => github.listen(0, '127.0.0.1', resolve));

        process.env['GOOGLE_CLIENT_ID'] = 'test-client';
        process.env['GOOGLE_CLIENT_SECRET'] = 'test-secret';
        process.env['PUBLIC_URL'] = SITE;
        process.env['ALLOWED_EMAILS'] = `${OWNER}, ${GUEST}, ${OTHER}`;
        process.env['APP_VERSION'] = '1.1.131';
        process.env['GITHUB_ISSUES_TOKEN'] = TOKEN;
        process.env['GITHUB_REPOSITORY'] = 'someone/shop';
        process.env['GITHUB_API_URL'] = `http://127.0.0.1:${(github.address() as AddressInfo).port}/`;

        app = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
        configureApi(app);
        await app.listen(0, '127.0.0.1');
        base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;
        const cookie = (email: string): Record<string, string> => ({
            cookie: `${SESSION_COOKIE}=${app.get(SessionService).issue(email)}`
        });
        asOwner = cookie(OWNER);
        asGuest = cookie(GUEST);
        asOther = cookie(OTHER);
    });

    after(async () => {
        await app.close();
        await new Promise((resolve) => github.close(resolve));
        rmSync(testFolder, { recursive: true, force: true });
    });

    it('needs a login', async () => {
        assert.equal((await call('POST', '/remarks', {}, { kind: 'bug', text: 'x' })).status, 401);
        assert.equal((await call('GET', '/remarks', {})).status, 401);
    });

    it('refuses a remark without a text, with an unknown kind or with a text that is too long', async () => {
        for (const remark of [
            { kind: 'bug' },
            { kind: 'bug', text: '' },
            { kind: 'rant', text: 'x' },
            { kind: 'bug', text: 'x'.repeat(2001) },
            { kind: 'bug', text: 'x', target: 'tile' }
        ]) {
            assert.equal(
                (await call('POST', '/remarks', asGuest, remark)).status,
                400,
                JSON.stringify(remark).slice(0, 60)
            );
        }
    });

    it('keeps a remark of any account, with what was pointed at and the known facts only', async () => {
        const id = await write(asGuest, {
            kind: 'bug',
            text: '  The pill is white on white  ',
            page: '#/list',
            target: { component: 'app-item-tile', text: 'Melk', secret: 'dropped' },
            context: { version: '1.1.40', installed: true, cookie: 'dropped' }
        });
        const [remark] = (await listed(asGuest)).filter((row) => row.id === id);

        assert.equal(remark.text, 'The pill is white on white');
        assert.deepEqual([remark.kind, remark.state, remark.account, remark.page], ['bug', 'open', GUEST, '#/list']);
        assert.deepEqual(remark.target, { component: 'app-item-tile', text: 'Melk' });
        assert.deepEqual(remark.context, { version: '1.1.40', installed: true });
    });

    it('shows every account its own remarks and the owner all of them, newest first', async () => {
        await write(asOther, { kind: 'wish', text: 'A dark icon' });
        await write(asOwner, { kind: 'note', text: 'Check the buzzer' });

        assert.deepEqual(
            (await listed(asOther)).map((remark) => remark.text),
            ['A dark icon']
        );
        assert.deepEqual(new Set((await listed(asGuest)).map((remark) => remark.account)), new Set([GUEST]));
        assert.deepEqual(
            (await listed(asOwner)).slice(0, 2).map((remark) => remark.text),
            ['Check the buzzer', 'A dark icon']
        );
        assert.equal((await listed(asOwner)).length, 3);
    });

    it('keeps the time a remark was written without a connection, but not a time in the future', async () => {
        const earlier = await write(asGuest, { kind: 'note', text: 'offline', writtenAt: '2026-11-01T10:00:00.000Z' });
        const later = await write(asGuest, {
            kind: 'note',
            text: 'clock is off',
            writtenAt: '2099-01-01T00:00:00.000Z'
        });
        const rows = (await app.get(DataSource).getRepository(RemarkEntity).find()).filter((row) =>
            [earlier, later].includes(row.id)
        );

        assert.equal(rows.find((row) => row.id === earlier)?.createdAt.toISOString(), '2026-11-01T10:00:00.000Z');
        assert.ok((rows.find((row) => row.id === later)?.createdAt.getTime() ?? Infinity) <= Date.now());
        assert.equal(
            (await call('POST', '/remarks', asGuest, { kind: 'note', text: 'x', writtenAt: 'yesterday' })).status,
            400
        );
    });

    it('lets only the owner close a remark, send it to GitHub or see what would be sent', async () => {
        const [remark] = await listed(asGuest);

        assert.equal((await call('PATCH', `/remarks/${remark.id}`, asGuest, { state: 'closed' })).status, 403);
        assert.equal((await call('POST', `/remarks/${remark.id}/issue-draft`, asGuest, {})).status, 403);
        assert.equal((await call('POST', `/remarks/${remark.id}/issue`, asGuest, {})).status, 403);
        assert.equal(received.length, 0);

        const closed = await call<Remark>('PATCH', `/remarks/${remark.id}`, asOwner, { state: 'closed' });
        assert.deepEqual([closed.status, closed.body.state], [200, 'closed']);
        assert.equal(
            (await call<Remark>('PATCH', `/remarks/${remark.id}`, asOwner, { state: 'open' })).body.state,
            'open'
        );
        assert.equal((await call('PATCH', `/remarks/${remark.id}`, asOwner, { state: 'done' })).status, 400);
        assert.equal((await call('PATCH', '/remarks/99999', asOwner, { state: 'closed' })).status, 404);
    });

    it('tells the owner, and nobody else, that remarks can go to GitHub', async () => {
        assert.equal((await call<{ canSendToGitHub: boolean }>('GET', '/remarks', asOwner)).body.canSendToGitHub, true);
        assert.equal(
            (await call<{ canSendToGitHub: boolean }>('GET', '/remarks', asGuest)).body.canSendToGitHub,
            false
        );
    });

    it('shows the owner exactly what would be sent, without the account and the device unless asked', async () => {
        const id = (await listed(asGuest)).find((remark) => remark.text === 'The pill is white on white')?.id;
        const bare = await call<{ title: string; body: string; labels: Array<string> }>(
            'POST',
            `/remarks/${id}/issue-draft`,
            asOwner,
            {}
        );
        const full = await call<{ body: string; labels: Array<string> }>(
            'POST',
            `/remarks/${id}/issue-draft`,
            asOwner,
            { includeAccount: true, investigate: true }
        );

        assert.equal(bare.body.title, 'The pill is white on white');
        assert.deepEqual(bare.body.labels, ['bug']);
        assert.doesNotMatch(bare.body.body, /guest@example\.com/);
        assert.match(full.body.body, /guest@example\.com/);
        assert.deepEqual(full.body.labels, ['bug', 'investigate']);
        assert.equal(received.length, 0);
    });

    it('sends a remark to GitHub once, with the token, and remembers the issue', async () => {
        const id = (await listed(asGuest)).find((remark) => remark.text === 'The pill is white on white')?.id;
        const sent = await call<Remark>('POST', `/remarks/${id}/issue`, asOwner, { investigate: true });

        assert.deepEqual(
            [sent.status, sent.body.issueNumber, sent.body.issueUrl],
            [200, 12, 'https://github.example/issues/12']
        );
        assert.deepEqual(
            [received[0].path, received[0].authorization],
            ['/repos/someone/shop/issues', `Bearer ${TOKEN}`]
        );
        assert.equal(received[0].body.title, 'The pill is white on white');
        assert.deepEqual(received[0].body.labels, ['bug', 'investigate']);
        assert.doesNotMatch(received[0].body.body, /guest@example\.com/);

        assert.equal((await call('POST', `/remarks/${id}/issue`, asOwner, {})).status, 409);
        assert.equal(received.length, 1);
        assert.equal(
            (await listed(asGuest)).find((remark) => remark.id === id)?.issueUrl,
            'https://github.example/issues/12'
        );
    });

    it('keeps the remark as it was when GitHub refuses', async () => {
        const id = await write(asOwner, { kind: 'wish', text: 'Sort by aisle' });
        githubStatus = 403;

        assert.equal((await call('POST', `/remarks/${id}/issue`, asOwner, {})).status, 502);
        assert.equal((await listed(asOwner)).find((remark) => remark.id === id)?.issueUrl, null);

        githubStatus = 201;
    });

    it('lets the owner reject any remark and a writer only their own, hides it, and keeps the row', async () => {
        const mine = await write(asGuest, { kind: 'note', text: 'reject me' });
        const theirs = await write(asGuest, { kind: 'note', text: 'reject me too' });
        const others = await write(asOwner, { kind: 'note', text: 'not yours' });

        assert.equal((await call('DELETE', `/remarks/${others}`, asGuest)).status, 404);
        assert.equal((await call('DELETE', `/remarks/${mine}`, {})).status, 401);
        assert.equal((await call('DELETE', `/remarks/${mine}`, asGuest)).status, 204);
        assert.equal((await call('DELETE', `/remarks/${theirs}`, asOwner)).status, 204);

        assert.equal(
            (await listed(asGuest)).some((remark) => remark.id === mine),
            false
        );
        assert.equal(
            (await listed(asOwner)).some((remark) => [mine, theirs].includes(remark.id)),
            false
        );
        assert.equal((await call('DELETE', `/remarks/${mine}`, asOwner)).status, 404);
        assert.equal((await call('PATCH', `/remarks/${mine}`, asOwner, { state: 'closed' })).status, 404);
        assert.equal((await call('DELETE', '/remarks/99999', asOwner)).status, 404);
        assert.equal(
            (await app.get(DataSource).getRepository(RemarkEntity).findOneBy({ id: mine }))?.state,
            'rejected'
        );
    });

    it('does not reject a remark that is already on GitHub', async () => {
        const id = (await listed(asGuest)).find((remark) => remark.issueUrl)?.id;

        assert.equal((await call('DELETE', `/remarks/${id}`, asGuest)).status, 409);
        assert.equal((await call('DELETE', `/remarks/${id}`, asOwner)).status, 409);
        assert.ok((await listed(asGuest)).some((remark) => remark.id === id));
    });

    it('lets the owner edit any remark and a writer only their own, until it is on GitHub', async () => {
        const mine = await write(asGuest, { kind: 'note', text: 'before' });
        const others = await write(asOwner, { kind: 'note', text: 'not yours' });
        const onGitHub = (await listed(asGuest)).find((remark) => remark.issueUrl)?.id;
        const edit = (id: unknown, headers: Record<string, string>, text: unknown): ReturnType<typeof call> =>
            call('PUT', `/remarks/${id}`, headers, { text });

        assert.equal((await edit(mine, {}, 'x')).status, 401);
        assert.equal((await edit(others, asGuest, 'x')).status, 404);
        assert.equal((await edit(mine, asGuest, '   ')).status, 400);
        assert.equal((await edit(mine, asGuest, 'a'.repeat(2001))).status, 400);
        assert.equal((await edit(99999, asOwner, 'x')).status, 404);
        assert.equal((await edit(mine, asGuest, '  after  ')).status, 200);
        assert.equal((await listed(asGuest)).find((remark) => remark.id === mine)?.text, 'after');
        assert.equal((await edit(mine, asOwner, 'by owner')).status, 200);
        assert.equal((await listed(asOwner)).find((remark) => remark.id === mine)?.text, 'by owner');
        assert.equal((await call('PUT', `/remarks/${mine}`, asGuest, { text: 'kinded', kind: 'bug' })).status, 200);
        assert.equal((await listed(asGuest)).find((remark) => remark.id === mine)?.kind, 'bug');
        assert.equal((await edit(mine, asGuest, 'kept')).status, 200);
        assert.equal((await listed(asGuest)).find((remark) => remark.id === mine)?.kind, 'bug');
        assert.equal((await call('PUT', `/remarks/${mine}`, asGuest, { text: 'x', kind: 'idea' })).status, 400);
        assert.equal((await edit(onGitHub, asGuest, 'late')).status, 409);
        assert.equal((await edit(onGitHub, asOwner, 'late')).status, 409);
        assert.notEqual((await listed(asOwner)).find((remark) => remark.id === onGitHub)?.text, 'late');
    });

    it('shows how far the issue on GitHub has come, and keeps the last answer when GitHub fails', async () => {
        const id = (await listed(asGuest)).find((remark) => remark.issueUrl)?.id;
        const progress = async (): Promise<Remark['progress']> =>
            (await listed(asGuest)).find((remark) => remark.id === id)?.progress;
        const pull = (state: string, mergedAt: string | null): unknown => ({
            event: 'cross-referenced',
            source: {
                issue: {
                    number: 40,
                    title: 'Show the state',
                    html_url: 'https://github.example/pull/40',
                    state,
                    pull_request: { merged_at: mergedAt }
                }
            }
        });

        assert.deepEqual(await progress(), { stage: 'investigating' });

        const reads = githubReads;
        await progress();
        assert.equal(githubReads, reads);

        const remark = app.get(RemarkService) as unknown as { progressCache: Map<number, { at: number }> };
        const forget = (): void => remark.progressCache.forEach((entry) => (entry.at = 0));

        githubIssue = { state: 'open', labels: [{ name: 'agent: implemented' }] };
        githubTimeline = [{ event: 'labeled' }, pull('open', null)];
        forget();
        assert.deepEqual(await progress(), {
            stage: 'review',
            pullRequest: { number: 40, title: 'Show the state', url: 'https://github.example/pull/40' }
        });

        githubStatus = 500;
        forget();
        assert.equal((await progress())?.stage, 'review');
        githubStatus = 201;

        githubIssue = { state: 'closed', labels: [] };
        githubTimeline = [pull('closed', '2026-11-20T12:00:00Z')];
        forget();
        assert.equal((await progress())?.stage, 'merged');

        taggedVersions = ['1.1.130', '1.1.131', '1.1.132', '1.1.133'];
        forget();
        assert.deepEqual(await progress(), {
            stage: 'released',
            pullRequest: { number: 40, title: 'Show the state', url: 'https://github.example/pull/40' },
            version: '1.1.132'
        });

        (app.get(AppConfig) as { version: string }).version = '1.1.132';
        forget();
        assert.equal((await progress())?.stage, 'live');
    });

    it('stops an account after thirty remarks in an hour, without stopping the others', async () => {
        const answers: Array<number> = [];
        for (let count = 0; count < 31; count++) {
            answers.push((await call('POST', '/remarks', asOther, { kind: 'note', text: `note ${count}` })).status);
        }

        assert.equal(answers.filter((status) => status === 201).length, 29);
        assert.equal(answers.at(-1), 429);
        assert.equal((await call('POST', '/remarks', asOwner, { kind: 'note', text: 'still fine' })).status, 201);
    });

    it('records which account a push subscription belongs to', async () => {
        const subscription = { endpoint: 'https://push.example.com/guest-device', p256dh: 'key', auth: 'auth' };

        assert.equal((await call('POST', '/push/subscriptions', asGuest, subscription)).status, 204);

        const stored = await app
            .get(DataSource)
            .query('SELECT account FROM push_subscription WHERE endpoint = ?', [subscription.endpoint]);
        assert.equal(stored[0].account, GUEST);
    });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SESSION_LIFETIME_SECONDS, isAllowedEmail, newSession, parseCookies, safeEqual, signSession, verifySession } from './session';

const secret = 'test-secret';
const now = new Date('2026-11-13T10:00:00Z');
const secondsLater = (seconds: number): Date => new Date(now.getTime() + seconds * 1000);

describe('session cookie', () => {
    it('accepts a session it signed itself', () => {
        const token = signSession(newSession('me@example.com', now), secret);

        assert.equal(verifySession(token, secret, secondsLater(60))?.email, 'me@example.com');
    });

    it('refuses a session signed with another secret', () => {
        const token = signSession(newSession('me@example.com', now), 'other-secret');

        assert.equal(verifySession(token, secret, now), undefined);
    });

    it('refuses a session whose content was changed', () => {
        const [, signed] = signSession(newSession('me@example.com', now), secret).split('.');
        const forged = Buffer.from(JSON.stringify(newSession('intruder@example.com', now))).toString('base64url');

        assert.equal(verifySession(`${forged}.${signed}`, secret, now), undefined);
    });

    it('refuses an expired session', () => {
        const token = signSession(newSession('me@example.com', now), secret);

        assert.equal(verifySession(token, secret, secondsLater(SESSION_LIFETIME_SECONDS + 1)), undefined);
    });

    it('refuses a missing or malformed token', () => {
        assert.equal(verifySession(undefined, secret, now), undefined);
        assert.equal(verifySession('nonsense', secret, now), undefined);
        assert.equal(verifySession('a.b.c', secret, now), undefined);
    });
});

describe('helpers', () => {
    it('reads cookies from a header', () => {
        assert.deepEqual(parseCookies('session=abc.def; theme=dark; odd'), { session: 'abc.def', theme: 'dark' });
        assert.deepEqual(parseCookies(undefined), {});
    });

    it('matches allowed addresses without regard to case', () => {
        assert.equal(isAllowedEmail('Me@Example.com', ['me@example.com']), true);
        assert.equal(isAllowedEmail('other@example.com', ['me@example.com']), false);
        assert.equal(isAllowedEmail('me@example.com', []), false);
    });

    it('compares secrets of different length without failing', () => {
        assert.equal(safeEqual('abc', 'abc'), true);
        assert.equal(safeEqual('abc', 'abcd'), false);
    });
});

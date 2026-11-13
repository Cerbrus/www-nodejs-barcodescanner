import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { buildPolicy, contentPolicyMode, inlineScriptHashes, policyHeaders, readReports } from './content-policy';

const hashOf = (script: string): string => `'sha256-${createHash('sha256').update(script).digest('base64')}'`;

describe('content security policy', () => {
    it('reports by default, and enforces or switches off only when asked', () => {
        assert.deepEqual(['', 'report', 'nonsense', 'enforce', 'off'].map(contentPolicyMode), ['report', 'report', 'report', 'enforce', 'off']);
    });

    it('hashes the inline scripts of the page and skips scripts loaded from a file', () => {
        const html = '<script>start()</script><script src="main.js" type="module"></script><script data-x>\nlater()\n</script>';

        assert.deepEqual(inlineScriptHashes(html), [hashOf('start()'), hashOf('\nlater()\n')]);
    });

    it('allows own scripts and the hashed inline ones, and says where to report', () => {
        const policy = buildPolicy(["'sha256-abc'"], '/api/v1/csp-reports');

        assert.match(policy, /script-src 'self' 'sha256-abc';/);
        assert.match(policy, /frame-ancestors 'none'/);
        assert.match(policy, /report-uri \/api\/v1\/csp-reports$/);
        assert.doesNotMatch(policy, /unsafe-eval/);
    });

    it('sends the policy as report-only, as enforced, or not at all', () => {
        assert.deepEqual(policyHeaders('report', 'p'), { 'Content-Security-Policy-Report-Only': 'p' });
        assert.deepEqual(policyHeaders('enforce', 'p'), { 'Content-Security-Policy': 'p' });
        assert.deepEqual(policyHeaders('off', 'p'), {});
    });

    it('reads a report in the old and in the new format', () => {
        const old = { 'csp-report': { 'effective-directive': 'img-src', 'blocked-uri': 'http://x.example/a.png', 'document-uri': 'https://site/' } };
        const modern = [{ type: 'csp-violation', body: { effectiveDirective: 'script-src-elem', blockedURL: 'inline', documentURL: 'https://site/' } }];

        assert.deepEqual(readReports(old), [{ directive: 'img-src', blocked: 'http://x.example/a.png', page: 'https://site/' }]);
        assert.deepEqual(readReports(modern), [{ directive: 'script-src-elem', blocked: 'inline', page: 'https://site/' }]);
    });

    it('ignores anything that is not a report, and cuts long or multi-line values', () => {
        const long = { 'csp-report': { 'effective-directive': 'img-src', 'blocked-uri': `a\nb${'x'.repeat(500)}` } };

        assert.deepEqual(readReports(undefined), []);
        assert.deepEqual(readReports('text'), []);
        assert.deepEqual(readReports({ 'csp-report': { 'blocked-uri': 'x' } }), []);
        assert.equal(readReports(long)[0].blocked.length, 200);
        assert.doesNotMatch(readReports(long)[0].blocked, /\n/);
    });
});

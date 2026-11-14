import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RemarkContent, cleanContext, cleanTarget, issueFromRemark, tooManyRemarks } from './remarks';

const remark = (extra: Partial<RemarkContent> = {}): RemarkContent => ({
    id: 7,
    kind: 'bug',
    text: 'The count pill is white on white\nSeen after switching to light.',
    page: '#/list',
    target: { component: 'app-item-tile', label: 'Product tile "Melk"', text: 'Melk', path: 'app-list-page > app-item-tile > button.tile' },
    context: { version: '1.1.40', commit: '5ed181e', userAgent: 'Safari', viewport: '390 × 844', installed: true, online: true, waitingChanges: 2, recentMessages: ['Melk afgevinkt'] },
    account: 'guest@example.com',
    ...extra
});
const everything = { includeDevice: true, includeAccount: true, investigate: true };
const least = { includeDevice: false, includeAccount: false, investigate: false };

describe('remarks', () => {
    it('keeps only the known facts about what was pointed at, cut to size', () => {
        assert.deepEqual(cleanTarget({ component: ' app-item-tile ', text: `a\n b${'x'.repeat(400)}`, other: 'dropped', path: 5 }), {
            component: 'app-item-tile',
            text: `a b${'x'.repeat(297)}`
        });
        assert.equal(cleanTarget({ other: 'x' }), undefined);
        assert.equal(cleanTarget('text'), undefined);
        assert.equal(cleanTarget(['x']), undefined);
    });

    it('keeps only the known facts about the device and the moment', () => {
        const context = cleanContext({
            version: '1.1.40',
            installed: true,
            online: 'yes',
            waitingChanges: -1,
            recentMessages: ['a', 2, 'b', 'c', 'd', 'e', 'f'],
            cookie: 'secret'
        });

        assert.deepEqual(context, { version: '1.1.40', installed: true, recentMessages: ['b', 'c', 'd', 'e', 'f'] });
        assert.deepEqual(cleanContext(undefined), {});
    });

    it('allows thirty remarks an hour per account', () => {
        assert.equal(tooManyRemarks(29), false);
        assert.equal(tooManyRemarks(30), true);
    });

    it('makes an issue with the first line as title and a label by kind', () => {
        assert.equal(issueFromRemark(remark(), least).title, 'The count pill is white on white');
        assert.deepEqual(issueFromRemark(remark(), least).labels, ['bug']);
        assert.deepEqual(issueFromRemark(remark({ kind: 'wish' }), everything).labels, ['enhancement', 'investigate']);
        assert.deepEqual(issueFromRemark(remark({ kind: 'note' }), least).labels, []);
        assert.equal(issueFromRemark(remark({ text: 'x'.repeat(200) }), least).title.length, 80);
    });

    it('says what happened, where, and in which version', () => {
        const body = issueFromRemark(remark(), least).body;

        assert.match(body, /### What happened\n\nThe count pill is white on white\nSeen after switching to light\./);
        assert.match(body, /### Where in the app\n\n- Page: `#\/list`\n- Pointed at: Product tile "Melk"\n- Its text: "Melk"\n- Component: `app-item-tile`/);
        assert.match(body, /### Version\n\n1\.1\.40 \(5ed181e\)/);
        assert.match(body, /_Sent from the app as remark 7\._$/);
        assert.match(issueFromRemark(remark({ kind: 'wish' }), least).body, /### What is wished/);
    });

    it('leaves the device and the account out unless asked', () => {
        const bare = issueFromRemark(remark(), least).body;
        const full = issueFromRemark(remark(), everything).body;

        assert.doesNotMatch(bare, /Safari|guest@example\.com|Melk afgevinkt/);
        assert.match(full, /### Device\n\n- Browser: Safari\n- Viewport: 390 × 844\n- Installed as app: yes\n- Connected: yes\n- Changes waiting: 2\n- Message on screen: "Melk afgevinkt"/);
        assert.match(full, /### Sent by\n\nguest@example\.com/);
    });

    it('copes with a remark that has no target and no context', () => {
        const body = issueFromRemark(remark({ target: null, context: null, page: '' }), everything).body;

        assert.match(body, /- Page: `unknown`\n\n### Version\n\nunknown\n\n### Device\n\n- unknown/);
    });
});

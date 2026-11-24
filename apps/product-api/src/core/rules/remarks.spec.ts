import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    IssueSnapshot,
    RemarkContent,
    cleanContext,
    cleanTarget,
    compareVersions,
    isFinalStage,
    issueFromRemark,
    progressOfIssue,
    tooManyRemarks,
    withRelease
} from './remarks';

const remark = (extra: Partial<RemarkContent> = {}): RemarkContent => ({
    id: 7,
    kind: 'bug',
    text: 'The count pill is white on white\nSeen after switching to light.',
    page: '#/list',
    target: {
        component: 'app-item-tile',
        label: 'Product tile "Melk"',
        text: 'Melk',
        path: 'app-list-page > app-item-tile > button.tile'
    },
    context: {
        version: '1.1.40',
        commit: '5ed181e',
        userAgent: 'Safari',
        viewport: '390 × 844',
        installed: true,
        online: true,
        waitingChanges: 2,
        recentMessages: ['Melk afgevinkt']
    },
    account: 'guest@example.com',
    ...extra
});
const everything = { includeDevice: true, includeAccount: true, investigate: true };
const least = { includeDevice: false, includeAccount: false, investigate: false };

describe('remarks', () => {
    it('keeps only the known facts about what was pointed at, cut to size', () => {
        assert.deepEqual(
            cleanTarget({ component: ' app-item-tile ', text: `a\n b${'x'.repeat(400)}`, other: 'dropped', path: 5 }),
            {
                component: 'app-item-tile',
                text: `a b${'x'.repeat(297)}`
            }
        );
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
        assert.match(
            body,
            /### Where in the app\n\n- Page: `#\/list`\n- Pointed at: Product tile "Melk"\n- Its text: "Melk"\n- Component: `app-item-tile`/
        );
        assert.match(body, /### Version\n\n1\.1\.40 \(5ed181e\)/);
        assert.match(
            body,
            /### Authority\n\nSent to GitHub by the owner \(admin\) of this app\. It is his decision that this is to be done/
        );
        assert.match(body, /_Sent from the app as remark 7\._$/);
        assert.match(issueFromRemark(remark({ kind: 'wish' }), least).body, /### What is wished/);
    });

    it('leaves the device and the account out unless asked', () => {
        const bare = issueFromRemark(remark(), least).body;
        const full = issueFromRemark(remark(), everything).body;

        assert.doesNotMatch(bare, /Safari|guest@example\.com|Melk afgevinkt/);
        assert.match(
            full,
            /### Device\n\n- Browser: Safari\n- Viewport: 390 × 844\n- Installed as app: yes\n- Connected: yes\n- Changes waiting: 2\n- Message on screen: "Melk afgevinkt"/
        );
        assert.match(full, /### Sent by\n\nguest@example\.com/);
    });

    it('copes with a remark that has no target and no context', () => {
        const body = issueFromRemark(remark({ target: null, context: null, page: '' }), everything).body;

        assert.match(body, /- Page: `unknown`\n\n### Version\n\nunknown\n\n### Device\n\n- unknown\n\n### Sent by/);
    });
});

describe('progress of an issue', () => {
    const pull = (
        extra: Partial<IssueSnapshot['pullRequests'][number]> = {}
    ): IssueSnapshot['pullRequests'][number] => ({
        number: 40,
        title: 'Show the state',
        url: 'https://github.example/pull/40',
        state: 'open',
        merged: false,
        ...extra
    });
    const issue = (extra: Partial<IssueSnapshot> = {}): IssueSnapshot => ({
        state: 'open',
        labels: [],
        pullRequests: [],
        ...extra
    });

    it('is only sent while nothing has happened', () => {
        assert.deepEqual(progressOfIssue(issue({ labels: ['bug'] })), { stage: 'sent' });
    });

    it('follows the labels of the agent', () => {
        assert.equal(progressOfIssue(issue({ labels: ['investigate'] })).stage, 'investigating');
        assert.equal(progressOfIssue(issue({ labels: ['agent: needs answers'] })).stage, 'needsAnswers');
        assert.equal(progressOfIssue(issue({ labels: ['agent: too large'] })).stage, 'tooLarge');
        assert.equal(progressOfIssue(issue({ labels: ['agent: not possible'] })).stage, 'notPossible');
        assert.equal(progressOfIssue(issue({ labels: ['agent: not a bug'] })).stage, 'notABug');
    });

    it('waits for review while a pull request is open, and names it', () => {
        assert.deepEqual(progressOfIssue(issue({ labels: ['agent: implemented'], pullRequests: [pull()] })), {
            stage: 'review',
            pullRequest: { number: 40, title: 'Show the state', url: 'https://github.example/pull/40' }
        });
    });

    it('is done when the issue is closed with a merged pull request, and closed without one', () => {
        const done = progressOfIssue(
            issue({ state: 'closed', pullRequests: [pull({ state: 'closed', merged: true })] })
        );

        assert.equal(done.stage, 'merged');
        assert.equal(done.pullRequest?.number, 40);
        assert.deepEqual(progressOfIssue(issue({ state: 'closed', pullRequests: [pull({ state: 'closed' })] })), {
            stage: 'closed'
        });
        assert.deepEqual(
            [isFinalStage('merged'), isFinalStage('closed'), isFinalStage('review')],
            [false, true, false]
        );
        assert.equal(isFinalStage('live'), true);
    });

    it('ignores a pull request that was closed without merging', () => {
        assert.equal(progressOfIssue(issue({ pullRequests: [pull({ state: 'closed' })] })).stage, 'sent');
    });

    it('compares versions as numbers', () => {
        assert.ok(compareVersions('1.1.130', '1.1.99') > 0);
        assert.ok(compareVersions('1.2.0', '1.10.0') < 0);
        assert.equal(compareVersions('1.1.5', '1.1.5'), 0);
    });

    it('tells whether a merged fix is released and whether this app runs it', () => {
        const merged = { stage: 'merged' as const, pullRequest: { number: 40, title: 'x', url: 'u' } };

        assert.deepEqual(withRelease(merged, undefined, '1.1.131'), merged);
        assert.deepEqual(withRelease(merged, '1.1.132', '1.1.131'), {
            ...merged,
            stage: 'released',
            version: '1.1.132'
        });
        assert.equal(withRelease(merged, '1.1.131', '1.1.131').stage, 'live');
        assert.equal(withRelease(merged, '1.1.130', '1.1.131').stage, 'live');
        assert.equal(withRelease(merged, '1.1.130', 'dev').stage, 'released');
        assert.equal(withRelease({ stage: 'review' }, '1.1.130', '1.1.131').stage, 'review');
    });
});

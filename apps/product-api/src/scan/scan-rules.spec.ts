import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEBOUNCE_MILLISECONDS, addOneToEntry, decideScan } from './scan-rules';

const now = new Date('2026-11-12T12:00:00.000Z');
const millisecondsAgo = (milliseconds: number): Date => new Date(now.getTime() - milliseconds);

describe('decideScan', () => {
    it('asks for a name when the barcode has no catalog item', () => {
        assert.deepEqual(decideScan({ now }), { result: 'needs_name' });
    });

    it('adds a mapped item that is not on the list with quantity 1', () => {
        assert.deepEqual(decideScan({ now, catalogItemId: 7 }), {
            result: 'added',
            entry: { state: 'to_buy', quantity: 1 }
        });
    });

    it('puts a recent item back on the list with quantity 1', () => {
        assert.deepEqual(decideScan({ now, catalogItemId: 7, entry: { state: 'recent', quantity: 0 } }), {
            result: 'added',
            entry: { state: 'to_buy', quantity: 1 }
        });
    });

    it('counts up an item that is already to buy', () => {
        assert.deepEqual(decideScan({ now, catalogItemId: 7, entry: { state: 'to_buy', quantity: 2 } }), {
            result: 'incremented',
            entry: { state: 'to_buy', quantity: 3 }
        });
    });

    it('ignores the same code inside the debounce window', () => {
        const context = { now, catalogItemId: 7, previousScanOfCodeAt: millisecondsAgo(DEBOUNCE_MILLISECONDS - 1) };
        assert.deepEqual(decideScan(context), { result: 'ignored' });
    });

    it('ignores an unmapped code inside the debounce window too', () => {
        assert.deepEqual(decideScan({ now, previousScanOfCodeAt: millisecondsAgo(1700) }), { result: 'ignored' });
    });

    it('accepts the same code once the debounce window has passed', () => {
        const context = { now, catalogItemId: 7, previousScanOfCodeAt: millisecondsAgo(DEBOUNCE_MILLISECONDS) };
        assert.equal(decideScan(context).result, 'added');
    });
});

describe('addOneToEntry', () => {
    it('starts at quantity 1 without an entry', () => {
        assert.deepEqual(addOneToEntry(), { result: 'added', entry: { state: 'to_buy', quantity: 1 } });
    });

    it('applies several waiting scans as a running count', () => {
        const first = addOneToEntry();
        const second = addOneToEntry(first.entry);
        const third = addOneToEntry(second.entry);

        assert.equal(second.result, 'incremented');
        assert.deepEqual(third.entry, { state: 'to_buy', quantity: 3 });
    });
});

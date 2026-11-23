import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEBOUNCE_MILLISECONDS, addOneToEntry, addToEntry, collectEntry, decideScan, takeBack } from './scan-rules';

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
        assert.deepEqual(decideScan({ now, previousScanOfCodeAt: millisecondsAgo(DEBOUNCE_MILLISECONDS / 2) }), {
            result: 'ignored'
        });
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

describe('a recipe ingredient on the list', () => {
    it('goes on the list with its quantity when the product is not to buy', () => {
        assert.deepEqual(addToEntry(undefined, 2), { state: 'to_buy', quantity: 2 });
        assert.deepEqual(addToEntry({ state: 'recent', quantity: 0 }, 3), { state: 'to_buy', quantity: 3 });
    });

    it('is counted on top of what is already to buy', () => {
        assert.deepEqual(addToEntry({ state: 'to_buy', quantity: 1 }, 2), { state: 'to_buy', quantity: 3 });
    });

    it('is taken back to what the entry was before', () => {
        const before = { state: 'recent' as const, quantity: 0 };

        assert.deepEqual(takeBack({ quantity: 2, previous: before }, { state: 'to_buy', quantity: 2 }), before);
        assert.equal(takeBack({ quantity: 2 }, { state: 'to_buy', quantity: 2 }), undefined);
        assert.deepEqual(
            takeBack({ quantity: 2, previous: { state: 'to_buy', quantity: 1 } }, { state: 'to_buy', quantity: 3 }),
            { state: 'to_buy', quantity: 1 }
        );
    });

    it('keeps what was added to the entry after the recipe', () => {
        assert.deepEqual(takeBack({ quantity: 2 }, { state: 'to_buy', quantity: 3 }), { state: 'to_buy', quantity: 1 });
    });

    it('leaves an entry alone that was checked off or removed since', () => {
        const checkedOff = { state: 'recent' as const, quantity: 0 };

        assert.deepEqual(takeBack({ quantity: 2, previous: { state: 'to_buy', quantity: 1 } }, checkedOff), checkedOff);
        assert.equal(takeBack({ quantity: 2, previous: { state: 'to_buy', quantity: 1 } }), undefined);
    });
});

describe('collecting while shopping', () => {
    it('moves an entry that is to buy to recent', () => {
        assert.deepEqual(collectEntry({ state: 'to_buy', quantity: 3 }), {
            result: 'collected',
            entry: { state: 'recent', quantity: 0 }
        });
    });

    it('leaves a recent entry and a product that is not on the list alone', () => {
        assert.deepEqual(collectEntry({ state: 'recent', quantity: 0 }), { result: 'not_on_list' });
        assert.deepEqual(collectEntry(undefined), { result: 'not_on_list' });
    });

    it('decides a scan by it only when collecting', () => {
        const entry = { state: 'to_buy' as const, quantity: 1 };

        assert.equal(decideScan({ now, catalogItemId: 7, entry, collecting: true }).result, 'collected');
        assert.equal(decideScan({ now, catalogItemId: 7, entry, collecting: false }).result, 'incremented');
    });

    it('still asks for a name for an unknown barcode and still ignores a double read', () => {
        assert.equal(decideScan({ now, collecting: true }).result, 'needs_name');
        assert.equal(
            decideScan({ now, previousScanOfCodeAt: millisecondsAgo(10), catalogItemId: 7, collecting: true }).result,
            'ignored'
        );
    });
});

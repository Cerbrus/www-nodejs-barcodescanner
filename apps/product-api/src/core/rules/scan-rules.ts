import { ListState, ScanResult } from '@barcodescanner/shared';

export const DEBOUNCE_MILLISECONDS = 1000;

export interface EntrySnapshot {
    state: ListState;
    quantity: number;
}

export interface ScanContext {
    now: Date;
    previousScanOfCodeAt?: Date;
    catalogItemId?: number | null;
    entry?: EntrySnapshot;
}

export interface ScanDecision {
    result: ScanResult;
    entry?: EntrySnapshot;
}

export function addOneToEntry(entry?: EntrySnapshot): { result: 'added' | 'incremented'; entry: EntrySnapshot } {
    if (entry?.state === 'to_buy') {
        return { result: 'incremented', entry: { state: 'to_buy', quantity: entry.quantity + 1 } };
    }

    return { result: 'added', entry: { state: 'to_buy', quantity: 1 } };
}

export function addToEntry(entry: EntrySnapshot | undefined, quantity: number): EntrySnapshot {
    return { state: 'to_buy', quantity: (entry?.state === 'to_buy' ? entry.quantity : 0) + quantity };
}

export function takeBack(
    addition: { quantity: number; previous?: EntrySnapshot },
    current?: EntrySnapshot
): EntrySnapshot | undefined {
    if (current?.state !== 'to_buy') {
        return current;
    }

    return current.quantity > addition.quantity
        ? { state: 'to_buy', quantity: current.quantity - addition.quantity }
        : addition.previous;
}

export function decideScan(context: ScanContext): ScanDecision {
    const { now, previousScanOfCodeAt, catalogItemId, entry } = context;

    if (previousScanOfCodeAt && now.getTime() - previousScanOfCodeAt.getTime() < DEBOUNCE_MILLISECONDS) {
        return { result: 'ignored' };
    }

    if (!catalogItemId) {
        return { result: 'needs_name' };
    }

    return addOneToEntry(entry);
}

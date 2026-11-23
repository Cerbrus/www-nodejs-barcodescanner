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
    collecting?: boolean;
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

export function collectEntry(entry?: EntrySnapshot): { result: 'collected' | 'not_on_list'; entry?: EntrySnapshot } {
    if (entry?.state === 'to_buy') {
        return { result: 'collected', entry: { state: 'recent', quantity: 0 } };
    }

    return { result: 'not_on_list' };
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
    const { now, previousScanOfCodeAt, catalogItemId, entry, collecting } = context;

    if (previousScanOfCodeAt && now.getTime() - previousScanOfCodeAt.getTime() < DEBOUNCE_MILLISECONDS) {
        return { result: 'ignored' };
    }

    if (!catalogItemId) {
        return { result: 'needs_name' };
    }

    return collecting ? collectEntry(entry) : addOneToEntry(entry);
}

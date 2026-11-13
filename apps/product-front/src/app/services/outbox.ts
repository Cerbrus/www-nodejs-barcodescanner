import { ListEntryChange } from '../models';

export interface PendingChange extends ListEntryChange {
    catalogItemId: number;
    changedAt: string;
}

const OUTBOX_KEY = 'outbox';

export function loadOutbox(): Array<PendingChange> {
    try {
        const stored = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as Array<PendingChange>;

        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
}

export function saveOutbox(changes: Array<PendingChange>): void {
    try {
        localStorage.setItem(OUTBOX_KEY, JSON.stringify(changes));
    } catch {
        return;
    }
}

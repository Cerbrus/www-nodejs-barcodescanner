import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, filter, of, throwError } from 'rxjs';

import { CatalogItem, ListEntry, Section } from '../models';
import { ApiService } from './api.service';
import { EventsService } from './events.service';
import { loadOutbox } from './outbox';
import { ShoppingStore } from './shopping.store';
import { loadSnapshot, saveSnapshot } from './snapshot';
import { ToastService } from './toast.service';

const dairy: Section = { id: 'dairy', name: 'Zuivel', sortOrder: 2 };
const bread: Section = { id: 'bread', name: 'Brood', sortOrder: 1 };
const empty: Section = { id: 'empty', name: 'Leeg', sortOrder: 3 };
const milk: CatalogItem = { id: 1, name: 'Melk', sectionId: 'dairy', custom: false };
const loaf: CatalogItem = { id: 2, name: 'Brood', sectionId: 'bread', custom: false };
const entry = (catalogItem: CatalogItem, state: ListEntry['state'], quantity = 1, note = ''): ListEntry => ({
    id: `e${catalogItem.id}${note}`,
    catalogItemId: catalogItem.id,
    catalogItem,
    state,
    quantity,
    note,
    updatedAt: '2026-11-13T10:00:00.000Z'
});
const noConnection = (): HttpErrorResponse => new HttpErrorResponse({ status: 0 });

describe('ShoppingStore', () => {
    let events$: Subject<string>;
    let resumed$: Subject<void>;
    const api = {
        getSections: vi.fn(),
        getCatalog: vi.fn(),
        getList: vi.fn(),
        getInbox: vi.fn(),
        changeListEntry: vi.fn(),
        sendOfflineChanges: vi.fn()
    };

    const create = (): ShoppingStore => {
        TestBed.configureTestingModule({
            providers: [
                { provide: ApiService, useValue: api },
                {
                    provide: EventsService,
                    useValue: {
                        connected: signal(true),
                        on: (...types: Array<string>): Observable<string> =>
                            events$.pipe(filter((type) => types.includes(type))),
                        resumed: resumed$
                    }
                },
                { provide: TranslateService, useValue: { instant: (key: string): string => key } }
            ]
        });

        return TestBed.inject(ShoppingStore);
    };

    beforeEach(() => {
        vi.useFakeTimers();
        events$ = new Subject<string>();
        resumed$ = new Subject<void>();
        localStorage.clear();
        vi.clearAllMocks();
        api.getSections.mockReturnValue(of([bread, dairy, empty]));
        api.getCatalog.mockReturnValue(of([milk, loaf]));
        api.getList.mockReturnValue(of([entry(milk, 'to_buy', 2), entry(loaf, 'recent')]));
        api.getInbox.mockReturnValue(of([]));
        api.changeListEntry.mockReturnValue(of(entry(milk, 'recent')));
        api.sendOfflineChanges.mockReturnValue(of({ applied: 1, skipped: [] }));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('loads everything at start and splits the list into to buy and recent', () => {
        const store = create();

        expect(store.loaded()).toBe(true);
        expect(store.toBuy().map((row) => row.catalogItem.name)).toEqual(['Melk']);
        expect(store.recent().map((row) => row.catalogItem.name)).toEqual(['Brood']);
        expect(store.online()).toBe(true);
    });

    it('groups by section in the order of the sections and leaves out empty ones', () => {
        const store = create();

        expect(store.itemGroups().map((group) => group.section.name)).toEqual(['Brood', 'Zuivel']);
        expect(store.toBuyGroups().map((group) => [group.section.id, group.rows.length])).toEqual([['dairy', 1]]);
    });

    it('keeps a snapshot of what it loaded and starts from it when the server is away', () => {
        create();
        expect(loadSnapshot()?.entries.length).toBe(2);

        TestBed.resetTestingModule();
        api.getSections.mockReturnValue(throwError(noConnection));
        const offline = create();

        expect(offline.loaded()).toBe(true);
        expect(offline.failed()).toBe(true);
        expect(offline.toBuy().map((row) => row.catalogItem.name)).toEqual(['Melk']);
    });

    it('reloads the list shortly after a list event, once for a burst of events', () => {
        create();
        api.getList.mockClear();

        events$.next('list');
        events$.next('scan');
        vi.advanceTimersByTime(200);

        expect(api.getList).toHaveBeenCalledTimes(1);
        expect(api.getCatalog).toHaveBeenCalledTimes(1);

        events$.next('catalog');
        vi.advanceTimersByTime(200);

        expect(api.getCatalog).toHaveBeenCalledTimes(2);
    });

    it('sends a change to the server and reloads the list', () => {
        const store = create();
        api.getList.mockClear();

        store.changeEntry('e1', { state: 'recent' }).subscribe();

        expect(api.changeListEntry).toHaveBeenCalledWith('e1', { state: 'recent' });
        expect(api.getList).toHaveBeenCalledTimes(1);
        expect(store.pending()).toEqual([]);
    });

    it('shows a change at once, so a next tap before the server answers starts from it', () => {
        const store = create();
        api.changeListEntry.mockReturnValue(new Subject());

        store.changeEntry('e1', { note: 'jong' }).subscribe();
        expect(store.toBuy().map((row) => [row.id, row.note, row.quantity])).toEqual([['e1', 'jong', 2]]);

        store.addItem(milk).subscribe();
        const [id, change] = api.changeListEntry.mock.lastCall as [string, object];
        expect(id).not.toBe('e1');
        expect(change).toEqual({ catalogItemId: 1, note: '', state: 'to_buy', quantity: 1 });
    });

    it('puts the list back when the server refuses a change', () => {
        const store = create();
        api.changeListEntry.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
        const failures: Array<number> = [];

        store.changeEntry('e1', { state: 'recent' }).subscribe({ error: ({ status }) => failures.push(status) });

        expect(failures).toEqual([404]);
        expect(store.toBuy().map((row) => row.id)).toEqual(['e1']);
        expect(store.pending()).toEqual([]);
    });

    it('keeps a change for later when there is no connection, and shows it at once', () => {
        const store = create();
        api.changeListEntry.mockReturnValue(throwError(noConnection));

        store.changeEntry('e1', { state: 'recent' }).subscribe();

        expect(store.pending().map((change) => [change.id, change.state])).toEqual([['e1', 'recent']]);
        expect(loadOutbox().length).toBe(1);
        expect(store.recent().map((row) => row.catalogItem.name)).toContain('Melk');
        expect(store.pendingIds().has('e1')).toBe(true);
        expect(store.online()).toBe(false);
    });

    it('queues behind waiting changes instead of overtaking them', () => {
        const store = create();
        api.changeListEntry.mockReturnValue(throwError(noConnection));
        store.changeEntry('e1', { state: 'recent' }).subscribe();
        api.changeListEntry.mockClear();

        store.changeEntry('e2', { state: 'to_buy', quantity: 3 }).subscribe();

        expect(api.changeListEntry).not.toHaveBeenCalled();
        expect(store.pending().length).toBe(2);
        expect(store.toBuy().find((row) => row.catalogItemId === 2)?.quantity).toBe(3);
    });

    it('sends the waiting changes first when the connection is back, then reloads', () => {
        const store = create();
        api.changeListEntry.mockReturnValue(throwError(noConnection));
        store.changeEntry('e1', { state: 'recent' }).subscribe();
        const order: Array<string> = [];
        api.sendOfflineChanges.mockImplementation(() => {
            order.push('send');
            return of({ applied: 1, skipped: [] });
        });
        api.getList.mockImplementation(() => {
            order.push('list');
            return of([]);
        });

        resumed$.next();

        expect(order).toEqual(['send', 'list']);
        expect(store.pending()).toEqual([]);
        expect(loadOutbox()).toEqual([]);
        expect(store.online()).toBe(true);
    });

    it('tells the user when the server kept its own state over a waiting change', () => {
        const store = create();
        api.changeListEntry.mockReturnValue(throwError(noConnection));
        store.changeEntry('e1', { state: 'recent' }).subscribe();
        api.sendOfflineChanges.mockReturnValue(of({ applied: 0, skipped: ['e1'] }));

        resumed$.next();

        expect(
            TestBed.inject(ToastService)
                .toasts()
                .map((toast) => toast.text)
        ).toEqual(['offline.serverWon']);
    });

    it('tries again every five seconds while loading fails', () => {
        api.getSections.mockReturnValue(throwError(noConnection));
        const store = create();
        expect(store.failed()).toBe(true);

        api.getSections.mockReturnValue(of([bread, dairy]));
        vi.advanceTimersByTime(5000);

        expect(store.failed()).toBe(false);
    });

    it('ignores a snapshot that is not one', () => {
        saveSnapshot({ savedAt: '', sections: [], items: [], entries: [], inbox: [] });
        api.getSections.mockReturnValue(throwError(noConnection));

        expect(create().loaded()).toBe(false);
    });

    it('ignores a snapshot from before list entries had their own id', () => {
        const old = { ...entry(milk, 'to_buy'), id: undefined } as unknown as ListEntry;
        saveSnapshot({
            savedAt: '2026-11-15T10:00:00.000Z',
            sections: [dairy],
            items: [milk],
            entries: [old],
            inbox: []
        });
        api.getSections.mockReturnValue(throwError(noConnection));

        expect(create().loaded()).toBe(false);
    });

    it('adds one to the plain entry of a product that is to buy, and starts a new plain entry otherwise', () => {
        const store = create();

        store.addItem(milk).subscribe();
        expect(api.changeListEntry).toHaveBeenLastCalledWith('e1', { quantity: 3 });

        store.addItem(loaf).subscribe();
        expect(api.changeListEntry).toHaveBeenLastCalledWith('e2', {
            catalogItemId: 2,
            note: '',
            state: 'to_buy',
            quantity: 1
        });

        store.addItem(milk, ' volkoren ').subscribe();
        const [id, change] = api.changeListEntry.mock.lastCall as [string, object];
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
        expect(change).toEqual({ catalogItemId: 1, note: 'volkoren', state: 'to_buy', quantity: 1 });
    });

    it('shows a new variant at once while offline, and merges a note that another entry already has', () => {
        api.getList.mockReturnValue(of([entry(milk, 'to_buy', 2), entry(milk, 'to_buy', 1, 'vol')]));
        const store = create();
        api.changeListEntry.mockReturnValue(throwError(noConnection));

        store.changeEntry('new', { catalogItemId: 1, note: 'halfvol', state: 'to_buy', quantity: 1 }).subscribe();
        expect(store.toBuy().map((row) => [row.note, row.quantity])).toEqual([
            ['halfvol', 1],
            ['', 2],
            ['vol', 1]
        ]);

        store.changeEntry('e1', { note: ' vol ' }).subscribe();
        expect(store.toBuy().map((row) => [row.id, row.note, row.quantity])).toEqual([
            ['e1vol', 'vol', 3],
            ['new', 'halfvol', 1]
        ]);
        expect(store.pending().map((change) => change.id)).toEqual(['new', 'e1']);
    });
});

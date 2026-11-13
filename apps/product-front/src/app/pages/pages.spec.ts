import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { Scan } from '../models';
import { CatalogPage } from './catalog/catalog.page';
import { HistoryPage } from './history/history.page';
import { InboxPage } from './inbox/inbox.page';
import { LogPage } from './log/log.page';
import { LoginPage } from './login/login.page';
import { SoundsPage } from './sounds/sounds.page';
import { FakeEvents, FakeStore, click, fakeEvents, fakeStore, item, texts, type } from '../../testing/fakes';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { EventsService } from '../services/events.service';
import { ShoppingStore } from '../services/shopping.store';

const scan = (id: number, result: Scan['result'], extra: Partial<Scan> = {}): Scan => ({
    id,
    code: `871040000000${id}`,
    source: 'handheld',
    result,
    createdAt: '2026-11-13T10:00:00.000Z',
    ...extra
});
const SOUNDS = {
    events: [
        { event: 'added', soundId: 'blip', steps: [] },
        { event: 'ignored', soundId: 'none', steps: [] }
    ],
    sounds: [
        { id: 'blip', steps: [] },
        { id: 'long', steps: [] }
    ]
};

describe('the smaller pages', () => {
    let store: FakeStore;
    let events: FakeEvents;
    let page: HTMLElement;
    const api = {
        iconsUrl: '/icons',
        getIcons: () => of([]),
        getBarcode: vi.fn(() => of({ code: '8710400000001', scanCount: 1, suggestions: [] })),
        getScans: vi.fn(),
        undoScan: vi.fn(() => of({})),
        getLogs: vi.fn(),
        getFeedbackSettings: vi.fn(),
        setFeedbackSound: vi.fn(),
        testSound: vi.fn(() => of(undefined))
    };

    const open = async <T>(component: new () => T, inputs: Record<string, unknown> = {}): Promise<ComponentFixture<T>> => {
        const fixture = TestBed.createComponent(component);
        for (const [name, value] of Object.entries(inputs)) {
            fixture.componentRef.setInput(name, value);
        }
        page = fixture.nativeElement as HTMLElement;
        await settle(fixture);

        return fixture;
    };
    const settle = async (fixture: ComponentFixture<unknown>): Promise<void> => {
        fixture.detectChanges();
        await vi.advanceTimersByTimeAsync(250);
        fixture.detectChanges();
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        store = fakeStore([item(1, 'Melk'), item(2, 'Karnemelk'), item(3, 'Brood', 'brood-gebak')]);
        events = fakeEvents();
        api.getScans.mockReturnValue(of([]));
        api.getLogs.mockReturnValue(of([]));
        api.getFeedbackSettings.mockReturnValue(of(SOUNDS));
        api.setFeedbackSound.mockReturnValue(of(SOUNDS));
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [
                provideRouter([]),
                { provide: ShoppingStore, useValue: store },
                { provide: EventsService, useValue: events },
                { provide: ApiService, useValue: api },
                { provide: AuthService, useValue: { loginUrl: '/api/v1/auth/google' } }
            ]
        });
    });

    afterEach(() => vi.useRealTimers());

    describe('inbox', () => {
        it('lists the unnamed barcodes with the first suggestion as title, and says so when there are none', async () => {
            const fixture = await open(InboxPage);
            expect(texts(page, '.empty')).toEqual(['inbox.empty']);

            store.inbox.set([
                { code: '8710400000001', scanCount: 2, suggestions: [{ connectorId: 'ah', title: 'AH Melk', imageUrl: 'https://img.example/melk.jpg' }] },
                { code: '8710400000002', scanCount: 1 }
            ]);
            await settle(fixture);

            expect(texts(page, 'button.card .font-semibold')).toEqual(['AH Melk', 'inbox.unknownProduct']);
            expect(page.querySelectorAll('button.card img').length).toBe(1);
        });

        it('opens the naming prompt for a tapped barcode and closes it again', async () => {
            store.inbox.set([{ code: '8710400000001', scanCount: 1 }]);
            const fixture = await open(InboxPage);

            click(page, 'button.card');
            await settle(fixture);
            expect(api.getBarcode).toHaveBeenCalledWith('8710400000001');
            expect(page.querySelector('app-naming-prompt')).not.toBeNull();

            click(page, 'app-naming-prompt .mt-4 button.btn');
            await settle(fixture);
            expect(page.querySelector('app-naming-prompt')).toBeNull();
        });
    });

    describe('catalog', () => {
        it('lists the sections closed with their number of products, and opens one on a tap', async () => {
            const fixture = await open(CatalogPage);
            expect(texts(page, 'section .font-semibold')).toEqual(['Brood', 'Zuivel']);
            expect(texts(page, 'section .muted.text-sm')).toEqual(['1', '2']);
            expect(page.querySelector('app-item-tile')).toBeNull();

            click(page, 'section button', 1);
            await settle(fixture);
            expect(texts(page, '.name')).toEqual(['Melk', 'Karnemelk']);

            click(page, 'section button', 1);
            await settle(fixture);
            expect(page.querySelector('app-item-tile')).toBeNull();
        });

        it('opens every section with a match while searching, and says so when nothing matches', async () => {
            const fixture = await open(CatalogPage);
            type(page, 'input', 'karne');
            await settle(fixture);
            expect(texts(page, '.name')).toEqual(['Karnemelk']);

            type(page, 'input', 'zzz');
            await settle(fixture);
            expect(texts(page, '.empty')).toEqual(['catalog.noResults']);

            click(page, '.clear-button');
            await settle(fixture);
            expect(texts(page, 'section .font-semibold').length).toBe(2);
        });

        it('says loading before the products are there, and goes to a tapped product', async () => {
            store.loaded.set(false);
            store.items.set([]);
            const fixture = await open(CatalogPage);
            expect(texts(page, '.empty')).toEqual(['common.loading']);

            store.items.set([item(7, 'Kwark')]);
            const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
            type(page, 'input', 'kwark');
            await settle(fixture);
            click(page, 'button.tile');

            expect(navigate).toHaveBeenCalledWith(['/catalog', 7]);
        });
    });

    describe('history', () => {
        it('lists the scans with product name, source and result, and greys out an undone one', async () => {
            api.getScans.mockReturnValue(
                of([scan(1, 'added', { catalogItemId: 1, source: 'phone' }), scan(2, 'needs_name'), scan(3, 'incremented', { catalogItemId: 1, undoneAt: '2026-11-13T10:01:00.000Z' })])
            );
            await open(HistoryPage);

            expect(texts(page, '.card .font-semibold')).toEqual(['Melk', 'inbox.unknownProduct', 'Melk']);
            expect(texts(page, '.card > i')).toEqual(['smartphone', 'barcode_reader', 'barcode_reader']);
            expect(texts(page, '.result')).toEqual(['history.result.added', 'history.result.needs_name', 'history.result.undone']);
            expect(page.querySelectorAll('.card.opacity-50').length).toBe(1);
        });

        it('says loading, then that there are no scans, and offers no undo then', async () => {
            const fixture = TestBed.createComponent(HistoryPage);
            page = fixture.nativeElement as HTMLElement;
            fixture.detectChanges();
            expect(texts(page, '.empty')).toEqual(['common.loading']);

            await settle(fixture);
            expect(texts(page, '.empty')).toEqual(['history.empty']);
            expect((page.querySelector('button.btn') as HTMLButtonElement).disabled).toBe(true);
        });

        it('undoes the last scan, reloads the list and the history, and has nothing to undo among ignored or undone scans', async () => {
            api.getScans.mockReturnValue(of([scan(1, 'added')]));
            const fixture = await open(HistoryPage);
            api.getScans.mockReturnValue(of([scan(1, 'added', { undoneAt: '2026-11-13T10:01:00.000Z' }), scan(2, 'ignored')]));

            click(page, 'button.btn');
            await settle(fixture);

            expect(api.undoScan).toHaveBeenCalledTimes(1);
            expect(store.refreshListAndInbox).toHaveBeenCalledTimes(1);
            expect((page.querySelector('button.btn') as HTMLButtonElement).disabled).toBe(true);
        });

        it('reloads when a scan comes in', async () => {
            const fixture = await open(HistoryPage);
            events.emit('scan', {});
            await settle(fixture);

            expect(api.getScans).toHaveBeenCalledTimes(2);
        });
    });

    describe('log', () => {
        it('shows the lines with time, source and level, adds new ones as they come, and shows the connection', async () => {
            api.getLogs.mockReturnValue(of([{ id: 1, time: '2026-11-13T10:00:00.000Z', source: 'app', level: 'info', message: 'started' }]));
            const fixture = await open(LogPage);
            expect(texts(page, '.message')).toEqual(['started']);
            expect(texts(page, '.status')).toEqual(['log.live']);

            events.emit('log', { id: 2, time: '2026-11-13T10:00:01.000Z', source: 'agent', level: 'warning', message: 'scanner gone' });
            events.connected.set(false);
            await settle(fixture);

            expect(texts(page, '.message')).toEqual(['started', 'scanner gone']);
            expect(page.querySelector('.line.warning .source.agent')).not.toBeNull();
            expect(texts(page, '.status')).toEqual(['log.disconnected']);
        });

        it('says so when the log is empty, and keeps at most five hundred lines', async () => {
            const fixture = await open(LogPage);
            expect(texts(page, '.message')).toEqual(['log.empty']);

            for (let id = 1; id <= 510; id++) {
                events.emit('log', { id, time: '2026-11-13T10:00:00.000Z', source: 'app', level: 'info', message: `line ${id}` });
            }
            await settle(fixture);

            expect(page.querySelectorAll('.message').length).toBe(500);
            expect(texts(page, '.message')[0]).toBe('line 11');
        });
    });

    describe('login', () => {
        it('links to the Google login and shows no error by default', async () => {
            await open(LoginPage);

            expect(page.querySelector('a.btn')?.getAttribute('href')).toBe('/api/v1/auth/google');
            expect(page.querySelector('[role=alert]')).toBeNull();
        });

        it('explains a refused account, and treats any other error as a failed login', async () => {
            const fixture = await open(LoginPage, { error: 'not_allowed' });
            expect(texts(page, '[role=alert]')).toEqual(['login.error.not_allowed']);

            fixture.componentRef.setInput('error', '<script>');
            await settle(fixture);
            expect(texts(page, '[role=alert]')).toEqual(['login.error.failed']);
        });
    });

    describe('sounds', () => {
        it('shows the sound per event and plays one on request, but not "no sound"', async () => {
            await open(SoundsPage);

            expect(texts(page, 'label.field-label')).toEqual(['sound.event.added', 'sound.event.ignored']);
            expect(Array.from(page.querySelectorAll('button.play'), (button) => (button as HTMLButtonElement).disabled)).toEqual([false, true]);

            click(page, 'button.play');

            expect(api.testSound).toHaveBeenCalledWith('blip');
        });

        it('saves a chosen sound and plays it, and saves "no sound" without playing', async () => {
            const fixture = await open(SoundsPage);
            const choose = async (index: number, value: string): Promise<void> => {
                const select = page.querySelectorAll('select')[index] as HTMLSelectElement;
                select.value = value;
                select.dispatchEvent(new Event('change'));
                await settle(fixture);
            };

            await choose(1, 'long');
            await choose(0, 'none');

            expect(api.setFeedbackSound.mock.calls).toEqual([
                ['ignored', 'long'],
                ['added', 'none']
            ]);
            expect(api.testSound.mock.calls).toEqual([['long']]);
        });

        it('opens the list of all sounds to listen to, and closes it again', async () => {
            const fixture = await open(SoundsPage);
            expect(page.querySelector('button.btn')).toBeNull();

            click(page, 'button[aria-expanded]');
            await settle(fixture);
            click(page, 'button.btn', 1);

            expect(api.testSound).toHaveBeenCalledWith('long');

            click(page, 'button[aria-expanded]');
            await settle(fixture);
            expect(page.querySelector('button.btn')).toBeNull();
        });

        it('says the settings are not available when the server refuses', async () => {
            api.getFeedbackSettings.mockReturnValue(throwError(() => new Error('403')));
            await open(SoundsPage);

            expect(texts(page, '.card p')).toContain('sound.unavailable');
        });
    });
});

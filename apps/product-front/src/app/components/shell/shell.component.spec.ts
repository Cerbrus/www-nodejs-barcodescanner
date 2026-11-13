import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ShellComponent } from './shell.component';
import { FakeEvents, FakeStore, click, fakeEvents, fakeStore, texts } from '../../../testing/fakes';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

describe('ShellComponent', () => {
    let fixture: ComponentFixture<ShellComponent>;
    let page: HTMLElement;
    let store: FakeStore;
    let events: FakeEvents;
    const api = { undoScan: vi.fn(() => of({})) };
    const setAppBadge = vi.fn(() => Promise.resolve());
    const clearAppBadge = vi.fn(() => Promise.resolve());

    const open = (): void => {
        fixture = TestBed.createComponent(ShellComponent);
        page = fixture.nativeElement as HTMLElement;
        fixture.detectChanges();
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        store = fakeStore();
        events = fakeEvents();
        Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: setAppBadge });
        Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: clearAppBadge });
        TestBed.configureTestingModule({
            imports: [ShellComponent, TranslateModule.forRoot()],
            providers: [provideRouter([]), { provide: ShoppingStore, useValue: store }, { provide: EventsService, useValue: events }, { provide: ApiService, useValue: api }]
        });
    });

    afterEach(() => {
        Reflect.deleteProperty(navigator, 'setAppBadge');
        Reflect.deleteProperty(navigator, 'clearAppBadge');
        vi.useRealTimers();
    });

    it('shows the five tabs, and the number of unnamed barcodes on the inbox tab and the app icon', () => {
        store.inbox.set([{ code: '1', scanCount: 1 }, { code: '2', scanCount: 1 }]);
        open();

        expect(Array.from(page.querySelectorAll('a.tab'), (tab) => tab.getAttribute('href'))).toEqual(['/list', '/scan', '/inbox', '/catalog', '/system']);
        expect(texts(page, '.tab-badge')).toEqual(['2']);
        expect(setAppBadge).toHaveBeenCalledWith(2);
    });

    it('clears the number on the app icon when the inbox is empty, and leaves it alone before the data is loaded', () => {
        store.loaded.set(false);
        open();
        expect(clearAppBadge).not.toHaveBeenCalled();

        store.loaded.set(true);
        fixture.detectChanges();

        expect(clearAppBadge).toHaveBeenCalledTimes(1);
        expect(page.querySelector('.tab-badge')).toBeNull();
    });

    it('shows no banner while connected, or before the first load has settled', () => {
        open();
        expect(page.querySelector('.offline')).toBeNull();

        store.online.set(false);
        store.settled.set(false);
        fixture.detectChanges();

        expect(page.querySelector('.offline')).toBeNull();
    });

    it('says there is no connection, from when the list is, and how many changes wait', () => {
        store.online.set(false);
        store.updatedAt.set('2026-11-13T10:00:00.000Z');
        store.pending.set([{ catalogItemId: 1 }, { catalogItemId: 2 }]);
        open();

        const banner = texts(page, '.offline span')[0];

        expect(banner).toContain('common.offline');
        expect(banner).toContain('common.listFrom');
        expect(banner).toContain('offline.waiting');
    });

    it('announces a handheld scan with an undo, but not a scan from this phone or an undone one', () => {
        open();
        events.emit('scan', { source: 'phone', result: 'added', itemName: 'Melk' });
        events.emit('scan', { source: 'handheld', result: 'added', itemName: 'Melk', undone: true });
        events.emit('scan', { source: 'handheld', result: 'incremented', itemName: 'Melk', quantity: 2 });
        fixture.detectChanges();

        expect(texts(page, '.toast.ok .grow')).toEqual(['scan.incremented']);

        click(page, '.toast-action');
        fixture.detectChanges();

        expect(api.undoScan).toHaveBeenCalledTimes(1);
        expect(store.refreshListAndInbox).toHaveBeenCalledTimes(1);
        expect(page.querySelector('.toast')).toBeNull();
    });

    it('announces an unknown handheld scan with a way to the inbox', () => {
        open();
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        events.emit('scan', { source: 'handheld', result: 'needs_name', code: '871' });
        fixture.detectChanges();

        expect(texts(page, '.toast.attention .grow')).toEqual(['scan.unknownHandheld']);

        click(page, '.toast-action');

        expect(navigate).toHaveBeenCalledWith('/inbox');
    });

    it('shows at most three messages and lets each go after five seconds', () => {
        open();
        const toasts = TestBed.inject(ToastService);
        for (const text of ['a', 'b', 'c', 'd']) {
            toasts.show({ kind: 'ok', text });
        }
        fixture.detectChanges();
        expect(texts(page, '.toast .grow')).toEqual(['b', 'c', 'd']);

        vi.advanceTimersByTime(5000);
        fixture.detectChanges();

        expect(page.querySelector('.toast')).toBeNull();
    });
});

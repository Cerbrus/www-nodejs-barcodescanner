import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import {
    FakeEvents,
    FakeRemarks,
    FakeStore,
    click,
    fakeEvents,
    fakeRemarks,
    fakeStore,
    texts
} from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { PullRefreshService } from '../../services/pull-refresh.service';
import { RemarkService } from '../../services/remark.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
    let fixture: ComponentFixture<ShellComponent>;
    let page: HTMLElement;
    let store: FakeStore;
    let events: FakeEvents;
    let remarks: FakeRemarks;
    const owner = signal(true);
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
        remarks = fakeRemarks();
        owner.set(true);
        Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: setAppBadge });
        Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: clearAppBadge });
        TestBed.configureTestingModule({
            imports: [ShellComponent, TranslateTesting],
            providers: [
                provideRouter(['list', 'scan', 'inbox', 'catalog', 'system'].map((path) => ({ path, children: [] }))),
                { provide: ShoppingStore, useValue: store },
                { provide: EventsService, useValue: events },
                { provide: ApiService, useValue: api },
                { provide: RemarkService, useValue: remarks },
                { provide: AuthService, useValue: { owner } }
            ]
        });
    });

    afterEach(() => {
        Reflect.deleteProperty(navigator, 'setAppBadge');
        Reflect.deleteProperty(navigator, 'clearAppBadge');
        vi.useRealTimers();
    });

    it('shows the five tabs, and the number of unnamed barcodes on the inbox tab and the app icon', () => {
        store.inbox.set([
            { code: '1', scanCount: 1 },
            { code: '2', scanCount: 1 }
        ]);
        open();

        expect(Array.from(page.querySelectorAll('a.tab'), (tab) => tab.getAttribute('href'))).toEqual([
            '/list',
            '/scan',
            '/inbox',
            '/recipes',
            '/system'
        ]);
        expect(texts(page, '.tab-badge')).toEqual(['2']);
        expect(setAppBadge).toHaveBeenCalledWith(2);
    });

    it('counts an offered recipe on the inbox tab too', () => {
        store.inbox.set([{ code: '1', scanCount: 1 }]);
        store.recipeOffers.set([
            { id: 3, name: 'Soep', createdAt: '2026-11-23T16:00:00.000Z', products: 4, unknown: [], nameTaken: false }
        ]);
        open();

        expect(texts(page, '.tab-badge')).toEqual(['2']);
    });

    it('shows the number of open remarks on the system tab', () => {
        remarks.ready.set(4);
        open();

        expect(Array.from(page.querySelectorAll('a.tab'), (tab) => texts(tab, '.tab-badge'))).toEqual([
            [],
            [],
            [],
            [],
            ['4']
        ]);
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
        store.pending.set([{ id: 'a' }, { id: 'b' }]);
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

        expect(store.undoLastScan).toHaveBeenCalledTimes(1);
        expect(page.querySelector('.toast')).toBeNull();
    });

    it('announces a recipe from the handheld scanner by its name, and says so when a product was unknown', () => {
        open();
        events.emit('scan', { source: 'handheld', result: 'recipe', title: 'Pannenkoeken', added: 3, unknown: [] });
        events.emit('scan', {
            source: 'handheld',
            result: 'recipe_partial',
            title: 'Soep',
            added: 1,
            unknown: [99]
        });
        fixture.detectChanges();

        expect(texts(page, '.toast.ok .grow')).toEqual(['recipe.added']);
        expect(texts(page, '.toast.attention .grow')).toEqual(['recipe.addedPartly']);
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

    it('starts the remark service, and tells the owner about a remark from someone else with a way to it', () => {
        open();
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        events.emit('remark', { id: 1, kind: 'bug', fromOwner: true });
        fixture.detectChanges();
        expect(page.querySelector('.toast')).toBeNull();

        events.emit('remark', { id: 2, kind: 'bug', fromOwner: false });
        fixture.detectChanges();
        click(page, '.toast-action');

        expect(remarks.start).toHaveBeenCalledTimes(1);
        expect(texts(page, '.toast.attention .grow')).toEqual(['remark.newFromOther']);
        expect(navigate).toHaveBeenCalledWith('/remarks');
    });

    it('does not tell another account about remarks', () => {
        owner.set(false);
        open();
        events.emit('remark', { id: 2, kind: 'bug', fromOwner: false });
        fixture.detectChanges();

        expect(page.querySelector('.toast')).toBeNull();
    });

    it('shows a bar while pointing, which can be cancelled, and opens the remark sheet for the tapped part', async () => {
        open();
        expect(page.querySelector('.pointing')).toBeNull();

        remarks.startPointing();
        fixture.detectChanges();
        expect(texts(page, '.pointing .grow')).toEqual(['remark.pointing']);

        click(page, '.pointing-cancel');
        fixture.detectChanges();
        expect(page.querySelector('.pointing')).toBeNull();

        remarks.startPointing();
        fixture.detectChanges();
        (page.querySelector('main') as HTMLElement).insertAdjacentHTML(
            'beforeend',
            '<button id="probe" class="btn">Probe</button>'
        );
        const probed = vi.fn();
        (page.querySelector('#probe') as HTMLElement).addEventListener('click', probed);
        click(page, '#probe');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(probed).not.toHaveBeenCalled();
        expect(remarks.pointing()).toBe(false);
        expect(remarks.draft()?.target?.text).toBe('Probe');
        expect(page.querySelector('app-remark-sheet dialog')).not.toBeNull();
    });

    it('while pointing, a tap on the active tab starts a remark about it, and a tap on another tab only navigates', () => {
        open();
        const tabs = Array.from(page.querySelectorAll<HTMLElement>('a.tab'));
        tabs[0].classList.add('active');
        const tapped = vi.fn((event: Event) => event.preventDefault());
        page.querySelector('nav')?.addEventListener('click', tapped);
        remarks.startPointing();

        tabs[1].click();
        expect(tapped).toHaveBeenCalledTimes(1);
        expect(remarks.pointing()).toBe(true);
        expect(remarks.draft()).toBeUndefined();

        tabs[0].click();
        expect(tapped).toHaveBeenCalledTimes(1);
        expect(remarks.pointing()).toBe(false);
        expect(remarks.draft()?.target).toEqual(
            expect.objectContaining({
                text: 'nav.list',
                path: expect.stringMatching(/^div#\d+ > nav\.tabs#\d+ > a\.tab#0$/)
            })
        );
    });

    it('leaves a tap on the active tab alone while not pointing', () => {
        open();
        const tab = page.querySelector<HTMLElement>('a.tab') as HTMLElement;
        tab.classList.add('active');
        tab.addEventListener('click', (event) => event.preventDefault());
        tab.click();

        expect(remarks.draft()).toBeUndefined();
    });

    it('starts a remark about a tab on a right click', () => {
        open();
        const event = new Event('contextmenu', { bubbles: true, cancelable: true });
        page.querySelectorAll('a.tab')[2].dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(remarks.draft()?.target).toEqual(expect.objectContaining({ text: 'nav.inbox' }));
    });

    const pull = (): void => {
        const main = page.querySelector('main') as HTMLElement;
        const touch = (type: string, y?: number): void => {
            const event = new Event(type, { cancelable: true });
            Object.defineProperty(event, 'touches', { value: y === undefined ? [] : [{ clientY: y }] });
            main.dispatchEvent(event);
        };

        touch('touchstart', 0);
        touch('touchmove', 300);
        touch('touchend');
    };

    it('reloads everything when the page is pulled down and the page has no reload of its own', () => {
        open();

        pull();

        expect(store.refreshAll).toHaveBeenCalledTimes(1);
    });

    it('runs the reload of the page when it has one', () => {
        open();
        const reload = vi.fn(() => of(undefined));
        TestBed.runInInjectionContext(() => TestBed.inject(PullRefreshService).use(reload));

        pull();

        expect(reload).toHaveBeenCalledTimes(1);
        expect(store.refreshAll).not.toHaveBeenCalled();
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

import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { EventsService } from './events.service';
import { UpdateService } from './update.service';

const LOADED = 'main-AAAAAAAA.js';
const NEWER = 'main-BBBBBBBB.js';

describe('UpdateService', () => {
    let resumed$: Subject<void>;
    let routerEvents$: Subject<unknown>;
    let reload: ReturnType<typeof vi.spyOn>;
    const showAddress = (address: string): void => (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(address);
    let published: Array<string> | undefined;

    const settle = async (): Promise<void> => {
        for (let round = 0; round < 5; round++) {
            await Promise.resolve();
        }
    };
    const resume = async (): Promise<void> => {
        resumed$.next();
        await settle();
    };
    const changePage = async (): Promise<void> => {
        routerEvents$.next(new NavigationEnd(1, '/list', '/list'));
        await settle();
    };

    beforeEach(() => {
        published = [NEWER, 'styles-CCCCCCCC.css'];
        resumed$ = new Subject<void>();
        routerEvents$ = new Subject<unknown>();
        showAddress('http://localhost/#/list');
        reload = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        sessionStorage.clear();
        document.head.innerHTML = `<script src="/${LOADED}"></script>`;
        document.body.innerHTML = '';
        vi.stubGlobal(
            'fetch',
            vi.fn(() => (published ? Promise.resolve({ ok: true, json: () => Promise.resolve(published) }) : Promise.reject(new Error('offline'))))
        );

        TestBed.configureTestingModule({
            providers: [
                { provide: EventsService, useValue: { resumed: resumed$ } },
                { provide: Router, useValue: { events: routerEvents$ } }
            ]
        });
        TestBed.inject(UpdateService).start();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('reloads when the script the page started with is no longer published', async () => {
        await resume();

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the page still runs the published files', async () => {
        published = [LOADED];
        await resume();

        expect(reload).not.toHaveBeenCalled();
    });

    it('does nothing without a connection or without a file list', async () => {
        published = undefined;
        await resume();
        published = [];
        await resume();

        expect(reload).not.toHaveBeenCalled();
    });

    it('waits while a text field has focus and reloads at the next change of page', async () => {
        document.body.innerHTML = '<input id="field" />';
        document.getElementById('field')?.focus();
        await resume();
        expect(reload).not.toHaveBeenCalled();

        (document.activeElement as HTMLElement).blur();
        await changePage();

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('waits while a dialog is open or the camera page is shown', async () => {
        document.body.innerHTML = '<dialog open></dialog>';
        await resume();
        document.body.innerHTML = '';
        showAddress('http://localhost/#/scan');
        await resume();

        expect(reload).not.toHaveBeenCalled();
    });

    it('does not check on a change of page when nothing is waiting', async () => {
        await changePage();

        expect(fetch).not.toHaveBeenCalled();
    });

    it('reloads once for one published list, so old cached files cannot cause a loop', async () => {
        await resume();
        await resume();

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('reloads again for a later release', async () => {
        await resume();
        published = ['main-DDDDDDDD.js'];
        await resume();

        expect(reload).toHaveBeenCalledTimes(2);
    });
});

import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { EventsService } from './events.service';
import { PageLogService } from './page-log.service';
import { PageSwapService, PreparedPage } from './page-swap.service';
import { UpdateService } from './update.service';

const LOADED = 'main-AAAAAAAA.js';
const NEWER = 'main-BBBBBBBB.js';

describe('UpdateService', () => {
    let resumed$: Subject<void>;
    let routerEvents$: Subject<unknown>;
    let reload: ReturnType<typeof vi.spyOn>;
    let prepare: ReturnType<typeof vi.fn>;
    let swap: ReturnType<typeof vi.fn>;
    let lines: Array<string>;
    const showAddress = (address: string): void =>
        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(address);
    let published: Array<string> | undefined;

    const settle = async (): Promise<void> => {
        for (let round = 0; round < 15; round++) {
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
        prepare = vi.fn(() => Promise.resolve({ files: [NEWER] } as unknown as PreparedPage));
        swap = vi.fn(() => Promise.resolve(true));
        lines = [];
        document.head.innerHTML = `<script src="/${LOADED}"></script>`;
        document.body.innerHTML = '';
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                published
                    ? Promise.resolve({ ok: true, json: () => Promise.resolve(published) })
                    : Promise.reject(new Error('offline'))
            )
        );

        TestBed.configureTestingModule({
            providers: [
                { provide: EventsService, useValue: { resumed: resumed$ } },
                { provide: Router, useValue: { events: routerEvents$ } },
                { provide: PageSwapService, useValue: { prepare, swap, swapped: () => false } },
                { provide: PageLogService, useValue: { add: (line: string) => lines.push(line) } }
            ]
        });
        TestBed.inject(UpdateService).start();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('swaps to the new version without reloading when the script the page started with is no longer published', async () => {
        await resume();

        expect(prepare).toHaveBeenCalledWith([NEWER, 'styles-CCCCCCCC.css']);
        expect(swap).toHaveBeenCalledTimes(1);
        expect(reload).not.toHaveBeenCalled();
        expect(lines).toEqual([
            `started by a page load (unknown), running ${LOADED}`,
            'a newer version is published, fetching its files',
            'swap done, no page load'
        ]);
    });

    it('does nothing when the page still runs the published files', async () => {
        published = [LOADED];
        await resume();

        expect(prepare).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });

    it('does nothing without a connection or without a file list', async () => {
        published = undefined;
        await resume();
        published = [];
        await resume();

        expect(prepare).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });

    it('waits while a text field has focus and swaps at the next change of page', async () => {
        document.body.innerHTML = '<input id="field" />';
        document.getElementById('field')?.focus();
        await resume();
        await resume();
        expect(swap).not.toHaveBeenCalled();
        expect(lines.slice(1)).toEqual(['a newer version is published, waiting because a text field has focus']);

        (document.activeElement as HTMLElement).blur();
        await changePage();

        expect(swap).toHaveBeenCalledTimes(1);
    });

    it('waits while a dialog is open or the camera page is shown', async () => {
        document.body.innerHTML = '<dialog open></dialog>';
        await resume();
        document.body.innerHTML = '';
        showAddress('http://localhost/#/scan');
        await resume();

        expect(prepare).not.toHaveBeenCalled();
        expect(swap).not.toHaveBeenCalled();
    });

    it('does not check on a change of page when nothing is waiting', async () => {
        await changePage();

        expect(fetch).not.toHaveBeenCalled();
    });

    it('swaps once for one published list, so old cached files cannot cause a loop', async () => {
        await resume();
        await resume();

        expect(swap).toHaveBeenCalledTimes(1);
    });

    it('swaps again for a later release', async () => {
        await resume();
        published = ['main-DDDDDDDD.js'];
        await resume();

        expect(swap).toHaveBeenCalledTimes(2);
    });

    it('does not touch the running app when the new files could not be fetched, and tries again later', async () => {
        prepare.mockRejectedValueOnce(new Error('offline'));
        await resume();
        expect(swap).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();

        await changePage();

        expect(swap).toHaveBeenCalledTimes(1);
    });

    it('reloads when the new version cannot be swapped in, once', async () => {
        prepare.mockResolvedValue({ refused: 'the main script already ran in this page' });
        await resume();
        await resume();

        expect(swap).not.toHaveBeenCalled();
        expect(reload).toHaveBeenCalledTimes(1);
        expect(lines).toContain('reloading the page instead of swapping: the main script already ran in this page');
    });

    it('does not reload when the swap stopped before the running app was touched, and tries again later', async () => {
        swap.mockResolvedValueOnce(false);
        await resume();
        expect(reload).not.toHaveBeenCalled();

        await changePage();

        expect(swap).toHaveBeenCalledTimes(2);
        expect(reload).not.toHaveBeenCalled();
    });

    it('reloads when the swap fails halfway', async () => {
        swap.mockRejectedValueOnce(new Error('did not start'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await resume();

        expect(reload).toHaveBeenCalledTimes(1);
        expect(lines).toContain('the swap failed after the old app was stopped, reloading the page: did not start');
    });
});

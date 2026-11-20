import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PageSwapService, PreparedPage } from './page-swap.service';

const NEW_PAGE = `<!doctype html><html><head>
<style>.boot{color:red}</style>
<link rel="stylesheet" href="styles-BBBBBBBB.css" media="print">
<noscript><link rel="stylesheet" href="styles-BBBBBBBB.css"></noscript>
</head><body><app-root><div class="boot"></div></app-root>
<link rel="modulepreload" href="chunk-r2_usiF-.js"><script src="main-BBBBBBBB.js" type="module"></script></body></html>`;

describe('PageSwapService', () => {
    let service: PageSwapService;
    let destroy: ReturnType<typeof vi.fn>;
    let answers: Record<string, { ok: boolean; text?: string }>;
    let keptPages: Array<[string, unknown]>;
    const published = ['main-BBBBBBBB.js', 'chunk-r2_usiF-.js', 'styles-BBBBBBBB.css'];

    beforeEach(() => {
        destroy = vi.fn(() => document.querySelector('app-root')?.replaceChildren());
        answers = {
            '/': { ok: true, text: NEW_PAGE },
            '/main-BBBBBBBB.js': { ok: true },
            '/chunk-r2_usiF-.js': { ok: true },
            '/styles-BBBBBBBB.css': { ok: true }
        };
        vi.stubGlobal(
            'fetch',
            vi.fn((address: string) => {
                const answer = answers[address];

                return answer
                    ? Promise.resolve({
                          ok: answer.ok,
                          text: () => Promise.resolve(answer.text ?? ''),
                          clone: () => ({ copyOf: address })
                      })
                    : Promise.reject(new Error('offline'));
            })
        );
        keptPages = [];
        vi.stubGlobal('caches', {
            open: vi.fn(() =>
                Promise.resolve({
                    put: (key: string, kept: unknown) => Promise.resolve(keptPages.push([key, kept]))
                })
            )
        });
        delete document.documentElement.dataset['seenScripts'];
        document.head.innerHTML = `<style>.old{}</style>
            <link rel="stylesheet" href="/styles-AAAAAAAA.css">`;
        document.body.innerHTML = `<app-root ng-version="22"><p>old page</p></app-root>
            <script src="/main-AAAAAAAA.js" type="module"></script>`;
        TestBed.configureTestingModule({ providers: [{ provide: ApplicationRef, useValue: { destroy } }] });
        service = TestBed.inject(PageSwapService);
    });

    afterEach(() => vi.unstubAllGlobals());

    it('fetches the start page and every file of the new version before anything changes', async () => {
        const prepared = (await service.prepare(published)) as PreparedPage;

        expect(prepared.files.sort()).toEqual([...published].sort());
        expect(fetch).toHaveBeenCalledWith('/main-BBBBBBBB.js');
        expect(fetch).toHaveBeenCalledWith('/styles-BBBBBBBB.css');
        expect(fetch).toHaveBeenCalledWith('/chunk-r2_usiF-.js');
        expect(destroy).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('old page');
    });

    it('fails and leaves the page alone when a file of the new version cannot be fetched', async () => {
        answers['/chunk-r2_usiF-.js'] = { ok: false };

        await expect(service.prepare(published)).rejects.toThrow();
        await expect(service.prepare(published)).rejects.toThrow();
        expect(destroy).not.toHaveBeenCalled();
    });

    it('fails when the start page cannot be fetched', async () => {
        answers['/'] = { ok: false };

        await expect(service.prepare(published)).rejects.toThrow();
    });

    it('does not swap when the start page lists files that are not published', async () => {
        await expect(service.prepare(['main-BBBBBBBB.js'])).resolves.toEqual({ refused: expect.any(String) });
    });

    it('does not swap to a script that already ran in this page, as after a rollback', async () => {
        document.documentElement.dataset['seenScripts'] = 'main-BBBBBBBB.js';

        await expect(service.prepare(published)).resolves.toEqual({ refused: expect.any(String) });
    });

    it('does not swap when only the style sheet is new, because the running main script cannot start twice', async () => {
        answers['/'] = { ok: true, text: NEW_PAGE.replace('main-BBBBBBBB.js', 'main-AAAAAAAA.js') };

        await expect(
            service.prepare(['main-AAAAAAAA.js', 'chunk-r2_usiF-.js', 'styles-BBBBBBBB.css'])
        ).resolves.toEqual({ refused: expect.any(String) });
    });

    it('does not swap when a chunk of the start page is not published', async () => {
        await expect(service.prepare(['main-BBBBBBBB.js', 'styles-BBBBBBBB.css'])).resolves.toEqual({
            refused: expect.any(String)
        });
    });

    it('destroys the old app, replaces files and styles, and waits until the new app has started', async () => {
        const prepared = (await service.prepare(published)) as PreparedPage;
        const swapping = service.swap(prepared);

        document.head
            .querySelectorAll('link[href="/styles-BBBBBBBB.css"]')
            .forEach((link) => link.dispatchEvent(new Event('load')));
        await vi.waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
        document.querySelector('app-root')?.setAttribute('ng-version', '22');
        await expect(swapping).resolves.toBe(true);

        expect(
            Array.from(document.querySelectorAll('script[src]')).map((script) => script.getAttribute('src'))
        ).toEqual(['/main-BBBBBBBB.js']);
        expect(
            Array.from(document.querySelectorAll('link[rel=stylesheet]')).map((link) => link.getAttribute('href'))
        ).toEqual(['/styles-BBBBBBBB.css']);
        expect(document.head.innerHTML).not.toContain('.old{}');
        expect(
            Array.from(document.head.querySelectorAll('style, link[rel=stylesheet]')).map(
                (element) => element.localName
            )
        ).toEqual(['style', 'link']);
        expect(document.head.innerHTML).toContain('.boot{color:red}');
        expect(document.querySelectorAll('app-root').length).toBe(1);
        expect(document.querySelector('app-root .boot')).not.toBeNull();
        expect(keptPages).toEqual([['/', { copyOf: '/' }]]);
        expect(document.body.textContent).not.toContain('old page');
        expect(document.documentElement.dataset['seenScripts']).toBe('main-AAAAAAAA.js');
    });

    it('does not touch the running app when a style sheet does not load', async () => {
        const prepared = (await service.prepare(published)) as PreparedPage;
        const swapping = service.swap(prepared);

        document.head
            .querySelectorAll('link[href="/styles-BBBBBBBB.css"]')
            .forEach((link) => link.dispatchEvent(new Event('error')));

        await expect(swapping).resolves.toBe(false);
        expect(destroy).not.toHaveBeenCalled();
        expect(document.head.querySelector('link[href="/styles-BBBBBBBB.css"]')).toBeNull();
        expect(document.head.querySelector('link[href="/styles-AAAAAAAA.css"]')).not.toBeNull();
        expect(keptPages).toEqual([]);
    });
});

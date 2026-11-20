import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PageSwapService } from './page-swap.service';

const NEW_PAGE = `<!doctype html><html><head>
<style>.boot{color:red}</style>
<link rel="stylesheet" href="styles-BBBBBBBB.css" media="print">
</head><body><app-root><div class="boot"></div></app-root>
<link rel="modulepreload" href="chunk-ABCDEFGH.js"><script src="main-BBBBBBBB.js" type="module"></script></body></html>`;

describe('PageSwapService', () => {
    let service: PageSwapService;
    let destroy: ReturnType<typeof vi.fn>;
    let answers: Record<string, { ok: boolean; text?: string }>;
    const published = ['main-BBBBBBBB.js', 'chunk-ABCDEFGH.js', 'styles-BBBBBBBB.css'];

    beforeEach(() => {
        destroy = vi.fn(() => document.querySelector('app-root')?.replaceChildren());
        answers = {
            '/': { ok: true, text: NEW_PAGE },
            '/main-BBBBBBBB.js': { ok: true },
            '/chunk-ABCDEFGH.js': { ok: true },
            '/styles-BBBBBBBB.css': { ok: true }
        };
        vi.stubGlobal(
            'fetch',
            vi.fn((address: string) => {
                const answer = answers[address];

                return answer
                    ? Promise.resolve({ ok: answer.ok, text: () => Promise.resolve(answer.text ?? '') })
                    : Promise.reject(new Error('offline'));
            })
        );
        delete document.documentElement.dataset['seenScripts'];
        document.head.innerHTML = `<style>.old{}</style><style ng-app-id="ng">.component{}</style>
            <link rel="stylesheet" href="/styles-AAAAAAAA.css">`;
        document.body.innerHTML = `<app-root ng-version="22"><p>old page</p></app-root>
            <script src="/main-AAAAAAAA.js" type="module"></script>`;
        TestBed.configureTestingModule({ providers: [{ provide: ApplicationRef, useValue: { destroy } }] });
        service = TestBed.inject(PageSwapService);
    });

    afterEach(() => vi.unstubAllGlobals());

    it('fetches the start page and every file of the new version before anything changes', async () => {
        const prepared = await service.prepare(published);

        expect(prepared?.files.sort()).toEqual([...published].sort());
        expect(fetch).toHaveBeenCalledWith('/main-BBBBBBBB.js');
        expect(fetch).toHaveBeenCalledWith('/styles-BBBBBBBB.css');
        expect(destroy).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('old page');
    });

    it('fails and leaves the page alone when a file of the new version cannot be fetched', async () => {
        answers['/chunk-ABCDEFGH.js'] = { ok: false };

        await expect(service.prepare(published)).rejects.toThrow();
        await expect(service.prepare(published)).rejects.toThrow();
        expect(destroy).not.toHaveBeenCalled();
    });

    it('fails when the start page cannot be fetched', async () => {
        answers['/'] = { ok: false };

        await expect(service.prepare(published)).rejects.toThrow();
    });

    it('does not swap when the start page lists files that are not published', async () => {
        await expect(service.prepare(['main-BBBBBBBB.js'])).resolves.toBeUndefined();
    });

    it('does not swap to a script that already ran in this page, as after a rollback', async () => {
        document.documentElement.dataset['seenScripts'] = 'main-BBBBBBBB.js';

        await expect(service.prepare(published)).resolves.toBeUndefined();
    });

    it('destroys the old app, replaces files and styles, and waits until the new app has started', async () => {
        const prepared = await service.prepare(published);
        const swapping = service.swap(prepared!);

        document.head
            .querySelectorAll('link[href="/styles-BBBBBBBB.css"]')
            .forEach((link) => link.dispatchEvent(new Event('load')));
        await vi.waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
        document.querySelector('app-root')?.setAttribute('ng-version', '22');
        await swapping;

        expect(
            Array.from(document.querySelectorAll('script[src]')).map((script) => script.getAttribute('src'))
        ).toEqual(['/main-BBBBBBBB.js']);
        expect(
            Array.from(document.querySelectorAll('link[rel=stylesheet]')).map((link) => link.getAttribute('href'))
        ).toEqual(['/styles-BBBBBBBB.css']);
        expect(document.head.querySelector('style[ng-app-id]')).not.toBeNull();
        expect(document.head.innerHTML).not.toContain('.old{}');
        expect(document.head.innerHTML).toContain('.boot{color:red}');
        expect(document.querySelectorAll('app-root').length).toBe(1);
        expect(document.body.textContent).not.toContain('old page');
        expect(document.documentElement.dataset['seenScripts']).toBe('main-AAAAAAAA.js');
    });

    it('does not touch the running app when a style sheet does not load', async () => {
        const prepared = await service.prepare(published);
        const swapping = service.swap(prepared!);

        document.head
            .querySelectorAll('link[href="/styles-BBBBBBBB.css"]')
            .forEach((link) => link.dispatchEvent(new Event('error')));

        await expect(swapping).rejects.toThrow();
        expect(destroy).not.toHaveBeenCalled();
    });
});

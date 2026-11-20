import { ApplicationRef, Injectable, inject } from '@angular/core';

const PAGE_URL = '/';
const KEPT_FILES = 'app-files-v1';
const SEEN_SCRIPTS = 'seenScripts';
const BOOT_LIMIT_MILLISECONDS = 20000;
const POLL_MILLISECONDS = 50;
const SCRIPTS = 'script[src]';
const PRELOADS = 'link[rel="modulepreload"][href]';
const STYLESHEETS = 'link[rel="stylesheet"][href]';

export interface PreparedPage {
    page: Document;
    files: Array<string>;
    answer: Response;
}

export interface SwapRefusal {
    refused: string;
}

@Injectable({ providedIn: 'root' })
export class PageSwapService {
    private readonly application = inject(ApplicationRef);

    public swapped(): boolean {
        return this.seenScripts().length !== 0;
    }

    public async prepare(published: Array<string>): Promise<PreparedPage | SwapRefusal> {
        const response = await fetch(PAGE_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('The start page could not be fetched.');
        }

        const answer = response.clone();
        const page = new DOMParser().parseFromString(await response.text(), 'text/html');
        const main = this.filesOf(page, SCRIPTS);
        const files = [...new Set([...main, ...this.filesOf(page, PRELOADS), ...this.filesOf(page, STYLESHEETS)])];
        const unpublished = files.filter((file) => !published.includes(file));
        if (!main.length) {
            return { refused: 'the start page names no main script' };
        }
        if (unpublished.length) {
            return { refused: `the start page names files that are not published: ${unpublished.join(', ')}` };
        }
        if (this.alreadyRun(main)) {
            return { refused: `the main script ${main.join(', ')} already ran in this page` };
        }

        const answers = await Promise.all(files.map((file) => fetch(`/${file}`)));
        if (answers.some((fetched) => !fetched.ok)) {
            throw new Error('Not all files of the new version could be fetched.');
        }

        return { page, files, answer };
    }

    public async swap(prepared: PreparedPage): Promise<boolean> {
        const { page } = prepared;
        const oldStyles = Array.from(document.querySelectorAll(STYLESHEETS));
        const newStyles = this.filesOf(page, STYLESHEETS).map((file) => this.stylesheet(file));
        try {
            await Promise.all(newStyles.map((link) => this.loaded(link)));
        } catch {
            newStyles.forEach((link) => link.remove());

            return false;
        }

        this.rememberRunScripts();
        this.application.destroy();
        this.dropOldFiles(oldStyles);
        this.putNewStyles(page, newStyles[0]);
        this.putNewPage(page);
        await this.booted();
        await this.keepPage(prepared.answer);

        return true;
    }

    private filesOf(root: ParentNode, selector: string): Array<string> {
        const files = Array.from(root.querySelectorAll(selector))
            .map(
                (element) =>
                    new URL(
                        element.getAttribute('src') ?? element.getAttribute('href') ?? '',
                        `${window.location.origin}${PAGE_URL}`
                    )
            )
            .filter((url) => url.origin === window.location.origin)
            .map((url) => url.pathname.slice(1));

        return [...new Set(files)];
    }

    private seenScripts(): Array<string> {
        return (document.documentElement.dataset[SEEN_SCRIPTS] ?? '').split(' ').filter(Boolean);
    }

    private alreadyRun(main: Array<string>): boolean {
        const run = [...this.seenScripts(), ...this.filesOf(document, SCRIPTS)];

        return main.some((file) => run.includes(file));
    }

    private rememberRunScripts(): void {
        document.documentElement.dataset[SEEN_SCRIPTS] = [
            ...new Set([...this.seenScripts(), ...this.filesOf(document, SCRIPTS)])
        ].join(' ');
    }

    private stylesheet(file: string): HTMLLinkElement {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `/${file}`;
        document.head.appendChild(link);

        return link;
    }

    private loaded(link: HTMLLinkElement): Promise<void> {
        return new Promise((resolve, reject) => {
            link.addEventListener('load', () => resolve());
            link.addEventListener('error', () => reject(new Error(`${link.href} did not load`)));
        });
    }

    private dropOldFiles(oldStyles: Array<Element>): void {
        oldStyles.forEach((link) => link.remove());
        document.querySelectorAll(`${SCRIPTS}, ${PRELOADS}`).forEach((element) => element.remove());
        document.head.querySelectorAll('style').forEach((style) => style.remove());
        document.querySelectorAll('app-root').forEach((root) => root.remove());
    }

    private putNewStyles(page: Document, before?: Element): void {
        page.head
            .querySelectorAll('style')
            .forEach((style) => document.head.insertBefore(document.importNode(style, true), before ?? null));
    }

    private putNewPage(page: Document): void {
        const root = page.querySelector('app-root');
        if (root) {
            document.body.prepend(document.importNode(root, true));
        }

        for (const file of this.filesOf(page, SCRIPTS)) {
            const script = document.createElement('script');
            script.type = 'module';
            script.src = `/${file}`;
            document.body.appendChild(script);
        }
    }

    private booted(): Promise<void> {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const check = (): void => {
                if (document.querySelector('app-root[ng-version]')) {
                    resolve();
                } else if (Date.now() - started > BOOT_LIMIT_MILLISECONDS) {
                    reject(new Error('The new version did not start.'));
                } else {
                    setTimeout(check, POLL_MILLISECONDS);
                }
            };
            check();
        });
    }

    private async keepPage(answer: Response): Promise<void> {
        if (!('caches' in window)) {
            return;
        }

        try {
            const kept = await caches.open(KEPT_FILES);
            await kept.put(PAGE_URL, answer);
        } catch (error) {
            console.warn('The new start page could not be kept for use without a connection.', error);
        }
    }
}

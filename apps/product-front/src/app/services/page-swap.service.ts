import { ApplicationRef, Injectable, inject } from '@angular/core';

const PAGE_URL = '/';
const SEEN_SCRIPTS = 'seenScripts';
const BOOT_LIMIT_MILLISECONDS = 10000;
const POLL_MILLISECONDS = 50;
const ANGULAR_STYLE = 'style[ng-app-id]';
const VERSIONED_FILE = /-[A-Z0-9]{8}\.(?:js|css)$/;

export interface PreparedPage {
    page: Document;
    files: Array<string>;
}

@Injectable({ providedIn: 'root' })
export class PageSwapService {
    private readonly application = inject(ApplicationRef);

    public async prepare(published: Array<string>): Promise<PreparedPage | undefined> {
        const response = await fetch(PAGE_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('The start page could not be fetched.');
        }

        const page = new DOMParser().parseFromString(await response.text(), 'text/html');
        const files = this.versionedFiles(page);
        const main = this.scriptsOf(page);
        if (!main.length || !files.every((file) => published.includes(file)) || this.alreadyRun(main)) {
            return undefined;
        }

        const answers = await Promise.all(files.map((file) => fetch(`/${file}`)));
        if (answers.some((answer) => !answer.ok)) {
            throw new Error('Not all files of the new version could be fetched.');
        }

        return { page, files };
    }

    public async swap(prepared: PreparedPage): Promise<void> {
        const { page } = prepared;
        const oldStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'));
        const newStyles = this.stylesheetsOf(page).map((address) => this.stylesheet(address));
        await Promise.all(newStyles.map((link) => this.loaded(link)));

        this.rememberRunScripts();
        this.application.destroy();
        this.dropOldFiles(oldStyles);
        this.putNewStyles(page);
        this.putNewPage(page);
        await this.booted();
    }

    private versionedFiles(page: Document): Array<string> {
        const addresses = [
            ...this.scriptsOf(page),
            ...Array.from(page.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"][href]')).map((link) =>
                this.pathOf(link.getAttribute('href') ?? '')
            ),
            ...this.stylesheetsOf(page)
        ];

        return [...new Set(addresses.filter((file) => VERSIONED_FILE.test(file)))];
    }

    private scriptsOf(page: Document): Array<string> {
        return Array.from(page.querySelectorAll('script[src]')).map((script) =>
            this.pathOf(script.getAttribute('src') ?? '')
        );
    }

    private stylesheetsOf(page: Document): Array<string> {
        return Array.from(page.querySelectorAll('link[rel="stylesheet"][href]')).map((link) =>
            this.pathOf(link.getAttribute('href') ?? '')
        );
    }

    private pathOf(address: string): string {
        return new URL(address, `${window.location.origin}${PAGE_URL}`).pathname.slice(1);
    }

    private runScripts(): Array<string> {
        return this.scriptsOf(document);
    }

    private alreadyRun(main: Array<string>): boolean {
        const seen = (document.documentElement.dataset[SEEN_SCRIPTS] ?? '').split(' ');

        return main.some((file) => seen.includes(file));
    }

    private rememberRunScripts(): void {
        const seen = (document.documentElement.dataset[SEEN_SCRIPTS] ?? '').split(' ').filter(Boolean);
        document.documentElement.dataset[SEEN_SCRIPTS] = [...new Set([...seen, ...this.runScripts()])].join(' ');
    }

    private stylesheet(address: string): HTMLLinkElement {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `/${address}`;
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
        document.querySelectorAll('script[src], link[rel="modulepreload"]').forEach((element) => element.remove());
        document.head.querySelectorAll(`style:not(${ANGULAR_STYLE})`).forEach((style) => style.remove());
        document.querySelectorAll('app-root').forEach((root) => root.remove());
    }

    private putNewStyles(page: Document): void {
        page.head
            .querySelectorAll('style')
            .forEach((style) => document.head.appendChild(document.importNode(style, true)));
    }

    private putNewPage(page: Document): void {
        const root = page.querySelector('app-root');
        if (root) {
            document.body.prepend(document.createElement(root.localName));
        }

        for (const address of this.scriptsOf(page)) {
            const script = document.createElement('script');
            script.type = 'module';
            script.src = `/${address}`;
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
}

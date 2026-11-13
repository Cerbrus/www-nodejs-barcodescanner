import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, Observable, catchError, filter, from, map, merge, switchMap, tap } from 'rxjs';

import { EventsService } from './events.service';

const FILE_LIST_URL = '/app-files.json';
const RELOADED_FOR_KEY = 'reloaded-for';
const VERSIONED_FILE = /-[A-Z0-9]{8}\.(?:js|css)$/;
const ENTRY_FILES = 'script[src], link[rel="stylesheet"][href]';
const BUSY_FIELD = 'input, textarea, select';
const OPEN_DIALOG = 'dialog[open]';
const CAMERA_ROUTE = '#/scan';

@Injectable({ providedIn: 'root' })
export class UpdateService {
    private readonly events = inject(EventsService);
    private readonly router = inject(Router);
    private waitingFor?: string;
    private started = false;

    public start(): void {
        if (this.started) {
            return;
        }
        this.started = true;

        const pageChanged = this.router.events.pipe(filter((event) => event instanceof NavigationEnd));

        merge(
            this.events.resumed.pipe(switchMap(() => this.publishedFiles())),
            pageChanged.pipe(
                filter(() => this.waitingFor !== undefined),
                switchMap(() => this.publishedFiles())
            )
        )
            .pipe(tap((published) => this.reloadWhenOutdated(published)))
            .subscribe();
    }

    private publishedFiles(): Observable<Array<string>> {
        return from(fetch(FILE_LIST_URL, { cache: 'no-store' }).then((response) => (response.ok ? response.json() : []))).pipe(
            map((files: unknown) => (Array.isArray(files) ? files.filter((file) => typeof file === 'string') : [])),
            catchError(() => EMPTY)
        );
    }

    private reloadWhenOutdated(published: Array<string>): void {
        const loaded = this.loadedFiles();
        if (!published.length || !loaded.length || loaded.every((file) => published.includes(file))) {
            this.waitingFor = undefined;
            return;
        }

        const signature = [...published].sort().join();
        if (sessionStorage.getItem(RELOADED_FOR_KEY) === signature) {
            console.warn('A newer version is published, but reloading did not load it.');
            return;
        }
        if (this.busy()) {
            this.waitingFor = signature;
            return;
        }

        sessionStorage.setItem(RELOADED_FOR_KEY, signature);
        window.location.reload();
    }

    private loadedFiles(): Array<string> {
        return Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(ENTRY_FILES))
            .map((element) => new URL(element instanceof HTMLScriptElement ? element.src : element.href, window.location.origin))
            .filter((url) => url.origin === window.location.origin && VERSIONED_FILE.test(url.pathname))
            .map((url) => url.pathname.slice(1));
    }

    private busy(): boolean {
        return (
            document.activeElement?.matches(BUSY_FIELD) === true ||
            document.querySelector(OPEN_DIALOG) !== null ||
            window.location.hash.startsWith(CAMERA_ROUTE)
        );
    }
}

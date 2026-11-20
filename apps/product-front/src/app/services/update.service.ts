import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, Observable, catchError, filter, from, map, merge, switchMap, tap } from 'rxjs';

import { EventsService } from './events.service';
import { PageSwapService, PreparedPage } from './page-swap.service';

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
    private readonly pageSwap = inject(PageSwapService);
    private readonly destroyRef = inject(DestroyRef);
    private waitingFor?: string;
    private swapping = false;
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
            .pipe(
                tap((published) => this.replaceWhenOutdated(published)),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe();
    }

    private publishedFiles(): Observable<Array<string>> {
        return from(
            fetch(FILE_LIST_URL, { cache: 'no-store' }).then((response) => (response.ok ? response.json() : []))
        ).pipe(
            map((files: unknown) => (Array.isArray(files) ? files.filter((file) => typeof file === 'string') : [])),
            catchError(() => EMPTY)
        );
    }

    private replaceWhenOutdated(published: Array<string>): void {
        const loaded = this.loadedFiles();
        if (!published.length || !loaded.length || loaded.every((file) => published.includes(file))) {
            this.waitingFor = undefined;
            return;
        }

        const signature = [...published].sort().join();
        if (sessionStorage.getItem(RELOADED_FOR_KEY) === signature) {
            console.warn('A newer version is published, but it could not be taken into use.');
            return;
        }
        if (this.busy()) {
            this.waitingFor = signature;
            return;
        }
        if (this.swapping) {
            return;
        }

        this.swapping = true;
        void this.swapTo(published, signature).finally(() => (this.swapping = false));
    }

    private async swapTo(published: Array<string>, signature: string): Promise<void> {
        let prepared: PreparedPage | undefined;
        try {
            prepared = await this.pageSwap.prepare(published);
        } catch {
            this.waitingFor = signature;
            return;
        }
        if (this.busy()) {
            this.waitingFor = signature;
            return;
        }

        sessionStorage.setItem(RELOADED_FOR_KEY, signature);
        if (!prepared) {
            window.location.reload();
            return;
        }

        try {
            if (!(await this.pageSwap.swap(prepared))) {
                sessionStorage.removeItem(RELOADED_FOR_KEY);
                this.waitingFor = signature;
            }
        } catch (error) {
            console.error('Taking the new version into use failed, reloading.', error);
            window.location.reload();
        }
    }

    private loadedFiles(): Array<string> {
        return Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(ENTRY_FILES))
            .map(
                (element) =>
                    new URL(element instanceof HTMLScriptElement ? element.src : element.href, window.location.origin)
            )
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

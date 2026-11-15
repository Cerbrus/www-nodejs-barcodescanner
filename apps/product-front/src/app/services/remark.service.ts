import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, catchError, concatMap, from, fromEvent, map, merge, of, switchMap, tap, throwError, toArray } from 'rxjs';

import { Remark, RemarkContext, RemarkInput, RemarkKind, RemarkTarget } from '../models';
import { ApiService } from './api.service';
import { EventsService } from './events.service';
import { ShoppingStore } from './shopping.store';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';

export interface RemarkDraft {
    target?: RemarkTarget;
}

export type RemarkDelivery = 'sent' | 'kept';

const QUEUE_KEY = 'remark-outbox';
const NO_CONNECTION = 0;

@Injectable({ providedIn: 'root' })
export class RemarkService {
    public readonly draft = signal<RemarkDraft | undefined>(undefined);
    public readonly pointing = signal(false);
    public readonly waiting = signal(this.queued().length);
    public readonly ready = signal(0);

    private readonly api = inject(ApiService);
    private readonly events = inject(EventsService);
    private readonly store = inject(ShoppingStore);
    private readonly theme = inject(ThemeService);
    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);
    private version?: { version: string; commit?: string };
    private started = false;

    public start(): void {
        if (this.started) {
            return;
        }
        this.started = true;

        this.api
            .getHealth()
            .pipe(
                tap((health) => (this.version = { version: health.version, commit: health.commit })),
                catchError(() => of(undefined))
            )
            .subscribe();

        merge(of(undefined), this.events.resumed, fromEvent(window, 'online'))
            .pipe(concatMap(() => this.sendQueued()))
            .subscribe();

        merge(of(undefined), this.events.resumed, this.events.on('remark'))
            .pipe(
                switchMap(() => this.api.getRemarks().pipe(catchError(() => EMPTY))),
                tap((answer) => this.count(answer.remarks))
            )
            .subscribe();
    }

    public count(remarks: Array<Remark>): void {
        this.ready.set(remarks.filter((remark) => remark.state === 'open' && !remark.issueUrl).length);
    }

    public write(target?: RemarkTarget): void {
        this.pointing.set(false);
        this.draft.set({ target });
    }

    public startPointing(): void {
        this.draft.set(undefined);
        this.pointing.set(true);
    }

    public cancel(): void {
        this.pointing.set(false);
        this.draft.set(undefined);
    }

    public send(kind: RemarkKind, text: string): Observable<RemarkDelivery> {
        const remark: RemarkInput = {
            kind,
            text: text.trim(),
            page: window.location.hash || '#/',
            target: this.draft()?.target,
            context: this.context(),
            writtenAt: new Date().toISOString()
        };
        this.draft.set(undefined);

        if (!navigator.onLine) {
            return of(this.keep(remark));
        }

        return this.api.sendRemark(remark).pipe(
            map((): RemarkDelivery => 'sent'),
            catchError((error: HttpErrorResponse) => (error.status === NO_CONNECTION ? of(this.keep(remark)) : throwError(() => error)))
        );
    }

    private keep(remark: RemarkInput): RemarkDelivery {
        this.storeQueue([...this.queued(), remark]);

        return 'kept';
    }

    private sendQueued(): Observable<unknown> {
        const queue = this.queued();
        if (!queue.length || !navigator.onLine) {
            return of(undefined);
        }

        return from(queue).pipe(
            concatMap((remark) =>
                this.api.sendRemark(remark).pipe(
                    map(() => undefined),
                    catchError((error: HttpErrorResponse) => of(error.status === NO_CONNECTION ? remark : undefined))
                )
            ),
            toArray(),
            tap((left) => {
                const unsent = left.filter((remark): remark is RemarkInput => remark !== undefined);
                this.storeQueue(unsent);
                if (unsent.length < queue.length) {
                    this.toasts.show({ kind: 'ok', text: this.translate.instant('remark.sentLater') });
                }
            })
        );
    }

    private context(): RemarkContext {
        return {
            version: this.version?.version,
            commit: this.version?.commit,
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth} × ${window.innerHeight}`,
            language: this.translate.currentLang,
            theme: this.theme.theme(),
            installed: window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
            online: navigator.onLine,
            waitingChanges: this.store.pending().length,
            recentMessages: this.toasts.recent()
        };
    }

    private queued(): Array<RemarkInput> {
        try {
            const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Array<RemarkInput>;

            return Array.isArray(stored) ? stored : [];
        } catch {
            return [];
        }
    }

    private storeQueue(remarks: Array<RemarkInput>): void {
        this.waiting.set(remarks.length);
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(remarks));
        } catch {
            return;
        }
    }
}

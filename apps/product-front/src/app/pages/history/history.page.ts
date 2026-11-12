import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, debounceTime, startWith, switchMap, tap } from 'rxjs';

import { Scan } from '../../models';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';
import { ShoppingStore } from '../../services/shopping.store';

const REFRESH_DELAY_MILLISECONDS = 200;

@Component({
    selector: 'app-history-page',
    standalone: true,
    imports: [DatePipe, RouterLink, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <a class="muted inline-flex items-center gap-1 text-sm" routerLink="/system">
                <i class="material-symbols-outlined">arrow_back</i>
                {{ 'nav.system' | translate }}
            </a>
            <div class="flex items-center justify-between gap-3">
                <h1 class="page-title">{{ 'history.title' | translate }}</h1>
                <button type="button" class="btn" [disabled]="!canUndo()" (click)="undo()">
                    <i class="material-symbols-outlined">undo</i>
                    {{ 'history.undoLast' | translate }}
                </button>
            </div>

            <div class="flex flex-col gap-1">
                @for (scan of scans(); track scan.id) {
                    <div class="card flex items-center gap-3 !py-2" [class.opacity-50]="scan.undoneAt">
                        <i class="material-symbols-outlined muted">
                            {{ scan.source === 'phone' ? 'smartphone' : 'barcode_reader' }}
                        </i>
                        <span class="grow">
                            <span class="block font-semibold">
                                {{ itemName(scan) ?? ('inbox.unknownProduct' | translate) }}
                            </span>
                            <span class="muted block text-xs">
                                <span class="font-mono">{{ scan.code }}</span>
                                · {{ scan.createdAt | date: 'd MMM HH:mm:ss' }}
                            </span>
                        </span>
                        <span class="result" [class]="scan.result">
                            {{ 'history.result.' + (scan.undoneAt ? 'undone' : scan.result) | translate }}
                        </span>
                    </div>
                } @empty {
                    <p class="empty">{{ (loaded() ? 'history.empty' : 'common.loading') | translate }}</p>
                }
            </div>
        </div>
    `,
    styles: `
        .result { padding: 2px 8px; border-radius: 8px; background: var(--line); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
        .result.added, .result.incremented { background: color-mix(in srgb, var(--accent) 22%, transparent); }
        .result.needs_name { background: var(--warning); color: var(--warning-text); }
    `
})
export class HistoryPage {
    protected readonly scans = signal<Array<Scan>>([]);
    protected readonly loaded = signal(false);
    protected readonly canUndo = computed(() => this.scans().some((scan) => !scan.undoneAt && scan.result !== 'ignored'));

    private readonly api = inject(ApiService);
    private readonly store = inject(ShoppingStore);

    constructor() {
        inject(EventsService)
            .on('scan', 'barcode')
            .pipe(
                startWith(undefined),
                debounceTime(REFRESH_DELAY_MILLISECONDS),
                switchMap(() => this.load()),
                takeUntilDestroyed()
            )
            .subscribe();
    }

    protected itemName(scan: Scan): string | undefined {
        return scan.catalogItemId ? this.store.itemById(scan.catalogItemId)?.name : undefined;
    }

    protected undo(): void {
        this.api
            .undoScan()
            .pipe(
                switchMap(() => this.store.refreshListAndInbox()),
                switchMap(() => this.load())
            )
            .subscribe();
    }

    private load(): Observable<Array<Scan>> {
        return this.api.getScans().pipe(
            tap((scans) => {
                this.scans.set(scans);
                this.loaded.set(true);
            })
        );
    }
}

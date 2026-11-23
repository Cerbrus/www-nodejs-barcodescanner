import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, debounceTime, startWith, switchMap, tap } from 'rxjs';

import { CONNECTORS, NamingPromptComponent } from '../../components/naming-prompt/naming-prompt.component';
import { withNote } from '../../display-name';
import { Scan, ScanChange } from '../../models';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';
import { ShoppingStore } from '../../services/shopping.store';

const REFRESH_DELAY_MILLISECONDS = 200;

@Component({
    selector: 'app-history-page',
    standalone: true,
    imports: [DatePipe, NamingPromptComponent, RouterLink, TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './history.page.html',
    styleUrl: './history.page.scss'
})
export class HistoryPage {
    protected readonly scans = signal<Array<Scan>>([]);
    protected readonly loaded = signal(false);
    protected readonly namingCode = signal<string | undefined>(undefined);
    protected readonly openScanId = signal<number | undefined>(undefined);
    protected readonly canUndo = computed(() =>
        this.scans().some((scan) => !scan.undoneAt && scan.result !== 'ignored')
    );

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

    protected failedSources(scan: Scan): string | undefined {
        const barcode = this.store.inbox().find((unnamed) => unnamed.code === scan.code);

        return (
            barcode?.lookupFailed?.map((connectorId) => CONNECTORS[connectorId]?.name ?? connectorId).join(', ') ||
            undefined
        );
    }

    protected itemName(scan: Scan): string | undefined {
        return scan.catalogItemId ? withNote(this.store.itemById(scan.catalogItemId)?.name, scan.note) : undefined;
    }

    protected changeName(change: ScanChange): string | undefined {
        return withNote(this.store.itemById(change.catalogItemId)?.name, change.note);
    }

    protected toggle(scanId: number): void {
        this.openScanId.update((open) => (open === scanId ? undefined : scanId));
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

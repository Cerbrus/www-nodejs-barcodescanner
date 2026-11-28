import {
    ChangeDetectionStrategy,
    Component,
    afterNextRender,
    computed,
    inject,
    input,
    linkedSignal,
    output,
    signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, finalize, forkJoin, of, switchMap, tap } from 'rxjs';

import { BARCODE_SEARCH_MAX, BarcodeCandidate } from '@barcodescanner/shared';

import { CatalogItem } from '../../models';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { CONNECTORS } from '../naming-prompt/naming-prompt.component';
import { SheetComponent } from '../sheet/sheet.component';

@Component({
    selector: 'app-barcode-search',
    standalone: true,
    imports: [FormsModule, TranslatePipe, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './barcode-search.component.html',
    styleUrl: './barcode-search.component.scss'
})
export class BarcodeSearchComponent {
    public readonly item = input.required<CatalogItem>();

    public readonly linked = output<void>();
    public readonly closed = output<void>();

    protected readonly max = BARCODE_SEARCH_MAX;
    protected readonly connectors = CONNECTORS;
    protected readonly words = linkedSignal(() => this.item().name);
    protected readonly candidates = signal<Array<BarcodeCandidate> | undefined>(undefined);
    protected readonly notes = signal<ReadonlyMap<string, string>>(new Map());
    protected readonly saving = signal(false);

    protected readonly rows = computed(() =>
        this.candidates()?.map((candidate) => ({
            candidate,
            title: candidate.suggestions[0]?.title ?? candidate.code,
            detail: [candidate.suggestions.find(({ brand }) => brand)?.brand, candidate.size, candidate.code]
                .filter((part) => part)
                .join(' · ')
        }))
    );

    private readonly api = inject(ApiService);
    private readonly store = inject(ShoppingStore);

    constructor() {
        afterNextRender(() => this.search());
    }

    protected search(): void {
        const words = this.words().trim();
        if (!words) {
            return;
        }

        this.candidates.set(undefined);
        this.notes.set(new Map());
        this.api
            .searchBarcodes(words, this.item().id)
            .pipe(
                catchError(() => of([])),
                tap((found) => this.candidates.set(found))
            )
            .subscribe();
    }

    protected toggle({ code, note }: BarcodeCandidate): void {
        this.notes.update((notes) => {
            const next = new Map(notes);
            if (!next.delete(code)) {
                next.set(code, note);
            }

            return next;
        });
    }

    protected setNote(code: string, note: string): void {
        this.notes.update((notes) => new Map(notes).set(code, note));
    }

    protected link(): void {
        this.saving.set(true);
        forkJoin([...this.notes()].map(([code, note]) => this.api.mapBarcode(code, this.item().id, note.trim())))
            .pipe(
                switchMap(() => this.store.refreshListAndInbox()),
                tap(() => this.linked.emit()),
                finalize(() => this.saving.set(false))
            )
            .subscribe();
    }
}

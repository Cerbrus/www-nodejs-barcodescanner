import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { filter, finalize, switchMap, tap } from 'rxjs';

import { Barcode, CatalogItem, ProductSuggestion } from '../../models';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ItemAutocompleteComponent } from '../item-autocomplete/item-autocomplete.component';
import { NewItemFormComponent } from '../new-item-form/new-item-form.component';
import { SheetComponent } from '../sheet/sheet.component';

const CONNECTORS: Record<string, { name: string; logo: string }> = {
    ah: { name: 'Albert Heijn', logo: 'assets/connectors/ah.svg' },
    off: { name: 'Open Food Facts', logo: 'assets/connectors/off.svg' }
};

export type NamingOutcome = { kind: 'linked'; item: CatalogItem } | { kind: 'later' } | { kind: 'discarded' };

@Component({
    selector: 'app-naming-prompt',
    standalone: true,
    imports: [TranslateModule, ItemAutocompleteComponent, NewItemFormComponent, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './naming-prompt.component.html'
})
export class NamingPromptComponent {
    public readonly code = input.required<string>();
    public readonly closed = output<NamingOutcome>();

    protected readonly store = inject(ShoppingStore);
    protected readonly connectors = CONNECTORS;
    protected readonly barcode = signal<Barcode | undefined>(undefined);
    protected readonly search = signal('');
    protected readonly newName = signal<string | undefined>(undefined);
    protected readonly busy = signal(false);

    protected readonly suggestions = computed(() => this.barcode()?.suggestions ?? []);
    protected readonly lookingUp = signal(false);
    protected readonly failedSources = computed(() =>
        (this.barcode()?.lookupFailed ?? []).map((connectorId) => this.connectors[connectorId]?.name ?? connectorId)
    );

    protected readonly lookupPending = computed(() => this.barcode() !== undefined && !this.barcode()?.suggestions);
    protected readonly suggestionText = computed(() =>
        this.suggestions()
            .map((suggestion) => `${suggestion.category ?? ''} ${suggestion.title}`)
            .join(' ')
    );

    private readonly api = inject(ApiService);
    private readonly events = inject(EventsService);

    constructor() {
        effect(() => {
            const code = this.code();
            this.barcode.set(undefined);
            this.api
                .getBarcode(code)
                .pipe(tap((barcode) => this.barcode.set(barcode)))
                .subscribe();
        });

        this.events
            .on<{ code: string }>('barcode')
            .pipe(
                filter((event) => event.code === this.code()),
                switchMap(() => this.api.getBarcode(this.code())),
                tap((barcode) => this.barcode.set(barcode)),
                takeUntilDestroyed()
            )
            .subscribe();
    }

    protected lookUpAgain(): void {
        this.lookingUp.set(true);
        this.api
            .repeatLookup(this.code())
            .pipe(
                tap((barcode) => this.barcode.set(barcode)),
                finalize(() => this.lookingUp.set(false))
            )
            .subscribe();
    }

    protected useSuggestion(suggestion: ProductSuggestion): void {
        this.newName.set(undefined);
        this.search.set(suggestion.title);
    }

    protected choose(item: CatalogItem): void {
        this.busy.set(true);
        this.store
            .mapBarcode(this.code(), item.id)
            .pipe(tap(() => this.closed.emit({ kind: 'linked', item })))
            .subscribe();
    }

    protected discard(): void {
        this.busy.set(true);
        this.api
            .discardBarcode(this.code())
            .pipe(
                switchMap(() => this.store.refreshListAndInbox()),
                tap(() => this.closed.emit({ kind: 'discarded' }))
            )
            .subscribe();
    }
}

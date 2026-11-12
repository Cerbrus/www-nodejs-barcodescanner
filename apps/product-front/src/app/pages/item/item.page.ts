import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, switchMap, tap } from 'rxjs';

import { BarcodeComponent } from '../../components/barcode';
import { IconPickerComponent } from '../../components/icon-picker/icon-picker.component';
import { ItemAutocompleteComponent } from '../../components/item-autocomplete/item-autocomplete.component';
import { ItemIconComponent } from '../../components/item-icon/item-icon.component';
import { Barcode, CatalogItem } from '../../models';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-item-page',
    standalone: true,
    imports: [
        DatePipe,
        FormsModule,
        RouterLink,
        TranslateModule,
        BarcodeComponent,
        ItemIconComponent,
        IconPickerComponent,
        ItemAutocompleteComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './item.page.html'
})
export class ItemPage {
    public readonly id = input.required({ transform: numberAttribute });

    protected readonly store = inject(ShoppingStore);
    protected readonly item = signal<CatalogItem | undefined>(undefined);
    protected readonly name = signal('');
    protected readonly sectionId = signal('');
    protected readonly emoji = signal('');
    protected readonly icon = signal('');
    protected readonly movingCode = signal<string | undefined>(undefined);
    protected readonly moveSearch = signal('');
    protected readonly pickingIcon = signal(false);
    protected readonly confirmingDelete = signal(false);

    protected readonly preview = computed(() => ({
        name: this.name() || '?',
        icon: this.icon() || undefined,
        emoji: this.emoji() || undefined
    }));

    protected readonly changed = computed(() => {
        const item = this.item();
        return (
            item !== undefined &&
            (this.name().trim() !== item.name ||
                this.sectionId() !== item.sectionId ||
                this.emoji().trim() !== (item.emoji ?? '') ||
                this.icon().trim() !== (item.icon ?? ''))
        );
    });

    private readonly api = inject(ApiService);
    private readonly router = inject(Router);
    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);

    constructor() {
        effect(() => {
            this.load(this.id()).subscribe();
        });
    }

    protected save(): void {
        this.api
            .updateCatalogItem(this.id(), {
                name: this.name().trim(),
                sectionId: this.sectionId(),
                emoji: this.emoji().trim(),
                icon: this.icon().trim()
            })
            .pipe(
                switchMap(() => this.store.refreshAll()),
                switchMap(() => this.load(this.id())),
                tap(() => this.toasts.show({ kind: 'ok', text: this.translate.instant('item.saved') }))
            )
            .subscribe();
    }

    protected chooseIcon(icon: string): void {
        this.icon.set(icon);
        this.pickingIcon.set(false);
    }

    protected detach(barcode: Barcode): void {
        this.api
            .unmapBarcode(barcode.code)
            .pipe(
                switchMap(() => this.store.refreshListAndInbox()),
                switchMap(() => this.load(this.id()))
            )
            .subscribe();
    }

    protected moveTo(target: CatalogItem): void {
        const code = this.movingCode();
        if (!code) {
            return;
        }

        this.movingCode.set(undefined);
        this.moveSearch.set('');
        this.store
            .mapBarcode(code, target.id)
            .pipe(switchMap(() => this.load(this.id())))
            .subscribe();
    }

    protected delete(): void {
        this.api
            .deleteCatalogItem(this.id())
            .pipe(
                switchMap(() => this.store.refreshAll()),
                tap(() => this.router.navigate(['/catalog']))
            )
            .subscribe();
    }

    private load(id: number): Observable<CatalogItem> {
        return this.api.getCatalogItem(id).pipe(
            tap((item) => {
                this.item.set(item);
                this.name.set(item.name);
                this.sectionId.set(item.sectionId);
                this.emoji.set(item.emoji ?? '');
                this.icon.set(item.icon ?? '');
            })
        );
    }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '../../services/api.service';
import { SheetComponent } from '../sheet/sheet.component';

@Component({
    selector: 'app-icon-picker',
    standalone: true,
    imports: [FormsModule, TranslateModule, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <app-sheet (closed)="closed.emit()">
            <h2 class="page-title">{{ 'icons.title' | translate }}</h2>
            <input
                class="field"
                type="search"
                autocomplete="off"
                autocapitalize="off"
                [placeholder]="'icons.search' | translate"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
            />

            <div class="grid">
                <button type="button" class="icon none" [class.selected]="!selected()" (click)="picked.emit('')">
                    <i class="material-symbols-outlined">block</i>
                    <span>{{ 'icons.none' | translate }}</span>
                </button>
                @for (name of matches(); track name) {
                    <button type="button" class="icon" [class.selected]="name === selected()" [title]="name" (click)="picked.emit(name)">
                        <img loading="lazy" alt="" [src]="iconsUrl + '/' + name + '.png'" />
                        <span>{{ label(name) }}</span>
                    </button>
                } @empty {
                    <p class="empty col-span-full">{{ 'icons.noResults' | translate }}</p>
                }
            </div>

            <button type="button" class="btn mt-3 w-full" (click)="closed.emit()">
                <i class="material-symbols-outlined">close</i>
                {{ 'common.cancel' | translate }}
            </button>
        </app-sheet>
    `,
    styles: `
        .grid {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 6px;
            max-height: 52dvh; margin-top: 10px; overflow-y: auto;
        }
        .icon {
            display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px 6px;
            border: 2px solid transparent; border-radius: 12px; background: var(--tile-neutral); color: var(--tile-text);
        }
        .icon.selected { border-color: var(--accent); background: var(--tile-recent); }
        .icon img, .icon i { width: 40px; height: 40px; object-fit: contain; }
        .icon i { font-size: 34px; line-height: 40px; text-align: center; }
        .icon span { max-width: 100%; overflow: hidden; font-size: 0.62rem; text-overflow: ellipsis; white-space: nowrap; }
    `
})
export class IconPickerComponent {
    public readonly selected = input('');
    public readonly picked = output<string>();
    public readonly closed = output<void>();

    protected readonly search = signal('');
    protected readonly iconsUrl = inject(ApiService).iconsUrl;
    protected readonly names = toSignal(inject(ApiService).getIcons(), { initialValue: [] });

    protected readonly matches = computed(() => {
        const term = this.search().trim().toLowerCase().replace(/\s+/g, '_');
        return term ? this.names().filter((name) => name.includes(term)) : this.names();
    });

    protected label(name: string): string {
        return name.replace(/_/g, ' ');
    }
}

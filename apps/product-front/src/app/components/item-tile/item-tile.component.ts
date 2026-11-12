import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CatalogItem } from '../../models';
import { ItemIconComponent } from '../item-icon/item-icon.component';

@Component({
    selector: 'app-item-tile',
    standalone: true,
    imports: [ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button type="button" class="tile" [class.muted]="muted()" (click)="selected.emit()">
            @if (quantity() > 1) {
                <span class="quantity">{{ quantity() }}</span>
            }
            <span class="icon"><app-item-icon [item]="item()" /></span>
            <span class="name">{{ item().name }}</span>
            @if (note()) {
                <span class="note">{{ note() }}</span>
            }
        </button>
        @if (showDetails()) {
            <button type="button" class="details" [attr.aria-label]="detailsLabel()" (click)="details.emit()">
                <i class="material-symbols-outlined">more_horiz</i>
            </button>
        }
    `,
    styles: `
        :host { position: relative; display: block; }
        .tile {
            display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 2px;
            width: 100%; height: 100%; min-height: 104px; padding: 10px 6px 8px;
            border-radius: 14px; background: var(--tile); color: var(--tile-text);
            transition: transform 80ms ease, background-color 120ms ease;
        }
        .tile:active { transform: scale(0.96); }
        .tile.muted { background: var(--tile-muted); }
        .icon { width: 44px; height: 44px; }
        .name { font-size: 0.8rem; font-weight: 600; line-height: 1.15; text-align: center; overflow-wrap: anywhere; }
        .note { font-size: 0.7rem; line-height: 1.1; text-align: center; opacity: 0.85; overflow-wrap: anywhere; }
        .quantity {
            position: absolute; top: 6px; left: 6px; min-width: 22px; padding: 1px 6px;
            border-radius: 11px; background: var(--badge); color: var(--badge-text);
            font-size: 0.75rem; font-weight: 700; text-align: center;
        }
        .details {
            position: absolute; top: 2px; right: 2px; display: flex; padding: 4px;
            border-radius: 12px; color: var(--tile-text); opacity: 0.75;
        }
        .details i { font-size: 20px; }
    `
})
export class ItemTileComponent {
    public readonly item = input.required<CatalogItem>();
    public readonly quantity = input(0);
    public readonly note = input('');
    public readonly muted = input(false);
    public readonly showDetails = input(false);
    public readonly detailsLabel = input('');

    public readonly selected = output<void>();
    public readonly details = output<void>();
}

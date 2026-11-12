import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CatalogItem } from '../../models';
import { ItemIconComponent } from '../item-icon/item-icon.component';

@Component({
    selector: 'app-item-tile',
    standalone: true,
    imports: [ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button type="button" class="tile" [class]="tone()" (click)="selected.emit()">
            @if (quantity() > 1) {
                <span class="quantity">{{ quantity() }}</span>
            }
            <span class="icon"><app-item-icon [item]="item()" /></span>
            <span class="text">
                <span class="name">{{ item().name }}</span>
                @if (note()) {
                    <span class="note">{{ note() }}</span>
                }
            </span>
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
            display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%;
            min-height: 108px; padding: 10px 6px 6px; border-radius: 14px;
            --tone: var(--tile-neutral); background: var(--tone); color: var(--tile-text);
            transition: transform 80ms ease, background-color 120ms ease;
        }
        .tile:active { transform: scale(0.96); }
        .tile.buy { --tone: var(--tile-buy); }
        .tile.recent { --tone: var(--tile-recent); }
        .icon { flex: 0 0 auto; width: 44px; height: 44px; }
        .text { display: flex; flex: 1 1 auto; flex-direction: column; align-items: center; justify-content: center; gap: 1px; width: 100%; min-height: 34px; }
        .name { font-size: 0.8rem; font-weight: 600; line-height: 1.15; text-align: center; overflow-wrap: anywhere; }
        .note { font-size: 0.7rem; line-height: 1.1; text-align: center; opacity: 0.85; overflow-wrap: anywhere; }
        .quantity {
            position: absolute; top: 6px; left: 6px; min-width: 22px; padding: 1px 6px;
            border-radius: 11px; background: var(--tile-text); color: var(--tone);
            font-size: 0.75rem; font-weight: 700; text-align: center;
        }
        .details {
            position: absolute; top: 2px; right: 2px; display: flex; padding: 4px;
            border-radius: 12px; color: var(--tile-text); opacity: 0.8;
        }
        .details i { font-size: 20px; }
    `
})
export class ItemTileComponent {
    public readonly item = input.required<CatalogItem>();
    public readonly quantity = input(0);
    public readonly note = input('');
    public readonly tone = input<'buy' | 'recent' | 'neutral'>('neutral');
    public readonly showDetails = input(false);
    public readonly detailsLabel = input('');

    public readonly selected = output<void>();
    public readonly details = output<void>();
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CatalogItem } from '../../models';
import { ItemIconComponent } from '../item-icon/item-icon.component';

@Component({
    selector: 'app-item-tile',
    standalone: true,
    imports: [ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './item-tile.component.html',
    styleUrl: './item-tile.component.scss'
})
export class ItemTileComponent {
    public readonly item = input.required<CatalogItem>();
    public readonly quantity = input(0);
    public readonly badge = input('');
    public readonly note = input('');
    public readonly tone = input<'buy' | 'recent' | 'neutral'>('neutral');
    public readonly showDetails = input(false);
    public readonly pending = input(false);
    public readonly detailsLabel = input('');

    public readonly selected = output<void>();
    public readonly details = output<void>();
}

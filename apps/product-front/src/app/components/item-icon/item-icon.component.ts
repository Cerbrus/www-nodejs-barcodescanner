import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';

import { CatalogItem } from '../../models';
import { ApiService } from '../../services/api.service';

@Component({
    selector: 'app-item-icon',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './item-icon.component.html',
    styleUrl: './item-icon.component.scss'
})
export class ItemIconComponent {
    public readonly item = input.required<Pick<CatalogItem, 'name' | 'icon' | 'emoji'>>();

    protected readonly imageFailed = linkedSignal({ source: () => this.item().icon, computation: () => false });
    protected readonly letter = computed(() => this.item().name.charAt(0).toUpperCase());
    protected readonly imageUrl = computed(() => {
        const icon = this.item().icon;
        return icon && !this.imageFailed() ? `${this.api.iconsUrl}/${encodeURIComponent(icon)}.png` : undefined;
    });

    private readonly api = inject(ApiService);
}

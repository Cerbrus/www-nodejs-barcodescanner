import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';

import { CatalogItem } from '../../models';
import { ApiService } from '../../services/api.service';

@Component({
    selector: 'app-item-icon',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (imageUrl(); as url) {
            <img class="h-full w-full object-contain" [src]="url" alt="" (error)="imageFailed.set(true)" />
        } @else if (item().emoji) {
            <span class="emoji">{{ item().emoji }}</span>
        } @else {
            <span class="letter">{{ letter() }}</span>
        }
    `,
    styles: `
        :host { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
        .emoji { font-size: 1.9em; line-height: 1; }
        .letter { font-size: 1.6em; font-weight: 600; opacity: 0.9; }
    `
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

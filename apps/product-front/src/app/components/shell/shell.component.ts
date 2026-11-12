import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

interface NavLink {
    route: string;
    label: string;
    icon: string;
}

@Component({
    selector: 'app-shell',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './shell.component.html',
    styleUrl: './shell.component.scss'
})
export class ShellComponent {
    protected readonly store = inject(ShoppingStore);
    protected readonly toasts = inject(ToastService);
    protected readonly inboxCount = computed(() => this.store.inbox().length);

    protected readonly links: Array<NavLink> = [
        { route: '/list', label: 'nav.list', icon: 'shopping_cart' },
        { route: '/scan', label: 'nav.scan', icon: 'barcode_scanner' },
        { route: '/inbox', label: 'nav.inbox', icon: 'inbox' },
        { route: '/catalog', label: 'nav.catalog', icon: 'category' },
        { route: '/system', label: 'nav.system', icon: 'settings' }
    ];

    constructor() {
        effect(() => {
            const count = this.inboxCount();
            if (this.store.loaded() && 'setAppBadge' in navigator) {
                void (count ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => undefined);
            }
        });
    }
}

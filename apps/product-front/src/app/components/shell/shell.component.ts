import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, switchMap, tap } from 'rxjs';

import { ScanOutcome, ScanSource } from '../../models';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

type ScanEvent = ScanOutcome & { source?: ScanSource; undone?: boolean };

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

    private readonly api = inject(ApiService);
    private readonly router = inject(Router);
    private readonly translate = inject(TranslateService);

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

        inject(EventsService)
            .on<ScanEvent>('scan')
            .pipe(
                filter((scan) => scan.source === 'handheld' && !scan.undone),
                tap((scan) => this.announce(scan)),
                takeUntilDestroyed()
            )
            .subscribe();
    }

    private announce(scan: ScanEvent): void {
        if (scan.result === 'needs_name') {
            this.toasts.show({
                kind: 'attention',
                text: this.translate.instant('scan.unknownHandheld'),
                actionLabel: this.translate.instant('scan.nameIt'),
                action: () => void this.router.navigateByUrl('/inbox')
            });
            return;
        }

        this.toasts.show({
            kind: 'ok',
            text: this.translate.instant(`scan.${scan.result}`, { name: scan.itemName, quantity: scan.quantity }),
            actionLabel: this.translate.instant('history.undo'),
            action: () => this.undoScan()
        });
    }

    private undoScan(): void {
        this.api
            .undoScan()
            .pipe(switchMap(() => this.store.refreshListAndInbox()))
            .subscribe();
    }
}

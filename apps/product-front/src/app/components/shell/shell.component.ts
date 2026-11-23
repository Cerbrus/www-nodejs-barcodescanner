import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs';

import { ScanSource } from '@barcodescanner/shared';

import { withNote } from '../../display-name';
import { IconName } from '../../icon-names';
import { ScanOutcome } from '../../models';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { RemarkService } from '../../services/remark.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';
import { RecipePrintComponent } from '../recipe-print/recipe-print.component';
import { RemarkPointerDirective } from '../remark-sheet/remark-pointer.directive';
import { RemarkSheetComponent } from '../remark-sheet/remark-sheet.component';

type ScanEvent = ScanOutcome & { source?: ScanSource; undone?: boolean };

interface NavLink {
    route: string;
    label: string;
    icon: IconName;
}

@Component({
    selector: 'app-shell',
    standalone: true,
    imports: [
        DatePipe,
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        TranslatePipe,
        RecipePrintComponent,
        RemarkPointerDirective,
        RemarkSheetComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './shell.component.html',
    styleUrl: './shell.component.scss'
})
export class ShellComponent {
    protected readonly store = inject(ShoppingStore);
    protected readonly toasts = inject(ToastService);
    protected readonly remarks = inject(RemarkService);
    protected readonly inboxCount = this.store.waiting;

    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly translate = inject(TranslateService);

    protected readonly links: Array<NavLink> = [
        { route: '/list', label: 'nav.list', icon: 'shopping_cart' },
        { route: '/scan', label: 'nav.scan', icon: 'barcode_scanner' },
        { route: '/inbox', label: 'nav.inbox', icon: 'inbox' },
        { route: '/recipes', label: 'nav.recipes', icon: 'menu_book' },
        { route: '/system', label: 'nav.system', icon: 'settings' }
    ];

    constructor() {
        effect(() => {
            const count = this.inboxCount();
            if (this.store.loaded() && 'setAppBadge' in navigator) {
                void (count ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => undefined);
            }
        });

        const events = inject(EventsService);
        this.remarks.start();

        events
            .on<{ fromOwner: boolean }>('remark')
            .pipe(
                filter((remark) => !remark.fromOwner && this.auth.owner()),
                tap(() =>
                    this.toasts.show({
                        kind: 'attention',
                        text: this.translate.instant('remark.newFromOther'),
                        actionLabel: this.translate.instant('remark.open'),
                        action: () => void this.router.navigateByUrl('/remarks')
                    })
                ),
                takeUntilDestroyed()
            )
            .subscribe();

        events
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

        if (scan.title !== undefined) {
            this.toasts.show({
                kind: scan.unknown?.length ? 'attention' : 'ok',
                text: this.translate.instant(scan.unknown?.length ? 'recipe.addedPartly' : 'recipe.added', {
                    name: scan.title,
                    count: scan.added,
                    unknown: scan.unknown?.length
                }),
                actionLabel: this.translate.instant('history.undo'),
                action: () => this.store.undoLastScan()
            });
            return;
        }

        this.toasts.show({
            kind: 'ok',
            text: this.translate.instant(`scan.${scan.result}`, {
                name: withNote(scan.itemName, scan.note),
                quantity: scan.quantity
            }),
            actionLabel: this.translate.instant('history.undo'),
            action: () => this.store.undoLastScan()
        });
    }
}

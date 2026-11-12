import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { NamingPromptComponent } from '../../components/naming-prompt/naming-prompt.component';
import { ShoppingStore } from '../../services/shopping.store';

@Component({
    selector: 'app-inbox-page',
    standalone: true,
    imports: [DatePipe, TranslateModule, NamingPromptComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <h1 class="page-title">{{ 'inbox.title' | translate }}</h1>
            <p class="muted mb-3 text-sm">{{ 'inbox.intro' | translate }}</p>

            <div class="flex flex-col gap-2">
                @for (barcode of store.inbox(); track barcode.code) {
                    <button type="button" class="card flex items-center gap-3 text-left" (click)="namingCode.set(barcode.code)">
                        @if (barcode.suggestions?.[0]?.imageUrl; as imageUrl) {
                            <img class="h-14 w-14 shrink-0 rounded-lg bg-white object-contain" [src]="imageUrl" alt="" />
                        }
                        <span class="grow">
                            <span class="block font-semibold">
                                {{ barcode.suggestions?.[0]?.title ?? ('inbox.unknownProduct' | translate) }}
                            </span>
                            <span class="muted block font-mono text-sm">{{ barcode.code }}</span>
                            <span class="muted block text-xs">
                                {{ 'inbox.scans' | translate: { count: barcode.scanCount } }}
                                @if (barcode.lastScannedAt) {
                                    · {{ barcode.lastScannedAt | date: 'd MMM HH:mm' }}
                                }
                            </span>
                        </span>
                        <i class="material-symbols-outlined muted">chevron_right</i>
                    </button>
                } @empty {
                    <p class="empty">{{ 'inbox.empty' | translate }}</p>
                }
            </div>
        </div>

        @if (namingCode(); as code) {
            <app-naming-prompt [code]="code" (closed)="namingCode.set(undefined)" />
        }
    `
})
export class InboxPage {
    protected readonly store = inject(ShoppingStore);
    protected readonly namingCode = signal<string | undefined>(undefined);
}

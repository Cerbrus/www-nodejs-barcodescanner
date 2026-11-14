import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, of, tap } from 'rxjs';

import { REMARK_KINDS, RemarkKind } from '../../models';
import { RemarkService } from '../../services/remark.service';
import { ToastService } from '../../services/toast.service';
import { SheetComponent } from '../sheet/sheet.component';

const KIND_ICONS: Record<RemarkKind, string> = { bug: 'bug_report', wish: 'lightbulb', note: 'sticky_note_2' };

@Component({
    selector: 'app-remark-sheet',
    standalone: true,
    imports: [FormsModule, TranslateModule, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (remarks.draft(); as draft) {
            <app-sheet (closed)="remarks.cancel()">
                <h2 class="page-title">{{ 'remark.title' | translate }}</h2>

                <div class="segments wide">
                    @for (option of kinds; track option) {
                        <button type="button" class="segment" [class.chosen]="kind() === option" [attr.aria-pressed]="kind() === option" (click)="kind.set(option)">
                            <i class="material-symbols-outlined">{{ icons[option] }}</i>
                            {{ 'remark.kind.' + option | translate }}
                        </button>
                    }
                </div>

                @if (draft.target; as target) {
                    <p class="about">
                        <i class="material-symbols-outlined">ads_click</i>
                        <span>{{ 'remark.about' | translate }}: {{ target.label || target.text || target.component || target.path }}</span>
                    </p>
                }

                <label class="field-label" for="remark-text">{{ 'remark.text.' + kind() | translate }}</label>
                <textarea id="remark-text" class="field" rows="5" maxlength="2000" [ngModel]="text()" (ngModelChange)="text.set($event)"></textarea>

                <div class="mt-3 flex gap-2">
                    <button type="button" class="btn" (click)="remarks.cancel()">
                        <i class="material-symbols-outlined">close</i>
                        {{ 'common.cancel' | translate }}
                    </button>
                    <button type="button" class="btn primary grow" [disabled]="busy() || !text().trim()" (click)="send()">
                        <i class="material-symbols-outlined">send</i>
                        {{ 'remark.send' | translate }}
                    </button>
                </div>
            </app-sheet>
        }
    `,
    styles: `
        .about { display: flex; align-items: center; gap: 6px; margin-top: 10px; color: var(--text-muted); font-size: 0.85rem; }
        .about i { font-size: 18px; }
        .about span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        textarea { resize: vertical; }
    `
})
export class RemarkSheetComponent {
    protected readonly remarks = inject(RemarkService);
    protected readonly kinds = REMARK_KINDS;
    protected readonly icons = KIND_ICONS;
    protected readonly kind = signal<RemarkKind>('bug');
    protected readonly text = signal('');
    protected readonly busy = signal(false);

    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);

    protected send(): void {
        this.busy.set(true);
        this.remarks
            .send(this.kind(), this.text())
            .pipe(
                tap((delivery) => {
                    this.text.set('');
                    this.toasts.show({ kind: 'ok', text: this.translate.instant(delivery === 'sent' ? 'remark.thanks' : 'remark.kept') });
                }),
                catchError(() => of(undefined)),
                finalize(() => this.busy.set(false))
            )
            .subscribe();
    }
}

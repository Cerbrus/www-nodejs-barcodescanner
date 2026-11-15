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
            <app-sheet (closed)="close()">
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
                <textarea id="remark-text" class="field" rows="5" maxlength="2000" [ngModel]="text()" (ngModelChange)="text.set($event)" (keydown)="onKey($event)"></textarea>

                @if (asking()) {
                    <p class="mt-3 text-sm">{{ 'remark.closeAsk' | translate }}</p>
                    <div class="mt-2 flex flex-wrap gap-2">
                        <button type="button" class="btn" (click)="asking.set(false)">
                            <i class="material-symbols-outlined">edit</i>
                            {{ 'remark.keepWriting' | translate }}
                        </button>
                        <button type="button" class="btn" (click)="leave(false)">
                            <i class="material-symbols-outlined">close</i>
                            {{ 'remark.closeKeep' | translate }}
                        </button>
                        <button type="button" class="btn danger" (click)="leave(true)">
                            <i class="material-symbols-outlined">delete</i>
                            {{ 'remark.closeClear' | translate }}
                        </button>
                    </div>
                } @else {
                    <div class="mt-3 flex gap-2">
                        <button type="button" class="btn" (click)="close()">
                            <i class="material-symbols-outlined">close</i>
                            {{ 'common.cancel' | translate }}
                        </button>
                        <button type="button" class="btn primary grow" [disabled]="!canSend()" (click)="send()">
                            <i class="material-symbols-outlined">send</i>
                            {{ 'remark.send' | translate }}
                        </button>
                    </div>
                }
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
    protected readonly asking = signal(false);

    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);

    protected canSend(): boolean {
        return !this.busy() && this.text().trim() !== '';
    }

    protected onKey(event: KeyboardEvent): void {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            if (this.canSend()) {
                this.send();
            }
        }
    }

    protected close(): void {
        if (this.text().trim()) {
            this.asking.set(true);
        } else {
            this.leave(true);
        }
    }

    protected leave(clear: boolean): void {
        if (clear) {
            this.text.set('');
            this.kind.set('bug');
        }
        this.asking.set(false);
        this.remarks.cancel();
    }

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

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, of, tap } from 'rxjs';

import { REMARK_KINDS, RemarkKind } from '@barcodescanner/shared';

import { IconName } from '../../icon-names';
import { RemarkService } from '../../services/remark.service';
import { ToastService } from '../../services/toast.service';
import { SheetComponent } from '../sheet/sheet.component';

const KIND_ICONS: Record<RemarkKind, IconName> = { bug: 'bug_report', wish: 'lightbulb', note: 'sticky_note_2' };

@Component({
    selector: 'app-remark-sheet',
    standalone: true,
    imports: [FormsModule, TranslatePipe, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './remark-sheet.component.html',
    styleUrl: './remark-sheet.component.scss'
})
export class RemarkSheetComponent {
    protected readonly remarks = inject(RemarkService);
    protected readonly kinds = REMARK_KINDS;
    protected readonly icons = KIND_ICONS;
    protected readonly kind = signal<RemarkKind>('wish');
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
            this.kind.set('wish');
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
                    this.toasts.show({
                        kind: 'ok',
                        text: this.translate.instant(delivery === 'sent' ? 'remark.thanks' : 'remark.kept')
                    });
                }),
                catchError(() => of(undefined)),
                finalize(() => this.busy.set(false))
            )
            .subscribe();
    }
}

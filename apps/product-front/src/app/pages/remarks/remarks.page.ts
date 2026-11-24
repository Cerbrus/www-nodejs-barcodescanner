import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, catchError, finalize, interval, merge, of, startWith, switchMap, tap } from 'rxjs';

import { IssueDraft, IssueOptions, IssueStage, REMARK_KINDS, RemarkKind } from '@barcodescanner/shared';

import { MarkdownComponent } from '../../components/markdown/markdown.component';
import { SheetComponent } from '../../components/sheet/sheet.component';
import { FocusOnShowDirective } from '../../directives/focus-on-show.directive';
import { IconName } from '../../icon-names';
import { Remark, RemarkList } from '../../models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { PullRefreshService } from '../../services/pull-refresh.service';
import { RemarkService } from '../../services/remark.service';
import { ToastService } from '../../services/toast.service';

const KIND_ICONS: Record<RemarkKind, IconName> = { bug: 'bug_report', wish: 'lightbulb', note: 'sticky_note_2' };

const STAGE_ICONS: Record<IssueStage, IconName> = {
    sent: 'outbox',
    investigating: 'manage_search',
    needsAnswers: 'help',
    tooLarge: 'unfold_more',
    notPossible: 'block',
    notABug: 'fact_check',
    review: 'rate_review',
    merged: 'inventory_2',
    released: 'local_shipping',
    live: 'check_circle',
    closed: 'cancel'
};
const PROGRESS_REFRESH = 60 * 1000;

type RemarkAction = 'handle' | 'reopen' | 'edit' | 'toGitHub' | 'reject';

const ACTION_ICONS: Record<RemarkAction, IconName> = {
    handle: 'verified',
    reopen: 'undo',
    edit: 'edit',
    toGitHub: 'outbox',
    reject: 'block'
};
const ACTION_TEXTS: Record<RemarkAction, string> = {
    handle: 'remark.close',
    reopen: 'remark.reopen',
    edit: 'remark.edit',
    toGitHub: 'remark.toGitHub',
    reject: 'remark.reject'
};
const DEFAULT_OPTIONS: IssueOptions = { includeDevice: false, includeAccount: false, investigate: true };

@Component({
    selector: 'app-remarks-page',
    standalone: true,
    imports: [
        DatePipe,
        FormsModule,
        NgTemplateOutlet,
        RouterLink,
        TranslatePipe,
        MarkdownComponent,
        SheetComponent,
        FocusOnShowDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './remarks.page.html',
    styleUrl: './remarks.page.scss'
})
export class RemarksPage {
    protected readonly remarks = inject(RemarkService);
    protected readonly auth = inject(AuthService);
    protected readonly actionIcons = ACTION_ICONS;
    protected readonly actionTexts = ACTION_TEXTS;
    protected readonly optionNames: Array<keyof IssueOptions> = ['investigate', 'includeDevice', 'includeAccount'];
    protected readonly loaded = signal(false);
    protected readonly sending = signal<Remark | undefined>(undefined);
    protected readonly options = signal<IssueOptions>(DEFAULT_OPTIONS);
    protected readonly draft = signal<IssueDraft | undefined>(undefined);
    protected readonly busy = signal(false);
    protected readonly rejecting = signal<number | undefined>(undefined);
    protected readonly closing = signal<Remark | undefined>(undefined);
    protected readonly editing = signal<number | undefined>(undefined);
    protected readonly draftText = signal('');
    protected readonly draftKind = signal<RemarkKind>('note');
    protected readonly kinds = REMARK_KINDS;
    protected readonly icons = KIND_ICONS;
    protected readonly showHandled = signal(false);
    protected readonly menu = signal<number | undefined>(undefined);

    private readonly answer = signal<RemarkList>({ remarks: [], canSendToGitHub: false });
    private readonly api = inject(ApiService);
    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);

    protected readonly unhandled = computed(() => this.answer().remarks.filter((remark) => remark.state === 'open'));
    protected readonly handled = computed(() => this.answer().remarks.filter((remark) => remark.state === 'closed'));
    protected readonly canSendToGitHub = computed(() => this.answer().canSendToGitHub);

    constructor() {
        inject(PullRefreshService).use(() => this.load());
        merge(inject(EventsService).on('remark'), interval(PROGRESS_REFRESH))
            .pipe(
                startWith(undefined),
                switchMap(() => this.load()),
                takeUntilDestroyed()
            )
            .subscribe();
    }

    protected actionsFor(remark: Remark): Array<RemarkAction> {
        const owner = this.auth.owner();
        const onGitHub = remark.issueUrl;
        const actions: Array<RemarkAction> = [];

        if (owner && this.canSendToGitHub() && !onGitHub) {
            actions.push('toGitHub');
        }
        if (!onGitHub) {
            actions.push('edit');
        }
        if (owner) {
            actions.push(remark.state === 'open' ? 'handle' : 'reopen');
        }
        if (!onGitHub) {
            actions.push('reject');
        }

        return actions;
    }

    protected run(remark: Remark, action: RemarkAction): void {
        this.menu.set(undefined);
        if (action === 'reopen') {
            this.setState(remark, 'open');
        } else if (action === 'handle') {
            this.editing.set(undefined);
            this.rejecting.set(undefined);
            this.closing.set(remark);
        } else if (action === 'edit') {
            this.rejecting.set(undefined);
            this.closing.set(undefined);
            this.draftText.set(remark.text);
            this.draftKind.set(remark.kind);
            this.editing.set(remark.id);
        } else if (action === 'toGitHub') {
            this.prepare(remark);
        } else {
            this.editing.set(undefined);
            this.closing.set(undefined);
            this.rejecting.set(remark.id);
        }
    }

    protected stageIcon(stage: IssueStage): IconName {
        return STAGE_ICONS[stage];
    }

    protected icon(kind: RemarkKind): IconName {
        return KIND_ICONS[kind];
    }

    protected setState(remark: Remark, state: Remark['state']): void {
        this.api
            .setRemarkState(remark.id, state)
            .pipe(switchMap(() => this.load()))
            .subscribe();
    }

    protected onEditKey(event: KeyboardEvent, remark: Remark): void {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            if (!this.busy() && this.draftText().trim()) {
                this.saveEdit(remark);
            }
        }
    }

    protected saveEdit(remark: Remark): void {
        this.busy.set(true);
        this.api
            .editRemark(remark.id, this.draftText().trim(), this.draftKind())
            .pipe(
                tap(() => this.editing.set(undefined)),
                switchMap(() => this.load()),
                catchError(() => of(undefined)),
                finalize(() => this.busy.set(false))
            )
            .subscribe();
    }

    protected close(remark: Remark): void {
        this.closing.set(undefined);
        this.setState(remark, 'closed');
    }

    protected reject(remark: Remark): void {
        this.rejecting.set(undefined);
        this.api
            .rejectRemark(remark.id)
            .pipe(switchMap(() => this.load()))
            .subscribe();
    }

    protected prepare(remark: Remark): void {
        this.menu.set(undefined);
        this.options.set(DEFAULT_OPTIONS);
        this.sending.set(remark);
        this.loadDraft(remark);
    }

    protected choose(remark: Remark, option: keyof IssueOptions, chosen: boolean): void {
        this.options.update((options) => ({ ...options, [option]: chosen }));
        this.loadDraft(remark);
    }

    protected sendToGitHub(remark: Remark): void {
        this.busy.set(true);
        this.api
            .sendRemarkToGitHub(remark.id, this.options())
            .pipe(
                tap((sent) => {
                    this.sending.set(undefined);
                    this.toasts.show({
                        kind: 'ok',
                        text: this.translate.instant('remark.sentToGitHub', { number: sent.issueNumber })
                    });
                }),
                switchMap(() => this.load()),
                catchError(() => of(undefined)),
                finalize(() => this.busy.set(false))
            )
            .subscribe();
    }

    private loadDraft(remark: Remark): void {
        this.draft.set(undefined);
        this.api
            .getIssueDraft(remark.id, this.options())
            .pipe(tap((draft) => this.draft.set(draft)))
            .subscribe();
    }

    private load(): Observable<RemarkList | undefined> {
        return this.api.getRemarks().pipe(
            tap((answer) => {
                this.answer.set(answer);
                this.remarks.count(answer.remarks);
                this.loaded.set(true);
            }),
            catchError(() => of(undefined))
        );
    }
}

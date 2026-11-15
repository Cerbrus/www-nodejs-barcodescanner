import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, catchError, finalize, of, startWith, switchMap, tap } from 'rxjs';

import { SheetComponent } from '../../components/sheet/sheet.component';
import { IssueDraft, IssueOptions, Remark, RemarkKind, RemarkList } from '../../models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { RemarkService } from '../../services/remark.service';
import { ToastService } from '../../services/toast.service';

const KIND_ICONS: Record<RemarkKind, string> = { bug: 'bug_report', wish: 'lightbulb', note: 'sticky_note_2' };
const NOTHING_EXTRA: IssueOptions = { includeDevice: false, includeAccount: false, investigate: false };

@Component({
    selector: 'app-remarks-page',
    standalone: true,
    imports: [DatePipe, FormsModule, RouterLink, TranslateModule, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <a class="back-bar" routerLink="/system">
                <i class="material-symbols-outlined">arrow_back</i>
                {{ 'nav.system' | translate }}
            </a>
            <div class="flex items-center justify-between gap-3">
                <h1 class="page-title">{{ 'remark.listTitle' | translate }}</h1>
                <button type="button" class="btn" (click)="remarks.write()">
                    <i class="material-symbols-outlined">add_comment</i>
                    {{ 'remark.write' | translate }}
                </button>
            </div>

            @if (remarks.waiting(); as count) {
                <p class="muted mb-2 text-sm">{{ 'remark.waiting' | translate: { count } }}</p>
            }

            <div class="flex flex-col gap-2">
                @for (remark of list(); track remark.id) {
                    <article class="card" [class.opacity-60]="remark.state === 'closed'">
                        <div class="flex items-center gap-2 text-sm">
                            <i class="material-symbols-outlined kind" [class]="remark.kind">{{ icons[remark.kind] }}</i>
                            <span class="font-semibold">{{ 'remark.kind.' + remark.kind | translate }}</span>
                            <span class="muted grow">{{ remark.createdAt | date: 'd MMM HH:mm' }}</span>
                            @if (remark.state === 'closed') {
                                <span class="state">{{ 'remark.closed' | translate }}</span>
                            }
                        </div>
                        <p class="text">{{ remark.text }}</p>
                        <p class="muted where text-xs">
                            <span class="font-mono">{{ remark.page }}</span>
                            @if (remark.target; as target) {
                                · {{ target.label || target.text || target.component }}
                            }
                            @if (auth.owner() && auth.state()?.enabled) {
                                · {{ remark.account }}
                            }
                        </p>

                        @if (remark.issueUrl) {
                            <a class="issue" target="_blank" rel="noopener" [href]="remark.issueUrl">
                                <i class="material-symbols-outlined">open_in_new</i>
                                {{ 'remark.onGitHub' | translate: { number: remark.issueNumber } }}
                            </a>
                        }

                        @if (rejecting() === remark.id) {
                            <div class="mt-2">
                                <p class="text-sm">{{ 'remark.rejectConfirm' | translate }}</p>
                                <div class="mt-2 flex gap-2">
                                    <button type="button" class="btn danger" (click)="reject(remark)">
                                        <i class="material-symbols-outlined">block</i>
                                        {{ 'remark.reject' | translate }}
                                    </button>
                                    <button type="button" class="btn" (click)="rejecting.set(undefined)">
                                        {{ 'common.cancel' | translate }}
                                    </button>
                                </div>
                            </div>
                        } @else if (auth.owner() || !remark.issueUrl) {
                            <div class="mt-2 flex flex-wrap gap-2">
                                @if (auth.owner()) {
                                    <button
                                        type="button"
                                        class="btn"
                                        (click)="setState(remark, remark.state === 'open' ? 'closed' : 'open')">
                                        <i class="material-symbols-outlined">{{
                                            remark.state === 'open' ? 'check' : 'undo'
                                        }}</i>
                                        {{ (remark.state === 'open' ? 'remark.close' : 'remark.reopen') | translate }}
                                    </button>
                                    @if (canSendToGitHub() && !remark.issueUrl) {
                                        <button type="button" class="btn" (click)="prepare(remark)">
                                            <i class="material-symbols-outlined">outbox</i>
                                            {{ 'remark.toGitHub' | translate }}
                                        </button>
                                    }
                                }
                                @if (!remark.issueUrl) {
                                    <button type="button" class="btn" (click)="rejecting.set(remark.id)">
                                        <i class="material-symbols-outlined">block</i>
                                        {{ 'remark.reject' | translate }}
                                    </button>
                                }
                            </div>
                        }
                    </article>
                } @empty {
                    <p class="empty">{{ (loaded() ? 'remark.empty' : 'common.loading') | translate }}</p>
                }
            </div>
        </div>

        @if (sending(); as remark) {
            <app-sheet (closed)="sending.set(undefined)">
                <h2 class="page-title">{{ 'remark.toGitHub' | translate }}</h2>
                <p class="muted text-sm">{{ 'remark.publicWarning' | translate }}</p>

                @for (option of optionNames; track option) {
                    <label class="option">
                        <input
                            type="checkbox"
                            [ngModel]="options()[option]"
                            (ngModelChange)="choose(remark, option, $event)" />
                        <span>{{ 'remark.option.' + option | translate }}</span>
                    </label>
                }

                @if (draft(); as issue) {
                    <span class="field-label">{{ 'remark.preview' | translate }}</span>
                    <div class="preview">
                        <p class="font-semibold">{{ issue.title }}</p>
                        @if (issue.labels.length) {
                            <p class="muted text-xs">{{ issue.labels.join(', ') }}</p>
                        }
                        <pre>{{ issue.body }}</pre>
                    </div>
                }

                <div class="mt-3 flex gap-2">
                    <button type="button" class="btn" (click)="sending.set(undefined)">
                        <i class="material-symbols-outlined">close</i>
                        {{ 'common.cancel' | translate }}
                    </button>
                    <button
                        type="button"
                        class="btn primary grow"
                        [disabled]="busy() || !draft()"
                        (click)="sendToGitHub(remark)">
                        <i class="material-symbols-outlined">send</i>
                        {{ 'remark.sendToGitHub' | translate }}
                    </button>
                </div>
            </app-sheet>
        }
    `,
    styles: `
        .kind {
            font-size: 20px;
            color: var(--text-muted);
        }
        .kind.bug {
            color: var(--danger);
        }
        .kind.wish {
            color: var(--accent);
        }
        .state {
            padding: 2px 8px;
            border-radius: 8px;
            background: var(--line);
            font-size: 0.75rem;
            font-weight: 700;
        }
        .text {
            margin-top: 6px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }
        .where {
            margin-top: 4px;
            overflow-wrap: anywhere;
        }
        .issue {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-top: 6px;
            color: var(--accent);
            font-size: 0.85rem;
            font-weight: 600;
        }
        .issue i {
            font-size: 16px;
        }
        .option {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 8px;
            font-size: 0.9rem;
        }
        .option input {
            width: 18px;
            height: 18px;
            accent-color: var(--accent);
        }
        .preview {
            max-height: 36dvh;
            padding: 10px;
            overflow: auto;
            border: 1px solid var(--line);
            border-radius: 10px;
            background: var(--page);
        }
        .preview pre {
            margin-top: 6px;
            font-family: inherit;
            font-size: 0.8rem;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }
    `,
})
export class RemarksPage {
    protected readonly remarks = inject(RemarkService);
    protected readonly auth = inject(AuthService);
    protected readonly icons = KIND_ICONS;
    protected readonly optionNames: Array<keyof IssueOptions> = ['includeDevice', 'includeAccount', 'investigate'];
    protected readonly loaded = signal(false);
    protected readonly sending = signal<Remark | undefined>(undefined);
    protected readonly options = signal<IssueOptions>(NOTHING_EXTRA);
    protected readonly draft = signal<IssueDraft | undefined>(undefined);
    protected readonly busy = signal(false);
    protected readonly rejecting = signal<number | undefined>(undefined);

    private readonly answer = signal<RemarkList>({ remarks: [], canSendToGitHub: false });
    private readonly api = inject(ApiService);
    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);

    protected readonly list = computed(() => this.answer().remarks);
    protected readonly canSendToGitHub = computed(() => this.answer().canSendToGitHub);

    constructor() {
        inject(EventsService)
            .on('remark')
            .pipe(
                startWith(undefined),
                switchMap(() => this.load()),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    protected setState(remark: Remark, state: Remark['state']): void {
        this.api
            .setRemarkState(remark.id, state)
            .pipe(switchMap(() => this.load()))
            .subscribe();
    }

    protected reject(remark: Remark): void {
        this.rejecting.set(undefined);
        this.api
            .rejectRemark(remark.id)
            .pipe(switchMap(() => this.load()))
            .subscribe();
    }

    protected prepare(remark: Remark): void {
        this.options.set(NOTHING_EXTRA);
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
                        text: this.translate.instant('remark.sentToGitHub', { number: sent.issueNumber }),
                    });
                }),
                switchMap(() => this.load()),
                catchError(() => of(undefined)),
                finalize(() => this.busy.set(false)),
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
                this.loaded.set(true);
            }),
            catchError(() => of(undefined)),
        );
    }
}

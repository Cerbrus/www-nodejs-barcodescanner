import { DatePipe, NgTemplateOutlet } from '@angular/common';
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

type RemarkAction = 'handle' | 'reopen' | 'toGitHub' | 'reject';

const ACTION_ICONS: Record<RemarkAction, string> = { handle: 'check', reopen: 'undo', toGitHub: 'outbox', reject: 'block' };
const ACTION_TEXTS: Record<RemarkAction, string> = { handle: 'remark.close', reopen: 'remark.reopen', toGitHub: 'remark.toGitHub', reject: 'remark.reject' };
const DEFAULT_OPTIONS: IssueOptions = { includeDevice: false, includeAccount: false, investigate: true };

@Component({
    selector: 'app-remarks-page',
    standalone: true,
    imports: [DatePipe, FormsModule, NgTemplateOutlet, RouterLink, TranslateModule, SheetComponent],
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
                @for (remark of unhandled(); track remark.id) {
                    <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ $implicit: remark }" />
                } @empty {
                    @if (!handled().length) {
                        <p class="empty">{{ (loaded() ? 'remark.empty' : 'common.loading') | translate }}</p>
                    }
                }
            </div>

            @if (handled().length) {
                <button type="button" class="group" [attr.aria-expanded]="showHandled()" (click)="showHandled.set(!showHandled())">
                    <i class="material-symbols-outlined">{{ showHandled() ? 'expand_less' : 'expand_more' }}</i>
                    <span class="grow text-left">{{ 'remark.closed' | translate }}</span>
                    <span class="state">{{ handled().length }}</span>
                </button>
                @if (showHandled()) {
                    <div class="flex flex-col gap-2">
                        @for (remark of handled(); track remark.id) {
                            <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ $implicit: remark }" />
                        }
                    </div>
                }
            }
        </div>

        <ng-template #card let-remark>
            <article class="card" [class.opacity-60]="remark.state === 'closed'">
                <div class="flex items-center gap-2 text-sm">
                    <i class="material-symbols-outlined kind" [class]="remark.kind">{{ icon(remark.kind) }}</i>
                    <span class="font-semibold">{{ 'remark.kind.' + remark.kind | translate }}</span>
                    <span class="muted grow">{{ remark.createdAt | date: 'd MMM HH:mm' }}</span>
                    @let actions = actionsFor(remark);
                    @if (actions.length === 1) {
                        <button type="button" class="btn small" (click)="run(remark, actions[0])">
                            <i class="material-symbols-outlined">{{ actionIcons[actions[0]] }}</i>
                            {{ actionTexts[actions[0]] | translate }}
                        </button>
                    } @else if (actions.length) {
                        <div class="menu-anchor">
                            <button
                                type="button"
                                class="btn small"
                                [attr.aria-expanded]="menu() === remark.id"
                                [attr.aria-label]="'remark.actions' | translate"
                                (click)="menu.set(menu() === remark.id ? undefined : remark.id)">
                                <i class="material-symbols-outlined">more_vert</i>
                            </button>
                            @if (menu() === remark.id) {
                                <button type="button" class="backdrop" tabindex="-1" aria-hidden="true" (click)="menu.set(undefined)"></button>
                                <div class="menu" role="menu">
                                    @for (action of actions; track action) {
                                        <button type="button" role="menuitem" (click)="run(remark, action)">
                                            <i class="material-symbols-outlined">{{ actionIcons[action] }}</i>
                                            {{ actionTexts[action] | translate }}
                                        </button>
                                    }
                                </div>
                            }
                        </div>
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
                    <p class="mt-2 text-sm">{{ 'remark.rejectConfirm' | translate }}</p>
                    <div class="mt-2 flex gap-2">
                        <button type="button" class="btn danger" (click)="reject(remark)">
                            <i class="material-symbols-outlined">block</i>
                            {{ 'remark.reject' | translate }}
                        </button>
                        <button type="button" class="btn" (click)="rejecting.set(undefined)">
                            <i class="material-symbols-outlined">close</i>
                            {{ 'common.cancel' | translate }}
                        </button>
                    </div>
                }
            </article>
        </ng-template>

        @if (sending(); as remark) {
            <app-sheet (closed)="sending.set(undefined)">
                <h2 class="page-title">{{ 'remark.toGitHub' | translate }}</h2>
                <p class="muted text-sm">{{ 'remark.publicWarning' | translate }}</p>

                @for (option of optionNames; track option) {
                    <label class="option">
                        <input type="checkbox" [ngModel]="options()[option]" (ngModelChange)="choose(remark, option, $event)" />
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
                    <button type="button" class="btn primary grow" [disabled]="busy() || !draft()" (click)="sendToGitHub(remark)">
                        <i class="material-symbols-outlined">send</i>
                        {{ 'remark.sendToGitHub' | translate }}
                    </button>
                </div>
            </app-sheet>
        }
    `,
    styles: `
        .kind { font-size: 20px; color: var(--text-muted); }
        .kind.bug { color: var(--danger); }
        .kind.wish { color: var(--accent); }
        .state { padding: 2px 8px; border-radius: 8px; background: var(--line); font-size: 0.75rem; font-weight: 700; }
        .group { display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 12px; padding: 8px 4px; color: var(--text-muted); font-weight: 600; }
        .btn.small { padding: 4px 10px; font-size: 0.85rem; }
        .menu-anchor { position: relative; }
        .backdrop { position: fixed; inset: 0; z-index: 10; cursor: default; }
        .menu { position: absolute; top: 100%; right: 0; z-index: 11; min-width: 160px; margin-top: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); box-shadow: 0 4px 16px rgb(0 0 0 / 0.2); }
        .menu button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border-radius: 8px; text-align: left; }
        .menu button:hover { background: var(--line); }
        .text { margin-top: 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .where { margin-top: 4px; overflow-wrap: anywhere; }
        .issue { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; color: var(--accent); font-size: 0.85rem; font-weight: 600; }
        .issue i { font-size: 16px; }
        .option { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 0.9rem; }
        .option input { width: 18px; height: 18px; accent-color: var(--accent); }
        .preview { max-height: 36dvh; padding: 10px; overflow: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--page); }
        .preview pre { margin-top: 6px; font-family: inherit; font-size: 0.8rem; white-space: pre-wrap; overflow-wrap: anywhere; }
    `
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
        inject(EventsService)
            .on('remark')
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

        if (owner) {
            actions.push(remark.state === 'open' ? 'handle' : 'reopen');
        }
        if (owner && this.canSendToGitHub() && !onGitHub) {
            actions.push('toGitHub');
        }
        if (!onGitHub) {
            actions.push('reject');
        }

        return actions;
    }

    protected run(remark: Remark, action: RemarkAction): void {
        this.menu.set(undefined);
        if (action === 'handle' || action === 'reopen') {
            this.setState(remark, action === 'handle' ? 'closed' : 'open');
        } else if (action === 'toGitHub') {
            this.prepare(remark);
        } else {
            this.rejecting.set(remark.id);
        }
    }

    protected icon(kind: RemarkKind): string {
        return KIND_ICONS[kind];
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
                    this.toasts.show({ kind: 'ok', text: this.translate.instant('remark.sentToGitHub', { number: sent.issueNumber }) });
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

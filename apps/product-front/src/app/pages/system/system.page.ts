import { DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, interval, merge, of, startWith, switchMap, tap } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { PushService } from '../../services/push.service';
import { Theme, ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';

const LANGUAGES = ['nl', 'en'] as const;
const LANGUAGE_STORAGE_KEY = 'language';
const COMMIT_LENGTH = 7;
const AGENT_REFRESH_MILLISECONDS = 60 * 1000;
const MANAGEMENT_LINKS = [
    { path: '/sounds', icon: 'volume_up', title: 'sound.title' },
    { path: '/history', icon: 'history', title: 'history.title' },
    { path: '/log', icon: 'terminal', title: 'log.title' }
];
const THEME_OPTIONS: Array<{ theme: Theme; icon: string }> = [
    { theme: 'auto', icon: 'brightness_auto' },
    { theme: 'light', icon: 'light_mode' },
    { theme: 'dark', icon: 'dark_mode' }
];

@Component({
    selector: 'app-system-page',
    standalone: true,
    imports: [DatePipe, LowerCasePipe, RouterLink, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <h1 class="page-title">{{ 'nav.system' | translate }}</h1>

            <h2 class="section-title">{{ 'system.device' | translate }}</h2>
            <div class="card group">
                <div class="row choice">
                    <span class="label">{{ 'system.language' | translate }}</span>
                    <div class="segments">
                        @for (language of languages; track language) {
                            <button
                                type="button"
                                class="segment"
                                [class.chosen]="currentLanguage() === language"
                                (click)="useLanguage(language)"
                            >
                                {{ 'language.' + language | translate }}
                            </button>
                        }
                    </div>
                </div>
                <div class="row choice">
                    <span class="label">{{ 'system.theme' | translate }}</span>
                    <div class="segments">
                        @for (option of themeOptions; track option.theme) {
                            <button
                                type="button"
                                class="segment"
                                [class.chosen]="theme.theme() === option.theme"
                                (click)="theme.use(option.theme)"
                            >
                                <i class="material-symbols-outlined">{{ option.icon }}</i>
                                {{ 'theme.' + option.theme | translate }}
                            </button>
                        }
                    </div>
                </div>
                <div class="row">
                    <span class="label">
                        {{ 'push.title' | translate }}
                        <span class="hint">{{ 'push.state.' + push.status() | translate }}</span>
                    </span>
                    @if (push.status() === 'off') {
                        <button type="button" class="btn primary" [disabled]="push.busy()" (click)="enablePush()">
                            <i class="material-symbols-outlined">notifications_active</i>
                            {{ 'push.turnOn' | translate }}
                        </button>
                    } @else if (push.status() === 'on') {
                        <div class="flex gap-2">
                            @if (auth.owner()) {
                                <button type="button" class="btn" (click)="testPush()">
                                    <i class="material-symbols-outlined">send</i>
                                    {{ 'push.test' | translate }}
                                </button>
                            }
                            <button type="button" class="btn" (click)="push.disable()">
                                <i class="material-symbols-outlined">notifications_off</i>
                                {{ 'push.disable' | translate }}
                            </button>
                        </div>
                    }
                </div>
                @if (push.status() !== 'on') {
                    <p class="note">
                        {{ (push.status() === 'off' ? 'push.intro' : 'push.' + push.status()) | translate }}
                    </p>
                }
            </div>

            @if (auth.state()?.enabled) {
                <h2 class="section-title">{{ 'login.account' | translate }}</h2>
                <div class="card group">
                    <div class="row">
                        <i class="material-symbols-outlined muted">account_circle</i>
                        <span class="label truncate">{{ auth.state()?.email }}</span>
                        @if (!confirmingLogout()) {
                            <button type="button" class="btn danger" (click)="confirmingLogout.set(true)">
                                <i class="material-symbols-outlined">logout</i>
                                {{ 'login.logout' | translate }}
                            </button>
                        }
                    </div>
                    @if (confirmingLogout()) {
                        <p class="note">{{ 'login.logoutConfirm' | translate }}</p>
                        <div class="row">
                            <button type="button" class="btn danger basis-0 grow" (click)="logout()">
                                <i class="material-symbols-outlined">logout</i>
                                {{ 'login.logout' | translate }}
                            </button>
                            <button type="button" class="btn basis-0 grow" (click)="confirmingLogout.set(false)">
                                <i class="material-symbols-outlined">close</i>
                                {{ 'common.cancel' | translate }}
                            </button>
                        </div>
                    }
                </div>
            }

            @if (auth.owner()) {
                <h2 class="section-title">{{ 'system.management' | translate }}</h2>
                <div class="card group">
                    <div class="row">
                        <span class="dot" [class.bad]="!events.connected()"></span>
                        <span class="label">{{ 'system.connection' | translate }}</span>
                        <span class="value">{{ (events.connected() ? 'log.live' : 'log.disconnected') | translate }}</span>
                    </div>
                    <div class="row">
                        <span class="dot" [class.bad]="scannerState() !== 'connected'"></span>
                        <span class="label">
                            {{ 'system.scanner' | translate }}
                            @if (agent()?.lastHandheldScanAt; as lastScan) {
                                <span class="hint">
                                    {{ 'system.lastHandheldScan' | translate }}: {{ lastScan | date: 'd MMM HH:mm' }}
                                </span>
                            }
                        </span>
                        <span class="value">{{ 'system.scannerState.' + scannerState() | translate }}</span>
                    </div>
                    @for (link of managementLinks; track link.path) {
                        <a class="row link" [routerLink]="link.path">
                            <i class="material-symbols-outlined">{{ link.icon }}</i>
                            <span class="label">{{ link.title | translate }}</span>
                            <i class="material-symbols-outlined muted">chevron_right</i>
                        </a>
                    }
                </div>

                <p class="version">
                    {{ 'system.version' | translate }} <span class="font-mono">{{ version() }}</span>
                    @if (health()?.builtAt; as builtAt) {
                        · {{ 'system.built' | translate | lowercase }} {{ builtAt | date: 'd MMM y HH:mm' }}
                    }
                </p>
            }
        </div>
    `,
    styles: `
        .group { padding: 0; }
        .row {
            display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
            min-height: 52px; padding: 8px 12px;
        }
        .row + .row, .note + .row { border-top: 1px solid var(--line); }
        .label { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; font-weight: 600; }
        .hint { color: var(--text-muted); font-size: 0.8rem; font-weight: 400; }
        .value { color: var(--text-muted); font-size: 0.9rem; text-align: right; }
        .note { padding: 0 12px 10px; color: var(--text-muted); font-size: 0.85rem; }
        .link:hover, .link:focus-visible { background: var(--page); }
        .segments { display: flex; padding: 2px; border: 1px solid var(--line); border-radius: 10px; background: var(--page); }
        .segment {
            display: flex; align-items: center; gap: 4px; padding: 6px 10px;
            border-radius: 8px; font-size: 0.85rem; font-weight: 600;
        }
        .segment i { font-size: 18px; }
        .segment.chosen { background: var(--accent); color: var(--accent-text); }
        @media (max-width: 480px) {
            .choice { flex-flow: column nowrap; align-items: stretch; }
            .choice .segment { flex: 1 1 0; justify-content: center; }
        }
        .dot { flex: 0 0 auto; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
        .dot.bad { background: var(--danger); }
        .version { margin-top: 12px; color: var(--text-muted); font-size: 0.8rem; text-align: center; }
    `
})
export class SystemPage {
    protected readonly events = inject(EventsService);
    protected readonly theme = inject(ThemeService);
    protected readonly push = inject(PushService);
    protected readonly auth = inject(AuthService);
    protected readonly confirmingLogout = signal(false);
    protected readonly languages = LANGUAGES;
    protected readonly themeOptions = THEME_OPTIONS;
    protected readonly managementLinks = MANAGEMENT_LINKS;
    protected readonly currentLanguage = signal(inject(TranslateService).currentLang || 'nl');

    private readonly agentApi = inject(ApiService);

    protected readonly agent = toSignal(
        merge(interval(AGENT_REFRESH_MILLISECONDS), this.events.on('agent', 'scan')).pipe(
            startWith(undefined),
            switchMap(() => (this.auth.owner() ? this.agentApi.getAgentStatus().pipe(catchError(() => of(undefined))) : of(undefined)))
        )
    );

    protected readonly scannerState = computed(() => {
        const agent = this.agent();

        return agent?.agentOnline ? (agent.scanner ?? 'waiting') : 'offline';
    });

    protected readonly health = toSignal(
        inject(ApiService)
            .getHealth()
            .pipe(catchError(() => of(undefined)))
    );

    private readonly translate = inject(TranslateService);
    private readonly api = inject(ApiService);
    private readonly toasts = inject(ToastService);

    protected version(): string {
        const health = this.health();
        if (!health) {
            return '…';
        }

        return health.commit ? `${health.version} (${health.commit.slice(0, COMMIT_LENGTH)})` : health.version;
    }

    protected logout(): void {
        this.auth.logout().subscribe();
    }

    protected enablePush(): void {
        this.push.enable().catch(() => this.toasts.show({ kind: 'error', text: this.translate.instant('push.failed') }));
    }

    protected testPush(): void {
        this.api
            .sendTestPush()
            .pipe(tap((result) => this.toasts.show({ kind: 'ok', text: this.translate.instant('push.testResult', result) })))
            .subscribe();
    }

    protected useLanguage(language: string): void {
        this.translate.use(language);
        this.currentLanguage.set(language);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
}

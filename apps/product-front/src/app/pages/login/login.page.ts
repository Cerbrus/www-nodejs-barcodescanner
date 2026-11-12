import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';

const KNOWN_ERRORS = ['not_allowed', 'failed'];

@Component({
    selector: 'app-login-page',
    standalone: true,
    imports: [TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <main class="login">
            <img class="logo" src="assets/icons/icon-192.png" alt="" />
            <h1 class="page-title !m-0">{{ 'common.appName' | translate }}</h1>
            <p class="muted text-center">{{ 'login.intro' | translate }}</p>

            @if (errorKey(); as key) {
                <p class="error" role="alert">{{ key | translate }}</p>
            }

            <a class="btn primary w-full" [href]="auth.loginUrl">
                <i class="material-symbols-outlined">login</i>
                {{ 'login.google' | translate }}
            </a>
        </main>
    `,
    styles: `
        .login {
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
            max-width: 340px; min-height: 100dvh; margin: 0 auto; padding: 24px;
        }
        .logo { width: 96px; height: 96px; border-radius: 22px; }
        .error {
            width: 100%; padding: 10px 12px; border: 1px solid var(--danger); border-radius: 10px;
            color: var(--danger); font-size: 0.9rem; text-align: center;
        }
    `
})
export class LoginPage {
    public readonly error = input<string | undefined>(undefined);

    protected readonly auth = inject(AuthService);

    protected errorKey(): string | undefined {
        const error = this.error();
        if (!error) {
            return undefined;
        }

        return `login.error.${KNOWN_ERRORS.includes(error) ? error : 'failed'}`;
    }
}

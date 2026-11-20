import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';

const KNOWN_ERRORS = ['not_allowed', 'failed'];

@Component({
    selector: 'app-login-page',
    standalone: true,
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './login.page.html',
    styleUrl: './login.page.scss'
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

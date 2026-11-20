import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { Release } from '../../models';
import { ApiService } from '../../services/api.service';

@Component({
    selector: 'app-changelog-page',
    standalone: true,
    imports: [DatePipe, RouterLink, TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './changelog.page.html',
    styleUrl: './changelog.page.scss'
})
export class ChangelogPage {
    protected readonly releases = toSignal(
        inject(ApiService)
            .getChangelog()
            .pipe(catchError(() => of([] as Array<Release>)))
    );

    private readonly open = signal<string | undefined>(undefined);

    protected isOpen(release: Release): boolean {
        return this.open() === release.version;
    }

    protected toggle(release: Release): void {
        this.open.set(this.isOpen(release) ? undefined : release.version);
    }
}

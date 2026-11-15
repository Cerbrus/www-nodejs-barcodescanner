import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { Release } from '../../models';
import { ApiService } from '../../services/api.service';

@Component({
    selector: 'app-changelog-page',
    standalone: true,
    imports: [DatePipe, RouterLink, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <a class="back-bar" routerLink="/system">
                <i class="material-symbols-outlined">arrow_back</i>
                {{ 'nav.system' | translate }}
            </a>
            <h1 class="page-title">{{ 'changelog.title' | translate }}</h1>

            <div class="flex flex-col gap-1">
                @for (release of releases(); track release.version) {
                    <div class="card !py-2">
                        <button
                            type="button"
                            class="head"
                            [attr.aria-expanded]="isOpen(release)"
                            (click)="toggle(release)"
                        >
                            <span class="grow">
                                <span class="block font-semibold">{{ release.summary }}</span>
                                <span class="muted block text-xs">
                                    <span class="font-mono">{{ release.version }}</span>
                                    · {{ release.released | date: 'd MMM y HH:mm' }}
                                </span>
                            </span>
                            <i class="material-symbols-outlined muted">{{
                                isOpen(release) ? 'expand_less' : 'expand_more'
                            }}</i>
                        </button>
                        @if (isOpen(release)) {
                            <ul class="notes">
                                @for (note of release.notes; track $index) {
                                    <li>{{ note }}</li>
                                }
                            </ul>
                        }
                    </div>
                } @empty {
                    <p class="empty">{{ (releases() ? 'changelog.empty' : 'common.loading') | translate }}</p>
                }
            </div>
        </div>
    `,
    styles: `
        .head {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            text-align: left;
        }
        .notes {
            margin: 8px 0 4px;
            padding-left: 18px;
            list-style: disc;
            font-size: 0.9rem;
        }
        .notes li + li {
            margin-top: 4px;
        }
    `
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

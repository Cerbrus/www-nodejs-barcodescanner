import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of, tap } from 'rxjs';

import { FeedbackSettings } from '../../models';
import { ApiService } from '../../services/api.service';

const NO_SOUND = 'none';

@Component({
    selector: 'app-sound-test',
    standalone: true,
    imports: [FormsModule, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="card text-sm">
            <p class="muted">{{ 'sound.intro' | translate }}</p>

            @if (settings(); as settings) {
                <h3 class="field-label">{{ 'sound.events' | translate }}</h3>
                <div class="grid grid-cols-2 gap-x-3 gap-y-2">
                    @for (row of settings.events; track row.event) {
                        <div class="min-w-0">
                            <div class="flex items-center justify-between gap-1">
                                <label class="field-label !m-0 truncate" [for]="'sound-' + row.event">
                                    {{ 'sound.event.' + row.event | translate }}
                                </label>
                                <button
                                    type="button"
                                    class="play"
                                    [attr.aria-label]="'sound.play' | translate"
                                    [disabled]="row.soundId === noSound"
                                    (click)="play(row.soundId)"
                                >
                                    <i class="material-symbols-outlined">volume_up</i>
                                </button>
                            </div>
                            <select
                                class="field"
                                [id]="'sound-' + row.event"
                                [ngModel]="row.soundId"
                                (ngModelChange)="choose(row.event, $event)"
                            >
                                <option [value]="noSound">{{ 'sound.none' | translate }}</option>
                                @for (sound of settings.sounds; track sound.id) {
                                    <option [value]="sound.id">{{ 'sound.name.' + sound.id | translate }}</option>
                                }
                            </select>
                        </div>
                    }
                </div>

                <button
                    type="button"
                    class="mt-3 flex w-full items-center gap-2 font-semibold"
                    [attr.aria-expanded]="showAll()"
                    (click)="showAll.set(!showAll())"
                >
                    <span class="grow text-left">{{ 'sound.samples' | translate }} ({{ settings.sounds.length }})</span>
                    <i class="material-symbols-outlined muted">{{ showAll() ? 'expand_less' : 'expand_more' }}</i>
                </button>
                @if (showAll()) {
                    <div class="mt-2 grid grid-cols-2 gap-2">
                        @for (sound of settings.sounds; track sound.id) {
                            <button type="button" class="btn !justify-start text-left" (click)="play(sound.id)">
                                <i class="material-symbols-outlined">graphic_eq</i>
                                <span>{{ 'sound.name.' + sound.id | translate }}</span>
                            </button>
                        }
                    </div>
                }
            } @else {
                <p class="mt-2">{{ (failed() ? 'sound.unavailable' : 'common.loading') | translate }}</p>
            }
        </div>
    `,
    styles: `
        .play { display: flex; padding: 2px; border-radius: 8px; color: var(--accent); }
        .play:disabled { opacity: 0.35; }
        .play i { font-size: 20px; }
    `
})
export class SoundTestComponent {
    protected readonly noSound = NO_SOUND;
    protected readonly settings = signal<FeedbackSettings | undefined>(undefined);
    protected readonly showAll = signal(false);
    protected readonly failed = signal(false);

    private readonly api = inject(ApiService);

    constructor() {
        this.api
            .getFeedbackSettings()
            .pipe(
                tap((settings) => this.settings.set(settings)),
                catchError(() => {
                    this.failed.set(true);
                    return of(undefined);
                })
            )
            .subscribe();
    }

    protected choose(event: string, soundId: string): void {
        this.api
            .setFeedbackSound(event, soundId)
            .pipe(
                tap((settings) => this.settings.set(settings)),
                tap(() => soundId !== NO_SOUND && this.play(soundId))
            )
            .subscribe();
    }

    protected play(soundId: string): void {
        this.api.testSound(soundId).subscribe();
    }
}

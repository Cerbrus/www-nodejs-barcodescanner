import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, finalize, of, tap } from 'rxjs';

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
                <div class="flex flex-col gap-2">
                    @for (row of settings.events; track row.event) {
                        <div class="flex items-end gap-2">
                            <label class="grow">
                                <span class="field-label !mt-0">{{ 'sound.event.' + row.event | translate }}</span>
                                <select class="field" [ngModel]="row.soundId" (ngModelChange)="choose(row.event, $event)">
                                    <option [value]="noSound">{{ 'sound.none' | translate }}</option>
                                    @for (sound of settings.sounds; track sound.id) {
                                        <option [value]="sound.id">{{ 'sound.name.' + sound.id | translate }}</option>
                                    }
                                </select>
                            </label>
                            <button
                                type="button"
                                class="btn"
                                [attr.aria-label]="'sound.play' | translate"
                                [disabled]="busy() || row.soundId === noSound"
                                (click)="play(row.soundId)"
                            >
                                <i class="material-symbols-outlined">volume_up</i>
                            </button>
                        </div>
                    }
                </div>

                <h3 class="field-label">{{ 'sound.samples' | translate }}</h3>
                <div class="grid grid-cols-2 gap-2">
                    @for (sound of settings.sounds; track sound.id) {
                        <button type="button" class="btn !justify-start text-left" [disabled]="busy()" (click)="play(sound.id)">
                            <i class="material-symbols-outlined">graphic_eq</i>
                            <span>{{ 'sound.name.' + sound.id | translate }}</span>
                        </button>
                    }
                </div>
            } @else {
                <p class="mt-2">{{ (failed() ? 'sound.unavailable' : 'common.loading') | translate }}</p>
            }
        </div>
    `
})
export class SoundTestComponent {
    protected readonly noSound = NO_SOUND;
    protected readonly settings = signal<FeedbackSettings | undefined>(undefined);
    protected readonly busy = signal(false);
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
        this.busy.set(true);
        this.api
            .testSound(soundId)
            .pipe(finalize(() => this.busy.set(false)))
            .subscribe();
    }
}

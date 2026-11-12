import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { SoundStep } from '../../models';
import { ApiService } from '../../services/api.service';

interface Sound {
    id: string;
    detail?: string;
    steps: Array<SoundStep>;
}

const BLIP = 0.06;
const GAP = 0.07;

const on = (seconds: number): SoundStep => ({ kind: 'on', seconds });
const off = (seconds: number): SoundStep => ({ kind: 'off', seconds });
const gate = (hz: number, seconds: number, duty = 50): SoundStep => ({ kind: 'gate', hz, duty, seconds });

const EVENT_SOUNDS: Array<Sound> = [
    { id: 'added', steps: [on(0.08)] },
    { id: 'incremented', steps: [on(BLIP), off(GAP), on(BLIP)] },
    { id: 'needsName', steps: [on(0.45)] },
    { id: 'error', steps: [on(0.08), off(GAP), on(0.08), off(GAP), on(0.08)] }
];

const SAMPLE_SOUNDS: Array<Sound> = [
    { id: 'clean', detail: '0,25 s', steps: [on(0.25)] },
    { id: 'blip', detail: '0,05 s', steps: [on(0.05)] },
    { id: 'long', detail: '0,8 s', steps: [on(0.8)] },
    { id: 'trill', detail: '8/s', steps: [gate(8, 0.9)] },
    { id: 'trill', detail: '15/s', steps: [gate(15, 0.9)] },
    { id: 'trill', detail: '30/s', steps: [gate(30, 0.9)] },
    { id: 'rough', detail: '200 Hz', steps: [gate(200, 0.6)] },
    { id: 'rough', detail: '500 Hz', steps: [gate(500, 0.6)] },
    { id: 'rough', detail: '1000 Hz', steps: [gate(1000, 0.6)] },
    { id: 'soft', detail: '2000 Hz, 20%', steps: [gate(2000, 0.6, 20)] },
    { id: 'soft', detail: '2000 Hz, 5%', steps: [gate(2000, 0.6, 5)] },
    { id: 'shortShortLong', steps: [on(BLIP), off(BLIP), on(BLIP), off(BLIP), on(0.3)] },
    { id: 'longShort', steps: [on(0.3), off(BLIP), on(BLIP)] },
    { id: 'blipThenTrill', steps: [on(BLIP), off(GAP), gate(20, 0.4)] }
];

@Component({
    selector: 'app-sound-test',
    standalone: true,
    imports: [TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="card text-sm">
            <p class="muted">{{ 'sound.intro' | translate }}</p>

            <h3 class="field-label">{{ 'sound.events' | translate }}</h3>
            <div class="grid grid-cols-2 gap-2">
                @for (sound of eventSounds; track $index) {
                    <button type="button" class="btn !justify-start text-left" [disabled]="busy()" (click)="play(sound)">
                        <i class="material-symbols-outlined">volume_up</i>
                        <span>{{ 'sound.name.' + sound.id | translate }}</span>
                    </button>
                }
            </div>

            <h3 class="field-label">{{ 'sound.samples' | translate }}</h3>
            <div class="grid grid-cols-2 gap-2">
                @for (sound of sampleSounds; track $index) {
                    <button type="button" class="btn !justify-start text-left" [disabled]="busy()" (click)="play(sound)">
                        <i class="material-symbols-outlined">graphic_eq</i>
                        <span>
                            {{ 'sound.name.' + sound.id | translate }}
                            @if (sound.detail) {
                                <span class="muted block text-xs font-normal">{{ sound.detail }}</span>
                            }
                        </span>
                    </button>
                }
            </div>
        </div>
    `
})
export class SoundTestComponent {
    protected readonly eventSounds = EVENT_SOUNDS;
    protected readonly sampleSounds = SAMPLE_SOUNDS;
    protected readonly busy = signal(false);

    private readonly api = inject(ApiService);

    protected play(sound: Sound): void {
        this.busy.set(true);
        this.api
            .testSound([sound.id, sound.detail].filter((part) => part).join(' '), sound.steps)
            .pipe(finalize(() => this.busy.set(false)))
            .subscribe();
    }
}

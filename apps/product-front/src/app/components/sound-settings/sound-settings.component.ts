import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of, tap } from 'rxjs';

import { FeedbackSettings, Sound } from '../../models';
import { ApiService } from '../../services/api.service';
import { SheetComponent } from '../sheet/sheet.component';
import { SoundEditorComponent, SoundSaved } from '../sound-editor/sound-editor.component';
import { SoundTimelineComponent } from '../sound-timeline/sound-timeline.component';

const NO_SOUND = 'none';

interface Editing {
    sound?: Sound;
    forEvent?: string;
}

@Component({
    selector: 'app-sound-settings',
    standalone: true,
    imports: [TranslatePipe, SheetComponent, SoundEditorComponent, SoundTimelineComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sound-settings.component.html',
    styles: `
        .row {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 8px 0;
            border-bottom: 1px solid var(--line);
            text-align: left;
        }
        .row:last-of-type {
            border-bottom: 0;
        }
        .row app-sound-timeline {
            flex: 0 0 6rem;
        }
        .pick {
            display: flex;
            flex: 1;
            align-items: center;
            gap: 10px;
            min-width: 0;
            text-align: left;
        }
        .row.chosen {
            color: var(--accent);
        }
        .icon {
            display: flex;
            padding: 4px;
            border-radius: 8px;
            color: var(--accent);
        }
    `
})
export class SoundSettingsComponent {
    protected readonly noSound = NO_SOUND;
    protected readonly settings = signal<FeedbackSettings | undefined>(undefined);
    protected readonly failed = signal(false);
    protected readonly picking = signal<string | undefined>(undefined);
    protected readonly editing = signal<Editing | undefined>(undefined);
    protected readonly showSounds = signal(false);

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

    protected soundOf(id: string): Sound | undefined {
        return this.settings()?.sounds.find((sound) => sound.id === id);
    }

    protected chosenFor(event: string): string | undefined {
        return this.settings()?.events.find((row) => row.event === event)?.soundId;
    }

    protected inUse(id: string): boolean {
        return this.settings()?.events.some((row) => row.soundId === id) ?? false;
    }

    protected choose(event: string, soundId: string): void {
        this.picking.set(undefined);
        this.api
            .setFeedbackSound(event, soundId)
            .pipe(
                tap((settings) => this.settings.set(settings)),
                tap(() => soundId !== NO_SOUND && this.play(soundId))
            )
            .subscribe();
    }

    protected startNew(event?: string): void {
        this.picking.set(undefined);
        this.editing.set({ forEvent: event });
    }

    protected saved({ settings, soundId, copy }: SoundSaved): void {
        const event = this.editing()?.forEvent;
        const copied = copy ? settings.sounds.find((sound) => sound.id === soundId) : undefined;
        this.editing.set(copied ? { sound: copied } : undefined);
        this.settings.set(settings);
        if (event && soundId) {
            this.choose(event, soundId);
        }
    }

    protected play(soundId: string): void {
        this.api.testSound(soundId).subscribe();
    }
}

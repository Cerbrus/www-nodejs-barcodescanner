import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Injector,
    afterNextRender,
    computed,
    effect,
    inject,
    input,
    linkedSignal,
    output,
    signal,
    viewChild
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, finalize, tap } from 'rxjs';

import { BLOCK_KINDS, MAX_SOUND_MILLISECONDS, SOUND_RATES, Sound, SoundBlock } from '@barcodescanner/shared';

import { FeedbackSettings } from '../../models';
import { ApiService } from '../../services/api.service';
import { SheetComponent } from '../sheet/sheet.component';
import { SoundTimelineComponent } from '../sound-timeline/sound-timeline.component';

export interface SoundSaved {
    settings: FeedbackSettings;
    soundId?: string;
    copy?: boolean;
}

const MAX_NAME_LENGTH = 40;

const DURATIONS = [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900,
    1000
];

const NEW_BLOCK: Record<SoundBlock['kind'], SoundBlock> = {
    beep: { kind: 'beep', ms: 100 },
    pause: { kind: 'pause', ms: 100 },
    trill: { kind: 'trill', ms: 300, rate: 20 },
    buzz: { kind: 'buzz', ms: 300, rate: 400 }
};

@Component({
    selector: 'app-sound-editor',
    standalone: true,
    imports: [TranslatePipe, SheetComponent, SoundTimelineComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sound-editor.component.html',
    styleUrl: './sound-editor.component.scss'
})
export class SoundEditorComponent {
    public readonly sound = input<Sound>();
    public readonly shownName = input('');
    public readonly inUse = input(false);
    public readonly selectName = input(false);
    public readonly saved = output<SoundSaved>();
    public readonly closed = output<void>();

    protected readonly kinds = BLOCK_KINDS;
    protected readonly rates = SOUND_RATES;
    protected readonly maxMilliseconds = MAX_SOUND_MILLISECONDS;
    protected readonly durations = DURATIONS;
    protected readonly maxNameLength = MAX_NAME_LENGTH;
    protected readonly name = linkedSignal(() => this.shownName());
    protected readonly blocks = linkedSignal<Array<SoundBlock>>(() => this.sound()?.blocks ?? [NEW_BLOCK.beep]);
    protected readonly busy = signal(false);
    protected readonly total = computed(() => this.blocks().reduce((sum, block) => sum + block.ms, 0));
    protected readonly problem = computed(() => {
        if (this.total() > MAX_SOUND_MILLISECONDS) {
            return 'sound.tooLong';
        }

        return this.blocks().some((block) => block.kind !== 'pause') ? undefined : 'sound.needsSound';
    });

    protected readonly canSave = computed(() => !this.problem() && this.name().trim());

    private readonly api = inject(ApiService);
    private readonly translate = inject(TranslateService);
    private readonly injector = inject(Injector);
    private readonly nameField = viewChild.required<ElementRef<HTMLInputElement>>('nameField');

    constructor() {
        effect(() => {
            if (this.selectName() && this.sound()) {
                afterNextRender(
                    () => {
                        const field = this.nameField().nativeElement;
                        field.focus();
                        field.select();
                    },
                    { injector: this.injector }
                );
            }
        });
    }

    protected durationStep(ms: number): number {
        const closest = DURATIONS.reduce((best, duration) =>
            Math.abs(duration - ms) < Math.abs(best - ms) ? duration : best
        );

        return DURATIONS.indexOf(closest);
    }

    protected change(index: number, field: 'ms' | 'rate', value: string | number): void {
        this.blocks.update((blocks) =>
            blocks.map((block, at) => (at === index ? { ...block, [field]: Number(value) } : block))
        );
    }

    protected changeKind(index: number, value: string): void {
        const kind = this.kinds.find((candidate) => candidate === value) ?? 'beep';
        const { ms } = this.blocks()[index];
        this.blocks.update((blocks) => blocks.map((block, at) => (at === index ? { ...NEW_BLOCK[kind], ms } : block)));
    }

    protected add(kind: SoundBlock['kind']): void {
        this.blocks.update((blocks) => [...blocks, NEW_BLOCK[kind]]);
    }

    protected remove(index: number): void {
        this.blocks.update((blocks) => blocks.filter((_, at) => at !== index));
    }

    protected move(index: number, by: number): void {
        this.blocks.update((blocks) => {
            const moved = [...blocks];
            [moved[index], moved[index + by]] = [moved[index + by], moved[index]];
            return moved;
        });
    }

    protected play(): void {
        this.api.testSoundBlocks(this.blocks()).subscribe();
    }

    protected save(asNew: boolean): void {
        const sound = this.sound();
        const name = this.name().trim();
        if (!sound) {
            this.finish(this.api.createSound(name, this.blocks()), true);
        } else if (asNew) {
            const suffix = this.translate.instant('sound.copySuffix') as string;
            const copyName = `${name.slice(0, MAX_NAME_LENGTH - suffix.length - 1)} ${suffix}`;
            this.finish(this.api.createSound(copyName, this.blocks()), true, true);
        } else {
            const keepName = !sound.name && name === this.shownName();
            this.finish(this.api.changeSound(sound.id, keepName ? undefined : name, this.blocks()), false);
        }
    }

    protected delete(): void {
        const sound = this.sound();
        if (sound) {
            this.finish(this.api.deleteSound(sound.id), false);
        }
    }

    private finish(request: Observable<FeedbackSettings>, created: boolean, copy = false): void {
        this.busy.set(true);
        request
            .pipe(
                tap((settings) =>
                    this.saved.emit({ settings, soundId: created ? settings.sounds.at(-1)?.id : undefined, copy })
                ),
                finalize(() => this.busy.set(false))
            )
            .subscribe();
    }
}

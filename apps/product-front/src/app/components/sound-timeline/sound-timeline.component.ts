import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MAX_SOUND_MILLISECONDS, SoundBlock } from '../../models';

interface Wave {
    kind: SoundBlock['kind'];
    path: string;
}

const MIDDLE = 20;
const AMPLITUDE = 16;
const SAMPLES_PER_CYCLE = 8;

interface Density {
    sine: number;
    tooth: number;
}

const DETAILED: Density = { sine: 25, tooth: 8 };
const COMPACT: Density = { sine: 90, tooth: 40 };

const point = (x: number, y: number): string => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;

function sine(start: number, ms: number, density: Density): Array<string> {
    const cycles = Math.max(1, Math.round(ms / density.sine));
    const samples = cycles * SAMPLES_PER_CYCLE;

    return Array.from({ length: samples + 1 }, (_, index) =>
        point(start + (ms * index) / samples, MIDDLE - AMPLITUDE * Math.sin((2 * Math.PI * cycles * index) / samples))
    );
}

function trill(start: number, ms: number, rate: number, density: Density): Array<string> {
    const beats = Math.max(1, Math.round((rate * ms) / 1000));
    const period = ms / beats;

    return Array.from({ length: beats }, (_, beat) => {
        const from = start + beat * period;
        return [...sine(from, period / 2, density), point(from + period, MIDDLE)];
    }).flat();
}

function sawtooth(start: number, ms: number, rate: number, density: Density): Array<string> {
    const teeth = Math.max(1, Math.round(Math.min((rate * ms) / 1000, ms / density.tooth)));
    const width = ms / teeth;

    return Array.from({ length: teeth }, (_, tooth) => {
        const from = start + tooth * width;
        return [point(from, MIDDLE + AMPLITUDE), point(from + width, MIDDLE - AMPLITUDE)];
    }).flat();
}

function pointsOf({ kind, ms, rate }: SoundBlock, start: number, density: Density): Array<string> {
    if (kind === 'beep') {
        return sine(start, ms, density);
    }
    if (kind === 'trill') {
        return trill(start, ms, rate ?? 1, density);
    }
    if (kind === 'buzz') {
        return sawtooth(start, ms, rate ?? 1, density);
    }

    return [point(start, MIDDLE), point(start + ms, MIDDLE)];
}

function waves(blocks: Array<SoundBlock>, density: Density): Array<Wave> {
    let x = 0;

    return blocks.map((block) => {
        const start = x;
        x += block.ms;

        return { kind: block.kind, path: `M${pointsOf(block, start, density).join(' L')}` };
    });
}

@Component({
    selector: 'app-sound-timeline',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <svg [attr.viewBox]="'0 0 ' + scale + ' 40'" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="20" [attr.x2]="scale" y2="20" class="base" />
            @for (wave of waves(); track $index) {
                <path [attr.d]="wave.path" [class]="wave.kind" />
            }
        </svg>
    `,
    styles: `
        :host {
            display: block;
            height: 18px;
        }
        svg {
            width: 100%;
            height: 100%;
            overflow: visible;
        }
        path {
            fill: none;
            stroke: var(--accent);
            stroke-width: 1.5;
            stroke-linejoin: round;
            vector-effect: non-scaling-stroke;
        }
        path.buzz {
            stroke: var(--danger);
        }
        path.pause {
            stroke: var(--text-muted);
        }
        .base {
            stroke: var(--line);
            stroke-width: 1;
            vector-effect: non-scaling-stroke;
        }
    `
})
export class SoundTimelineComponent {
    public readonly blocks = input.required<Array<SoundBlock>>();
    public readonly compact = input(false);

    protected readonly waves = computed(() => waves(this.blocks(), this.compact() ? COMPACT : DETAILED));
    protected readonly scale = MAX_SOUND_MILLISECONDS;
}

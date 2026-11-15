import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MAX_SOUND_MILLISECONDS, SoundBlock } from '../../models';

interface Bar {
    x: number;
    width: number;
    kind: SoundBlock['kind'];
}

const MAX_STRIPES_PER_BLOCK = 80;

function bars(blocks: Array<SoundBlock>): Array<Bar> {
    let x = 0;

    return blocks.flatMap((block) => {
        const start = x;
        x += block.ms;
        if (block.kind === 'pause') {
            return [];
        }
        if (block.kind !== 'trill') {
            return [{ x: start, width: block.ms, kind: block.kind }];
        }

        const stripes = Math.min(MAX_STRIPES_PER_BLOCK, Math.max(1, Math.round(((block.rate ?? 1) * block.ms) / 1000)));
        const period = block.ms / stripes;

        return Array.from({ length: stripes }, (_, index) => ({
            x: start + index * period,
            width: period / 2,
            kind: block.kind
        }));
    });
}

@Component({
    selector: 'app-sound-timeline',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <svg [attr.viewBox]="'0 0 ' + scale + ' 40'" preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <pattern id="sound-buzz" width="8" height="40" patternUnits="userSpaceOnUse">
                    <rect width="4" height="40" class="sounding" />
                </pattern>
            </defs>
            <line x1="0" y1="39" [attr.x2]="scale" y2="39" class="base" />
            @for (bar of bars(); track $index) {
                <rect
                    [attr.x]="bar.x"
                    [attr.width]="bar.width"
                    [attr.y]="bar.kind === 'beep' ? 4 : 10"
                    [attr.height]="bar.kind === 'beep' ? 36 : 30"
                    [attr.fill]="bar.kind === 'buzz' ? 'url(#sound-buzz)' : null"
                    [class.sounding]="bar.kind !== 'buzz'"
                />
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
        }
        .sounding {
            fill: var(--accent);
        }
        .base {
            stroke: var(--line);
            stroke-width: 2;
            vector-effect: non-scaling-stroke;
        }
    `
})
export class SoundTimelineComponent {
    public readonly blocks = input.required<Array<SoundBlock>>();

    protected readonly bars = computed(() => bars(this.blocks()));
    protected readonly scale = MAX_SOUND_MILLISECONDS;
}

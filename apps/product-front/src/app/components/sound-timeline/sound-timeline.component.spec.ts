import { TestBed } from '@angular/core/testing';

import { SoundBlock } from '../../models';
import { SoundTimelineComponent } from './sound-timeline.component';

describe('SoundTimelineComponent', () => {
    const draw = (blocks: Array<SoundBlock>, compact = false): Array<{ kind: string; d: string }> => {
        const fixture = TestBed.createComponent(SoundTimelineComponent);
        fixture.componentRef.setInput('blocks', blocks);
        fixture.componentRef.setInput('compact', compact);
        fixture.detectChanges();

        return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('path'), (path) => ({
            kind: path.getAttribute('class') ?? '',
            d: path.getAttribute('d') ?? ''
        }));
    };
    const points = (d: string): Array<[number, number]> =>
        d
            .slice(1)
            .split(' L')
            .map((pair) => pair.split(' ').map(Number) as [number, number]);

    it('draws each block as its own wave, one after the other on a one second scale', () => {
        const waves = draw([
            { kind: 'beep', ms: 100 },
            { kind: 'pause', ms: 300 },
            { kind: 'trill', ms: 200, rate: 20 },
            { kind: 'buzz', ms: 100, rate: 400 }
        ]);

        expect(waves.map((wave) => wave.kind)).toEqual(['beep', 'pause', 'trill', 'buzz']);
        expect(waves.map((wave) => [points(wave.d)[0][0], points(wave.d).at(-1)?.[0]])).toEqual([
            [0, 100],
            [100, 400],
            [400, 600],
            [400 + 200, 700]
        ]);
    });

    it('draws a beep as a sine, a pause flat, a trill in bursts and a buzz as a sawtooth', () => {
        const [beep, pause, trill, buzz] = draw([
            { kind: 'beep', ms: 50 },
            { kind: 'pause', ms: 50 },
            { kind: 'trill', ms: 100, rate: 20 },
            { kind: 'buzz', ms: 40, rate: 100 }
        ]).map((wave) => points(wave.d));

        expect(new Set(beep.map(([, y]) => y)).size).toBeGreaterThan(3);
        expect(pause.map(([, y]) => y)).toEqual([20, 20]);
        expect(trill.filter(([, y]) => y === 20).length).toBeGreaterThan(4);
        expect(buzz.map(([, y]) => y)).toEqual([36, 4, 36, 4, 36, 4, 36, 4]);
    });

    it('draws fewer waves in a small timeline, so the shapes stay visible', () => {
        const detailed = draw([{ kind: 'beep', ms: 500 }]).map((wave) => points(wave.d).length);
        const compact = draw([{ kind: 'beep', ms: 500 }], true).map((wave) => points(wave.d).length);

        expect(compact[0]).toBeLessThan(detailed[0] / 3);
    });
});

import { TestBed } from '@angular/core/testing';

import { SoundBlock } from '../../models';
import { SoundTimelineComponent } from './sound-timeline.component';

describe('SoundTimelineComponent', () => {
    const draw = (blocks: Array<SoundBlock>): Array<Element> => {
        const fixture = TestBed.createComponent(SoundTimelineComponent);
        fixture.componentRef.setInput('blocks', blocks);
        fixture.detectChanges();

        return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('svg > rect'));
    };

    it('draws a bar per beep, nothing for a pause, on a two second scale', () => {
        const bars = draw([
            { kind: 'beep', ms: 100 },
            { kind: 'pause', ms: 300 },
            { kind: 'beep', ms: 50 }
        ]);

        expect(bars.map((bar) => [bar.getAttribute('x'), bar.getAttribute('width')])).toEqual([
            ['0', '100'],
            ['400', '50']
        ]);
    });

    it('draws a stripe per beat of a trill and hatching for a buzz', () => {
        const bars = draw([
            { kind: 'trill', ms: 500, rate: 10 },
            { kind: 'buzz', ms: 200, rate: 400 }
        ]);

        expect(bars.length).toBe(6);
        expect(bars[1].getAttribute('x')).toBe('100');
        expect(bars[5].getAttribute('fill')).toBe('url(#sound-buzz)');
    });
});

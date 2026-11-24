import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OverflowingDirective } from './overflowing.directive';

@Component({
    standalone: true,
    imports: [OverflowingDirective],
    template: '<div id="strip" appOverflowing></div>'
})
class HostComponent {}

describe('OverflowingDirective', () => {
    let measure: () => void;
    const disconnect = vi.fn();

    beforeEach(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                public disconnect = disconnect;

                constructor(callback: () => void) {
                    measure = callback;
                }

                public observe(): void {
                    return undefined;
                }
            }
        );
    });

    afterEach(() => vi.unstubAllGlobals());

    it('marks the element while its content is wider than itself, and stops watching when it goes', async () => {
        const fixture = TestBed.createComponent(HostComponent);
        await fixture.whenStable();
        const strip = fixture.nativeElement.querySelector('#strip') as HTMLElement;
        const sizes = { scrollWidth: 200, clientWidth: 100 };
        Object.defineProperty(strip, 'scrollWidth', { get: () => sizes.scrollWidth });
        Object.defineProperty(strip, 'clientWidth', { get: () => sizes.clientWidth });

        measure();
        await fixture.whenStable();
        expect(strip.classList.contains('overflowing')).toBe(true);

        sizes.clientWidth = 200;
        measure();
        await fixture.whenStable();
        expect(strip.classList.contains('overflowing')).toBe(false);

        fixture.destroy();
        expect(disconnect).toHaveBeenCalledTimes(1);
    });
});

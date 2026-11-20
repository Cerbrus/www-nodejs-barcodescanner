import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { FocusOnShowDirective } from './focus-on-show.directive';

@Component({
    standalone: true,
    imports: [FocusOnShowDirective],
    templateUrl: './focus-on-show.directive.spec.html'
})
class HostComponent {
    public readonly asking = signal(false);
}

describe('FocusOnShowDirective', () => {
    it('focuses the element when it appears, so Enter presses it', async () => {
        const fixture = TestBed.createComponent(HostComponent);
        document.body.appendChild(fixture.nativeElement);
        await fixture.whenStable();
        expect(fixture.nativeElement.querySelector('#confirm')).toBeNull();

        fixture.componentInstance.asking.set(true);
        await fixture.whenStable();

        expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#confirm'));
        fixture.nativeElement.remove();
    });
});

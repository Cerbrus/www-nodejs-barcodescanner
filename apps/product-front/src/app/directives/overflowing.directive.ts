import { DestroyRef, Directive, ElementRef, afterNextRender, inject, signal } from '@angular/core';

@Directive({
    selector: '[appOverflowing]',
    standalone: true,
    host: { '[class.overflowing]': 'overflowing()' }
})
export class OverflowingDirective {
    protected readonly overflowing = signal(false);

    constructor() {
        const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
        const destroyed = inject(DestroyRef);

        afterNextRender(() => {
            const observer = new ResizeObserver(() => this.overflowing.set(element.scrollWidth > element.clientWidth));

            observer.observe(element);
            destroyed.onDestroy(() => observer.disconnect());
        });
    }
}

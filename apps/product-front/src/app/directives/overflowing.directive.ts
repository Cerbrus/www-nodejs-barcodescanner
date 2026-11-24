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
            const observer = new ResizeObserver(() => {
                const overflowing = element.scrollWidth > element.clientWidth;

                this.overflowing.set(overflowing);
                if (overflowing) {
                    element.style.setProperty('--fit', `${this.lastFullEdge(element)}px`);
                } else {
                    element.style.removeProperty('--fit');
                }
            });

            observer.observe(element);
            destroyed.onDestroy(() => observer.disconnect());
        });
    }

    private lastFullEdge(element: HTMLElement): number {
        return Array.from(element.children, (child) => {
            const { offsetLeft, offsetWidth } = child as HTMLElement;

            return offsetLeft + offsetWidth;
        })
            .filter((edge) => edge <= element.clientWidth)
            .reduce((last, edge) => Math.max(last, edge), 0);
    }
}

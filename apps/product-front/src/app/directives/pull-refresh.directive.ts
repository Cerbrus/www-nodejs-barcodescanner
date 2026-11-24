import { DestroyRef, Directive, ElementRef, inject, output, signal } from '@angular/core';

const PULL_THRESHOLD_PIXELS = 70;
const PULL_RESISTANCE = 0.5;

@Directive({
    selector: '[appPullRefresh]',
    standalone: true,
    host: {
        '[class.pulling]': 'pull() > 0',
        '[style.--pull]': 'pull() + "px"',
        '[attr.data-pull-ready]': 'pull() >= threshold ? "" : null'
    }
})
export class PullRefreshDirective {
    public readonly pulled = output<void>();

    protected readonly pull = signal(0);
    protected readonly threshold = PULL_THRESHOLD_PIXELS;

    private startY: number | undefined;

    constructor() {
        const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
        const destroyed = inject(DestroyRef);
        const start = (event: TouchEvent): void => {
            this.startY = element.scrollTop <= 0 && event.touches.length === 1 ? event.touches[0].clientY : undefined;
        };
        const move = (event: TouchEvent): void => {
            if (this.startY === undefined) {
                return;
            }
            const distance = (event.touches[0].clientY - this.startY) * PULL_RESISTANCE;
            if (distance <= 0 || element.scrollTop > 0) {
                this.pull.set(0);
                return;
            }
            this.pull.set(distance);
            if (event.cancelable) {
                event.preventDefault();
            }
        };
        const end = (): void => {
            const ready = this.pull() >= PULL_THRESHOLD_PIXELS;
            this.startY = undefined;
            this.pull.set(0);
            if (ready) {
                this.pulled.emit();
            }
        };

        element.addEventListener('touchstart', start, { passive: true });
        element.addEventListener('touchmove', move, { passive: false });
        element.addEventListener('touchend', end);
        element.addEventListener('touchcancel', end);
        destroyed.onDestroy(() => {
            element.removeEventListener('touchstart', start);
            element.removeEventListener('touchmove', move);
            element.removeEventListener('touchend', end);
            element.removeEventListener('touchcancel', end);
        });
    }
}

import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

import { describeElement, isTextField } from '../../services/remark-target';
import { RemarkService } from '../../services/remark.service';

const TWO_FINGER_TAP_MILLISECONDS = 350;
const TWO_FINGER_TAP_PIXELS = 24;

interface TwoFingerTouch {
    startedAt: number;
    x: number;
    y: number;
    moved: boolean;
}

@Directive({
    selector: '[appRemarkPointer]',
    standalone: true
})
export class RemarkPointerDirective {
    private readonly remarks = inject(RemarkService);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    private touch?: TwoFingerTouch;

    constructor() {
        const listeners: Array<[keyof HTMLElementEventMap, (event: Event) => void, AddEventListenerOptions]> = [
            ['click', (event): void => this.onClick(event), { capture: true }],
            ['contextmenu', (event): void => this.onContextMenu(event), {}],
            ['touchstart', (event): void => this.onTouchStart(event as TouchEvent), { passive: true }],
            ['touchmove', (event): void => this.onTouchMove(event as TouchEvent), { passive: true }],
            ['touchend', (event): void => this.onTouchEnd(event as TouchEvent), {}],
            ['touchcancel', (): void => this.forgetTouch(), { passive: true }]
        ];

        for (const [type, listener, options] of listeners) {
            this.host.addEventListener(type, listener, options);
        }
        inject(DestroyRef).onDestroy(() => {
            for (const [type, listener, options] of listeners) {
                this.host.removeEventListener(type, listener, options);
            }
        });
    }

    private forgetTouch(): void {
        this.touch = undefined;
    }

    private onClick(event: Event): void {
        if (!this.remarks.pointing() || !(event.target instanceof Element)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.remarks.write(describeElement(event.target));
    }

    private onContextMenu(event: Event): void {
        if (!(event.target instanceof Element) || isTextField(event.target)) {
            return;
        }

        event.preventDefault();
        this.remarks.write(describeElement(event.target));
    }

    private onTouchStart(event: TouchEvent): void {
        if (event.touches.length !== 2) {
            this.touch = undefined;
            return;
        }

        const [first, second] = [event.touches[0], event.touches[1]];
        this.touch = { startedAt: Date.now(), x: (first.clientX + second.clientX) / 2, y: (first.clientY + second.clientY) / 2, moved: false };
    }

    private onTouchMove(event: TouchEvent): void {
        const touch = this.touch;
        if (!touch || event.touches.length !== 2) {
            return;
        }

        const x = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const y = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        touch.moved = touch.moved || Math.hypot(x - touch.x, y - touch.y) > TWO_FINGER_TAP_PIXELS;
    }

    private onTouchEnd(event: TouchEvent): void {
        const touch = this.touch;
        if (!touch || event.touches.length) {
            return;
        }

        this.touch = undefined;
        const element = document.elementFromPoint(touch.x, touch.y);
        if (touch.moved || Date.now() - touch.startedAt > TWO_FINGER_TAP_MILLISECONDS || !element || !this.host.contains(element)) {
            return;
        }

        event.preventDefault();
        this.remarks.write(describeElement(element));
    }
}

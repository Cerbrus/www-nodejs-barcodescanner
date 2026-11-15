import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

import { describeElement, isTextField } from '../../services/remark-target';
import { RemarkService } from '../../services/remark.service';

@Directive({
    selector: '[appRemarkPointer]',
    standalone: true
})
export class RemarkPointerDirective {
    private readonly remarks = inject(RemarkService);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

    constructor() {
        const listeners: Array<[keyof HTMLElementEventMap, (event: Event) => void, AddEventListenerOptions]> = [
            ['click', (event): void => this.onClick(event), { capture: true }],
            ['contextmenu', (event): void => this.onContextMenu(event), {}]
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
}

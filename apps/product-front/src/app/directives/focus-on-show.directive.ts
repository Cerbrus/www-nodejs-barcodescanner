import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

@Directive({
    selector: '[appFocusOnShow]',
    standalone: true
})
export class FocusOnShowDirective {
    constructor() {
        const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

        afterNextRender(() => element.focus());
    }
}

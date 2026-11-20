import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    afterNextRender,
    inject,
    output,
    viewChild
} from '@angular/core';

@Component({
    selector: 'app-sheet',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sheet.component.html'
})
export class SheetComponent {
    public readonly closed = output<void>();

    private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

    constructor() {
        afterNextRender(() => this.dialog().nativeElement.showModal());
        inject(DestroyRef).onDestroy(() => this.dialog().nativeElement.close());
    }

    protected onClick(event: MouseEvent): void {
        if (event.target === this.dialog().nativeElement) {
            this.closed.emit();
        }
    }
}

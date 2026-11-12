import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-checkbox',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './checkbox.component.html',
    styleUrl: './checkbox.component.scss'
})
export class CheckboxComponent {
    @Input() public disabled = false;
    @Input() public checked = false;
    @Input() public partial = false;
    @Output() public checkedChange: EventEmitter<boolean> = new EventEmitter<boolean>();

    protected onCheckChange(value: boolean): void {
        const change = value !== this.checked;
        this.checked = value;
        if (change) {
            this.checkedChange.emit(value);
        }
    }
}

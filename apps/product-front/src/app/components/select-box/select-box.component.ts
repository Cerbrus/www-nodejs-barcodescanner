import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';

export interface SelectBoxOption<T> {
    id: string;
    item: T;
    label?: Observable<string>;
}

@Component({
    selector: 'app-select-box',
    standalone: true,
    imports: [CommonModule, TranslateModule],
    templateUrl: './select-box.component.html',
    styleUrl: './select-box.component.scss'
})
export class SelectBoxComponent<T> {
    @Input() public options: Array<SelectBoxOption<T>> = [];
    @Input() public selected?: SelectBoxOption<T>;
    @Output() public selectOption = new EventEmitter<SelectBoxOption<T>>();

    @Input() public groupBySettings?: { labelKey: string; groupBy: (option: SelectBoxOption<T>) => unknown };

    protected get groupedOptions(): Array<{ label: string; options: Array<SelectBoxOption<T>> }> {
        if (!this.groupBySettings) return [];

        const settings = this.groupBySettings;

        return this.options.reduce((groups, option) => {
            const optionKey = settings.groupBy(option);
            const group = groups.find((g) => settings.groupBy(g.options[0]) === optionKey);
            if (group) {
                group.options.push(option);
            } else {
                groups.push({ label: `${settings.labelKey}.${optionKey}`, options: [option] });
            }

            return groups;
        }, [] as Array<{ label: string; options: Array<SelectBoxOption<T>> }>);
    }

    protected onChange(id: string): void {
        const option = this.options.find((o) => o.id === id);
        if (option) this.selectOption.emit(option);
    }
}

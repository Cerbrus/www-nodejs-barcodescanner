import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { IPaginatedRequest, ISortingModel, TSortDirection } from '../../utils/request.utils';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { PageSelectorComponent } from '../page-selector/page-selector.component';
import { SelectBoxComponent, SelectBoxOption } from '../select-box/select-box.component';
import { SpinnerComponent } from '../spinner/spinner.component';

export type TableColumnType = 'text' | 'label';

export interface ITableColumn<T> {
    key: keyof T;
    label: string;
    sortable?: boolean;
    enabled?: boolean;
    type?: TableColumnType;
}

type RowModel = { id: unknown };

@Component({
    selector: 'app-paginated-table',
    standalone: true,
    imports: [TranslateModule, PageSelectorComponent, CheckboxComponent, SelectBoxComponent, SpinnerComponent],
    templateUrl: './paginated-table.component.html',
    styleUrl: './paginated-table.component.scss'
})
export class PaginatedTableComponent<T extends RowModel> implements OnInit, OnChanges {
    public get rows(): Array<T> {
        return this._rows;
    }

    @Input()
    public set rows(value: Array<T>) {
        this.loading = false;
        this._rows = value;
    }

    private _rows: Array<T> = [];
    @Input() public total = 0;
    @Input() public start = 0;
    @Input() public sort: Array<ISortingModel<T>> = [];
    @Input() public columns: Array<ITableColumn<T>> = [];

    @Output() public readonly requestData = new EventEmitter<IPaginatedRequest<T>>();

    @Output() public readonly rowClick = new EventEmitter<{ data: T; event: MouseEvent }>();

    protected pageTotal = 0;
    protected pageIndex = 0;
    protected loading = true;
    protected selectedRows: Array<unknown> = [];
    protected readonly stepOptions: Array<SelectBoxOption<number>>;
    protected stepOption: SelectBoxOption<number> | undefined;
    protected gridTemplateColumns = '3rem';

    protected readonly String = String;

    private get step(): number {
        return this.stepOption?.item ?? 0;
    }

    constructor(private translate: TranslateService) {
        this.stepOptions = [10, 15, 20, 30, 40, 50].map((count) => ({
            id: count.toString(),
            item: count,
            label: this.translate.stream('PaginatedTableComponent.stepOption', { step: count })
        }));
        this.stepOption = this.stepOptions[2];
    }

    public ngOnInit(): void {
        this.requestDataEmit(this.start, this.step, this.sort);
    }

    public ngOnChanges(): void {
        this.pageTotal = Math.ceil(this.total / this.step);
        this.pageIndex = Math.floor(this.start / this.step);
        this.gridTemplateColumns = `3rem repeat(${this.columns.filter((c) => c.enabled).length}, 1fr)`;
    }

    protected onRowCheck(row: T, checked: boolean): void {
        const currentlySelectedIndex = this.selectedRows.indexOf(row.id);
        if (checked && currentlySelectedIndex === -1) {
            this.selectedRows.push(row.id);
        }
        if (!checked && currentlySelectedIndex >= 0) {
            this.selectedRows.splice(currentlySelectedIndex, 1);
        }
    }

    protected onRowClick(data: T, event: MouseEvent): void {
        this.rowClick.emit({ data, event });
    }

    protected getSortState(column: keyof T): TSortDirection | undefined {
        return this.sort.find((s) => s.property === column)?.direction;
    }

    protected toggleSortState(column: ITableColumn<T>): void {
        if (!(column.enabled && column.sortable)) return;

        const currentSortState = this.sort.find((s) => s.property === column.key);

        if (!currentSortState) {
            // This column isn't currently being sorted, add it to the sorting. Order will be set at the end
            this.sort.push({ property: column.key, direction: 'asc', order: null! });
        } else if (currentSortState.direction === 'asc') {
            // This column is currently being sorted in ascending order, invert the sort.
            currentSortState.direction = 'desc';
        } else {
            // This column is currently being sorted in descending order, remove it from the sorting.
            this.sort = this.sort.filter((s) => s.property !== column.key);
        }

        // Reset order properties on the currently active sorts.
        this.sort.forEach((s, index) => (s.order = index));

        this.requestDataEmit(this.start, this.step, this.sort);
    }

    protected getRotation(sort: TSortDirection | undefined): string {
        return `${sort === 'asc' ? 180 : 0}deg`;
    }

    protected goToPage(page: number): void {
        this.requestDataEmit(page * this.step, this.step, this.sort);
    }

    protected getBulkSelectMode(): 'all' | 'partial' | 'none' {
        if (this._rows.length === 0 && this.selectedRows.length === 0) return 'none';
        if (this._rows.every((r) => this.selectedRows.includes(r.id))) return 'all';
        return this.selectedRows.length ? 'partial' : 'none';
    }

    protected onBulkSelect(selected: boolean): void {
        if (selected) {
            this._rows
                .map((r) => r.id)
                .filter((id) => !this.selectedRows.includes(id))
                .forEach((id) => this.selectedRows.push(id));
        } else {
            this.selectedRows = [];
        }
    }

    protected setStepSize(step: number): void {
        if (this.step === step) return;
        this.stepOption = this.stepOptions.find((o) => o.item === step);
        this.requestDataEmit(this.start, this.step, this.sort);
    }

    protected getVisibleRows(): { start: number; end: number } {
        return {
            start: this.start + 1,
            end: Math.min(this.start + this.step, this.total)
        };
    }

    private requestDataEmit(start: number, step: number, sort: Array<ISortingModel<T>>): void {
        this.loading = true;
        this.requestData.emit({ pagination: { start, step }, sort });
    }
}

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

interface PageIndicator {
    index?: number;
    active: boolean;
    label: string;
}

@Component({
    selector: 'app-page-selector',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './page-selector.component.html',
    styleUrl: './page-selector.component.scss'
})
export class PageSelectorComponent implements OnChanges {
    @Input() public total = 0;
    @Input() public pageIndex = 0;

    @Output() public readonly navigateTo = new EventEmitter<number>();

    protected pages: Array<PageIndicator> = [];

    public ngOnChanges(): void {
        // Clamp the input to valid ranges
        this.pageIndex = Math.max(Math.min(this.pageIndex, this.total - 1), 0);
        this.total = Math.max(this.total, 0);
        // Calculate which indices to show indicators for
        let midrange = 2;
        if (this.pageIndex < 3 || this.pageIndex > this.total - 2) midrange++;
        let start = Math.max(0, this.pageIndex - Math.ceil(midrange / 2));
        let end = Math.min(this.total - 1, start + midrange);
        if (end >= this.total - 1) {
            const diff = end - (this.total - 1);
            start = Math.max(0, start - diff);
            end = this.total - 1;
        }
        const midRangeIndices = Array.from({ length: end - start + 1 }, (_, i) => i + start);
        const indices = [...new Set([0, ...midRangeIndices, this.total - 1])]
            .sort((a, b) => a - b)
            .filter((i) => i >= 0);

        // Generate the indicators
        this.pages = indices.map((i) => ({
            index: i,
            active: i === this.pageIndex,
            label: (i + 1).toString()
        }));

        // Add ellipses if necessary
        if (this.pages.length >= 2 && this.pages.at(0)!.index! + 1 < this.pages.at(1)!.index!) {
            this.pages.splice(1, 0, { label: '...', active: false });
        }
        if (
            this.pages.length >= 4 &&
            this.pages.at(this.pages.length - 2)!.index! + 1 < this.pages.at(this.pages.length - 1)!.index!
        ) {
            this.pages.splice(this.pages.length - 1, 0, { label: '...', active: false });
        }
    }

    protected trackPageBy(index: number, item: PageIndicator): string | number {
        return item.index ?? item.label + index.toString(10);
    }

    protected canGoNext(): boolean {
        return this.pageIndex < this.total - 1;
    }

    protected canGoBack(): boolean {
        return this.pageIndex > 0;
    }

    protected navigate(index: number | undefined): void {
        if (index !== undefined && index >= 0 && index < this.total) this.navigateTo.emit(index);
    }
}

import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

type TSize = 'w-4 h-4' | 'w-6 h-6' | 'w-8 h-8';

@Component({
    selector: 'app-spinner',
    standalone: true,
    imports: [TranslateModule],
    templateUrl: './spinner.component.html',
    styleUrl: './spinner.component.scss'
})
export class SpinnerComponent {
    @Input()
    public get size(): TSize {
        return this._size;
    }

    public set size(size: 'small' | 'medium' | 'large') {
        this._size = {
            small: 'w-4 h-4',
            medium: 'w-6 h-6',
            large: 'w-8 h-8'
        }[size] as TSize;
    }

    private _size: TSize = 'w-6 h-6';
}

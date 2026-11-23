import { ChangeDetectionStrategy, Component, afterRenderEffect, inject } from '@angular/core';

import { RecipePrintService } from '../../services/recipe-print.service';
import { RecipeCodeComponent } from '../recipe-code/recipe-code.component';

@Component({
    selector: 'app-recipe-print',
    standalone: true,
    imports: [RecipeCodeComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './recipe-print.component.html',
    styleUrl: './recipe-print.component.scss'
})
export class RecipePrintComponent {
    protected readonly printing = inject(RecipePrintService);

    constructor() {
        afterRenderEffect(() => {
            if (this.printing.recipes().length) {
                window.print();
            }
        });
    }
}

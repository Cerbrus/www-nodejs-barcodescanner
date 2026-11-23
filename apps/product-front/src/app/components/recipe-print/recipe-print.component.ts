import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { RecipePrintService } from '../../services/recipe-print.service';
import { SHEET, cutMarks, sheetPages } from '../../services/recipe-sheet-image';
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
    protected readonly pages = computed(() => sheetPages(this.printing.recipes()));
    protected readonly marks = cutMarks().map(({ x, y, width, height }) => ({
        left: x - SHEET.edge,
        top: y - SHEET.edge,
        width,
        height
    }));
}

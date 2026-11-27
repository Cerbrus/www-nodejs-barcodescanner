import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import qrcode from 'qrcode-generator';

import { RecipeContent, writeRecipeCode } from '@barcodescanner/shared';

const QUIET_ZONE = 4;

export function recipeCodeModules(recipe: RecipeContent): Array<Array<boolean>> {
    const code = qrcode(0, 'M');
    code.addData(writeRecipeCode(recipe), 'Byte');
    code.make();
    const size = code.getModuleCount();

    return Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (__, column) => code.isDark(row, column))
    );
}

@Component({
    selector: 'app-recipe-code',
    standalone: true,
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './recipe-code.component.html',
    styleUrl: './recipe-code.component.scss'
})
export class RecipeCodeComponent {
    public readonly recipe = input.required<RecipeContent>();
    public readonly unprintable = input(false);

    protected readonly drawing = computed(() => {
        const modules = recipeCodeModules(this.recipe());
        const path = modules
            .flatMap((row, y) =>
                row.flatMap((dark, x) => (dark ? [`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`] : []))
            )
            .join('');
        const size = modules.length + QUIET_ZONE * 2;

        return { path, viewBox: `0 0 ${size} ${size}` };
    });
}

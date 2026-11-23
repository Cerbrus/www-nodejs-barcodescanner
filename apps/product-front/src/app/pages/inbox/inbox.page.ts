import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { tap } from 'rxjs';

import { NamingPromptComponent } from '../../components/naming-prompt/naming-prompt.component';
import { ShoppingStore } from '../../services/shopping.store';

@Component({
    selector: 'app-inbox-page',
    standalone: true,
    imports: [DatePipe, TranslatePipe, NamingPromptComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './inbox.page.html'
})
export class InboxPage {
    protected readonly store = inject(ShoppingStore);
    protected readonly namingCode = signal<string | undefined>(undefined);

    private readonly router = inject(Router);

    protected saveRecipe(id: number): void {
        this.store
            .saveRecipeOffer(id)
            .pipe(tap((recipe) => void this.router.navigate(['/recipes', recipe.id], { queryParams: { edit: true } })))
            .subscribe();
    }

    protected ignoreRecipe(id: number): void {
        this.store.dropRecipeOffer(id).subscribe();
    }
}

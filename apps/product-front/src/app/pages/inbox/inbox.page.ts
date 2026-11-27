import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { tap } from 'rxjs';

import { ItemIconComponent } from '../../components/item-icon/item-icon.component';
import { NamingPromptComponent } from '../../components/naming-prompt/naming-prompt.component';
import { AuthService } from '../../services/auth.service';
import { ShoppingStore } from '../../services/shopping.store';

@Component({
    selector: 'app-inbox-page',
    standalone: true,
    imports: [DatePipe, RouterLink, TranslatePipe, ItemIconComponent, NamingPromptComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './inbox.page.html'
})
export class InboxPage {
    protected readonly store = inject(ShoppingStore);
    protected readonly namingCode = signal<string | undefined>(undefined);

    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    protected readonly drafts = computed(() =>
        this.auth.owner()
            ? this.store.drafts().map((item) => ({
                  item,
                  section: this.store.sections().find((section) => section.id === item.sectionId)
              }))
            : []
    );

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

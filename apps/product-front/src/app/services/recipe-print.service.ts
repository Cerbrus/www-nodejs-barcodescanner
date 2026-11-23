import { Injectable, signal } from '@angular/core';

import { Recipe } from '../models';

const PRINTING_CLASS = 'printing-recipes';

@Injectable({ providedIn: 'root' })
export class RecipePrintService {
    public readonly recipes = signal<Array<Recipe>>([]);

    constructor() {
        window.addEventListener('afterprint', () => this.done());
    }

    public print(recipes: Array<Recipe>): void {
        document.body.classList.add(PRINTING_CLASS);
        this.recipes.set([...recipes]);
    }

    public done(): void {
        document.body.classList.remove(PRINTING_CLASS);
        this.recipes.set([]);
    }
}

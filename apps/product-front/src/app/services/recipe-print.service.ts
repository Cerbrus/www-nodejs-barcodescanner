import { ApplicationRef, Injectable, inject, signal } from '@angular/core';

import { Recipe } from '../models';
import { sheetImages } from './recipe-sheet-image';

const PRINTING_CLASS = 'printing-recipes';
const IMAGE_TYPE = 'image/png';

@Injectable({ providedIn: 'root' })
export class RecipePrintService {
    public readonly recipes = signal<Array<Recipe>>([]);

    private readonly app = inject(ApplicationRef);

    constructor() {
        window.addEventListener('afterprint', () => this.done());
    }

    public print(recipes: Array<Recipe>): void {
        if (!recipes.length) {
            return;
        }

        const images = this.onHomeScreen() ? this.images(recipes) : [];
        if (images.length && navigator.canShare?.({ files: images })) {
            navigator.share({ files: images }).catch(() => undefined);
            return;
        }

        document.body.classList.add(PRINTING_CLASS);
        this.recipes.set([...recipes]);
        this.app.tick();
        window.print();
    }

    public done(): void {
        document.body.classList.remove(PRINTING_CLASS);
        this.recipes.set([]);
    }

    private onHomeScreen(): boolean {
        return (navigator as { standalone?: boolean }).standalone === true && typeof navigator.share === 'function';
    }

    private images(recipes: Array<Recipe>): Array<File> {
        const style = getComputedStyle(document.documentElement);

        return sheetImages(
            recipes,
            style.getPropertyValue('--print-ink').trim(),
            style.getPropertyValue('--print-paper').trim()
        ).map((image, page) => new File([image], `codes-${page + 1}.png`, { type: IMAGE_TYPE }));
    }
}

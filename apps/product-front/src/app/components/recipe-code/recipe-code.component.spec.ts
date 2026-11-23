import { TestBed } from '@angular/core/testing';
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';

import { RecipeContent, readRecipeCode, writeRecipeCode } from '@barcodescanner/shared';

import { TranslateTesting } from '../../../testing/translate';
import { RecipeCodeComponent, recipeCodeModules } from './recipe-code.component';

const QUIET_ZONE = 4;
const PIXELS_A_MODULE = 4;
const WHITE = 255;

const SMALL: RecipeContent = {
    name: 'Pasta pesto',
    ingredients: [
        { catalogItemId: 45, quantity: 2, note: 'volkoren' },
        { catalogItemId: 87, quantity: 1, note: '' }
    ]
};
const LARGE: RecipeContent = {
    name: 'Crème brûlée voor acht; 100% €',
    ingredients: Array.from({ length: 20 }, (_, index) => ({
        catalogItemId: 100 + index * 17,
        quantity: 1 + (index % 3),
        note: index % 2 ? 'één; twee' : ''
    }))
};

function readBack(modules: Array<Array<boolean>>): string {
    const size = (modules.length + QUIET_ZONE * 2) * PIXELS_A_MODULE;
    const pixels = new Uint8ClampedArray(size * size).fill(WHITE);
    modules.forEach((row, y) =>
        row.forEach((dark, x) => {
            if (!dark) {
                return;
            }
            for (let dy = 0; dy < PIXELS_A_MODULE; dy++) {
                const start = ((y + QUIET_ZONE) * PIXELS_A_MODULE + dy) * size + (x + QUIET_ZONE) * PIXELS_A_MODULE;
                pixels.fill(0, start, start + PIXELS_A_MODULE);
            }
        })
    );

    return new QRCodeReader()
        .decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, size, size))))
        .getText();
}

describe('RecipeCodeComponent', () => {
    it('draws a code that the camera decoder reads back as the recipe code', () => {
        expect(readBack(recipeCodeModules(SMALL))).toBe('R1;Pasta pesto;45*2:volkoren;87');
    });

    it('holds a recipe of twenty products with accents, read back whole', () => {
        const text = readBack(recipeCodeModules(LARGE));

        expect(text).toBe(writeRecipeCode(LARGE));
        expect(readRecipeCode(text)).toEqual(LARGE);
    });

    it('shows the code as a square picture with a quiet edge, named after the recipe', () => {
        TestBed.configureTestingModule({ imports: [RecipeCodeComponent, TranslateTesting] });
        const fixture = TestBed.createComponent(RecipeCodeComponent);
        fixture.componentRef.setInput('recipe', SMALL);
        fixture.detectChanges();
        const picture = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
        const size = recipeCodeModules(SMALL).length + QUIET_ZONE * 2;

        expect(picture.getAttribute('viewBox')).toBe(`0 0 ${size} ${size}`);
        expect(picture.getAttribute('aria-label')).toBe('recipe.code');
        expect(picture.querySelector('path')?.getAttribute('d')).toMatch(/^M4 4h1v1h-1z/);
    });
});

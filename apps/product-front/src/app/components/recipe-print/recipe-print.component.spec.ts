import { ComponentFixture, TestBed } from '@angular/core/testing';

import { texts } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { Recipe } from '../../models';
import { RecipePrintService } from '../../services/recipe-print.service';
import { RecipePrintComponent } from './recipe-print.component';

const recipe = (id: number, name: string): Recipe => ({
    id,
    name,
    description: '',
    category: 'other',
    ingredients: [{ catalogItemId: id, quantity: 1, note: '' }]
});

describe('RecipePrintComponent and RecipePrintService', () => {
    let fixture: ComponentFixture<RecipePrintComponent>;
    let sheet: HTMLElement;
    let printing: RecipePrintService;
    let cellsWhenPrinting: Array<number>;
    let share: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        cellsWhenPrinting = [];
        share = vi.fn(() => Promise.resolve());
        vi.stubGlobal('print', () => cellsWhenPrinting.push(sheet.querySelectorAll('.cell').length));
        TestBed.configureTestingModule({ imports: [RecipePrintComponent, TranslateTesting] });
        printing = TestBed.inject(RecipePrintService);
        fixture = TestBed.createComponent(RecipePrintComponent);
        fixture.autoDetectChanges();
        sheet = fixture.nativeElement as HTMLElement;
    });

    afterEach(() => {
        printing.done();
        vi.unstubAllGlobals();
        Reflect.deleteProperty(navigator, 'standalone');
        Reflect.deleteProperty(navigator, 'share');
        Reflect.deleteProperty(navigator, 'canShare');
    });

    it('holds nothing and prints nothing until recipes are handed over', () => {
        printing.print([]);

        expect(sheet.querySelectorAll('.cell').length).toBe(0);
        expect(cellsWhenPrinting).toEqual([]);
        expect(document.body.classList.contains('printing-recipes')).toBe(false);
    });

    it('has drawn one cell per recipe, with its code and name, by the time the print dialog opens in the same tap', () => {
        printing.print([recipe(1, 'Pannenkoeken'), recipe(2, 'Soep')]);

        expect(cellsWhenPrinting).toEqual([2]);
        expect(texts(sheet, '.cell-name')).toEqual(['Pannenkoeken', 'Soep']);
        expect(sheet.querySelectorAll('.cell app-recipe-code svg').length).toBe(2);
        expect(sheet.querySelectorAll('.leaf').length).toBe(1);
        expect(sheet.querySelectorAll('.leaf .mark').length).toBe(18);
        expect(document.body.classList.contains('printing-recipes')).toBe(true);
    });

    it('starts a new page after twelve codes, each page with its own cut marks', () => {
        printing.print(Array.from({ length: 14 }, (_, index) => recipe(index + 1, `Recept ${index + 1}`)));

        expect(Array.from(sheet.querySelectorAll('.leaf'), (page) => page.querySelectorAll('.cell').length)).toEqual([
            12, 2
        ]);
        expect(sheet.querySelectorAll('.mark').length).toBe(36);
    });

    it('clears the sheet when printing is over, and can print again after that', () => {
        printing.print([recipe(1, 'Pannenkoeken')]);
        window.dispatchEvent(new Event('afterprint'));
        fixture.detectChanges();

        expect(sheet.querySelectorAll('.cell').length).toBe(0);
        expect(document.body.classList.contains('printing-recipes')).toBe(false);

        printing.print([recipe(1, 'Pannenkoeken')]);

        expect(cellsWhenPrinting).toEqual([1, 1]);
    });

    it('prints as usual from the home screen when the sheet cannot be made into a picture', () => {
        Object.assign(navigator, { standalone: true, share, canShare: () => true });

        printing.print([recipe(1, 'Pannenkoeken')]);

        expect(share).not.toHaveBeenCalled();
        expect(cellsWhenPrinting).toEqual([1]);
    });
});

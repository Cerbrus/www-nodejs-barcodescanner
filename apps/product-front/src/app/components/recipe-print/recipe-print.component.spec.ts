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
    ingredients: [{ catalogItemId: id, quantity: 1, note: '' }]
});

describe('RecipePrintComponent', () => {
    let fixture: ComponentFixture<RecipePrintComponent>;
    let sheet: HTMLElement;
    let printing: RecipePrintService;
    let print: ReturnType<typeof vi.fn>;

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
    };

    beforeEach(async () => {
        print = vi.fn();
        vi.stubGlobal('print', print);
        TestBed.configureTestingModule({ imports: [RecipePrintComponent, TranslateTesting] });
        printing = TestBed.inject(RecipePrintService);
        fixture = TestBed.createComponent(RecipePrintComponent);
        sheet = fixture.nativeElement as HTMLElement;
        await settle();
    });

    afterEach(() => {
        printing.done();
        vi.unstubAllGlobals();
    });

    it('holds nothing and prints nothing until recipes are handed over', () => {
        expect(sheet.querySelectorAll('.cell').length).toBe(0);
        expect(print).not.toHaveBeenCalled();
        expect(document.body.classList.contains('printing-recipes')).toBe(false);
    });

    it('lays out one cell per recipe with its code and its name, then opens the print dialog once', async () => {
        printing.print([recipe(1, 'Pannenkoeken'), recipe(2, 'Soep')]);
        await settle();

        expect(texts(sheet, '.cell-name')).toEqual(['Pannenkoeken', 'Soep']);
        expect(sheet.querySelectorAll('.cell app-recipe-code svg').length).toBe(2);
        expect(print).toHaveBeenCalledTimes(1);
        expect(document.body.classList.contains('printing-recipes')).toBe(true);
    });

    it('clears the sheet when printing is over, and can print again after that', async () => {
        printing.print([recipe(1, 'Pannenkoeken')]);
        await settle();
        window.dispatchEvent(new Event('afterprint'));
        await settle();

        expect(sheet.querySelectorAll('.cell').length).toBe(0);
        expect(document.body.classList.contains('printing-recipes')).toBe(false);

        printing.print([recipe(1, 'Pannenkoeken')]);
        await settle();

        expect(print).toHaveBeenCalledTimes(2);
    });
});

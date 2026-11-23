import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeIngredient } from '@barcodescanner/shared';

import { click, fakeStore, item, texts } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { RecipeChoice, RecipeSheetComponent } from './recipe-sheet.component';

const INGREDIENTS: Array<RecipeIngredient> = [
    { catalogItemId: 1, quantity: 2, note: 'vol' },
    { catalogItemId: 2, quantity: 1, note: '' },
    { catalogItemId: 99, quantity: 1, note: 'weg' }
];

describe('RecipeSheetComponent', () => {
    let fixture: ComponentFixture<RecipeSheetComponent>;
    let sheet: HTMLElement;
    let confirmed: Array<RecipeChoice>;
    let closed: number;

    const confirm = (): HTMLButtonElement => sheet.querySelector('button.primary') as HTMLButtonElement;

    beforeEach(() => {
        confirmed = [];
        closed = 0;
        TestBed.configureTestingModule({
            imports: [RecipeSheetComponent, TranslateTesting],
            providers: [
                { provide: ShoppingStore, useValue: fakeStore([item(1, 'Melk'), item(2, 'Eieren')]) },
                { provide: ApiService, useValue: { iconsUrl: '/icons' } }
            ]
        });
        fixture = TestBed.createComponent(RecipeSheetComponent);
        fixture.componentRef.setInput('name', 'Pannenkoeken');
        fixture.componentRef.setInput('ingredients', INGREDIENTS);
        fixture.componentInstance.confirmed.subscribe((chosen) => confirmed.push(chosen));
        fixture.componentInstance.closed.subscribe(() => closed++);
        sheet = fixture.nativeElement as HTMLElement;
        fixture.detectChanges();
    });

    it('shows the recipe with every known product ticked, its note and its quantity', () => {
        expect(texts(sheet, 'h2')).toEqual(['Pannenkoeken']);
        expect(texts(sheet, 'label.choice')).toEqual(['MMelkvol× 2', 'EEieren']);
        expect(Array.from(sheet.querySelectorAll('input'), (box) => box.checked)).toEqual([true, true]);
        expect(texts(sheet, 'button.primary')[0]).toContain('recipe.products');
        expect(sheet.querySelector('p')).toBeNull();
    });

    it('shows a product the app does not know greyed, without a tick box', () => {
        expect(texts(sheet, '.choice.unknown')).toEqual(['recipe.unknownProduct weg']);
        expect(sheet.querySelectorAll('.choice.unknown input').length).toBe(0);
    });

    it('hands over only what is still ticked', () => {
        click(sheet, 'label.choice input', 0);
        fixture.detectChanges();
        confirm().click();

        expect(confirmed).toEqual([{ ingredients: [INGREDIENTS[1]], save: false }]);

        click(sheet, 'label.choice input', 0);
        fixture.detectChanges();
        confirm().click();

        expect(confirmed.at(-1)?.ingredients).toEqual([INGREDIENTS[0], INGREDIENTS[1]]);
    });

    it('has a box to keep the recipe only when it can be kept, and hands over whether it is ticked', () => {
        expect(sheet.querySelector('.keep')).toBeNull();

        fixture.componentRef.setInput('savable', true);
        fixture.detectChanges();
        confirm().click();
        click(sheet, '.keep input');
        fixture.detectChanges();
        confirm().click();

        expect(texts(sheet, '.keep')).toEqual(['recipe.keep']);
        expect(confirmed.map(({ save }) => save)).toEqual([false, true]);
    });

    it('cannot be confirmed with nothing ticked, and closes on cancel', () => {
        click(sheet, 'label.choice input', 0);
        click(sheet, 'label.choice input', 1);
        fixture.detectChanges();

        expect(confirm().disabled).toBe(true);

        click(sheet, 'button.btn:not(.primary)');
        expect(closed).toBe(1);
    });
});

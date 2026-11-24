import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FakeStore, click, fakeStore, item, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { Recipe } from '../../models';
import { ApiService } from '../../services/api.service';
import { RecipePrintService } from '../../services/recipe-print.service';
import { ShoppingStore } from '../../services/shopping.store';
import { RecipesPage } from './recipes.page';

const SOUP: Recipe = {
    id: 2,
    name: 'Soep',
    description: '',
    ingredients: [
        { catalogItemId: 1, quantity: 2, note: 'vol' },
        { catalogItemId: 99, quantity: 1, note: '' }
    ]
};
const PANCAKES: Recipe = {
    id: 1,
    name: 'Pannenkoeken',
    description: 'Beslag',
    ingredients: [{ catalogItemId: 2, quantity: 1, note: '' }]
};
const NOTHING: Recipe = { id: 3, name: 'Leeg', description: '', ingredients: [] };

describe('RecipesPage', () => {
    let fixture: ComponentFixture<RecipesPage>;
    let page: HTMLElement;
    let store: FakeStore;
    const printing = { print: vi.fn() };

    const open = async (): Promise<void> => {
        fixture = TestBed.createComponent(RecipesPage);
        page = fixture.nativeElement as HTMLElement;
        await settle();
    };
    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const addButtons = (): Array<HTMLButtonElement> => Array.from(page.querySelectorAll('.recipe button'));

    beforeEach(() => {
        vi.clearAllMocks();
        store = fakeStore([item(1, 'Melk'), item(2, 'Eieren')]);
        store.recipes.set([SOUP, PANCAKES, NOTHING]);
        TestBed.configureTestingModule({
            imports: [RecipesPage, TranslateTesting],
            providers: [
                provideRouter([]),
                { provide: ShoppingStore, useValue: store },
                { provide: ApiService, useValue: { iconsUrl: '/icons' } },
                { provide: RecipePrintService, useValue: printing }
            ]
        });
    });

    it('lists the recipes by name, each with a link to itself and the icons of its known products', async () => {
        await open();

        expect(texts(page, '.recipe .font-semibold')).toEqual(['Leeg', 'Pannenkoeken', 'Soep']);
        expect(Array.from(page.querySelectorAll('a.recipe-link'), (link) => link.getAttribute('href'))).toEqual([
            '/recipes/3',
            '/recipes/1',
            '/recipes/2'
        ]);
        expect(
            Array.from(page.querySelectorAll('.recipe'), (row) => row.querySelectorAll('app-item-icon').length)
        ).toEqual([0, 1, 1]);
        expect(page.querySelector('a.btn.primary')?.getAttribute('href')).toBe('/recipes/new');
    });

    it('shows the recipes as rows of one connected group, not as separate cards', async () => {
        await open();

        expect(page.querySelectorAll('.card.group')).toHaveLength(1);
        expect(page.querySelectorAll('.card.group > .recipe')).toHaveLength(3);
        expect(page.querySelectorAll('.recipe.card')).toHaveLength(0);
    });

    it('filters on the name while searching, and says so when nothing matches', async () => {
        await open();
        type(page, '#recipe-search', 'pan');
        await settle();

        expect(texts(page, '.recipe .font-semibold')).toEqual(['Pannenkoeken']);

        type(page, '#recipe-search', 'zzz');
        await settle();

        expect(texts(page, '.empty')).toEqual(['recipe.noResults']);
    });

    it('says there are no recipes yet, and that it is loading before that', async () => {
        store.recipes.set([]);
        store.loaded.set(false);
        await open();
        expect(texts(page, '.empty')).toEqual(['common.loading']);

        store.loaded.set(true);
        await settle();
        expect(texts(page, '.empty')).toEqual(['recipe.empty']);
    });

    it('puts every product of a recipe on the list with the button on its row', async () => {
        await open();
        click(page, '.recipe button.primary', 2);

        expect(store.putRecipeOnList).toHaveBeenCalledWith({ name: 'Soep', ingredients: SOUP.ingredients });
    });

    it('turns the rows into tick boxes for choosing, and prints the codes of the chosen recipes by name', async () => {
        await open();
        click(page, 'button[aria-label="recipe.select"]');
        await settle();
        const printButton = (): HTMLButtonElement =>
            page.querySelector('button[aria-label="recipe.print"]') as HTMLButtonElement;

        expect(page.querySelectorAll('a.recipe-link').length).toBe(0);
        expect(page.querySelectorAll('.recipe input[type=checkbox]').length).toBe(3);
        expect(page.querySelector('a.btn.primary')).toBeNull();
        expect(printButton().disabled).toBe(true);

        click(page, '.recipe input', 2);
        click(page, '.recipe input', 1);
        await settle();

        expect(texts(page, 'button[aria-label="recipe.print"]')).toEqual(['print 2']);

        printButton().click();

        expect(printing.print).toHaveBeenCalledWith([PANCAKES, SOUP]);
    });

    it('leaves choosing with nothing ticked, and offers no choosing while there are no recipes', async () => {
        await open();
        click(page, 'button[aria-label="recipe.select"]');
        await settle();
        click(page, '.recipe input', 0);
        await settle();
        click(page, 'button[aria-label="common.cancel"]');
        await settle();

        expect(page.querySelectorAll('a.recipe-link').length).toBe(3);

        click(page, 'button[aria-label="recipe.select"]');
        await settle();

        expect(Array.from(page.querySelectorAll('.recipe input'), (box) => (box as HTMLInputElement).checked)).toEqual([
            false,
            false,
            false
        ]);

        click(page, 'button[aria-label="common.cancel"]');
        store.recipes.set([]);
        await settle();

        expect((page.querySelector('button[aria-label="recipe.select"]') as HTMLButtonElement).disabled).toBe(true);
    });

    it('offers nothing to add for a recipe without products, and still adds without a connection', async () => {
        await open();
        expect(addButtons().map((button) => button.disabled)).toEqual([true, false, false]);

        store.online.set(false);
        await settle();
        expect(addButtons().map((button) => button.disabled)).toEqual([true, false, false]);
    });
});

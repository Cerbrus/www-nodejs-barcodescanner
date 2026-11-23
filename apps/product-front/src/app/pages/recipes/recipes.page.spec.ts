import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FakeStore, click, fakeStore, item, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { Recipe } from '../../models';
import { ApiService } from '../../services/api.service';
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
        store = fakeStore([item(1, 'Melk'), item(2, 'Eieren')]);
        store.recipes.set([SOUP, PANCAKES, NOTHING]);
        TestBed.configureTestingModule({
            imports: [RecipesPage, TranslateTesting],
            providers: [
                provideRouter([]),
                { provide: ShoppingStore, useValue: store },
                { provide: ApiService, useValue: { iconsUrl: '/icons' } }
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
        click(page, '.recipe button', 2);

        expect(store.putRecipeOnList).toHaveBeenCalledWith({ name: 'Soep', ingredients: SOUP.ingredients });
    });

    it('offers nothing to add for a recipe without products, or without a connection', async () => {
        await open();
        expect(addButtons().map((button) => button.disabled)).toEqual([true, false, false]);

        store.online.set(false);
        await settle();
        expect(addButtons().map((button) => button.disabled)).toEqual([true, true, true]);
    });
});

import { CdkDropList } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { FakeStore, click, fakeStore, item, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { Recipe } from '../../models';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';
import { RecipePage } from './recipe.page';

const PANCAKES: Recipe = {
    id: 7,
    name: 'Pannenkoeken',
    description: 'Laat het **beslag** rusten.',
    ingredients: [
        { catalogItemId: 1, quantity: 2, note: 'vol' },
        { catalogItemId: 2, quantity: 1, note: '' }
    ]
};

describe('RecipePage', () => {
    let fixture: ComponentFixture<RecipePage>;
    let page: HTMLElement;
    let store: FakeStore;
    let navigate: ReturnType<typeof vi.spyOn>;

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const open = async (id?: string): Promise<void> => {
        fixture = TestBed.createComponent(RecipePage);
        if (id !== undefined) {
            fixture.componentRef.setInput('id', id);
        }
        page = fixture.nativeElement as HTMLElement;
        navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        await settle();
    };
    const button = (label: string, index = 0): HTMLButtonElement =>
        Array.from(page.querySelectorAll('button')).filter((candidate) =>
            (candidate.textContent ?? '').includes(label)
        )[index] as HTMLButtonElement;
    const edit = async (): Promise<void> => {
        click(page, 'button[aria-label="recipe.edit"]');
        await settle();
    };

    beforeEach(() => {
        store = fakeStore([item(1, 'Melk'), item(2, 'Eieren'), item(3, 'Bloem')]);
        store.recipes.set([PANCAKES]);
        store.saveRecipe.mockImplementation((id: number | undefined) => of({ ...PANCAKES, id: id ?? 12 }));
        TestBed.configureTestingModule({
            imports: [RecipePage, TranslateTesting],
            providers: [
                provideRouter([]),
                { provide: ShoppingStore, useValue: store },
                { provide: ApiService, useValue: { iconsUrl: '/icons', getIcons: () => of([]) } }
            ]
        });
    });

    it('opens a recipe to read: its name, its description as markdown and its products', async () => {
        await open('7');

        expect(texts(page, 'h1')).toEqual(['Pannenkoeken']);
        expect(page.querySelector('app-markdown strong')?.textContent).toBe('beslag');
        expect(texts(page, '.ingredient')).toEqual(['MMelkvol× 2', 'EEieren']);
        expect(page.querySelector('#recipe-name')).toBeNull();
        expect(page.querySelector('a.back-bar')?.getAttribute('href')).toBe('/recipes');
    });

    it('says so when the recipe does not exist, and that it is loading before that', async () => {
        store.loaded.set(false);
        await open('404');
        expect(texts(page, '.empty')).toEqual(['common.loading']);

        store.loaded.set(true);
        await settle();
        expect(texts(page, '.empty')).toEqual(['recipe.notFound']);
    });

    it('turns into a form with the pencil, and goes back to reading on cancel without saving', async () => {
        await open('7');
        await edit();

        expect((page.querySelector('#recipe-name') as HTMLInputElement).value).toBe('Pannenkoeken');
        expect((page.querySelector('#recipe-description') as HTMLTextAreaElement).value).toBe(PANCAKES.description);
        expect(button('common.save').disabled).toBe(true);

        type(page, '#recipe-name', 'Flensjes');
        await settle();
        button('common.cancel').click();
        await settle();

        expect(store.saveRecipe).not.toHaveBeenCalled();
        expect(texts(page, 'h1')).toEqual(['Pannenkoeken']);
    });

    it('saves a changed name, quantity, note and product list, and reads again after that', async () => {
        await open('7');
        await edit();
        type(page, '#recipe-name', '  Flensjes ');
        click(page, 'button[aria-label="recipe.more"]', 1);
        click(page, 'button[aria-label="recipe.less"]', 0);
        const note = page.querySelector('#ingredient-note-1') as HTMLInputElement;
        note.value = ' scharrel ';
        note.dispatchEvent(new Event('change'));
        await settle();
        button('common.save').click();
        await settle();

        expect(store.saveRecipe).toHaveBeenCalledWith(7, {
            name: 'Flensjes',
            description: PANCAKES.description,
            ingredients: [
                { catalogItemId: 1, quantity: 1, note: 'vol' },
                { catalogItemId: 2, quantity: 2, note: 'scharrel' }
            ]
        });
        expect(TestBed.inject(ToastService).toasts().at(-1)?.text).toBe('recipe.saved');
        expect(page.querySelector('#recipe-name')).toBeNull();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('adds a product from the search, counts one up when it is there already, and takes out one that is down to one', async () => {
        await open('7');
        await edit();
        type(page, 'app-item-autocomplete input', 'bloem');
        await settle();
        click(page, 'app-item-autocomplete .option');
        await settle();
        type(page, 'app-item-autocomplete input', 'eieren');
        await settle();
        click(page, 'app-item-autocomplete .option');
        await settle();
        expect(texts(page, '.ingredient .quantity')).toEqual(['2', '2', '1']);
        expect(texts(page, '.ingredient .step:not([aria-label="recipe.more"])')).toEqual([
            'remove',
            'remove',
            'delete'
        ]);

        click(page, 'button[aria-label="recipe.removeProduct"]', 0);
        await settle();
        button('common.save').click();

        expect(store.saveRecipe.mock.calls[0][1].ingredients).toEqual([
            { catalogItemId: 1, quantity: 2, note: 'vol' },
            { catalogItemId: 2, quantity: 2, note: '' }
        ]);
    });

    it('gives the description as many rows as its text needs, between four and twenty-four', async () => {
        await open('7');
        await edit();
        const rows = (): number => Number(page.querySelector('#recipe-description')?.getAttribute('rows'));

        expect(rows()).toBe(4);

        type(page, '#recipe-description', Array.from({ length: 9 }, (_, line) => `Stap ${line}`).join('\n'));
        await settle();
        expect(rows()).toBe(10);

        type(page, '#recipe-description', 'x'.repeat(36 * 40));
        await settle();
        expect(rows()).toBe(24);
    });

    it('saves the products in the order they were dragged into', async () => {
        await open('7');
        await edit();

        fixture.debugElement
            .query(By.directive(CdkDropList))
            .triggerEventHandler('cdkDropListDropped', { previousIndex: 0, currentIndex: 1 });
        await settle();
        button('common.save').click();

        expect(store.saveRecipe.mock.calls[0][1].ingredients).toEqual([
            { catalogItemId: 2, quantity: 1, note: '' },
            { catalogItemId: 1, quantity: 2, note: 'vol' }
        ]);
    });

    it('starts a new recipe as an empty form, and opens it after the first save', async () => {
        await open();

        expect(texts(page, 'h1')).toEqual(['recipe.new']);
        expect(button('common.save').disabled).toBe(true);
        expect(button('recipe.delete')).toBeUndefined();

        type(page, '#recipe-name', 'Vla');
        await settle();
        button('common.save').click();
        await settle();

        expect(store.saveRecipe).toHaveBeenCalledWith(undefined, { name: 'Vla', description: '', ingredients: [] });
        expect(navigate).toHaveBeenCalledWith(['/recipes', 12], { replaceUrl: true });
    });

    it('goes back to the recipes when a new recipe is cancelled', async () => {
        await open();
        button('common.cancel').click();

        expect(navigate).toHaveBeenCalledWith(['/recipes']);
    });

    it('deletes the recipe only after a confirmation, then goes back to the recipes', async () => {
        await open('7');
        await edit();
        button('recipe.delete').click();
        await settle();
        expect(store.deleteRecipe).not.toHaveBeenCalled();

        button('recipe.delete').click();

        expect(store.deleteRecipe).toHaveBeenCalledWith(7);
        expect(navigate).toHaveBeenCalledWith(['/recipes']);
    });

    it('asks which products go on the list, and puts the ticked ones there', async () => {
        await open('7');
        button('recipe.toList').click();
        await settle();
        click(page, 'app-recipe-sheet label.choice input', 1);
        await settle();
        click(page, 'app-recipe-sheet button.primary');
        await settle();

        expect(store.putRecipeOnList).toHaveBeenCalledWith({
            name: 'Pannenkoeken',
            ingredients: [{ catalogItemId: 1, quantity: 2, note: 'vol' }]
        });
        expect(page.querySelector('app-recipe-sheet')).toBeNull();
    });

    it('offers nothing to put on the list without a connection', async () => {
        store.online.set(false);
        await open('7');

        expect(button('recipe.toList').disabled).toBe(true);
    });
});

import { CdkDropList } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { FakeStore, click, draft, fakeStore, item, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { Recipe } from '../../models';
import { ApiService } from '../../services/api.service';
import { RecipePrintService } from '../../services/recipe-print.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';
import { RecipePage } from './recipe.page';

const PANCAKES: Recipe = {
    id: 7,
    name: 'Pannenkoeken',
    description: 'Laat het **beslag** rusten.',
    category: 'dinner',
    ingredients: [
        { catalogItemId: 1, quantity: 2, note: 'vol' },
        { catalogItemId: 2, quantity: 1, note: '' }
    ]
};

describe('RecipePage', () => {
    let fixture: ComponentFixture<RecipePage>;
    let page: HTMLElement;
    let store: FakeStore;
    const printing = { print: vi.fn() };
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
            `${candidate.textContent} ${candidate.getAttribute('aria-label')}`.includes(label)
        )[index] as HTMLButtonElement;
    const category = (): HTMLSelectElement => page.querySelector('#recipe-category') as HTMLSelectElement;
    const pick = (value: string): void => {
        category().value = value;
        category().dispatchEvent(new Event('change'));
    };
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
                { provide: ApiService, useValue: { iconsUrl: '/icons', getIcons: () => of([]) } },
                { provide: RecipePrintService, useValue: printing }
            ]
        });
    });

    it('opens a recipe to read: its name, then its ingredient lines and its description as one text', async () => {
        store.recipes.set([
            {
                ...PANCAKES,
                ingredients: [
                    { catalogItemId: 1, quantity: 2, note: 'vol', text: '' },
                    { catalogItemId: 3, quantity: 1, note: 'patent', text: '250 g bloem' },
                    { catalogItemId: 2, quantity: 1, note: '' },
                    { catalogItemId: 99, quantity: 3, note: '', text: '' }
                ]
            }
        ]);
        await open('7');

        expect(texts(page, 'h1')).toEqual(['Pannenkoeken']);
        expect(texts(page, '.card h2')).toEqual(['recipe.ingredientList', 'recipe.preparation']);
        expect(texts(page, '.ingredient-lines li')).toEqual([
            'Melk, vol ×2',
            '250 g bloem',
            'Eieren',
            'recipe.unknownProduct ×3'
        ]);
        expect(page.querySelector('.ingredient-lines + .preparation h2 + app-markdown strong')?.textContent).toBe(
            'beslag'
        );
        expect(page.querySelector('.ingredient, app-item-icon, .draft-mark')).toBeNull();
        expect(page.querySelector('#recipe-name')).toBeNull();
        expect(page.querySelector('a.back-bar')?.getAttribute('href')).toBe('/recipes');
    });

    it('shows an ingredient line as it was typed, never as markdown or html', async () => {
        const typed = '*x* <b>y</b> [z](http://a)';
        store.recipes.set([{ ...PANCAKES, ingredients: [{ catalogItemId: 1, quantity: 1, note: '', text: typed }] }]);
        await open('7');

        expect(texts(page, '.ingredient-lines li')).toEqual([typed]);
        expect(page.querySelector('.ingredient-lines :is(em, b, a)')).toBeNull();
    });

    it('marks the line of a draft product with a warning', async () => {
        store.items.set([item(1, 'Melk'), draft(2, 'Eieren')]);
        await open('7');

        const marks = Array.from(page.querySelectorAll('.ingredient-lines li'), (line) =>
            line.querySelector('.draft-mark[role="img"]')?.getAttribute('aria-label')
        );

        expect(marks).toEqual([undefined, 'item.draft']);
    });

    it('leaves the preparation heading out of a recipe without a description', async () => {
        store.recipes.set([{ ...PANCAKES, description: '' }]);
        await open('7');

        expect(texts(page, '.card h2')).toEqual(['recipe.ingredientList']);
        expect(page.querySelector('.preparation, .card app-markdown')).toBeNull();
    });

    it('leaves the ingredient heading out of a recipe without products, and the whole text when there is none', async () => {
        store.recipes.set([{ ...PANCAKES, ingredients: [] }]);
        await open('7');

        expect(page.querySelector('.ingredient-lines')).toBeNull();
        expect(texts(page, '.card h2')).toEqual(['recipe.preparation']);
        expect(page.querySelector('.card app-markdown')).not.toBeNull();
        expect(button('recipe.toList').disabled).toBe(true);

        store.recipes.set([{ ...PANCAKES, description: '', ingredients: [] }]);
        await settle();

        expect(page.querySelector('.card')).toBeNull();
    });

    it('has a field for the ingredient line under each product, with the product as its placeholder', async () => {
        store.recipes.set([
            {
                ...PANCAKES,
                ingredients: [
                    { catalogItemId: 1, quantity: 2, note: 'vol', text: '5 dl melk' },
                    { catalogItemId: 2, quantity: 1, note: '', text: '' }
                ]
            }
        ]);
        await open('7');
        await edit();
        const fields = (): Array<HTMLInputElement> =>
            Array.from(page.querySelectorAll<HTMLInputElement>('.ingredient input.ingredient-text'));

        expect(fields().map((field) => field.value)).toEqual(['5 dl melk', '']);
        expect(fields().map((field) => field.placeholder)).toEqual(['Melk, vol ×2', 'Eieren']);
        expect(fields().map((field) => field.getAttribute('maxlength'))).toEqual(['200', '200']);
        expect(fields().map((field) => field.getAttribute('aria-label'))).toEqual([
            'recipe.ingredientText',
            'recipe.ingredientText'
        ]);

        click(page, 'button[aria-label="recipe.more"]', 1);
        const note = page.querySelector('#ingredient-note-1') as HTMLInputElement;
        note.value = 'scharrel';
        note.dispatchEvent(new Event('change'));
        await settle();

        expect(fields()[1].placeholder).toBe('Eieren, scharrel ×2');
    });

    it('allows a save once an ingredient line differs, and sends every line trimmed', async () => {
        await open('7');
        await edit();

        type(page, '#ingredient-text-1', '   ');
        await settle();
        expect(button('common.save').disabled).toBe(true);

        type(page, '#ingredient-text-1', '  2 eieren ');
        await settle();
        expect(button('common.save').disabled).toBe(false);

        button('common.save').click();

        expect(store.saveRecipe.mock.calls[0][1].ingredients).toEqual([
            { catalogItemId: 1, quantity: 2, note: 'vol', text: '' },
            { catalogItemId: 2, quantity: 1, note: '', text: '2 eieren' }
        ]);
    });

    it('keeps the line with its product when rows are dragged or taken out', async () => {
        await open('7');
        await edit();
        type(page, '#ingredient-text-0', '5 dl melk');
        type(page, '#ingredient-text-1', '2 eieren');
        await settle();

        fixture.debugElement
            .query(By.directive(CdkDropList))
            .triggerEventHandler('cdkDropListDropped', { previousIndex: 0, currentIndex: 1 });
        await settle();

        expect((page.querySelector('#ingredient-text-0') as HTMLInputElement).value).toBe('2 eieren');

        click(page, 'button[aria-label="recipe.removeProduct"]', 0);
        await settle();
        button('common.save').click();

        expect(store.saveRecipe.mock.calls[0][1].ingredients).toEqual([
            { catalogItemId: 1, quantity: 2, note: 'vol', text: '5 dl melk' }
        ]);
    });

    it('shows the code of the saved recipe while reading, not in the form, and prints it from the button', async () => {
        await open('7');

        expect(page.querySelectorAll('app-recipe-code svg').length).toBe(1);

        click(page, 'button[aria-label="recipe.print"]');

        expect(printing.print).toHaveBeenCalledWith([PANCAKES]);

        await edit();

        expect(page.querySelector('app-recipe-code')).toBeNull();
        expect(page.querySelector('button[aria-label="recipe.print"]')).toBeNull();
    });

    it('draws a warning over the code and cannot print it while the recipe holds a draft product', async () => {
        await open('7');
        const print = (): HTMLButtonElement =>
            page.querySelector('button[aria-label="recipe.print"]') as HTMLButtonElement;

        expect(page.querySelector('app-recipe-code .unprintable')).toBeNull();
        expect(print().disabled).toBe(false);

        store.items.set([item(1, 'Melk'), draft(2, 'Eieren'), item(3, 'Bloem')]);
        await settle();

        expect(page.querySelector('app-recipe-code .unprintable')).not.toBeNull();
        expect(print().disabled).toBe(true);

        print().click();

        expect(printing.print).not.toHaveBeenCalled();
    });

    it('offers a draft product in the search of the form, and leaves it off the list in the tick sheet', async () => {
        store.items.set([item(1, 'Melk'), draft(2, 'Eieren'), draft(3, 'Bloem')]);
        await open('7');
        click(page, 'button[aria-label="recipe.toList"]');
        await settle();

        expect(texts(page, 'app-recipe-sheet .choice.draft')).toEqual(['EEieren']);

        click(page, 'app-recipe-sheet button.primary');
        expect(store.putRecipeOnList).toHaveBeenCalledWith({
            name: 'Pannenkoeken',
            ingredients: [{ catalogItemId: 1, quantity: 2, note: 'vol' }]
        });

        await settle();
        await edit();
        type(page, 'app-item-autocomplete input', 'bloem');
        await settle();

        expect(texts(page, 'app-item-autocomplete .option .grow')).toEqual(['Bloem']);
    });

    it('opens straight in the form when asked to, as after saving an offered recipe', async () => {
        fixture = TestBed.createComponent(RecipePage);
        fixture.componentRef.setInput('id', '7');
        fixture.componentRef.setInput('edit', 'true');
        page = fixture.nativeElement as HTMLElement;
        await settle();

        expect((page.querySelector('#recipe-name') as HTMLInputElement).value).toBe('Pannenkoeken');

        button('common.cancel').click();
        await settle();

        expect(page.querySelector('#recipe-name')).toBeNull();
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
            category: 'dinner',
            sourceUrl: '',
            ingredients: [
                { catalogItemId: 1, quantity: 1, note: 'vol', text: '' },
                { catalogItemId: 2, quantity: 2, note: 'scharrel', text: '' }
            ]
        });
        expect(TestBed.inject(ToastService).toasts().at(-1)?.text).toBe('recipe.saved');
        expect(page.querySelector('#recipe-name')).toBeNull();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('adds a product from the search, counts one up when it is there already, and takes out one that is down to one', async () => {
        await open('7');
        await edit();
        type(page, '#ingredient-text-1', '2 eieren');
        type(page, 'app-item-autocomplete input', 'bloem');
        await settle();
        click(page, 'app-item-autocomplete .option');
        await settle();
        expect((page.querySelector('#ingredient-text-2') as HTMLInputElement).value).toBe('');
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
            { catalogItemId: 1, quantity: 2, note: 'vol', text: '' },
            { catalogItemId: 2, quantity: 2, note: '', text: '2 eieren' }
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
            { catalogItemId: 2, quantity: 1, note: '', text: '' },
            { catalogItemId: 1, quantity: 2, note: 'vol', text: '' }
        ]);
    });

    it('starts a new recipe as an empty form, and opens it after the first save', async () => {
        await open();

        expect(texts(page, 'h1')).toEqual(['recipe.new']);
        expect(button('common.save').disabled).toBe(true);
        expect(button('recipe.delete')).toBeUndefined();

        type(page, '#recipe-name', 'Vla');
        await settle();

        expect(category().value).toBe('');
        expect(button('common.save').disabled).toBe(true);

        pick('dessert');
        await settle();
        button('common.save').click();
        await settle();

        expect(store.saveRecipe).toHaveBeenCalledWith(undefined, {
            name: 'Vla',
            description: '',
            category: 'dessert',
            sourceUrl: '',
            ingredients: []
        });
        expect(navigate).toHaveBeenCalledWith(['/recipes', 12], { replaceUrl: true });
    });

    it('names the category of a recipe while reading, and files one without a known category under other', async () => {
        await open('7');

        expect(texts(page, 'p.category')).toEqual(['dinner_dining recipe.categories.dinner']);

        store.recipes.set([{ ...PANCAKES, category: undefined } as unknown as Recipe]);
        await settle();

        expect(texts(page, 'p.category')).toEqual(['restaurant recipe.categories.other']);
    });

    it('shows the link a recipe came from by the name of its site, and nothing for a recipe without one', async () => {
        await open('7');

        expect(page.querySelector('a.source')).toBeNull();

        store.recipes.set([
            { ...PANCAKES, description: '', ingredients: [], sourceUrl: 'https://www.example.com/recept/1' }
        ]);
        await settle();
        const link = page.querySelector('.card a.source') as HTMLAnchorElement;

        expect(link.getAttribute('href')).toBe('https://www.example.com/recept/1');
        expect([link.target, link.rel]).toEqual(['_blank', 'noopener noreferrer']);
        expect(texts(page, 'a.source')).toEqual(['open_in_new www.example.com']);

        store.recipes.set([{ ...PANCAKES, sourceUrl: 'javascript:alert(1)' }]);
        await settle();

        expect(page.querySelector('a.source')).toBeNull();
    });

    it('has a field for the link in the form, saves it trimmed, and saves nothing that is no web address', async () => {
        store.recipes.set([{ ...PANCAKES, sourceUrl: 'https://example.com/a' }]);
        await open('7');
        await edit();
        const field = (): HTMLInputElement => page.querySelector('#recipe-source-url') as HTMLInputElement;

        expect(field().value).toBe('https://example.com/a');
        expect(button('common.save').disabled).toBe(true);

        type(page, '#recipe-source-url', 'example.com/b');
        await settle();
        expect(button('common.save').disabled).toBe(true);

        type(page, '#recipe-source-url', ' https://example.com/b ');
        await settle();
        expect(button('common.save').disabled).toBe(false);

        type(page, '#recipe-source-url', '');
        await settle();
        button('common.save').click();

        expect(store.saveRecipe.mock.calls[0][1].sourceUrl).toBe('');
    });

    it('offers the nine categories in the form with the one of the recipe picked, and saves another', async () => {
        await open('7');
        await edit();

        expect(Array.from(category().options, (option) => option.value)).toEqual([
            'breakfast',
            'lunch',
            'dinner',
            'soup',
            'salad',
            'dessert',
            'baking',
            'snack',
            'other'
        ]);
        expect(category().value).toBe('dinner');
        expect(button('common.save').disabled).toBe(true);

        pick('baking');
        await settle();

        expect(button('common.save').disabled).toBe(false);

        button('common.save').click();

        expect(store.saveRecipe.mock.calls[0][1].category).toBe('baking');
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

    it('asks which products go on the list, and puts the ticked ones there without their lines', async () => {
        store.recipes.set([
            { ...PANCAKES, ingredients: PANCAKES.ingredients.map((row) => ({ ...row, text: 'een regel' })) }
        ]);
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

    it('still offers to put the recipe on the list without a connection', async () => {
        store.online.set(false);
        await open('7');

        expect(button('recipe.toList').disabled).toBe(false);
    });
});

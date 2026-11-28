import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { FakeStore, click, draft, fakeStore, item, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { Recipe } from '../../models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { RecipePrintService } from '../../services/recipe-print.service';
import { ShoppingStore } from '../../services/shopping.store';
import { RecipesPage } from './recipes.page';

const SOUP: Recipe = {
    id: 2,
    name: 'Soep',
    description: '',
    category: 'soup',
    ingredients: [
        { catalogItemId: 1, quantity: 2, note: 'vol' },
        { catalogItemId: 99, quantity: 1, note: '' }
    ]
};
const PANCAKES: Recipe = {
    id: 1,
    name: 'Pannenkoeken',
    description: 'Beslag',
    category: 'dinner',
    ingredients: [{ catalogItemId: 2, quantity: 1, note: '' }]
};
const NOTHING: Recipe = { id: 3, name: 'Leeg', description: '', category: 'dinner', ingredients: [] };

describe('RecipesPage', () => {
    let fixture: ComponentFixture<RecipesPage>;
    let page: HTMLElement;
    let store: FakeStore;
    const printing = { print: vi.fn() };
    const owner = signal(false);
    const api = {
        iconsUrl: '/icons',
        getRecipeImport: vi.fn(),
        recipePictureUrl: ({ id, picture }: Recipe): string | undefined =>
            picture ? `/recipes/${id}/picture?v=${picture}` : undefined
    };
    const importButton = (): HTMLButtonElement | null =>
        page.querySelector('.recipes-header button[aria-label="recipe.import"]');
    const sheetButton = (label: string): HTMLButtonElement =>
        page.querySelector(`app-sheet button[aria-label="${label}"]`) as HTMLButtonElement;
    const openImport = async (text: string): Promise<void> => {
        owner.set(true);
        await open();
        importButton()?.click();
        await settle();
        type(page, '#recipe-source', text);
        await settle();
    };

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
        owner.set(false);
        api.getRecipeImport.mockReturnValue(of({ available: true }));
        HTMLDialogElement.prototype.showModal ??= vi.fn();
        HTMLDialogElement.prototype.close ??= vi.fn();
        store = fakeStore([item(1, 'Melk'), item(2, 'Eieren')]);
        store.recipes.set([SOUP, PANCAKES, NOTHING]);
        TestBed.configureTestingModule({
            imports: [RecipesPage, TranslateTesting],
            providers: [
                provideRouter([]),
                { provide: ShoppingStore, useValue: store },
                { provide: ApiService, useValue: api },
                { provide: AuthService, useValue: { owner } },
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
            Array.from(page.querySelectorAll('.recipe'), (row) => row.querySelectorAll('.recipe-icon').length)
        ).toEqual([0, 1, 1]);
        expect(page.querySelector('a.btn.primary')?.getAttribute('href')).toBe('/recipes/new');
    });

    it('shows a recipe as a tile with its small picture, or with the icon of its category when it has none', async () => {
        store.recipes.set([{ ...SOUP, picture: 'abc123' }, PANCAKES]);
        await open();
        const tiles = Array.from(page.querySelectorAll('.recipe'));

        expect(tiles.map((tile) => tile.querySelector('img.recipe-picture')?.getAttribute('src') ?? null)).toEqual([
            null,
            '/recipes/2/picture?v=abc123'
        ]);
        expect(texts(tiles[0] as HTMLElement, '.recipe-picture.none')).toEqual(['dinner_dining']);
        expect(tiles[1].querySelector('.recipe-picture.none')).toBeNull();
        expect(tiles.map((tile) => tile.querySelector('.recipe-name')?.textContent?.trim())).toEqual([
            'Pannenkoeken',
            'Soep'
        ]);

        tiles[1].querySelector('img')?.dispatchEvent(new Event('error'));
        await settle();

        expect(page.querySelector('img.recipe-picture')).toBeNull();
        expect(texts(page, '.recipe-picture.none')).toEqual(['dinner_dining', 'soup_kitchen']);
    });

    it('shows the recipes of a category as a grid of tiles under its name, in the fixed order', async () => {
        await open();

        expect(texts(page, '.section-title')).toEqual([
            'dinner_dining recipe.categories.dinner',
            'soup_kitchen recipe.categories.soup'
        ]);
        expect(page.querySelectorAll('.recipe-grid')).toHaveLength(2);
        expect(
            Array.from(page.querySelectorAll('.recipe-grid'), (group) => group.querySelectorAll('.recipe').length)
        ).toEqual([2, 1]);
    });

    it('narrows the page to one category with its button, and back with the same button or the first one', async () => {
        await open();
        const chips = (): Array<HTMLButtonElement> => Array.from(page.querySelectorAll('.categories .segment'));
        const pressed = (): Array<string | null> => chips().map((chip) => chip.getAttribute('aria-pressed'));

        expect(chips().map((chip) => chip.getAttribute('aria-label'))).toEqual([
            'recipe.allCategories',
            'recipe.categories.dinner',
            'recipe.categories.soup'
        ]);
        expect(pressed()).toEqual(['true', 'false', 'false']);

        chips()[2].click();
        await settle();

        expect(texts(page, '.recipe .font-semibold')).toEqual(['Soep']);
        expect(pressed()).toEqual(['false', 'false', 'true']);

        type(page, '#recipe-search', 'pan');
        await settle();
        expect(texts(page, '.empty')).toEqual(['recipe.noResults']);

        type(page, '#recipe-search', '');
        chips()[2].click();
        await settle();
        expect(texts(page, '.recipe .font-semibold')).toEqual(['Leeg', 'Pannenkoeken', 'Soep']);

        chips()[1].click();
        await settle();
        chips()[0].click();
        await settle();
        expect(pressed()).toEqual(['true', 'false', 'false']);
    });

    it('shows no category buttons while every recipe has the same one, and drops a choice whose recipes are gone', async () => {
        await open();
        click(page, '.categories .segment', 2);
        await settle();

        store.recipes.set([PANCAKES, NOTHING]);
        await settle();

        expect(page.querySelector('.categories')).toBeNull();
        expect(texts(page, '.recipe .font-semibold')).toEqual(['Leeg', 'Pannenkoeken']);
    });

    it('files a recipe without a known category, as one kept before categories, under other', async () => {
        store.recipes.set([{ ...SOUP, category: undefined } as unknown as Recipe]);
        await open();

        expect(texts(page, '.section-title')).toEqual(['restaurant recipe.categories.other']);
    });

    it('keeps a gap between the header buttons and the search field', async () => {
        await open();

        const header = page.querySelector('.recipes-header') as HTMLElement;
        expect(header.classList).toContain('mb-3');
        expect(header.nextElementSibling?.querySelector('#recipe-search')).not.toBeNull();
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

    it('cannot pick a recipe that holds a draft product for printing, and marks it with a warning', async () => {
        store.items.set([item(1, 'Melk'), draft(2, 'Eieren')]);
        await open();
        click(page, 'button[aria-label="recipe.select"]');
        await settle();
        const boxes = (): Array<HTMLInputElement> => Array.from(page.querySelectorAll('.recipe input'));

        expect(boxes().map((box) => box.disabled)).toEqual([false, true, false]);
        expect(texts(page, '.recipe.unprintable .font-semibold')).toEqual(['Pannenkoeken']);
        expect(page.querySelectorAll('.recipe.unprintable [aria-label="recipe.holdsDraft"]').length).toBe(1);

        click(page, '.recipe input', 1);
        click(page, '.recipe input', 2);
        await settle();
        click(page, 'button[aria-label="recipe.print"]');

        expect(printing.print).toHaveBeenCalledWith([SOUP]);
    });

    it('leaves a recipe out of the print when one of its products became a draft after it was picked', async () => {
        await open();
        click(page, 'button[aria-label="recipe.select"]');
        await settle();
        click(page, '.recipe input', 1);
        click(page, '.recipe input', 2);
        store.items.set([item(1, 'Melk'), draft(2, 'Eieren')]);
        await settle();
        click(page, 'button[aria-label="recipe.print"]');

        expect(printing.print).toHaveBeenCalledWith([SOUP]);
    });

    it('still hands a recipe with a draft product to the list as a whole, where the server leaves the draft out', async () => {
        store.items.set([draft(1, 'Melk'), item(2, 'Eieren')]);
        await open();
        click(page, '.recipe button.primary', 2);

        expect(store.putRecipeOnList).toHaveBeenCalledWith({ name: 'Soep', ingredients: SOUP.ingredients });
    });

    it('offers the import to the owner only, and asks the server just for that account', async () => {
        await open();

        expect(importButton()).toBeNull();
        expect(api.getRecipeImport).not.toHaveBeenCalled();

        owner.set(true);
        await open();

        expect(importButton()?.textContent?.trim()).toBe('add_link');
        expect(api.getRecipeImport).toHaveBeenCalledTimes(1);
    });

    it('offers no import while the server has not answered, when it has no key, or when asking fails', async () => {
        owner.set(true);
        const answer = new Subject<{ available: boolean }>();
        api.getRecipeImport.mockReturnValue(answer);
        await open();
        expect(importButton()).toBeNull();

        answer.next({ available: true });
        await settle();
        expect(importButton()).not.toBeNull();

        api.getRecipeImport.mockReturnValue(of({ available: false }));
        await open();
        expect(importButton()).toBeNull();

        api.getRecipeImport.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
        await open();
        expect(importButton()).toBeNull();
    });

    it('opens a sheet with a field for a link or text, and imports nothing while the field is empty', async () => {
        await openImport('   ');

        expect(page.querySelector('#recipe-source')?.getAttribute('placeholder')).toBe('recipe.importSource');
        expect(sheetButton('recipe.import').disabled).toBe(true);

        type(page, '#recipe-source', ' https://food.example/soep ');
        await settle();

        expect(sheetButton('recipe.import').disabled).toBe(false);

        sheetButton('common.cancel').click();
        await settle();

        expect(page.querySelector('app-sheet')).toBeNull();
        expect(store.importRecipe).not.toHaveBeenCalled();
    });

    it('shows that an import runs and stays open meanwhile, then opens the new recipe for editing', async () => {
        const answer = new Subject<Recipe>();
        store.importRecipe.mockReturnValue(answer);
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        await openImport(' https://food.example/soep ');
        sheetButton('recipe.import').click();
        await settle();

        expect(store.importRecipe).toHaveBeenCalledWith('https://food.example/soep');
        expect(sheetButton('recipe.import').disabled).toBe(true);
        expect(sheetButton('recipe.import').textContent?.trim()).toBe('schedule');
        expect(sheetButton('common.cancel').disabled).toBe(true);
        expect(page.querySelector('app-sheet .busy-bar')?.getAttribute('aria-label')).toBe('recipe.importing');
        expect(texts(page, 'app-sheet p.muted')).toEqual(['recipe.importing']);
        expect((page.querySelector('#recipe-source') as HTMLTextAreaElement).disabled).toBe(true);

        page.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
        await settle();
        expect(page.querySelector('app-sheet')).not.toBeNull();

        answer.next({ ...SOUP, id: 12 });
        answer.complete();
        await settle();

        expect(page.querySelector('app-sheet')).toBeNull();
        expect(page.querySelector('.busy-bar')).toBeNull();
        expect(navigate).toHaveBeenCalledWith(['/recipes', 12]);

        importButton()?.click();
        await settle();
        expect((page.querySelector('#recipe-source') as HTMLTextAreaElement).value).toBe('');
    });

    it('keeps the sheet and the typed text when the import fails, ready for another try', async () => {
        store.importRecipe.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
        await openImport('https://food.example/soep');
        sheetButton('recipe.import').click();
        await settle();

        expect((page.querySelector('#recipe-source') as HTMLTextAreaElement).value).toBe('https://food.example/soep');
        expect(sheetButton('recipe.import').disabled).toBe(false);
        expect(sheetButton('recipe.import').textContent?.trim()).toBe('add_link');
        expect(navigate).not.toHaveBeenCalled();
    });
});

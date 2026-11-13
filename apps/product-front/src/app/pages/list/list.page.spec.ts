import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ListPage } from './list.page';
import { FakeStore, click, entry, fakeStore, item, texts, type } from '../../../testing/fakes';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

const milk = item(1, 'Melk');
const bread = item(2, 'Brood', 'brood-gebak');
const cola = item(3, 'Cola', 'dranken');
const buttermilk = item(4, 'Karnemelk');

describe('ListPage', () => {
    let fixture: ComponentFixture<ListPage>;
    let page: HTMLElement;
    let store: FakeStore;

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const open = async (): Promise<void> => {
        fixture = TestBed.createComponent(ListPage);
        page = fixture.nativeElement as HTMLElement;
        await settle();
    };
    const tiles = (tone: string): Array<string> => texts(page, `button.tile.${tone} .name`);
    const tap = async (tone: string, name: string, target: 'tile' | 'details' = 'tile'): Promise<void> => {
        const host = Array.from(page.querySelectorAll('app-item-tile')).find(
            (candidate) => candidate.querySelector(`button.tile.${tone}`) && texts(candidate, '.name')[0] === name
        ) as HTMLElement;
        click(host, target === 'tile' ? 'button.tile' : 'button.details');
        await settle();
    };
    const search = async (text: string): Promise<void> => {
        type(page, 'input[type=search]', text);
        await settle();
    };
    const toasts = (): Array<string> =>
        TestBed.inject(ToastService)
            .toasts()
            .map((toast) => toast.text);

    beforeEach(() => {
        store = fakeStore([milk, bread, cola, buttermilk], [entry(milk, 'to_buy', 2, 'halfvol'), entry(bread, 'to_buy'), entry(cola, 'recent')]);
        store.createItem.mockImplementation((input: { name: string }) => of(item(60, input.name)));
        TestBed.configureTestingModule({
            imports: [ListPage, TranslateModule.forRoot()],
            providers: [provideRouter([]), { provide: ShoppingStore, useValue: store }, { provide: ApiService, useValue: { iconsUrl: '/icons', getIcons: () => of([]) } }]
        });
    });

    it('shows what to buy by section, with quantity and note, and the recent products below', async () => {
        await open();

        expect(tiles('buy')).toEqual(['Brood', 'Melk']);
        expect(texts(page, '.flow-label')).toEqual(['🍞 Brood', '🥛 Zuivel']);
        expect(texts(page, 'button.tile.buy .quantity, button.tile.buy .note')).toEqual(['2', 'halfvol']);
        expect(tiles('recent')).toEqual(['Cola']);
    });

    it('says so when the list or the recent row is empty, and when it is still loading', async () => {
        store.entries.set([]);
        await open();
        expect(texts(page, '.empty')).toEqual(['list.empty', 'list.noRecent']);

        store.loaded.set(false);
        await settle();
        expect(texts(page, '.empty')).toEqual(['common.loading']);
    });

    it('checks a product off with a tap and can put it back from the message', async () => {
        await open();
        await tap('buy', 'Melk');

        expect(store.changeEntry).toHaveBeenCalledWith(1, { state: 'recent' });
        expect(toasts()).toEqual(['list.checkedOff']);

        TestBed.inject(ToastService).toasts()[0].action?.();

        expect(store.changeEntry).toHaveBeenLastCalledWith(1, { state: 'to_buy', quantity: 2, note: 'halfvol' });
    });

    it('puts a recent product back on the list with a tap', async () => {
        await open();
        await tap('recent', 'Cola');

        expect(store.changeEntry).toHaveBeenCalledWith(3, { state: 'to_buy', quantity: 1 });
    });

    it('marks a product whose change still waits for a connection', async () => {
        store.pending.set([{ catalogItemId: 2 }]);
        await open();

        expect(page.querySelectorAll('.waiting').length).toBe(1);
    });

    it('searches the products; one already on the list shows as +1 and gets one more', async () => {
        await open();
        await search('melk');

        expect(texts(page, '.tile-grid .name')).toEqual(['Melk', 'Karnemelk']);
        expect(texts(page, '.tile-grid .quantity')).toEqual(['+1']);

        await tap('buy', 'Melk');

        expect(store.changeEntry).toHaveBeenCalledWith(1, { quantity: 3 });
        expect((page.querySelector('input[type=search]') as HTMLInputElement).value).toBe('');
    });

    it('adds a found product that is not on the list, and clears the search', async () => {
        await open();
        await search('karne');
        await tap('neutral', 'Karnemelk');

        expect(store.changeEntry).toHaveBeenCalledWith(4, { state: 'to_buy', quantity: 1 });
        expect(page.querySelector('.flow')).not.toBeNull();
    });

    it('offers to create a product when no product has exactly that name, and adds it to the list', async () => {
        await open();
        await search('melk');
        expect(page.querySelector('button.btn.mt-3')).toBeNull();

        await search('Kwark');
        expect(texts(page, '.empty')).toEqual(['list.noSearchResults']);
        click(page, 'button.btn.mt-3');
        await settle();
        click(page, 'app-new-item-form button.primary');
        await settle();

        expect(store.createItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kwark' }));
        expect(store.changeEntry).toHaveBeenCalledWith(60, { state: 'to_buy', quantity: 1 });
        expect(page.querySelector('app-new-item-form')).toBeNull();
    });

    it('changes the quantity in the details sheet, and minus at one moves the product to recent', async () => {
        await open();
        await tap('buy', 'Melk', 'details');
        expect(texts(page, 'app-sheet .page-title')).toEqual(['Melk']);

        click(page, 'app-sheet button[aria-label="list.more"]');
        click(page, 'app-sheet button[aria-label="list.less"]');
        expect(store.changeEntry.mock.calls).toEqual([
            [1, { quantity: 3 }],
            [1, { quantity: 1 }]
        ]);

        store.entries.set([entry(milk, 'to_buy', 1)]);
        await settle();
        click(page, 'app-sheet button[aria-label="list.toRecent"]');
        await settle();

        expect(store.changeEntry).toHaveBeenLastCalledWith(1, { state: 'recent' });
        expect(page.querySelector('app-sheet')).toBeNull();
    });

    it('saves a changed note on Enter, on leaving the field and on Done, but not an unchanged one', async () => {
        await open();
        await tap('buy', 'Melk', 'details');
        const note = page.querySelector('#entry-note') as HTMLInputElement;

        note.dispatchEvent(new Event('blur'));
        expect(store.changeEntry).not.toHaveBeenCalled();

        note.value = 'vol';
        note.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
        note.value = 'mager';
        click(page, 'app-sheet button.primary');
        await settle();

        expect(store.changeEntry.mock.calls).toEqual([
            [1, { note: 'vol' }],
            [1, { note: 'mager' }]
        ]);
        expect(page.querySelector('app-sheet')).toBeNull();
    });

    it('offers add, edit and remove for a recent product, and removes only after a confirmation', async () => {
        await open();
        await tap('recent', 'Cola', 'details');
        expect(page.querySelector('app-sheet a.btn')?.getAttribute('href')).toBe('/catalog/3');

        click(page, 'app-sheet button.danger');
        await settle();
        expect(store.removeEntry).not.toHaveBeenCalled();
        expect(texts(page, 'app-sheet p')).toEqual(['list.removeConfirm']);

        click(page, 'app-sheet button.btn:not(.danger)');
        await settle();
        click(page, 'app-sheet button.danger');
        await settle();
        click(page, 'app-sheet button.danger');
        await settle();

        expect(store.removeEntry).toHaveBeenCalledWith(3);
        expect(page.querySelector('app-sheet')).toBeNull();
    });

    it('adds a recent product from its sheet', async () => {
        await open();
        await tap('recent', 'Cola', 'details');
        click(page, 'app-sheet button.primary');
        await settle();

        expect(store.changeEntry).toHaveBeenCalledWith(3, { state: 'to_buy', quantity: 1 });
        expect(page.querySelector('app-sheet')).toBeNull();
    });
});

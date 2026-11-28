import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { FakeStore, click, draft, fakeStore, item, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { CatalogItem } from '../../models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';
import { ItemPage } from './item.page';

const MILK: CatalogItem = {
    ...item(1, 'Melk'),
    emoji: '🥛',
    icon: 'milk',
    defaultIcon: 'milk_carton',
    barcodes: [
        {
            code: '8710400335481',
            scanCount: 3,
            catalogItemId: 1,
            note: 'Volkoren',
            suggestions: [{ connectorId: 'ah', title: 'AH Melk' }]
        },
        { code: '22223333', scanCount: 1, catalogItemId: 1 }
    ]
};
const SAFFRON: CatalogItem = { ...draft(1, 'Saffraan'), barcodes: [], recipeCount: 1 };

describe('ItemPage', () => {
    let fixture: ComponentFixture<ItemPage>;
    let page: HTMLElement;
    let store: FakeStore;
    let owner: boolean;
    const api = {
        iconsUrl: '/icons',
        getIcons: () => of(['milk', 'bread']),
        getCatalogItem: vi.fn(),
        updateCatalogItem: vi.fn(),
        deleteCatalogItem: vi.fn(),
        unmapBarcode: vi.fn(),
        searchBarcodes: vi.fn(),
        mapBarcode: vi.fn()
    };

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const open = async (): Promise<void> => {
        fixture = TestBed.createComponent(ItemPage);
        fixture.componentRef.setInput('id', '1');
        page = fixture.nativeElement as HTMLElement;
        await settle();
    };
    const save = (): HTMLButtonElement => page.querySelector('button.primary') as HTMLButtonElement;
    const button = (label: string, index = 0): HTMLElement =>
        Array.from(page.querySelectorAll('button')).filter((candidate) =>
            `${candidate.textContent} ${candidate.getAttribute('aria-label')}`.includes(label)
        )[index] as HTMLElement;

    beforeEach(() => {
        vi.clearAllMocks();
        owner = true;
        store = fakeStore([MILK, item(2, 'Karnemelk')]);
        api.getCatalogItem.mockReturnValue(of(MILK));
        api.updateCatalogItem.mockReturnValue(of(MILK));
        api.deleteCatalogItem.mockReturnValue(of(undefined));
        api.unmapBarcode.mockReturnValue(of(undefined));
        api.searchBarcodes.mockReturnValue(
            of([
                {
                    code: '8718906716230',
                    suggestions: [{ connectorId: 'off', title: 'melk' }],
                    note: '',
                    shopCode: false
                }
            ])
        );
        api.mapBarcode.mockReturnValue(of({}));
        TestBed.configureTestingModule({
            imports: [ItemPage, TranslateTesting],
            providers: [
                provideRouter([]),
                { provide: ShoppingStore, useValue: store },
                { provide: ApiService, useValue: api },
                { provide: AuthService, useValue: { owner: () => owner } }
            ]
        });
    });

    it('loads the product by the number in the address and fills the form', async () => {
        await open();

        expect(api.getCatalogItem).toHaveBeenCalledWith(1);
        expect(texts(page, 'h1')).toEqual(['Melk']);
        expect((page.querySelector('#item-name') as HTMLInputElement).value).toBe('Melk');
        expect((page.querySelector('#item-section') as HTMLSelectElement).value).toBe('zuivel');
        expect((page.querySelector('#item-emoji') as HTMLInputElement).value).toBe('🥛');
    });

    it('says loading until the product is there', async () => {
        api.getCatalogItem.mockReturnValue(of());
        await open();

        expect(texts(page, '.empty')).toEqual(['common.loading']);
    });

    it('can only save a real change with a name, and saves it trimmed', async () => {
        await open();
        expect(save().disabled).toBe(true);

        type(page, '#item-name', '  ');
        await settle();
        expect(save().disabled).toBe(true);

        type(page, '#item-name', ' Volle melk ');
        await settle();
        save().click();

        expect(api.updateCatalogItem).toHaveBeenCalledWith(1, {
            name: 'Volle melk',
            sectionId: 'zuivel',
            emoji: '🥛',
            icon: 'milk',
            stocked: false
        });
        expect(store.refreshAll).toHaveBeenCalledTimes(1);
        expect(
            TestBed.inject(ToastService)
                .toasts()
                .map((toast) => toast.text)
        ).toEqual(['item.saved']);
    });

    it('marks a product as always in the house with a tick box, as a change that can be saved', async () => {
        await open();
        const box = page.querySelector('#item-stocked') as HTMLInputElement;

        expect(box.checked).toBe(false);
        expect(box.closest('label')?.textContent?.trim()).toBe('item.stocked');
        expect((button('common.save') as HTMLButtonElement).disabled).toBe(true);

        box.click();
        await settle();

        expect((button('common.save') as HTMLButtonElement).disabled).toBe(false);

        button('common.save').click();
        await settle();

        expect(api.updateCatalogItem).toHaveBeenCalledWith(1, expect.objectContaining({ stocked: true }));
    });

    it('changes the icon through the picker, which offers the standard icon of the product', async () => {
        await open();
        click(page, 'button.icon-choice');
        await settle();
        expect(texts(page, 'app-icon-picker .icon span').slice(0, 2)).toEqual(['icons.none', 'icons.standard']);

        click(page, 'app-icon-picker .icon.none');
        await settle();

        expect(page.querySelector('app-icon-picker')).toBeNull();
        expect(save().disabled).toBe(false);

        save().click();
        expect(api.updateCatalogItem).toHaveBeenCalledWith(1, expect.objectContaining({ icon: '' }));
    });

    it('draws each barcode of the product, with the name the lookup gave it', async () => {
        await open();

        expect(texts(page, '.section-title')[0]).toBe('item.barcodes (2)');
        expect(page.querySelectorAll('app-barcode .barcode-container').length).toBe(2);
        expect(texts(page, '.card p.font-semibold')).toEqual(['AH Melk', 'inbox.unknownProduct']);
        expect(texts(page, '.barcode-variant')).toEqual(['item.variant']);
    });

    it('says so when the product has no barcodes', async () => {
        api.getCatalogItem.mockReturnValue(of({ ...MILK, barcodes: [] }));
        await open();

        expect(texts(page, '.empty')).toEqual(['item.noBarcodes']);
    });

    it('searches barcodes for the product in a sheet, and loads the product again once one is linked', async () => {
        await open();
        expect(page.querySelector('app-barcode-search')).toBeNull();

        click(page, 'button.search-barcodes');
        await settle();
        expect(api.searchBarcodes).toHaveBeenCalledExactlyOnceWith('Melk', 1);
        expect(texts(page, 'app-barcode-search .hit-title')).toEqual(['melk']);

        click(page, 'app-barcode-search input[type=checkbox]');
        await settle();
        click(page, 'app-barcode-search button.primary');
        await settle();

        expect(api.mapBarcode).toHaveBeenCalledExactlyOnceWith('8718906716230', 1, '');
        expect(page.querySelector('app-barcode-search')).toBeNull();
        expect(api.getCatalogItem).toHaveBeenCalledTimes(2);
    });

    it('closes the barcode search without loading the product again', async () => {
        await open();
        click(page, 'button.search-barcodes');
        await settle();

        click(page, 'app-barcode-search button[aria-label="common.cancel"]');
        await settle();

        expect(page.querySelector('app-barcode-search')).toBeNull();
        expect(api.getCatalogItem).toHaveBeenCalledTimes(1);
    });

    it('detaches a barcode, which sends it back to the inbox', async () => {
        await open();
        button('item.detach', 1).click();

        expect(api.unmapBarcode).toHaveBeenCalledWith('22223333');
        expect(store.refreshListAndInbox).toHaveBeenCalledTimes(1);
        expect(api.getCatalogItem).toHaveBeenCalledTimes(2);
    });

    it('moves a barcode to another product picked from the search, which leaves this product out', async () => {
        await open();
        button('item.move').click();
        await settle();
        type(page, 'app-item-autocomplete input', 'melk');
        (page.querySelector('app-item-autocomplete input') as HTMLElement).dispatchEvent(new Event('focus'));
        await settle();
        expect(texts(page, 'app-item-autocomplete .option .grow')).toEqual(['Karnemelk']);

        click(page, 'app-item-autocomplete .option');
        await settle();

        expect(store.mapBarcode).toHaveBeenCalledWith('8710400335481', 2);
        expect(page.querySelector('app-item-autocomplete')).toBeNull();
    });

    it('can cancel moving a barcode', async () => {
        await open();
        button('item.move').click();
        await settle();
        button('common.cancel').click();
        await settle();

        expect(page.querySelector('app-item-autocomplete')).toBeNull();
        expect(store.mapBarcode).not.toHaveBeenCalled();
    });

    it('deletes the product only after a confirmation, then goes back to the products', async () => {
        await open();
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        button('item.delete').click();
        await settle();
        expect(api.deleteCatalogItem).not.toHaveBeenCalled();

        button('common.cancel').click();
        await settle();
        button('item.delete').click();
        await settle();
        button('item.delete').click();

        expect(api.deleteCatalogItem).toHaveBeenCalledWith(1);
        expect(store.refreshAll).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(['/catalog']);
    });

    it('sends another account back to the list instead of the products', async () => {
        owner = false;
        await open();

        expect(page.querySelector('a.back-bar')?.getAttribute('href')).toBe('/list');
        expect(texts(page, 'a.back-bar')[0]).toContain('item.backToList');
    });

    it('says a product that recipes use cannot be deleted, and offers only the way back', async () => {
        api.getCatalogItem.mockReturnValue(of({ ...MILK, recipeCount: 2 }));
        await open();
        button('item.delete').click();
        await settle();

        expect(texts(page, '.card p').join(' ')).toContain('item.inRecipes');
        expect(button('item.delete')).toBeUndefined();

        button('common.cancel').click();
        await settle();

        expect(button('item.delete')).not.toBeUndefined();
        expect(api.deleteCatalogItem).not.toHaveBeenCalled();
    });

    it('shows no draft mark and no review buttons for an ordinary product', async () => {
        await open();

        expect(page.querySelector('.draft-mark')).toBeNull();
        expect(page.querySelector('.review')).toBeNull();
    });

    it('marks a draft, hides its barcodes, and lets only the owner confirm or replace it', async () => {
        api.getCatalogItem.mockReturnValue(of(SAFFRON));
        await open();

        expect(texts(page, '.draft-mark')).toEqual(['item.draft']);
        expect(page.querySelector('.section-title')).toBeNull();
        expect(page.querySelector('app-barcode')).toBeNull();
        expect(texts(page, '.review button')).toEqual(['check', 'swap_horiz']);

        owner = false;
        await open();

        expect(texts(page, '.draft-mark')).toEqual(['item.draft']);
        expect(page.querySelector('.review')).toBeNull();
    });

    it('leads back to the inbox from a draft, and goes there once the draft is confirmed', async () => {
        api.getCatalogItem.mockReturnValue(of(SAFFRON));
        await open();
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

        expect(page.querySelector('a.back-bar')?.getAttribute('href')).toBe('/inbox');
        expect(texts(page, 'a.back-bar')).toEqual(['arrow_back inbox.title']);

        button('item.confirmDraft').click();
        await settle();

        expect(store.confirmDraft).toHaveBeenCalledWith(1);
        expect(navigate).toHaveBeenCalledWith(['/inbox']);
    });

    it('replaces a draft by a product from the search, which offers no drafts and not the draft itself, and goes back to the inbox', async () => {
        store.items.set([SAFFRON, item(2, 'Saffraandraadjes'), draft(3, 'Saffraanpoeder')]);
        api.getCatalogItem.mockReturnValue(of(SAFFRON));
        await open();
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        button('item.replaceDraft').click();
        await settle();
        type(page, '.review app-item-autocomplete input', 'saffraan');
        (page.querySelector('.review app-item-autocomplete input') as HTMLElement).dispatchEvent(new Event('focus'));
        await settle();

        expect(texts(page, '.review .option .grow')).toEqual(['Saffraandraadjes']);

        click(page, '.review .option');
        await settle();

        expect(store.replaceDraft).toHaveBeenCalledWith(1, 2);
        expect(navigate).toHaveBeenCalledWith(['/inbox']);
    });

    it('can cancel replacing a draft', async () => {
        api.getCatalogItem.mockReturnValue(of(SAFFRON));
        await open();
        button('item.replaceDraft').click();
        await settle();
        button('common.cancel').click();
        await settle();

        expect(page.querySelector('app-item-autocomplete')).toBeNull();
        expect(texts(page, '.review button')).toEqual(['check', 'swap_horiz']);
        expect(store.replaceDraft).not.toHaveBeenCalled();
    });
});

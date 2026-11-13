import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ItemPage } from './item.page';
import { FakeStore, click, fakeStore, item, texts, type } from '../../../testing/fakes';
import { CatalogItem } from '../../models';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

const MILK: CatalogItem = {
    ...item(1, 'Melk'),
    emoji: '🥛',
    icon: 'milk',
    defaultIcon: 'milk_carton',
    barcodes: [
        { code: '8710400335481', scanCount: 3, catalogItemId: 1, suggestions: [{ connectorId: 'ah', title: 'AH Melk' }] },
        { code: '22223333', scanCount: 1, catalogItemId: 1 }
    ]
};

describe('ItemPage', () => {
    let fixture: ComponentFixture<ItemPage>;
    let page: HTMLElement;
    let store: FakeStore;
    const api = {
        iconsUrl: '/icons',
        getIcons: () => of(['milk', 'bread']),
        getCatalogItem: vi.fn(),
        updateCatalogItem: vi.fn(),
        deleteCatalogItem: vi.fn(),
        unmapBarcode: vi.fn()
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
        Array.from(page.querySelectorAll('button')).filter((candidate) => (candidate.textContent ?? '').includes(label))[index] as HTMLElement;

    beforeEach(() => {
        vi.clearAllMocks();
        store = fakeStore([MILK, item(2, 'Karnemelk')]);
        api.getCatalogItem.mockReturnValue(of(MILK));
        api.updateCatalogItem.mockReturnValue(of(MILK));
        api.deleteCatalogItem.mockReturnValue(of(undefined));
        api.unmapBarcode.mockReturnValue(of(undefined));
        TestBed.configureTestingModule({
            imports: [ItemPage, TranslateModule.forRoot()],
            providers: [provideRouter([]), { provide: ShoppingStore, useValue: store }, { provide: ApiService, useValue: api }]
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

        expect(api.updateCatalogItem).toHaveBeenCalledWith(1, { name: 'Volle melk', sectionId: 'zuivel', emoji: '🥛', icon: 'milk' });
        expect(store.refreshAll).toHaveBeenCalledTimes(1);
        expect(TestBed.inject(ToastService).toasts().map((toast) => toast.text)).toEqual(['item.saved']);
    });

    it('changes the icon through the picker, which offers the standard icon of the product', async () => {
        await open();
        click(page, 'button.btn.w-full');
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
        expect(texts(page, '.card > p.font-semibold')).toEqual(['AH Melk', 'inbox.unknownProduct']);
    });

    it('says so when the product has no barcodes', async () => {
        api.getCatalogItem.mockReturnValue(of({ ...MILK, barcodes: [] }));
        await open();

        expect(texts(page, '.empty')).toEqual(['item.noBarcodes']);
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
});

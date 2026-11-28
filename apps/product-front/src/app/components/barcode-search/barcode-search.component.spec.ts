import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { BarcodeCandidate } from '@barcodescanner/shared';

import { FakeStore, click, fakeStore, item, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { BarcodeSearchComponent } from './barcode-search.component';

const MILK = item(1, 'Melk');
const HITS: Array<BarcodeCandidate> = [
    {
        code: '8718906716230',
        suggestions: [
            { connectorId: 'ah', title: 'AH Halfvolle melk', brand: 'AH' },
            { connectorId: 'off', title: 'melk' }
        ],
        size: '1 l',
        note: 'Halfvolle',
        shopCode: false
    },
    {
        code: '8710400335481',
        suggestions: [{ connectorId: 'off', title: 'Karnemelk' }],
        note: '',
        shopCode: false,
        catalogItem: { id: 2, name: 'Karnemelk' }
    },
    {
        code: '0000210066210',
        suggestions: [{ connectorId: 'off', title: 'Melk van de markt' }],
        note: 'Van de markt',
        shopCode: true
    }
];

describe('BarcodeSearchComponent', () => {
    let fixture: ComponentFixture<BarcodeSearchComponent>;
    let sheet: HTMLElement;
    let store: FakeStore;
    let linked: number;
    let closed: number;
    const api = { searchBarcodes: vi.fn(), mapBarcode: vi.fn() };

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const open = async (): Promise<void> => {
        fixture = TestBed.createComponent(BarcodeSearchComponent);
        fixture.componentRef.setInput('item', MILK);
        fixture.componentInstance.linked.subscribe(() => linked++);
        fixture.componentInstance.closed.subscribe(() => closed++);
        sheet = fixture.nativeElement as HTMLElement;
        await settle();
    };
    const link = (): HTMLButtonElement => sheet.querySelector('button.primary') as HTMLButtonElement;
    const boxes = (): Array<HTMLInputElement> => Array.from(sheet.querySelectorAll('input[type=checkbox]'));

    beforeEach(() => {
        vi.clearAllMocks();
        linked = 0;
        closed = 0;
        store = fakeStore([MILK]);
        api.searchBarcodes.mockReturnValue(of(HITS));
        api.mapBarcode.mockReturnValue(of({}));
        TestBed.configureTestingModule({
            imports: [BarcodeSearchComponent, TranslateTesting],
            providers: [
                { provide: ShoppingStore, useValue: store },
                { provide: ApiService, useValue: api }
            ]
        });
    });

    it('searches by the name of the product when it opens and shows each hit with its brand, size and code', async () => {
        await open();

        expect(api.searchBarcodes).toHaveBeenCalledExactlyOnceWith('Melk', 1);
        expect((sheet.querySelector('#barcode-search-words') as HTMLInputElement).value).toBe('Melk');
        expect(texts(sheet, '.hit-title')).toEqual(['AH Halfvolle melk', 'Karnemelk', 'Melk van de markt']);
        expect(texts(sheet, '.hit-detail')).toEqual(['AH · 1 l · 8718906716230', '8710400335481', '0000210066210']);
        expect(Array.from(sheet.querySelectorAll('.hit:first-child img'), (logo) => logo.getAttribute('alt'))).toEqual([
            'Albert Heijn',
            'Open Food Facts'
        ]);
    });

    it('says loading while the search runs, and nothing found when it gives nothing or fails', async () => {
        const answer = new Subject<Array<BarcodeCandidate>>();
        api.searchBarcodes.mockReturnValue(answer);
        await open();
        expect(texts(sheet, '.empty')).toEqual(['common.loading']);

        answer.next([]);
        await settle();
        expect(texts(sheet, '.empty')).toEqual(['barcodeSearch.none']);

        api.searchBarcodes.mockReturnValue(throwError(() => new Error('offline')));
        click(sheet, 'button[type=submit]');
        await settle();
        expect(texts(sheet, '.empty')).toEqual(['barcodeSearch.none']);
    });

    it('gives a barcode of another product no tick box and names that product', async () => {
        await open();

        expect(boxes().map((box) => box.id)).toEqual(['barcode-hit-8718906716230', 'barcode-hit-0000210066210']);
        expect(texts(sheet, '.hit.taken .hit-owner')).toEqual(['barcodeSearch.belongsTo']);
        expect(sheet.querySelectorAll('.hit.shop-code').length).toBe(1);
    });

    it('shows the proposed variant of a ticked barcode, which can be changed, and hides it when unticked', async () => {
        await open();
        expect(sheet.querySelector('.hit-note')).toBeNull();
        expect(link().disabled).toBe(true);

        boxes()[0].click();
        await settle();
        expect((sheet.querySelector('#barcode-note-8718906716230') as HTMLInputElement).value).toBe('Halfvolle');
        expect(link().disabled).toBe(false);

        boxes()[0].click();
        await settle();
        expect(sheet.querySelector('.hit-note')).toBeNull();
        expect(link().disabled).toBe(true);
    });

    it('links every ticked barcode to the product with its variant, then reloads the list and says it is done', async () => {
        await open();
        boxes()[0].click();
        boxes()[1].click();
        await settle();
        type(sheet, '#barcode-note-8718906716230', ' Halfvol ');
        await settle();

        link().click();
        await settle();

        expect(api.mapBarcode.mock.calls).toEqual([
            ['8718906716230', 1, 'Halfvol'],
            ['0000210066210', 1, 'Van de markt']
        ]);
        expect(store.refreshListAndInbox).toHaveBeenCalledTimes(1);
        expect(linked).toBe(1);
    });

    it('searches again with other words, which drops the ticks', async () => {
        await open();
        boxes()[0].click();
        await settle();

        type(sheet, '#barcode-search-words', 'AH melk');
        click(sheet, 'button[type=submit]');
        await settle();

        expect(api.searchBarcodes).toHaveBeenLastCalledWith('AH melk', 1);
        expect(boxes().some((box) => box.checked)).toBe(false);
        expect(link().disabled).toBe(true);
    });

    it('does not search without words, and closes from its button', async () => {
        await open();
        type(sheet, '#barcode-search-words', '  ');
        await settle();
        expect((sheet.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);

        click(sheet, 'button[aria-label="common.cancel"]');
        expect(closed).toBe(1);
        expect(linked).toBe(0);
    });
});

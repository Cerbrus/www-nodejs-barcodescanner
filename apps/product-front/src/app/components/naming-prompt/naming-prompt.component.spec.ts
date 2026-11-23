import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FakeEvents, FakeStore, click, entry, fakeEvents, fakeStore, item, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { Barcode } from '../../models';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';
import { ShoppingStore } from '../../services/shopping.store';
import { NamingOutcome, NamingPromptComponent } from './naming-prompt.component';

const CODE = '8710400000001';
const known = (extra: Partial<Barcode> = {}): Barcode => ({ code: CODE, scanCount: 1, suggestions: [], ...extra });
const AH = { connectorId: 'ah', title: 'AH Halfvolle melk', brand: 'AH', category: 'Zuivel' };
const OFF = { connectorId: 'off', title: 'Melk 1L' };

describe('NamingPromptComponent', () => {
    let fixture: ComponentFixture<NamingPromptComponent>;
    let page: HTMLElement;
    let store: FakeStore;
    let events: FakeEvents;
    const outcomes: Array<NamingOutcome> = [];
    const api = {
        iconsUrl: '/icons',
        getIcons: () => of([]),
        getBarcode: vi.fn(),
        repeatLookup: vi.fn(),
        discardBarcode: vi.fn()
    };

    const open = async (barcode: Barcode): Promise<void> => {
        api.getBarcode.mockReturnValue(of(barcode));
        fixture = TestBed.createComponent(NamingPromptComponent);
        fixture.componentRef.setInput('code', CODE);
        fixture.componentInstance.closed.subscribe((outcome) => outcomes.push(outcome));
        page = fixture.nativeElement as HTMLElement;
        await settle();
    };
    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const search = (): HTMLInputElement => page.querySelector('app-item-autocomplete input') as HTMLInputElement;
    const variantField = (): HTMLInputElement => page.querySelector('#naming-variant') as HTMLInputElement;
    const typeName = async (name: string): Promise<void> => {
        type(page, 'app-item-autocomplete input', name);
        search().dispatchEvent(new Event('focus'));
        await settle();
    };

    beforeEach(() => {
        vi.clearAllMocks();
        outcomes.length = 0;
        store = fakeStore([item(1, 'Melk'), item(2, 'Karnemelk')]);
        store.createItem.mockImplementation((input: { name: string }) => of(item(50, input.name)));
        events = fakeEvents();
        api.repeatLookup.mockReturnValue(of(known({ suggestions: [OFF] })));
        api.discardBarcode.mockReturnValue(of(undefined));
        TestBed.configureTestingModule({
            imports: [NamingPromptComponent, TranslateTesting],
            providers: [
                { provide: ShoppingStore, useValue: store },
                { provide: ApiService, useValue: api },
                { provide: EventsService, useValue: events }
            ]
        });
    });

    it('shows the code and what each source suggested, with the source named', async () => {
        await open(known({ suggestions: [AH, OFF] }));

        expect(texts(page, '.font-mono')).toEqual([CODE]);
        expect(texts(page, 'button.card .font-semibold')).toEqual(['AH Halfvolle melk', 'Melk 1L']);
        expect(
            Array.from(page.querySelectorAll('button.card img[title]'), (logo) => logo.getAttribute('title'))
        ).toEqual(['Albert Heijn', 'Open Food Facts']);
    });

    it('says it is still looking, or that nothing was found', async () => {
        await open({ code: CODE, scanCount: 1 });
        expect(texts(page, 'p.muted.text-sm:not(.font-mono)')).toEqual(['naming.lookingUp']);

        events.emit('barcode', { code: 'other' });
        api.getBarcode.mockReturnValue(of(known()));
        events.emit('barcode', { code: CODE });
        await settle();

        expect(texts(page, 'p.muted.text-sm:not(.font-mono)')).toEqual(['naming.noSuggestions']);
    });

    it('puts a tapped suggestion in the search field and marks it', async () => {
        await open(known({ suggestions: [AH, OFF] }));
        click(page, 'button.card', 1);
        await settle();

        expect(search().value).toBe('Melk 1L');
        expect(Array.from(page.querySelectorAll('button.card'), (card) => card.getAttribute('aria-pressed'))).toEqual([
            'false',
            'true'
        ]);
    });

    it('names the sources that gave no answer and asks them again on request', async () => {
        await open(known({ lookupFailed: ['ah', 'other'] }));
        expect(page.querySelector('[role=status]')).not.toBeNull();

        click(page, '[role=status] button');
        await settle();

        expect(api.repeatLookup).toHaveBeenCalledWith(CODE);
        expect(texts(page, 'button.card .font-semibold')).toEqual(['Melk 1L']);
        expect(page.querySelector('[role=status]')).toBeNull();
    });

    it('offers the products on the list to pick from only while shopping', async () => {
        store.entries.set([entry(store.items()[0], 'to_buy', 1, 'Volkoren'), entry(store.items()[1], 'recent')]);
        await open(known());
        expect(page.querySelector('.flex-wrap button')).toBeNull();

        store.shoppingMode.set(true);
        await settle();
        expect(texts(page, '.flex-wrap button')).toEqual(['Melk · Volkoren']);

        click(page, '.flex-wrap button');
        await settle();

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 1, 'Volkoren');
    });

    it('offers no list while shopping when nothing is to buy', async () => {
        store.shoppingMode.set(true);
        await open(known());

        expect(page.querySelector('.flex-wrap button')).toBeNull();
    });

    it('links the barcode to a product picked from the search', async () => {
        await open(known());
        await typeName('karne');
        click(page, 'app-item-autocomplete .option');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 2, '');
        expect(outcomes).toEqual([{ kind: 'linked', item: item(2, 'Karnemelk') }]);
    });

    it('offers the proposed product with its note as variant, and links it with one tap', async () => {
        await open(known({ proposal: { catalogItemId: 1, name: 'Melk', note: 'Halfvolle' } }));

        expect(texts(page, '.proposal .font-semibold')).toEqual(['Melk']);
        expect((page.querySelector('#naming-variant') as HTMLInputElement).value).toBe('Halfvolle');

        type(page, '#naming-variant', 'Vol');
        click(page, '.proposal button.primary');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 1, 'Vol');
        expect(outcomes).toEqual([{ kind: 'linked', item: item(1, 'Melk') }]);
    });

    it('leaves the proposed variant out when another product is picked from the search', async () => {
        await open(known({ proposal: { catalogItemId: 1, name: 'Melk', note: 'Halfvolle' } }));
        await typeName('karne');

        expect(variantField().value).toBe('');

        click(page, 'app-item-autocomplete .option');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 2, '');
    });

    it('shows the proposed variant again when the search is emptied', async () => {
        await open(known({ proposal: { catalogItemId: 1, name: 'Melk', note: 'Halfvolle' } }));
        await typeName('karne');
        await typeName('');

        expect(variantField().value).toBe('Halfvolle');
    });

    it('still links the proposed product with its variant after a search', async () => {
        await open(known({ proposal: { catalogItemId: 1, name: 'Melk', note: 'Halfvolle' } }));
        await typeName('karne');
        click(page, '.proposal button.primary');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 1, 'Halfvolle');
    });

    it('keeps a typed variant for a product picked from the search, also next to a proposal', async () => {
        await open(known({ proposal: { catalogItemId: 1, name: 'Melk', note: 'Halfvolle' } }));
        type(page, '#naming-variant', 'Vol');
        await typeName('karne');

        expect(variantField().value).toBe('Vol');

        click(page, 'app-item-autocomplete .option');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 2, 'Vol');
    });

    it('keeps a variant that was emptied by hand', async () => {
        await open(known({ proposal: { catalogItemId: 1, name: 'Melk', note: 'Halfvolle' } }));
        type(page, '#naming-variant', '');
        click(page, '.proposal button.primary');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 1, '');
    });

    it('does not overwrite a typed variant when the lookup answers later', async () => {
        await open({ code: CODE, scanCount: 1 });
        type(page, '#naming-variant', 'Volkoren');

        api.getBarcode.mockReturnValue(of(known({ proposal: { catalogItemId: 1, name: 'Melk', note: 'Halfvolle' } })));
        events.emit('barcode', { code: CODE });
        await settle();

        expect(variantField().value).toBe('Volkoren');
    });

    it('opens the new product form with a proposed new name', async () => {
        await open(known({ proposal: { name: 'Rode linzen', note: '' } }));
        click(page, '.proposal button.primary');
        await settle();

        expect((page.querySelector('#new-item-name') as HTMLInputElement).value).toBe('Rode linzen');
    });

    it('gives a new product made from the proposal its variant, and one made from the search none', async () => {
        await open(known({ proposal: { name: 'Linzen', note: 'Rode' } }));
        await typeName('Cola zero');
        click(page, '.proposal button.primary');
        await settle();
        click(page, 'app-new-item-form button.primary');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 50, 'Rode');

        store.mapBarcode.mockClear();
        click(page, 'app-new-item-form .mt-3 button.btn');
        await settle();
        await typeName('Cola zero');
        click(page, 'app-item-autocomplete .option.create');
        await settle();
        click(page, 'app-new-item-form button.primary');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 50, '');
    });

    it('shows no proposal when there is none', async () => {
        await open(known());

        expect(page.querySelector('.proposal')).toBeNull();
        expect((page.querySelector('#naming-variant') as HTMLInputElement).value).toBe('');
    });

    it('links the barcode with the variant typed above the search', async () => {
        await open(known());
        type(page, '#naming-variant', ' Volkoren ');
        await typeName('karne');
        click(page, 'app-item-autocomplete .option');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 2, 'Volkoren');
    });

    it('creates a new product from the typed name and links it, with the section guessed from the suggestions', async () => {
        await open(known({ suggestions: [{ connectorId: 'ah', title: 'Zero', category: 'Frisdrank' }] }));
        await typeName('Cola zero');
        click(page, 'app-item-autocomplete .option.create');
        await settle();

        expect(page.querySelector('app-item-autocomplete')).toBeNull();
        expect((page.querySelector('select') as HTMLSelectElement).value).toBe('dranken');

        click(page, 'app-new-item-form button.primary');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 50, '');
        expect(outcomes[0].kind).toBe('linked');
    });

    it('takes the section the server derived from the shop category', async () => {
        await open(
            known({
                suggestions: [
                    OFF,
                    { connectorId: 'ah', title: 'AH Karnemelk', category: 'Zuivel, eieren', sectionId: 'zuivel' }
                ]
            })
        );
        await typeName('Cola');
        click(page, 'app-item-autocomplete .option.create');
        await settle();

        expect((page.querySelector('select') as HTMLSelectElement).value).toBe('zuivel');
    });

    it('goes back to the search when creating is cancelled', async () => {
        await open(known());
        await typeName('Nieuw ding');
        click(page, 'app-item-autocomplete .option.create');
        await settle();
        click(page, 'app-new-item-form .mt-3 button.btn');
        await settle();

        expect(page.querySelector('app-item-autocomplete')).not.toBeNull();
    });

    it('leaves the barcode in the inbox on "later" and on closing the sheet', async () => {
        await open(known());
        click(page, '.mt-4 button.btn');
        (page.querySelector('dialog') as HTMLDialogElement).dispatchEvent(new Event('cancel', { cancelable: true }));

        expect(outcomes).toEqual([{ kind: 'later' }, { kind: 'later' }]);
        expect(store.mapBarcode).not.toHaveBeenCalled();
    });

    it('cancels the scan on request and reloads the list', async () => {
        await open(known());
        click(page, '.mt-4 button.danger');

        expect(api.discardBarcode).toHaveBeenCalledWith(CODE);
        expect(store.refreshListAndInbox).toHaveBeenCalledTimes(1);
        expect(outcomes).toEqual([{ kind: 'discarded' }]);
    });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { NamingOutcome, NamingPromptComponent } from './naming-prompt.component';
import { FakeEvents, FakeStore, click, fakeEvents, fakeStore, item, texts, type } from '../../../testing/fakes';
import { Barcode } from '../../models';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';
import { ShoppingStore } from '../../services/shopping.store';

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
    const api = { iconsUrl: '/icons', getIcons: () => of([]), getBarcode: vi.fn(), repeatLookup: vi.fn(), discardBarcode: vi.fn() };

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
            imports: [NamingPromptComponent, TranslateModule.forRoot()],
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
        expect(Array.from(page.querySelectorAll('button.card img[title]'), (logo) => logo.getAttribute('title'))).toEqual(['Albert Heijn', 'Open Food Facts']);
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
        expect(Array.from(page.querySelectorAll('button.card'), (card) => card.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
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

    it('links the barcode to a product picked from the search', async () => {
        await open(known());
        await typeName('karne');
        click(page, 'app-item-autocomplete .option');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 2);
        expect(outcomes).toEqual([{ kind: 'linked', item: item(2, 'Karnemelk') }]);
    });

    it('creates a new product from the typed name and links it, with the section guessed from the suggestions', async () => {
        await open(known({ suggestions: [{ connectorId: 'ah', title: 'Zero', category: 'Frisdrank' }] }));
        await typeName('Cola zero');
        click(page, 'app-item-autocomplete .option.create');
        await settle();

        expect(page.querySelector('app-item-autocomplete')).toBeNull();
        expect((page.querySelector('select') as HTMLSelectElement).value).toBe('dranken');

        click(page, 'app-new-item-form button.primary');

        expect(store.mapBarcode).toHaveBeenCalledWith(CODE, 50);
        expect(outcomes[0].kind).toBe('linked');
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

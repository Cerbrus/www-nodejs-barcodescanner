import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { ItemAutocompleteComponent } from './item-autocomplete.component';
import { CatalogItem } from '../../models';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';

const item = (id: number, name: string): CatalogItem => ({ id, name, sectionId: 'x', custom: false });
const CATALOG = [
    item(1, 'Roomkaas'),
    item(2, 'Kaas'),
    item(3, 'Kaasschaaf'),
    item(4, 'Melk'),
    item(5, 'Blauwe kaas'),
    ...Array.from({ length: 10 }, (_, index) => item(100 + index, `Pak ${index}`))
];

describe('ItemAutocompleteComponent', () => {
    let fixture: ComponentFixture<ItemAutocompleteComponent>;
    const picked: Array<string> = [];
    const created: Array<string> = [];

    const type = (text: string): void => {
        fixture.componentRef.setInput('text', text);
        fixture.nativeElement.querySelector('input').dispatchEvent(new Event('focus'));
        fixture.detectChanges();
    };
    const options = (): Array<string> =>
        Array.from(fixture.nativeElement.querySelectorAll('.option:not(.create) .grow') as NodeListOf<HTMLElement>, (element) => element.textContent?.trim() ?? '');
    const createOption = (): HTMLElement | null => fixture.nativeElement.querySelector('.option.create');
    const pressEnter = (): void => {
        fixture.nativeElement.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        fixture.detectChanges();
    };

    beforeEach(() => {
        picked.length = 0;
        created.length = 0;
        TestBed.configureTestingModule({
            imports: [ItemAutocompleteComponent, TranslateModule.forRoot()],
            providers: [
                { provide: ShoppingStore, useValue: { items: signal(CATALOG) } },
                { provide: ApiService, useValue: { iconsUrl: '/icons' } }
            ]
        });
        fixture = TestBed.createComponent(ItemAutocompleteComponent);
        fixture.componentInstance.picked.subscribe((chosen) => picked.push(chosen.name));
        fixture.componentInstance.create.subscribe((name) => created.push(name));
        fixture.detectChanges();
    });

    it('shows nothing until something is typed', () => {
        type('  ');

        expect(fixture.nativeElement.querySelector('.options')).toBeNull();
    });

    it('puts the exact name first, then names that start with the text, then the rest by name', () => {
        type('kaas');

        expect(options()).toEqual(['Kaas', 'Kaasschaaf', 'Blauwe kaas', 'Roomkaas']);
    });

    it('shows at most eight matches', () => {
        type('pak');

        expect(options().length).toBe(8);
    });

    it('leaves out the product that is being edited', () => {
        fixture.componentRef.setInput('excludeId', 2);
        type('kaas');

        expect(options()).not.toContain('Kaas');
    });

    it('offers to create a product only when allowed and when no product has exactly that name', () => {
        type('Kwark');
        expect(createOption()).toBeNull();

        fixture.componentRef.setInput('allowCreate', true);
        type('Kwark');
        expect(createOption()).not.toBeNull();

        type('melk');
        expect(createOption()).toBeNull();
    });

    it('picks the first match on Enter, and creates when there is no match', () => {
        fixture.componentRef.setInput('allowCreate', true);
        type('kaas');
        pressEnter();
        type(' Kwark ');
        pressEnter();

        expect(picked).toEqual(['Kaas']);
        expect(created).toEqual(['Kwark']);
    });

    it('closes the list after a pick', () => {
        type('melk');
        (fixture.nativeElement.querySelector('.option') as HTMLElement).click();
        fixture.detectChanges();

        expect(picked).toEqual(['Melk']);
        expect(fixture.nativeElement.querySelector('.options')).toBeNull();
    });
});

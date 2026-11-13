import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';

import { NewItemFormComponent } from './new-item-form.component';
import { FakeStore, click, fakeStore, item, type } from '../../../testing/fakes';
import { CatalogItem } from '../../models';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';

describe('NewItemFormComponent', () => {
    let fixture: ComponentFixture<NewItemFormComponent>;
    let page: HTMLElement;
    let store: FakeStore;
    const created: Array<string> = [];
    let cancelled = 0;

    const open = async (name: string, hint = ''): Promise<void> => {
        fixture = TestBed.createComponent(NewItemFormComponent);
        fixture.componentRef.setInput('initialName', name);
        fixture.componentRef.setInput('hint', hint);
        fixture.componentRef.setInput('submitLabel', 'Aanmaken');
        fixture.componentInstance.created.subscribe((made) => created.push(made.name));
        fixture.componentInstance.cancelled.subscribe(() => cancelled++);
        page = fixture.nativeElement as HTMLElement;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const section = (): string => (page.querySelector('select') as HTMLSelectElement).value;
    const submit = (): HTMLButtonElement => page.querySelector('button.primary') as HTMLButtonElement;

    beforeEach(() => {
        created.length = 0;
        cancelled = 0;
        store = fakeStore();
        store.createItem.mockImplementation((input: { name: string }) => of(item(99, input.name)));
        TestBed.configureTestingModule({
            imports: [NewItemFormComponent, TranslateModule.forRoot()],
            providers: [
                { provide: ShoppingStore, useValue: store },
                { provide: ApiService, useValue: { iconsUrl: '/icons', getIcons: () => of(['milk']) } }
            ]
        });
    });

    it('starts with the given name and guesses the section from it', async () => {
        await open('Volle melk');

        expect((page.querySelector('#new-item-name') as HTMLInputElement).value).toBe('Volle melk');
        expect(section()).toBe('zuivel');
    });

    it('guesses the section from what the lookup said when the name says nothing', async () => {
        await open('Zero', 'Frisdrank Cola');

        expect(section()).toBe('dranken');
    });

    it('takes the first section when nothing matches', async () => {
        await open('Dinges');

        expect(section()).toBe('brood-gebak');
    });

    it('creates the product with a trimmed name, the section and the emoji', async () => {
        await open('  Karnemelk ');
        type(page, '#new-item-emoji', ' 🥛 ');
        fixture.detectChanges();
        submit().click();

        expect(store.createItem).toHaveBeenCalledWith({ name: 'Karnemelk', sectionId: 'zuivel', icon: undefined, emoji: '🥛' });
        expect(created).toEqual(['Karnemelk']);
    });

    it('adds an icon chosen in the picker', async () => {
        await open('Melk');
        click(page, 'button.btn');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        click(page, 'app-icon-picker .icon', 1);
        fixture.detectChanges();
        submit().click();

        expect(page.querySelector('app-icon-picker')).toBeNull();
        expect(store.createItem).toHaveBeenCalledWith(expect.objectContaining({ icon: 'milk' }));
    });

    it('cannot create without a name, or twice while the first is under way', async () => {
        const answer = new Subject<CatalogItem>();
        store.createItem.mockReturnValue(answer);
        await open(' ');
        expect(submit().disabled).toBe(true);

        type(page, '#new-item-name', 'Kwark');
        fixture.detectChanges();
        expect(submit().disabled).toBe(false);

        submit().click();
        fixture.detectChanges();
        expect(submit().disabled).toBe(true);

        answer.next(item(5, 'Kwark'));
        answer.complete();
        fixture.detectChanges();
        expect(submit().disabled).toBe(false);
        expect(created).toEqual(['Kwark']);
    });

    it('reports a cancel', async () => {
        await open('Melk');
        click(page, '.mt-3 button.btn');

        expect(cancelled).toBe(1);
        expect(store.createItem).not.toHaveBeenCalled();
    });
});

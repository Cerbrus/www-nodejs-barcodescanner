import { TestBed } from '@angular/core/testing';

import { texts } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { SKINS } from '../../skins';
import { SkinSelectComponent } from './skin-select.component';

describe('SkinSelectComponent', () => {
    beforeEach(() => {
        localStorage.clear();
        delete document.documentElement.dataset['skin'];
        TestBed.configureTestingModule({ imports: [SkinSelectComponent, TranslateTesting] });
    });

    it('offers every theme with the remembered one chosen, applies another and remembers it', async () => {
        localStorage.setItem('skin', 'nord');
        const fixture = TestBed.createComponent(SkinSelectComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        const list = (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;

        expect(Array.from(list.options, (option) => option.value)).toEqual([...SKINS]);
        expect(list.value).toBe('nord');
        expect(texts(list, 'option')[2]).toBe('skin.darcula');
        expect(Array.from(list.querySelectorAll('optgroup'), (group) => group.label)).toEqual([
            'skinGroup.basic',
            'skinGroup.editors',
            'skinGroup.shops',
            'skinGroup.screens',
            'skinGroup.paper',
            'skinGroup.decades',
            'skinGroup.season'
        ]);
        expect(list.getAttribute('aria-label')).toBe('system.skin');

        list.value = 'comic';
        list.dispatchEvent(new Event('change'));

        expect(document.documentElement.dataset['skin']).toBe('comic');
        expect(localStorage.getItem('skin')).toBe('comic');
    });
});

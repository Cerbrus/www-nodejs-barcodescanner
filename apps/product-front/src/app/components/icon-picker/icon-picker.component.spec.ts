import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { IconPickerComponent } from './icon-picker.component';
import { click, texts, type } from '../../../testing/fakes';
import { ApiService } from '../../services/api.service';

describe('IconPickerComponent', () => {
    let fixture: ComponentFixture<IconPickerComponent>;
    let page: HTMLElement;
    const picked: Array<string> = [];
    let closed = 0;

    beforeEach(async () => {
        picked.length = 0;
        closed = 0;
        TestBed.configureTestingModule({
            imports: [IconPickerComponent, TranslateModule.forRoot()],
            providers: [{ provide: ApiService, useValue: { iconsUrl: '/icons', getIcons: () => of(['milk', 'milk_carton', 'bread']) } }]
        });
        fixture = TestBed.createComponent(IconPickerComponent);
        fixture.componentInstance.picked.subscribe((name) => picked.push(name));
        fixture.componentInstance.closed.subscribe(() => closed++);
        page = fixture.nativeElement as HTMLElement;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('opens as a dialog and lists "none" first, then every icon with a readable name', () => {
        expect(page.querySelector('dialog')?.hasAttribute('open')).toBe(true);
        expect(texts(page, '.icon span')).toEqual(['icons.none', 'milk', 'milk carton', 'bread']);
        expect((page.querySelectorAll('.icon img')[1] as HTMLImageElement).getAttribute('src')).toBe('/icons/milk_carton.png');
    });

    it('filters while typing, reading a space as the underscore in file names', () => {
        type(page, 'input', 'Milk c');
        fixture.detectChanges();
        expect(texts(page, '.icon span')).toEqual(['icons.none', 'milk carton']);

        type(page, 'input', 'zzz');
        fixture.detectChanges();
        expect(texts(page, '.empty')).toEqual(['icons.noResults']);

        click(page, '.clear-button');
        fixture.detectChanges();
        expect(texts(page, '.icon span').length).toBe(4);
    });

    it('marks the chosen icon, or "none" when there is no icon', () => {
        expect(page.querySelector('.icon.none')?.classList.contains('selected')).toBe(true);

        fixture.componentRef.setInput('selected', 'bread');
        fixture.detectChanges();

        expect(texts(page, '.icon.selected span')).toEqual(['bread']);
    });

    it('offers the standard icon of the product right after "none"', () => {
        fixture.componentRef.setInput('suggested', 'bread');
        fixture.detectChanges();

        expect(texts(page, '.icon span').slice(0, 2)).toEqual(['icons.none', 'icons.standard']);
    });

    it('reports the picked icon, an empty name for "none", and a close', () => {
        click(page, '.icon', 2);
        click(page, '.icon.none');
        click(page, 'button.btn');

        expect(picked).toEqual(['milk_carton', '']);
        expect(closed).toBe(1);
    });

    it('closes on Escape and on a tap beside the sheet, not on a tap inside it', () => {
        const dialog = page.querySelector('dialog') as HTMLDialogElement;

        dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
        dialog.click();
        click(page, '.sheet');

        expect(closed).toBe(2);
    });
});

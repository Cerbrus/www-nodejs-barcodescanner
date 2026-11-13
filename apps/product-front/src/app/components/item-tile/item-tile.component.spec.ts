import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemTileComponent } from './item-tile.component';
import { click, item, texts } from '../../../testing/fakes';
import { ApiService } from '../../services/api.service';
import { ItemIconComponent } from '../item-icon/item-icon.component';

describe('ItemTileComponent and ItemIconComponent', () => {
    let fixture: ComponentFixture<ItemTileComponent>;
    let page: HTMLElement;
    const show = (inputs: Record<string, unknown>): void => {
        for (const [name, value] of Object.entries(inputs)) {
            fixture.componentRef.setInput(name, value);
        }
        fixture.detectChanges();
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [ItemTileComponent, ItemIconComponent],
            providers: [{ provide: ApiService, useValue: { iconsUrl: '/icons' } }]
        });
        fixture = TestBed.createComponent(ItemTileComponent);
        page = fixture.nativeElement as HTMLElement;
    });

    it('shows the name and note, and the quantity only from two', () => {
        show({ item: item(1, 'Melk'), quantity: 1, note: 'halfvol' });
        expect(texts(page, '.name, .note')).toEqual(['Melk', 'halfvol']);
        expect(page.querySelector('.quantity')).toBeNull();

        show({ quantity: 3 });
        expect(texts(page, '.quantity')).toEqual(['3']);
    });

    it('shows a badge in place of the quantity', () => {
        show({ item: item(1, 'Melk'), quantity: 3, badge: '+1' });

        expect(texts(page, '.quantity')).toEqual(['+1']);
    });

    it('takes the colour of its tone and marks a change that still waits', () => {
        show({ item: item(1, 'Melk'), tone: 'buy', pending: true });

        expect(page.querySelector('button.tile')?.classList.contains('buy')).toBe(true);
        expect(page.querySelector('.waiting')).not.toBeNull();
    });

    it('reports a tap on the tile and a tap on the details button apart', () => {
        const taps: Array<string> = [];
        fixture.componentInstance.selected.subscribe(() => taps.push('tile'));
        fixture.componentInstance.details.subscribe(() => taps.push('details'));
        show({ item: item(1, 'Melk'), showDetails: true, detailsLabel: 'Opties' });

        click(page, 'button.tile');
        click(page, 'button.details');

        expect(taps).toEqual(['tile', 'details']);
        expect(page.querySelector('button.details')?.getAttribute('aria-label')).toBe('Opties');
    });

    it('draws the icon file, then the emoji when the file is missing, then the first letter', () => {
        show({ item: { ...item(1, 'melk'), icon: 'milk carton', emoji: '🥛' } });
        const image = page.querySelector('app-item-icon img') as HTMLImageElement;
        expect(image.getAttribute('src')).toBe('/icons/milk%20carton.png');

        image.dispatchEvent(new Event('error'));
        fixture.detectChanges();
        expect(texts(page, 'app-item-icon .emoji')).toEqual(['🥛']);

        show({ item: item(2, 'melk') });
        expect(texts(page, 'app-item-icon .letter')).toEqual(['M']);
    });
});

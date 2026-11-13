import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BarcodeComponent } from './barcode.component';

describe('BarcodeComponent', () => {
    let fixture: ComponentFixture<BarcodeComponent>;

    const draw = (code: string | number): HTMLElement => {
        fixture.componentRef.setInput('barcode', code);
        fixture.detectChanges();

        return fixture.nativeElement as HTMLElement;
    };
    const modules = (element: HTMLElement): number =>
        Array.from(element.querySelectorAll('.barcode-bar') as NodeListOf<HTMLElement>).reduce((sum, bar) => sum + Number(bar.style.flexGrow), 0);
    const digits = (element: HTMLElement): string =>
        Array.from(element.querySelectorAll('.numeric span'), (span) => span.textContent?.trim() ?? '').join(' ');

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [BarcodeComponent] });
        fixture = TestBed.createComponent(BarcodeComponent);
    });

    it('draws a thirteen digit code as 95 modules, with the first digit apart', () => {
        const element = draw('8710400335481');

        expect(modules(element)).toBe(95);
        expect(digits(element)).toBe('8 710400 335481');
    });

    it('draws an eight digit code as 67 modules', () => {
        const element = draw('22223333');

        expect(modules(element)).toBe(67);
        expect(digits(element)).toBe(' 2222 3333');
    });

    it('reads a twelve digit code as thirteen digits with a leading zero', () => {
        expect(draw(123456789012).querySelector('.barcode-container')?.getAttribute('title')).toBe('0123456789012');
    });

    it('starts and ends with a dark bar and never draws two bars of the same colour side by side', () => {
        const bars = Array.from(draw('8710400335481').querySelectorAll('.barcode-bar'), (bar) => bar.classList.contains('bg-black'));

        expect(bars[0]).toBe(true);
        expect(bars.at(-1)).toBe(true);
    });

    it('draws nothing for a code that is not eight or thirteen digits', () => {
        for (const code of ['', '123', '871040033548X', '12345678901234']) {
            expect(draw(code).querySelector('.barcode-container')).toBeNull();
        }
    });
});

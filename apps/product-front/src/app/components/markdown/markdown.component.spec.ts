import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarkdownComponent } from './markdown.component';

describe('MarkdownComponent', () => {
    let fixture: ComponentFixture<MarkdownComponent>;

    const show = (text: string): HTMLElement => {
        fixture.componentRef.setInput('text', text);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    };

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [MarkdownComponent] });
        fixture = TestBed.createComponent(MarkdownComponent);
    });

    it('renders bold text in bold, without the markers', () => {
        const page = show('a *bold* word and **strong**');
        expect(page.querySelector('.italic')?.textContent).toBe('bold');
        expect(page.querySelector('.bold')?.textContent).toBe('strong');
        expect(page.textContent).toBe('a bold word and strong');
    });

    it('renders lists and links, the links opening a new tab', () => {
        const page = show('- one\n- [two](https://x.example)');
        expect(page.querySelectorAll('ul li').length).toBe(2);
        const link = page.querySelector('a') as HTMLAnchorElement;
        expect(link.getAttribute('href')).toBe('https://x.example');
        expect(link.target).toBe('_blank');
        expect(link.rel).toBe('noopener noreferrer');
    });

    it('never turns text into elements', () => {
        const page = show('<img src=x onerror=alert(1)> <b>hi</b>');
        expect(page.querySelector('img, b')).toBeNull();
        expect(page.textContent).toBe('<img src=x onerror=alert(1)> <b>hi</b>');
    });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarkdownComponent } from './markdown.component';

describe('MarkdownComponent', () => {
    let fixture: ComponentFixture<MarkdownComponent>;

    const show = async (text: string): Promise<HTMLElement> => {
        fixture.componentRef.setInput('text', text);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    };

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [MarkdownComponent] });
        fixture = TestBed.createComponent(MarkdownComponent);
    });

    it('renders bold, italic, strike-through and code without the markers', async () => {
        const page = await show('a *slanted* word, **strong**, ~~gone~~ and `code`');
        expect(page.querySelector('em')?.textContent).toBe('slanted');
        expect(page.querySelector('strong')?.textContent).toBe('strong');
        expect(page.querySelector('del')?.textContent).toBe('gone');
        expect(page.querySelector('code')?.textContent).toBe('code');
        expect(page.textContent?.trim()).toBe('a slanted word, strong, gone and code');
    });

    it('renders headings, lists, quotes and code blocks', async () => {
        const page = await show('# Title\n\n- one\n- two\n\n1. x\n\n> quoted\n\n```\n**raw**\n```');
        expect(page.querySelector('h1')?.textContent).toBe('Title');
        expect(page.querySelectorAll('ul li').length).toBe(2);
        expect(page.querySelectorAll('ol li').length).toBe(1);
        expect(page.querySelector('blockquote')?.textContent?.trim()).toBe('quoted');
        expect(page.querySelector('pre')?.textContent).toContain('**raw**');
    });

    it('keeps a single line break', async () => {
        const page = await show('line one\nline two');
        expect(page.querySelectorAll('br').length).toBe(1);
    });

    it('renders links that open a new tab', async () => {
        const page = await show('[two](https://x.example) and https://y.example');
        const links = Array.from(page.querySelectorAll('a'));
        expect(links.map((link) => link.getAttribute('href'))).toEqual(['https://x.example', 'https://y.example']);
        expect(links.every((link) => link.target === '_blank' && link.rel === 'noopener noreferrer')).toBe(true);
    });

    it('never turns typed html or script links into elements', async () => {
        const page = await show('<img src=x onerror=alert(1)> <b>hi</b> [x](javascript:alert(1))');
        expect(page.querySelector('img, b')).toBeNull();
        expect(page.textContent).toContain('<b>hi</b>');
        expect(page.querySelector('a')?.getAttribute('href')).toBe('unsafe:javascript:alert(1)');
    });
});

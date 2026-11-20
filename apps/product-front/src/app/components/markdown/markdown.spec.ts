import { parseInline, parseMarkdown } from './markdown';

describe('markdown', () => {
    it('reads bold, italic, strike-through and code', () => {
        expect(parseInline('a **b** *c* ~~d~~ `e`')).toEqual([
            { text: 'a ' },
            { text: 'b', bold: true },
            { text: ' ' },
            { text: 'c', italic: true },
            { text: ' ' },
            { text: 'd', strike: true },
            { text: ' ' },
            { text: 'e', code: true }
        ]);
    });

    it('nests styles and leaves loose markers alone', () => {
        expect(parseInline('**a *b* c**')).toEqual([
            { text: 'a ', bold: true },
            { text: 'b', bold: true, italic: true },
            { text: ' c', bold: true }
        ]);
        expect(parseInline('2 * 3 * 4 and snake_case_name')).toEqual([{ text: '2 * 3 * 4 and snake_case_name' }]);
    });

    it('makes links of markdown links and bare addresses, http and https only', () => {
        expect(parseInline('[site](https://a.example/x) and https://b.example/y.')).toEqual([
            { text: 'site', href: 'https://a.example/x' },
            { text: ' and ' },
            { text: 'https://b.example/y', href: 'https://b.example/y' },
            { text: '.' }
        ]);
        expect(parseInline('[x](javascript:alert(1))').every((segment) => !segment.href)).toBe(true);
    });

    it('splits blocks: paragraphs, headings, lists, quotes and code', () => {
        const blocks = parseMarkdown(
            '# Title\nline one\nline two\n\n- a\n- b\n\n1. x\n2. y\n\n> q\n\n```\n**raw**\n```'
        );
        expect(blocks.map((block) => block.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'quote', 'code']);
        expect(blocks[1]).toMatchObject({ lines: [[{ text: 'line one' }], [{ text: 'line two' }]] });
        expect(blocks[2]).toMatchObject({ ordered: false });
        expect(blocks[3]).toMatchObject({ ordered: true });
        expect(blocks[5]).toEqual({ type: 'code', text: '**raw**' });
    });

    it('survives an unclosed code fence and empty text', () => {
        expect(parseMarkdown('```\nopen')).toEqual([{ type: 'code', text: 'open' }]);
        expect(parseMarkdown('')).toEqual([]);
    });
});

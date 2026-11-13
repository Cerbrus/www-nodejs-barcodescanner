import { MessageCompiler } from './message.compiler';

type Compiled = (values?: Record<string, string | number>) => string;

describe('MessageCompiler', () => {
    const compiler = new MessageCompiler();
    const format = (text: string, values?: Record<string, string | number>, language = 'nl'): string =>
        (compiler.compile(text, language) as Compiled)(values);

    it('leaves a text without placeholders as it is', () => {
        expect(compiler.compile('Lijst', 'nl')).toBe('Lijst');
    });

    it('fills in a placeholder', () => {
        expect(format('{name} afgevinkt', { name: 'Melk' })).toBe('Melk afgevinkt');
    });

    it('picks the singular or the plural and writes the number', () => {
        const text = '{count, plural, one {# scan} other {# scans}}';

        expect(format(text, { count: 1 })).toBe('1 scan');
        expect(format(text, { count: 2 })).toBe('2 scans');
        expect(format(text, { count: 0 })).toBe('0 scans');
    });

    it('does not treat angle brackets in a text as markup', () => {
        expect(format('<{name}>', { name: 'x' })).toBe('<x>');
    });

    it('shows the raw text when a value is missing, instead of failing', () => {
        expect(format('{name} afgevinkt')).toBe('{name} afgevinkt');
    });

    it('compiles a whole translation file, nested groups included', () => {
        const compiled = compiler.compileTranslations({ nav: { list: 'Lijst' }, list: { checkedOff: '{name} afgevinkt' } }, 'nl') as {
            nav: { list: string };
            list: { checkedOff: Compiled };
        };

        expect(compiled.nav.list).toBe('Lijst');
        expect(compiled.list.checkedOff({ name: 'Brood' })).toBe('Brood afgevinkt');
    });
});

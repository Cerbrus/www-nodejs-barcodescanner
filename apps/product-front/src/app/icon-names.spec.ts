import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { ICON_NAMES } from './icon-names';

const SOURCE_FOLDER = join(process.cwd(), 'apps/product-front/src');
const ICON_ELEMENT = /<i\b[^>]*\bmaterial-symbols-outlined\b[^>]*>([\s\S]*?)<\/i>/g;
const ICON_ATTRIBUTE = /\bsubmitIcon="([a-z0-9_]+)"/g;
const QUOTED_NAME = /'([a-z0-9_]+)'/g;
const COMPARED_VALUE = /[!=]==\s*'[^']*'/g;
const FONT_REQUEST = /fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined[^']*/;

function sourceFiles(extension: string): Array<string> {
    return readdirSync(SOURCE_FOLDER, { recursive: true, encoding: 'utf-8' })
        .filter((file) => file.endsWith(extension))
        .map((file) => readFileSync(join(SOURCE_FOLDER, file), 'utf-8'));
}

function namesIn(content: string): Array<string> {
    const text = content.trim();
    if (!text.includes('{{')) {
        return [text];
    }

    return Array.from(text.replace(COMPARED_VALUE, '').matchAll(QUOTED_NAME), (match) => match[1]);
}

function namesInTemplates(): Array<string> {
    return sourceFiles('.html').flatMap((template) => [
        ...Array.from(template.matchAll(ICON_ELEMENT)).flatMap((match) => namesIn(match[1])),
        ...Array.from(template.matchAll(ICON_ATTRIBUTE), (match) => match[1])
    ]);
}

describe('the icons in the font request', () => {
    const listed: ReadonlyArray<string> = ICON_NAMES;

    it('lists every icon a template shows', () => {
        const missing = namesInTemplates().filter((name) => !listed.includes(name));

        expect(Array.from(new Set(missing))).toEqual([]);
    });

    it('lists each icon once, in the order of the alphabet, as the font host wants it', () => {
        expect(listed).toEqual(Array.from(new Set(listed)).sort());
    });

    it('lists no icon that the app does not use', () => {
        const code = sourceFiles('.ts').join('\n');
        const inTemplates = namesInTemplates();

        expect(listed.filter((name) => !inTemplates.includes(name) && !code.includes(`'${name}'`))).toEqual([]);
    });

    it('asks the font host for exactly these icons, in one weight and size', () => {
        const request = FONT_REQUEST.exec(readFileSync(join(SOURCE_FOLDER, 'styles.css'), 'utf-8'))?.[0];

        expect(request).toContain('opsz,wght,FILL,GRAD@24,400,0,0');
        expect(request).toMatch(new RegExp(`[?&]icon_names=${listed.join(',')}(&|$)`));
    });
});

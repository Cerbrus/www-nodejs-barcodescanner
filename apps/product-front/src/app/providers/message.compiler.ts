import { TranslateCompiler } from '@ngx-translate/core';

type Values = Record<string, unknown>;
type Message = string | ((values?: Values) => string);

const PLURAL = /\{(\w+), plural, one \{([^{}]*)\} other \{([^{}]*)\}\}/g;
const PLACEHOLDER = /\{(\w+)\}/g;

function fill(text: string, values: Values = {}): string {
    return text
        .replace(PLURAL, (_, name: string, one: string, other: string) =>
            (Number(values[name]) === 1 ? one : other).replace(/#/g, String(values[name] ?? ''))
        )
        .replace(PLACEHOLDER, (placeholder, name: string) => (name in values ? String(values[name]) : placeholder));
}

export class MessageCompiler extends TranslateCompiler {
    public compile(value: string): Message {
        return value.includes('{') ? (values?: Values): string => fill(value, values) : value;
    }

    public compileTranslations(translations: unknown): unknown {
        if (typeof translations === 'string') {
            return this.compile(translations);
        }
        if (typeof translations !== 'object' || translations === null) {
            return translations;
        }

        return Object.fromEntries(Object.entries(translations).map(([key, value]) => [key, this.compileTranslations(value)]));
    }
}

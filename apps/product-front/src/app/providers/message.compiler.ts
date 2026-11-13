import { TranslateCompiler } from '@ngx-translate/core';
import { IntlMessageFormat } from 'intl-messageformat';

type Values = Record<string, string | number>;
type Message = string | ((values?: Values) => string);

export class MessageCompiler extends TranslateCompiler {
    public compile(value: string, language: string): Message {
        if (!value.includes('{')) {
            return value;
        }

        const message = new IntlMessageFormat(value, language, undefined, { ignoreTag: true });

        return (values?: Values): string => {
            try {
                return String(message.format(values));
            } catch {
                return value;
            }
        };
    }

    public compileTranslations(translations: unknown, language: string): unknown {
        if (typeof translations === 'string') {
            return this.compile(translations, language);
        }
        if (typeof translations !== 'object' || translations === null) {
            return translations;
        }

        return Object.fromEntries(Object.entries(translations).map(([key, value]) => [key, this.compileTranslations(value, language)]));
    }
}

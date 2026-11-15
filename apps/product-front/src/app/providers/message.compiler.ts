import {
    InterpolatableTranslation,
    InterpolatableTranslationObject,
    TranslateCompiler,
    TranslationObject
} from '@ngx-translate/core';
import { IntlMessageFormat } from 'intl-messageformat';

type Values = Record<string, string | number>;

export class MessageCompiler extends TranslateCompiler {
    public compile(value: string, language: string): InterpolatableTranslation {
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

    public compileTranslations(translations: TranslationObject, language: string): InterpolatableTranslationObject {
        return Object.fromEntries(
            Object.entries(translations).map(([key, value]) => [key, this.compileValue(value, language)])
        );
    }

    private compileValue(value: unknown, language: string): InterpolatableTranslation {
        if (typeof value === 'string') {
            return this.compile(value, language);
        }
        if (typeof value !== 'object' || value === null) {
            return value as InterpolatableTranslation;
        }

        return this.compileTranslations(value as TranslationObject, language);
    }
}

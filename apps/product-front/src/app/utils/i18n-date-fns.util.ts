import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { format, formatDistance, formatDistanceStrict, formatRelative, Locale } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';

export const SupportedLocales = ['en', 'nl'] as const;
export const DefaultLocale = 'en' as const;
export type SupportedLocale = (typeof SupportedLocales)[number];

type FormatFunction = typeof format | typeof formatDistance | typeof formatDistanceStrict | typeof formatRelative;

@Injectable({ providedIn: 'root' })
export class I18nDateFns {
    private locales: Record<SupportedLocale, Locale> = { en: enUS, nl };

    public format = this.wrapFunction(format);
    public formatDistance = this.wrapFunction(formatDistance);
    public formatDistanceStrict = this.wrapFunction(formatDistanceStrict);
    public formatRelative = this.wrapFunction(formatRelative);

    constructor(private readonly translate: TranslateService) {}

    private wrapFunction<T extends FormatFunction>(fn: T): T {
        return ((...args: Parameters<T>) => {
            const language = (this.translate.currentLang ?? this.translate.defaultLang) as SupportedLocale;

            return fn(args[0], args[1] as string | (string & Date), {
                ...(args[2] ?? {}),
                locale: this.locales[language],
            });
        }) as T;
    }
}

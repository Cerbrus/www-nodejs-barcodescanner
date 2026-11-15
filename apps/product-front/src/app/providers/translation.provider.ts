import { Provider } from '@angular/core';
import {
    TranslateLoader,
    TranslationObject,
    provideTranslateCompiler,
    provideTranslateLoader,
    provideTranslateService
} from '@ngx-translate/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { tap } from 'rxjs/operators';

import { MessageCompiler } from './message.compiler';

// Using lazy loader instead of http loader to prevent accidental caching
// https://github.com/ngx-translate/http-loader/issues/25#issuecomment-514056865
export class LazyTranslateLoader implements TranslateLoader {
    public translationsLoaded$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    public getTranslation(lang: string): Observable<TranslationObject> {
        return from(import(`../../assets/i18n/${lang}.json`) as Promise<TranslationObject>).pipe(
            tap(() => this.translationsLoaded$.next(true))
        );
    }
}

export function provideTranslation(): Array<Provider> {
    return provideTranslateService({
        fallbackLang: 'nl',
        loader: provideTranslateLoader(LazyTranslateLoader),
        compiler: provideTranslateCompiler(MessageCompiler)
    });
}

import { HttpClient } from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TranslateCompiler, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateMessageFormatCompiler } from 'ngx-translate-messageformat-compiler';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { tap } from 'rxjs/operators';

// Using lazy loader instead of http loader to prevent accidental caching
// https://github.com/ngx-translate/http-loader/issues/25#issuecomment-514056865
export class LazyTranslateLoader implements TranslateLoader {
    public translationsLoaded$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    public getTranslation(lang: string): Observable<unknown> {
        return from(import(`../../assets/i18n/${lang}.json`)).pipe(tap(() => this.translationsLoaded$.next(true)));
    }
}

export function createTranslateLoader(): LazyTranslateLoader {
    return new LazyTranslateLoader();
}

export function provideTranslation(): Array<Provider | EnvironmentProviders> {
    return TranslateModule.forRoot({
        defaultLanguage: 'nl',
        loader: {
            provide: TranslateLoader,
            useFactory: createTranslateLoader,
            deps: [HttpClient]
        },
        compiler: {
            provide: TranslateCompiler,
            useClass: TranslateMessageFormatCompiler
        }
    }).providers!;
}

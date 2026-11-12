import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { startWith, switchMap, tap } from 'rxjs';

@Component({
    standalone: true,
    imports: [RouterModule],
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
    constructor(translate: TranslateService) {
        translate.onLangChange
            .pipe(
                startWith(null),
                switchMap(() => translate.get('common.appName')),
                tap((appTitle) => {
                    document.title = appTitle;
                }),
                takeUntilDestroyed()
            )
            .subscribe();
    }
}

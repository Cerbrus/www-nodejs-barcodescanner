import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { SoundTestComponent } from '../../components/sound-test/sound-test.component';

@Component({
    selector: 'app-sounds-page',
    standalone: true,
    imports: [RouterLink, TranslateModule, SoundTestComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <a class="back-bar" routerLink="/system">
                <i class="material-symbols-outlined">arrow_back</i>
                {{ 'nav.system' | translate }}
            </a>
            <h1 class="page-title">{{ 'sound.title' | translate }}</h1>
            <app-sound-test />
        </div>
    `
})
export class SoundsPage {}

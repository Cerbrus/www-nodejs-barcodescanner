import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { SoundSettingsComponent } from '../../components/sound-settings/sound-settings.component';

@Component({
    selector: 'app-sounds-page',
    standalone: true,
    imports: [RouterLink, TranslatePipe, SoundSettingsComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <a class="back-bar" routerLink="/system">
                <i class="material-symbols-outlined">arrow_back</i>
                {{ 'nav.system' | translate }}
            </a>
            <h1 class="page-title">{{ 'sound.title' | translate }}</h1>
            <app-sound-settings />
        </div>
    `
})
export class SoundsPage {}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { SoundSettingsComponent } from '../../components/sound-settings/sound-settings.component';

@Component({
    selector: 'app-sounds-page',
    standalone: true,
    imports: [RouterLink, TranslatePipe, SoundSettingsComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sounds.page.html'
})
export class SoundsPage {}

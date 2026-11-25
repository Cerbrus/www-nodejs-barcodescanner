import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ThemeService } from '../../services/theme.service';
import { SKINS, SKIN_GROUPS } from '../../skins';

@Component({
    selector: 'app-skin-select',
    standalone: true,
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './skin-select.component.html',
    styleUrl: './skin-select.component.scss'
})
export class SkinSelectComponent {
    protected readonly theme = inject(ThemeService);
    protected readonly groups = SKIN_GROUPS;

    protected use(event: Event): void {
        const chosen = (event.target as HTMLSelectElement).value;
        const skin = SKINS.find((candidate) => candidate === chosen);

        if (skin) {
            this.theme.useSkin(skin);
        }
    }
}

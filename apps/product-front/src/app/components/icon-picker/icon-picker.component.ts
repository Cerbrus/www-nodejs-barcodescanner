import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { ApiService } from '../../services/api.service';
import { SheetComponent } from '../sheet/sheet.component';

@Component({
    selector: 'app-icon-picker',
    standalone: true,
    imports: [FormsModule, TranslatePipe, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './icon-picker.component.html',
    styleUrl: './icon-picker.component.scss'
})
export class IconPickerComponent {
    public readonly selected = input('');
    public readonly suggested = input<string | undefined>(undefined);
    public readonly picked = output<string>();
    public readonly closed = output<void>();

    protected readonly search = signal('');
    protected readonly iconsUrl = inject(ApiService).iconsUrl;
    protected readonly names = toSignal(inject(ApiService).getIcons(), { initialValue: [] });

    protected readonly matches = computed(() => {
        const term = this.search().trim().toLowerCase().replace(/\s+/g, '_');
        return term ? this.names().filter((name) => name.includes(term)) : this.names();
    });

    protected label(name: string): string {
        return name.replace(/_/g, ' ');
    }
}

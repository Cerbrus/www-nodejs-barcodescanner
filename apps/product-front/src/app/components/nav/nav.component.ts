import { Component, computed, Input, signal, Signal } from '@angular/core';
import { NavItem, NavItemComponent } from './nav-item.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, startWith, tap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { StorageService } from '../../services/storage.service';

@Component({
    selector: 'app-nav',
    templateUrl: './nav.component.html',
    styleUrl: './nav.component.scss',
    imports: [NavItemComponent, TranslateModule, MatMenuModule, MatIconModule, MatButtonModule],
    standalone: true
})
export class NavComponent {
    @Input({ required: true })
    public title!: string;

    @Input({ required: true })
    public navItems!: Array<NavItem>;

    public open = signal(true);

    public currentLang = toSignal(this.translate.onLangChange.pipe(map(x => x.lang), startWith(this.translate.defaultLang)));

    public supportedLanguages = ['nl', 'en'] as const;

    protected toggleNavItem: Signal<NavItem> = computed(() => {
        return {
            label: this.open() ? 'nav.toggle.close' : 'nav.toggle.open',
            icon: this.open() ? 'left_panel_close' : 'left_panel_open'
        };
    });

    public constructor(private readonly translate: TranslateService,
                       private readonly stor: StorageService) {
        stor.get<boolean>('NavComponent', 'open')
            .pipe(tap((value) => this.open.set(value ?? false)))
            .subscribe();
    }

    public toggleLanguage(lang: 'nl' | 'en'): void {
        if (this.translate.currentLang !== lang)
            this.translate.use(lang);

    }

    public toggle(): void {
        const open = !this.open();
        this.stor.set('NavComponent', 'open', open);
        this.open.set(open);
    }

    protected readonly onmouseleave = onmouseleave;
}

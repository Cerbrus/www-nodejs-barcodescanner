import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-nav-item',
    templateUrl: './nav-item.component.html',
    styleUrl: './nav-item.component.scss',
    imports: [
        RouterLink,
        RouterLinkActive,
        TranslateModule
    ],
    standalone: true
})
export class NavItemComponent {
    @Input({ required: true })
    public item!: NavItem;

    @Input()
    public compact = false;
}


export interface NavItem {
    route?: string;
    label: string;
    icon: string;
    count?: number;
}

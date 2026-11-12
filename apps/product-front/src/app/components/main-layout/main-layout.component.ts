import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NavComponent } from '../nav/nav.component';
import { NavItem } from '../nav/nav-item.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-main-layout',
    standalone: true,
    imports: [RouterModule, NavComponent, MatSidenavModule, MatCheckboxModule, FormsModule, MatButtonModule],
    templateUrl: './main-layout.component.html',
    styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
    protected title = 'common.appName';

    protected navItems: Array<NavItem> = [
        { route: '/products', label: 'nav.products', icon: 'grocery', count: 42 },
        { route: '/barcodes', label: 'nav.barcodes', icon: 'barcode', count: 1337 },
        { route: '/store-products', label: 'nav.store-products', icon: 'shopping_cart', count: 0 }
    ];
}

import { Route } from '@angular/router';

import { ShellComponent } from '../components/shell/shell.component';
import { requireLogin, requireOwner } from '../services/auth.service';

export const appRoutes: Array<Route> = [
    {
        path: 'login',
        loadComponent: () => import('../pages/login/login.page').then((m) => m.LoginPage)
    },
    {
        path: '',
        component: ShellComponent,
        canActivate: [requireLogin],
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'list' },
            {
                path: 'list',
                loadComponent: () => import('../pages/list/list.page').then((m) => m.ListPage)
            },
            {
                path: 'scan',
                loadComponent: () => import('../pages/scan/scan.page').then((m) => m.ScanPage)
            },
            {
                path: 'inbox',
                loadComponent: () => import('../pages/inbox/inbox.page').then((m) => m.InboxPage)
            },
            {
                path: 'catalog',
                loadComponent: () => import('../pages/catalog/catalog.page').then((m) => m.CatalogPage)
            },
            {
                path: 'catalog/:id',
                loadComponent: () => import('../pages/item/item.page').then((m) => m.ItemPage)
            },
            {
                path: 'history',
                canActivate: [requireOwner],
                loadComponent: () => import('../pages/history/history.page').then((m) => m.HistoryPage)
            },
            {
                path: 'log',
                canActivate: [requireOwner],
                loadComponent: () => import('../pages/log/log.page').then((m) => m.LogPage)
            },
            {
                path: 'system',
                loadComponent: () => import('../pages/system/system.page').then((m) => m.SystemPage)
            }
        ]
    },
    { path: '**', redirectTo: 'list' }
];

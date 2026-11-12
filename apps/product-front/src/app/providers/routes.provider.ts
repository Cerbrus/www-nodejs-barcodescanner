import { Route } from '@angular/router';

import { ShellComponent } from '../components/shell/shell.component';

export const appRoutes: Array<Route> = [
    {
        path: '',
        component: ShellComponent,
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
                loadComponent: () => import('../pages/history/history.page').then((m) => m.HistoryPage)
            },
            {
                path: 'log',
                loadComponent: () => import('../pages/log/log.page').then((m) => m.LogPage)
            },
            {
                path: 'more',
                loadComponent: () => import('../pages/more/more.page').then((m) => m.MorePage)
            }
        ]
    },
    { path: '**', redirectTo: 'list' }
];

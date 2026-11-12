import { Route } from '@angular/router';

import { MainLayoutComponent } from '../components/main-layout/main-layout.component';

export const appRoutes: Array<Route> = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: '/barcodes'
    },
    {
        path: '',
        component: MainLayoutComponent,
        children: [
            {
                path: 'barcodes',
                loadComponent: () =>
                    import('../features/barcode-overview/barcode-overview.component').then((m) => m.BarcodeOverviewComponent)
                /*children: [
                    {
                        path: ':id',
                        loadComponent: () =>
                            import('../features/poll-details/poll-details.component').then(
                                (m) => m.PollDetailsComponent
                            )
                    }
                ]*/
            }
        ]
    },
    /* {
         path: '',
         component: MainLayoutComponent,
         children: [
             {
                 path: 'templates/new',
                 loadComponent: () =>
                     import('../features/poll-template-create/poll-template-create.component').then(
                         (m) => m.PollTemplateCreateComponent
                     )
             },
             {
                 path: 'templates',
                 loadComponent: () =>
                     import('../features/poll-template-overview/poll-template-overview.component').then(
                         (m) => m.PollTemplateOverviewComponent
                     ),
                 children: [
                     {
                         path: ':templateId',
                         loadComponent: () =>
                             import('../features/poll-template-details/poll-template-details.component').then(
                                 (m) => m.PollTemplateDetailsComponent
                             )
                     },
                     {
                         path: ':templateId/options/:optionId',
                         loadComponent: () =>
                             import(
                                 '../features/poll-template-option-details/poll-template-option-details.component'
                                 ).then((m) => m.PollTemplateOptionDetailsComponent)
                     }
                 ]
             }
         ]
     },*/
    {
        path: '**',
        redirectTo: '/barcodes'
    }
];

import {RouterModule, Routes} from '@angular/router';
import {TrackingComponent} from './tracking.component';
import {NgModule} from '@angular/core';
import {TrackingViewComponent} from './tracking-view/tracking-view.component';
import {TrackingNotFoundComponent} from './tracking-not-found/tracking-not-found.component';

const routes: Routes = [
    {
        path: '',
        component: TrackingComponent,
        children: [
            {
                path: '',
                component: TrackingViewComponent
            },
            {
                path: 'tracking',
                component: TrackingViewComponent
            },
            {
                path: ':invoiceId/:invoiceType',
                component: TrackingViewComponent
            },
            {
                path: 'not-found',
                component: TrackingNotFoundComponent
            }
        ]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class TrackingRoutingModule {
}

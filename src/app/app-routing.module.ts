import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MisComprasComponent } from 'src/app/modules/mis-compras/mis-compras.component';

const routes: Routes = [
    { path: '', pathMatch: 'full', component: MisComprasComponent },
    { path: 'mis-compras', component: MisComprasComponent },
    { path: 'tracking', loadChildren: () => import('./modules/tracking/tracking.module').then(m => m.TrackingModule) },
    { path: '**', redirectTo: 'mis-compras' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule {
}

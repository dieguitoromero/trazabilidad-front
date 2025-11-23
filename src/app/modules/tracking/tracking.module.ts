import {NgModule} from '@angular/core';
import {TrackingComponent} from './tracking.component';
import {CommonModule} from '@angular/common';
import {TrackingRoutingModule} from './tracking.routing';
import {TrackingSearchBoxComponent} from './tracking-search-box/tracking-search-box.component';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatRadioModule} from '@angular/material/radio';
import {ReactiveFormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {TrackingHintModalComponent} from './tracking-hint-modal/tracking-hint-modal.component';
import {MatDialogModule} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {TrackingService} from '../../services/tracking.service';
import {TrackingRepository} from '../../repositories/tracking.repository';
import {TrackingNotFoundComponent} from './tracking-not-found/tracking-not-found.component';
import {TrackingViewComponent} from './tracking-view/tracking-view.component';
import {TrackingStepperViewComponent} from './tracking-view/tracking-stepper-view/tracking-stepper-view.component';
import { TimelineModule } from '../timeline/timeline.module';
import {TrackingMachinableProcessComponent} from './tracking-view/tracking-machinable-process/tracking-machinable-process.component';
import {TrackingMachinableOrderViewerComponent} from './tracking-view/tracking-machinable-order-viewer/tracking-machinable-order-viewer.component';
import {MatExpansionModule} from '@angular/material/expansion';
import {TrackingOrderDetailsComponent} from './tracking-view/tracking-order-details/tracking-order-details.component';
import {TrackingDeliveryDetailsComponent} from './tracking-view/tracking-delivery-details/tracking-delivery-details.component';
import {MatBadgeModule} from '@angular/material/badge';
import { PurchaseSummaryComponent } from './tracking-view/purchase-summary/purchase-summary.component';
import { OrderProductsComponent } from './tracking-view/order-products/order-products.component';

@NgModule({
  imports: [
    CommonModule,
    TrackingRoutingModule,
    ReactiveFormsModule,

    MatInputModule,
    MatFormFieldModule,
    MatRadioModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
  MatExpansionModule,
  MatBadgeModule,
  TimelineModule,
  ],
  declarations: [
    TrackingComponent,
    TrackingSearchBoxComponent,
  TrackingStepperViewComponent,
    TrackingNotFoundComponent,
    TrackingHintModalComponent,
    TrackingViewComponent,
    TrackingMachinableProcessComponent,
    TrackingMachinableOrderViewerComponent,
    TrackingOrderDetailsComponent,
  TrackingDeliveryDetailsComponent,
  PurchaseSummaryComponent,
  OrderProductsComponent,
  ],
  providers: [
    TrackingService,
    TrackingRepository,
  ],
})
export class TrackingModule {}

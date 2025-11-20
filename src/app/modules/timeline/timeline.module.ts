import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchaseTimelineComponent } from '../tracking/purchase-timeline/purchase-timeline.component';
import { PurchaseStepperComponent } from './purchase-stepper/purchase-stepper.component';

@NgModule({
  imports: [CommonModule],
  declarations: [PurchaseTimelineComponent, PurchaseStepperComponent],
  exports: [PurchaseTimelineComponent, PurchaseStepperComponent]
})
export class TimelineModule {}
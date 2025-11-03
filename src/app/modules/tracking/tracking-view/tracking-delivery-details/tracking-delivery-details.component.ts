import {Component, Input} from '@angular/core';
import {PickupModel} from '../../../../core/models/pickup.model';

@Component({
    selector: 'app-tracking-delivery-details',
    templateUrl: './tracking-delivery-details.template.html',
    styleUrls: ['tracking-delivery-details.mobile.scss', 'tracking-delivery-details.scss']
})
export class TrackingDeliveryDetailsComponent {
    @Input() pickup: PickupModel | undefined;

}

import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {OrderDetailsModel} from '../../../../core/models/order-details.model';
import {OrderItemStatusModel} from './order-item-status.model';
import {ArrayHelper} from '../../../../core/helpers/array.helper';

@Component({
    selector: 'app-tracking-order-details',
    templateUrl: './tracking-order-details.template.html',
    styleUrls: ['./tracking-order-details.mobile.scss', 'tracking-order-details.scss']
})
export class TrackingOrderDetailsComponent implements OnChanges {
    @Input() orderDetails: OrderDetailsModel[] | undefined;
    @Input() isBox = false;

    public status: OrderItemStatusModel[] = [];

    ngOnChanges(changes: SimpleChanges): void {

        if (changes.orderDetails) {
            this.status = [];
            this._prepareData(this.orderDetails || []);
        }
    }

    private _prepareData(orderDetails: OrderDetailsModel[]): void {
        const groups = ArrayHelper.groupBy(orderDetails, o => o.stateDescription);

        if (groups.undefined != null) {
            return;
        }

        Object.getOwnPropertyNames(groups).forEach((o) => {
            this.status.push(new OrderItemStatusModel(o, OrderDetailsModel.MapFromObjs(groups[o])));
        });
    }

}

import {OrderDetailsModel} from '../../../../core/models/order-details.model';

export class OrderItemStatusModel {
    public products: OrderDetailsModel[];
    public status: string;

    constructor(status: string = '', products: OrderDetailsModel[] = []) {
        this.products = products;
        this.status = status;
    }

}

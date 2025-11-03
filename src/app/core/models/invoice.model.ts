import {PickupModel} from './pickup.model';
import {TrackingStepModel} from './tracking-step.model';
import {SellerModel} from './seller.model';
import {OrderDetailsModel} from './order-details.model';

export class InvoiceModel {
    public printedNumber!: string;
    public documentType!: string;
    public documentLabel!: string;
    public total!: number;
    public issueDate!: Date;
    public payId!: number;
    public pickup!: PickupModel;
    public trackingSteps: TrackingStepModel[];
    public seller: SellerModel;
    public orderProducts: OrderDetailsModel[];

    constructor() {
        this.trackingSteps = [];
        this.seller = new SellerModel();
        this.orderProducts = [];
    }

    get hasProductDetails(): boolean {
        return this.orderProducts.length > 0;
    }


    public static mapFromObj(obj: any): InvoiceModel | undefined {

        const m = new InvoiceModel();

        if (!obj || !obj.traceability) {
            return;
        }

        m.printedNumber = obj.number_printed;
        m.documentType = obj.type_document;
        m.documentLabel = obj.label_document;
        m.total = obj.total;
        m.issueDate = obj.date_issue;
        m.payId = obj.id_pay;
        m.pickup = PickupModel.mapFromObj(obj.pickup);
        m.trackingSteps = TrackingStepModel.mapFromObjs(obj?.traceability?.steps);
        m.seller = SellerModel.mapFromObj(obj.seller);
        m.orderProducts = OrderDetailsModel.MapFromObjs(obj?.DetailsProduct);


        return m;
    }
}

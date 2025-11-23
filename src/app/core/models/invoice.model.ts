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
    public deliveryAddress?: string; // direccionEntrega para despacho o retiro
    public deliveryType?: string; // tipoEntrega (Retiro en tienda / Despacho a domicilio)

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
        // Priorizar arreglo 'productos' si viene del servicio de documentos; fallback a DetailsProduct legacy
        const rawProductos = Array.isArray(obj?.productos) ? obj.productos : [];
        if (rawProductos.length > 0) {
            m.orderProducts = OrderDetailsModel.MapFromObjs(rawProductos);
        } else {
            m.orderProducts = OrderDetailsModel.MapFromObjs(obj?.DetailsProduct);
        }
        m.deliveryAddress = obj.direccionEntrega || obj.direccion || undefined;
        m.deliveryType = obj.tipoEntrega || undefined;


        return m;
    }
}

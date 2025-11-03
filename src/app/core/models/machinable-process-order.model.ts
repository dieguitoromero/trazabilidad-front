import {MachinableProcessOrderStepTitleModel} from './machinable-process-order-step-title.model';
import {MachinableProcessOrderStepModel} from './machinable-process-order-step.model';
import {OrderDetailsModel} from './order-details.model';

export class MachinableProcessOrderModel {
    public title!: MachinableProcessOrderStepTitleModel;
    public description!: string;
    public date!: Date;
    public color!: string;
    public steps: MachinableProcessOrderStepModel[];
    public orderDetails: OrderDetailsModel[];

    constructor() {
        this.steps = [];
        this.orderDetails = [];
    }

    public static MapFromObj(obj: any): MachinableProcessOrderModel {
        const m = new MachinableProcessOrderModel();

        if (!obj) {
            return m;
        }

        m.title = MachinableProcessOrderStepTitleModel.MapFromObj(obj.title);
        m.description = obj.description;
        m.color = obj.color;
        m.date = obj.date;
        m.steps = MachinableProcessOrderStepModel.mapFromObjs(obj.machinable_steps);
        m.orderDetails = OrderDetailsModel.MapFromObjs(obj.Boards);

        return m;
    }

    public static MapFromObjs(obj: any): MachinableProcessOrderModel[] {
        let mA = [];

        if (obj && obj.length > 0) {
            mA = obj.map((o: any) => this.MapFromObj(o));
        }

        return mA;
    }

}

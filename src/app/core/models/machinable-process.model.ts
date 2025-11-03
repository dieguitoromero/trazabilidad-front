import {MachinableProcessOrderModel} from './machinable-process-order.model';

export class MachinableProcessModel {
    public text!: string;
    public color!: string;
    public icon!: string;
    public orders: MachinableProcessOrderModel[];

    constructor() {
        this.orders = [];
    }


    public static MapFromObj(obj: any): MachinableProcessModel {
        const m = new MachinableProcessModel();

        if (!obj) {
            return m;
        }

        m.text = obj.text;
        m.color = obj.color;
        m.icon = obj.icon;
        m.orders = MachinableProcessOrderModel.MapFromObjs(obj.orders);

        return m;
    }

}

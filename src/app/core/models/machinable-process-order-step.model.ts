import {MachinableProcessOrderStepTitleModel} from './machinable-process-order-step-title.model';

export class MachinableProcessOrderStepModel {

    public title!: MachinableProcessOrderStepTitleModel;
    public description!: string;
    public date!: Date;
    public icon!: string;

    public static mapFromObj(obj: any): MachinableProcessOrderStepModel {
        const m = new MachinableProcessOrderStepModel();

        if (!obj) {
            return m;
        }

        m.title = MachinableProcessOrderStepTitleModel.MapFromObj(obj.title);
        m.description = obj.description;
        m.date = obj.date;
        m.icon = obj.icon;

        return m;
    }

    public static mapFromObjs(obj: any[]): MachinableProcessOrderStepModel[] {
        return obj.map(o => MachinableProcessOrderStepModel.mapFromObj(o));
    }
}

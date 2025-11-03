import {TrackingStepTitleModel} from './tracking-step-title.model';
import {MachinableProcessModel} from './machinable-process.model';

export class TrackingStepModel {

    public title!: TrackingStepTitleModel;
    public description!: string;
    public date!: Date;
    public icon!: string;
    public machinable?: MachinableProcessModel;

    public static mapFromObj(obj: any): TrackingStepModel {
        const m = new TrackingStepModel();

        if (!obj) {
            return m;
        }

        m.title = TrackingStepTitleModel.MapFromObj(obj.title);
        m.description = obj.description;
        m.date = obj.date;
        m.icon = obj.icon;
        m.machinable = MachinableProcessModel.MapFromObj(obj.machinable);

        return m;
    }

    public static mapFromObjs(obj: any[]): TrackingStepModel[] {
        return obj.map(o => TrackingStepModel.mapFromObj(o));
    }

}

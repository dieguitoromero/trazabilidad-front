export class PickupModel {
    public title!: string;
    public text!: string;
    public dateTitle!: string;
    public date!: Date;
    public icon!: string;

    public static mapFromObj(obj: any): PickupModel {

        const m = new PickupModel();

        if (!obj) {
            return m;
        }

        m.date = obj.date;
        m.dateTitle = obj.title_date;
        m.icon = obj.icon;
        m.text = obj.text;
        m.title = obj.title;

        return m;
    }
}

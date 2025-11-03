export class MachinableProcessOrderStepTitleModel {
    public text!: string;
    public color!: string;
    public isBold!: boolean;

    public static MapFromObj(obj: any): MachinableProcessOrderStepTitleModel {
        const m = new MachinableProcessOrderStepTitleModel();

        if (!obj) {
            return m;
        }

        m.text = obj.text;
        m.color = obj.color;
        m.isBold = obj.isBold;

        return m;
    }

}

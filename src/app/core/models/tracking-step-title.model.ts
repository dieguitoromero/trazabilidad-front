export class TrackingStepTitleModel {
    public text!: string;
    public color!: string;
    public isBold!: boolean;

    public static MapFromObj(obj: any): TrackingStepTitleModel {
        const m = new TrackingStepTitleModel();

        if (!obj) {
            return m;
        }

        m.text = obj.text;
        m.color = obj.color;
        m.isBold = obj.isBold;

        return m;
    }
}

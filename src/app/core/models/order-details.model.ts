export class OrderDetailsModel {
    public order!: number;
    public lineNumber!: number;
    public internalNumber!: number;
    public documentType!: string;
    public quantity!: number;
    public code!: number;
    public codeUnimed!: string;
    public image!: string;
    public description!: string;
    public descriptionUnimed!: string;
    public stateDescription!: string;

    public static MapFromObj(obj: any): OrderDetailsModel {
        const m = new OrderDetailsModel();

        if (!obj) {
            return m;
        }

        m.order = obj.order;
        m.lineNumber = obj.lineNumber;
        m.internalNumber = obj.internalNumber;
        m.documentType = obj.documentType;
        m.quantity = obj.quantity;
        m.codeUnimed = obj.codeUnimed;
        m.image = obj.image;
        m.description = obj.description;
        m.descriptionUnimed = obj.descriptionUnimed;
        m.code = obj.code;
        m.stateDescription = obj.state_description;

        return m;
    }

    public static MapFromObjs(obj: any[]): OrderDetailsModel[] {
        if (!obj) {
            return [];
        }

        return obj.map((o) => this.MapFromObj(o));
    }
}

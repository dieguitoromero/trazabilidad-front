export class InvoiceTokenModel {
    public uuid!: string;

    constructor() {
    }

    public static mapFromObj(obj: any): InvoiceTokenModel | undefined {

        const m = new InvoiceTokenModel();

        if (!obj || !obj["Uuid"]) {
          m.uuid = '';
          return m;
        }

        m.uuid = obj["Uuid"];

        return m;
    }
}
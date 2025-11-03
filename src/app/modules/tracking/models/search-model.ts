export class SearchModel {
    public invoiceId: number;
    public invoiceType: string;

    constructor(invoiceId: number, invoiceType: string) {
        this.invoiceId = invoiceId;
        this.invoiceType = invoiceType;
    }
}

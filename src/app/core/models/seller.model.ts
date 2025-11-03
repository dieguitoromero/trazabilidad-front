export class SellerModel {
    public title!: string;
    public name!: string;
    public mail!: string;
    public phone!: string;
    public iconPrincipal!: string;
    public iconPhone!: string;
    public iconMail!: string;

    public static mapFromObj(obj: any): SellerModel {
        const m = new SellerModel();

        if (!obj) {
            return m;
        }

        m.iconMail = obj.icon_email;
        m.iconPhone = obj.icon_phone;
        m.iconPrincipal = obj.icon_principal;
        m.title = obj.title;
        m.name = obj.name;
        m.mail = obj.mail;
        m.phone = obj.phone;

        return m;
    }
}

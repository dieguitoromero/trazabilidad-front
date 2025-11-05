export class AuthModel {
    public token_type!: string;
    public expires_in!: number;
    public ext_expires_in!: number;
    public access_token!: string;

    public static mapFromObj(obj: any): AuthModel {
        const a = new AuthModel();
        a.token_type = obj.token_type;
        a.expires_in = obj.expires_in;
        a.ext_expires_in = obj.ext_expires_in;
        a.access_token = obj.access_token;
        return a;
    }
}
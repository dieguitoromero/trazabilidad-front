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
    // Campos raw adicionales soportados
    public nombre?: string;
    public descripcion?: string; // raw
    public sku?: string | number;
    public unidadMedida?: string;
    public rawCantidad?: number;
    public rawCodigo?: string | number;

    public static MapFromObj(obj: any): OrderDetailsModel {
        const m = new OrderDetailsModel();

        if (!obj) {
            return m;
        }

        m.order = obj.order;
        m.lineNumber = obj.lineNumber;
        m.internalNumber = obj.internalNumber;
        m.documentType = obj.documentType;
        // quantity: priorizar cantidad si viene de productos raw
        m.quantity = obj.quantity !== undefined ? obj.quantity : (obj.cantidad !== undefined ? obj.cantidad : undefined);
        m.codeUnimed = obj.codeUnimed || obj.code_unimed || '';
        m.image = obj.image || obj.imagen;
        // Buscar descripción en múltiples campos posibles (el backend puede enviarla en diferentes campos)
        m.description = obj.name || obj.nombre || obj.product_name || obj.productName || 
                        obj.titulo || obj.title || obj.descripcion || obj.description || '';
        m.descriptionUnimed = obj.descriptionUnimed || obj.description_unimed || '';
        m.code = obj.code !== undefined ? obj.code : (obj.codigo !== undefined ? obj.codigo : undefined);
        m.stateDescription = obj.state_description;
        // raw extras
        m.nombre = obj.nombre;
        m.descripcion = obj.descripcion;
        m.sku = obj.sku;
        m.unidadMedida = obj.unidadMedida;
        m.rawCantidad = obj.cantidad;
        m.rawCodigo = obj.codigo;

        return m;
    }

    public static MapFromObjs(obj: any[]): OrderDetailsModel[] {
        if (!obj) {
            return [];
        }

        return obj.map((o) => this.MapFromObj(o));
    }
}

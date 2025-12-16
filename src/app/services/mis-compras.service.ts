import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// Interfaz para machinable (dimensionado)
export interface MachinableOrderDto {
  title?: { text: string; color?: string; isBold?: boolean };
  description?: string;
  color?: string;
  date?: string;
  machinable_steps?: Array<{
    title?: { text: string; color?: string; isBold?: boolean };
    description?: string;
    date?: string;
    icon?: string;
  }>;
  Boards?: Array<{
    quantity?: number;
    code?: string | number;
    code_unimed?: string;
    image?: string;
    description?: string;
    description_unimed?: string;
    state_description?: string;
  }>;
}

export interface MachinableDto {
  text?: string;
  color?: string;
  icon?: string;
  orders?: MachinableOrderDto[];
}

export interface TrazabilidadDto {
  etapa?: string;
  glosa: string;
  observacion?: string;
  fechaRegistro: string;
  estado: string;
  orden?: number;
  indProcesado?: number | null; // 1 = completado, 0 = en progreso, null = pendiente
  // Campos calculados del backend (preferir usar estos cuando estén disponibles)
  title?: {
    text: string;
    color: string;
    isBold: boolean;
  };
  description?: string;
  date?: string | null; // Fecha ISO 8601 con milisegundos o null
  icon?: string; // URL del ícono
  // Machinable (dimensionado) - viene cuando el producto tiene corte/optimización
  machinable?: MachinableDto;
}

export interface PickupDto {
  title?: string; // "Retiro en Tienda" o "Despacho a Domicilio"
  text?: string; // Dirección de entrega o tienda
  title_date?: string; // "Retira a partir del " o "Llega a partir del "
  date?: string; // Fecha ISO 8601
  icon?: string; // URL del ícono
}

export interface CompraApiDto {
  tipoDocumento: string;
  numeroDocumento: string;
  fechaCompra: string;
  tipoEntrega: string;
  direccionEntrega: string;
  trazabilidad: TrazabilidadDto[];
  esDimensionado: boolean;
  total: number;
  facturasAsociadas?: Array<{ numeroFactura: string; fechaEmision: string; idFactura: number }>; // optional
  productos?: any[]; // incluir productos crudos para tracking
  pickup?: PickupDto; // Datos completos de entrega/retiro del backend
}

export interface MisComprasResponseDto {
  usuario?: string;
  compras: CompraApiDto[];
  total?: number;
  page?: number;
  perPage?: number;
  totalPages?: number;
}

@Injectable({ providedIn: 'root' })
export class MisComprasService {
  // Unified baseUrl for APIM host; derive API root from it to avoid duplicating '/api' everywhere
  private baseUrl = `${environment.baseUrl}/api`;

  constructor(private http: HttpClient, private authService: AuthService) { }

  public getCompras(rut: string | number, page: number = 1, limit: number = environment.limitDefault): Observable<MisComprasResponseDto> {
    const r = typeof rut === 'number' ? rut.toString() : rut;
    const url = `${this.baseUrl}/clients/${r}/documents?page=${page}&limit=${limit}`;
    return this.getToken().pipe(
      switchMap(() => this.http.get<any>(url).pipe(map(resp => this.mapResponse(resp)))),
      catchError(err => {
        console.error('[MisComprasService] Error fetching compras', err);
        return of({ compras: [], page, perPage: limit, totalPages: 1 } as MisComprasResponseDto);
      })
    );
  }

  /**
   * Busca un documento específico (BLV, FCV, NVV) usando parámetro ?buscar= en la API.
   * Sanitiza el número removiendo prefijos N°, Nº y ceros a la izquierda.
   * La API puede devolver un documento único o un array de documentos.
   */
  public buscarDocumento(rut: string | number, numero: string, page: number = 1, limit: number = environment.limitDefault): Observable<MisComprasResponseDto> {
    const r = typeof rut === 'number' ? rut.toString() : rut;
    const sanitized = this.sanitizeNumero(numero);
    const url = `${this.baseUrl}/clients/${r}/documents?buscar=${encodeURIComponent(sanitized)}&page=${page}&limit=${limit}`;
    return this.getToken().pipe(
      switchMap(() => this.http.get<any>(url).pipe(map(resp => this.mapBuscarResponse(resp, page, limit)))),
      catchError(err => {
        console.error('[MisComprasService] Error buscando documento', err);
        return of({ compras: [], page, perPage: limit, totalPages: 1 } as MisComprasResponseDto);
      })
    );
  }

  /**
   * Mapea la respuesta de búsqueda que puede ser un documento único o un array.
   * La API devuelve un objeto con number_printed, type_document, etc. cuando es un solo documento.
   */
  private mapBuscarResponse(resp: any, page: number, limit: number): MisComprasResponseDto {
    if (!resp) { return { compras: [], page, perPage: limit, totalPages: 1 }; }

    // Si la respuesta tiene number_printed, es un documento único
    if (resp.number_printed || resp.type_document) {
      const compra = this.mapSingleDocument(resp);
      return {
        compras: compra ? [compra] : [],
        total: compra ? 1 : 0,
        page: 1,
        perPage: limit,
        totalPages: 1
      };
    }

    // Si no, usar el mapeo estándar
    return this.mapResponse(resp);
  }

  /**
   * Mapea un documento único de la API al formato CompraApiDto.
   */
  private mapSingleDocument(doc: any): CompraApiDto | null {
    if (!doc) return null;

    // Mapear traceability.steps a trazabilidad
    const trazabilidad: TrazabilidadDto[] = (doc.traceability?.steps || []).map((step: any) => ({
      etapa: step.title?.text || '',
      glosa: step.title?.text || '',
      observacion: step.description || '',
      fechaRegistro: step.date || '',
      // Mapear indProcesado: si tiene fecha, asumimos procesado (1), si no (0 o null)
      indProcesado: step.date ? 1 : null,
      estado: step.icon?.includes('complete') ? 'activo' : 'pendiente',
      title: step.title ? {
        text: step.title.text || '',
        color: step.title.color || '',
        isBold: step.title.isBold !== undefined ? step.title.isBold : false
      } : undefined,
      description: step.description,
      date: step.date,
      icon: step.icon,
      machinable: step.machinable ? {
        text: step.machinable.text || 'Dimensionado',
        color: step.machinable.color || '#eb414a',
        icon: step.machinable.icon || '',
        orders: (step.machinable.orders || []).map((o: any) => ({
          title: o.title,
          description: o.description || '',
          machinable_steps: o.machinable_steps || [],
          Boards: o.Boards || []
        }))
      } : undefined
    }));

    // Determinar tipo de entrega
    const tipoEntrega = doc.pickup?.title || 'Despacho';
    const direccionEntrega = doc.pickup?.text || '';

    // Mapear productos - buscar descripción en múltiples campos posibles
    const productos = (doc.DetailsProduct || []).map((p: any) => {
      // Buscar descripción real en múltiples campos posibles
      const descripcionReal = p.name || p.nombre || p.product_name || p.productName ||
        p.titulo || p.title || p.descripcion || p.description || '';
      return {
        cantidad: p.quantity || 1,
        codigo: p.code || '',
        descripcion: descripcionReal,
        estado: p.state_description || '',
        imagen: p.image || '',
        nombre: descripcionReal,
        sku: p.code?.toString() || '',
        unidadMedida: p.description_unimed || p.code_unimed || '',
        state_description: p.state_description || ''
      };
    });

    // Mapear tipo de documento a label legible
    const tipoDocMap: { [key: string]: string } = {
      'FCV': 'Factura',
      'BLV': 'Boleta',
      'NVV': 'Nota de Venta'
    };
    const tipoDocumento = tipoDocMap[doc.type_document] || doc.label_document || doc.type_document || '';
    const esNotaVenta = doc.type_document === 'NVV' || tipoDocumento === 'Nota de Venta';

    // Mapear facturas asociadas (SOLO para Notas de Venta según especificación del backend)
    type Asociada = { numeroFactura: string; fechaEmision: string; idFactura: number };
    let asociadas: Asociada[] = [];

    // Solo procesar facturas asociadas si es Nota de Venta
    if (esNotaVenta && (doc.facturasAsociadas || doc.associatedInvoices)) {
      const sanitizeNumber = (val: any): string => {
        const raw = (val == null ? '' : String(val)).trim();
        return raw.replace(/^N[°º]?\s*/i, '').trim();
      };
      const parseDateDMY = (s: any): number => {
        if (!s) return 0;
        const str = String(s).trim();
        const m = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (m) {
          const d = parseInt(m[1], 10);
          const mo = parseInt(m[2], 10) - 1;
          const y = parseInt(m[3], 10);
          return new Date(y, mo, d).getTime();
        }
        const t = Date.parse(str);
        return isNaN(t) ? 0 : t;
      };

      // El backend puede enviar null, undefined o array vacío
      const facturasRaw = doc.facturasAsociadas || doc.associatedInvoices || [];
      asociadas = (Array.isArray(facturasRaw) ? facturasRaw : [])
        .map((f: any) => ({
          numeroFactura: sanitizeNumber(f?.numeroFactura ?? f?.number ?? ''),
          fechaEmision: String(f?.fechaEmision ?? f?.fecha ?? '').trim(),
          idFactura: Number(f?.idFactura ?? f?.id ?? 0)
        }))
        .filter((f: Asociada) => (f.numeroFactura?.length || 0) > 0 || (f.fechaEmision?.length || 0) > 0);

      // Ordenar: el backend dice que viene ordenado ascendente, pero mantenemos ordenamiento
      // consistente con mapResponse (más reciente primero)
      asociadas.sort((a: Asociada, b: Asociada) => {
        const aNonZero = a.numeroFactura && a.numeroFactura !== '0' ? 1 : 0;
        const bNonZero = b.numeroFactura && b.numeroFactura !== '0' ? 1 : 0;
        if (aNonZero !== bNonZero) return bNonZero - aNonZero; // no-cero primero
        const ta = parseDateDMY(a.fechaEmision);
        const tb = parseDateDMY(b.fechaEmision);
        if (tb !== ta) return tb - ta; // más reciente primero
        return (b.idFactura || 0) - (a.idFactura || 0);
      });
    }
    // Para BLV y FCV, facturasAsociadas será [] (array vacío)

    return {
      tipoDocumento,
      numeroDocumento: (doc.number_printed || '').replace(/^0+/, ''),
      fechaCompra: doc.date_issue || '',
      tipoEntrega: tipoEntrega,
      direccionEntrega: direccionEntrega,
      trazabilidad,
      esDimensionado: trazabilidad.some(t => t.machinable),
      total: doc.total || 0,
      facturasAsociadas: asociadas,
      productos,
      // Preservar objeto pickup completo del backend si está disponible
      pickup: doc.pickup ? {
        title: doc.pickup.title,
        text: doc.pickup.text,
        title_date: doc.pickup.title_date,
        date: doc.pickup.date,
        icon: doc.pickup.icon
      } : undefined
    };
  }

  private getToken(): Observable<string | undefined> {
    return this.authService.getToken().pipe(
      map(model => model?.access_token),
      catchError(err => {
        console.warn('[MisComprasService] Token fetch failed via AuthService, proceeding without token', err);
        return of(undefined);
      })
    );
  }

  private mapResponse(resp: any): MisComprasResponseDto {
    if (!resp) { return { compras: [] }; }
    // Normalizar estructura sin romper lo existente
    const sanitizeNumber = (val: any): string => {
      const raw = (val == null ? '' : String(val)).trim();
      // Remover prefijos tipo 'N°', 'Nº', 'N° ' etc.
      return raw.replace(/^N[°º]?\s*/i, '').trim();
    };
    // Sanitizador expuesto para otros métodos
    this.sanitizeNumero = sanitizeNumber as any;
    const parseDateDMY = (s: any): number => {
      if (!s) return 0;
      const str = String(s).trim();
      // dd-MM-yyyy
      const m = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const y = parseInt(m[3], 10);
        return new Date(y, mo, d).getTime();
      }
      // ISO o fallback
      const t = Date.parse(str);
      return isNaN(t) ? 0 : t;
    };
    const comprasRaw: CompraApiDto[] = (resp.compras || resp.documents || []).map((c: any) => {
      const trazabilidad: TrazabilidadDto[] = (c.trazabilidad || c.traceability?.steps || c.traceability || []).map((t: any) => {
        // Mapear machinable si existe
        let machinable: MachinableDto | undefined = undefined;
        if (t.machinable && t.machinable.orders && t.machinable.orders.length > 0) {
          machinable = {
            text: t.machinable.text || 'Dimensionado',
            color: t.machinable.color || '#eb414a',
            icon: t.machinable.icon || 'https://dvimperial.blob.core.windows.net/traceability/dimensioned_icon.svg',
            orders: (t.machinable.orders || []).map((order: any) => ({
              title: order.title ? {
                text: order.title.text || '',
                color: order.title.color || '',
                isBold: order.title.isBold !== undefined ? order.title.isBold : false
              } : undefined,
              description: order.description || '',
              color: order.color || '#000000',
              date: order.date || undefined,
              machinable_steps: (order.machinable_steps || []).map((ms: any) => ({
                title: ms.title ? {
                  text: ms.title.text || '',
                  color: ms.title.color || '',
                  isBold: ms.title.isBold !== undefined ? ms.title.isBold : false
                } : undefined,
                description: ms.description || '',
                date: ms.date || undefined,
                icon: ms.icon || ''
              })),
              Boards: (order.Boards || []).map((b: any) => ({
                quantity: b.quantity || 1,
                code: b.code || '',
                code_unimed: b.code_unimed || '',
                image: b.image || '',
                description: b.description || '',
                description_unimed: b.description_unimed || '',
                state_description: b.state_description || ''
              }))
            }))
          };
        }

        return {
          etapa: t.etapa || t.stage || t.scope || '',
          glosa: t.glosa || t.label || t.title?.text || '',
          observacion: t.observacion || t.observation || t.descripcion || t.description || '',
          fechaRegistro: t.fechaRegistro || t.date || '',
          estado: t.estado || t.state || '',
          orden: typeof t.orden === 'number' ? t.orden : (typeof t.order === 'number' ? t.order : undefined),
          indProcesado: t.indProcesado !== undefined ? (t.indProcesado === null ? null : Number(t.indProcesado)) : undefined,
          // Campos calculados del backend (preferir usar estos cuando estén disponibles)
          title: t.title ? {
            text: t.title.text || t.etapa || '',
            color: t.title.color || '',
            isBold: t.title.isBold !== undefined ? t.title.isBold : false
          } : undefined,
          description: t.description !== undefined ? t.description : undefined,
          date: t.date !== undefined ? t.date : undefined,
          icon: (t.icon && t.icon.trim()) ? t.icon.trim() : undefined,
          machinable
        };
      });

      // Verificar si es Nota de Venta (SOLO NVV tiene facturas asociadas según especificación del backend)
      const tipoDoc = c.tipoDocumento || c.documentType || '';
      const esNotaVenta = tipoDoc === 'Nota de Venta' || tipoDoc.includes('Nota de Venta');

      type Asociada = { numeroFactura: string; fechaEmision: string; idFactura: number };
      let asociadas: Asociada[] = [];

      // Solo procesar facturas asociadas si es Nota de Venta
      if (esNotaVenta && (c.facturasAsociadas || c.associatedInvoices)) {
        // El backend puede enviar null, undefined o array vacío
        const facturasRaw = c.facturasAsociadas || c.associatedInvoices || [];
        asociadas = (Array.isArray(facturasRaw) ? facturasRaw : [])
          .map((f: any) => ({
            numeroFactura: sanitizeNumber(f?.numeroFactura ?? f?.number ?? ''),
            fechaEmision: String(f?.fechaEmision ?? f?.fecha ?? '').trim(),
            idFactura: Number(f?.idFactura ?? f?.id ?? 0)
          }))
          .filter((f: Asociada) => (f.numeroFactura?.length || 0) > 0 || (f.fechaEmision?.length || 0) > 0);

        asociadas.sort((a: Asociada, b: Asociada) => {
          const aNonZero = a.numeroFactura && a.numeroFactura !== '0' ? 1 : 0;
          const bNonZero = b.numeroFactura && b.numeroFactura !== '0' ? 1 : 0;
          if (aNonZero !== bNonZero) return bNonZero - aNonZero; // no-cero primero
          const ta = parseDateDMY(a.fechaEmision);
          const tb = parseDateDMY(b.fechaEmision);
          if (tb !== ta) return tb - ta; // más reciente primero
          return (b.idFactura || 0) - (a.idFactura || 0);
        });
      }
      // Para BLV y FCV, facturasAsociadas será [] (array vacío)

      const productos = c.productos || c.items || [];
      // Determinar si es dimensionado: verificar si viene del backend o si hay machinable en la trazabilidad
      // Verificar también en la estructura original del backend por si la trazabilidad no se mapeó correctamente
      const hasMachinableInTrazabilidad = trazabilidad.some(t => t.machinable && t.machinable.orders && t.machinable.orders.length > 0);
      const hasMachinableInOriginal = (c.trazabilidad || c.traceability?.steps || c.traceability || []).some((t: any) =>
        t.machinable && t.machinable.orders && t.machinable.orders.length > 0
      );
      const esDimensionado = c.esDimensionado || c.dimensionado || hasMachinableInTrazabilidad || hasMachinableInOriginal;

      return {
        tipoDocumento: c.tipoDocumento || c.documentType || '',
        numeroDocumento: sanitizeNumber(c.numeroDocumento || c.number || ''),
        fechaCompra: c.fechaCompra || c.purchaseDate || '',
        tipoEntrega: c.tipoEntrega || c.deliveryType || '',
        direccionEntrega: c.direccionEntrega || c.deliveryAddress || '',
        trazabilidad,
        esDimensionado: esDimensionado,
        total: c.total || c.amount || 0,
        facturasAsociadas: asociadas,
        productos,
        // Preservar objeto pickup completo del backend si está disponible
        pickup: c.pickup ? {
          title: c.pickup.title,
          text: c.pickup.text,
          title_date: c.pickup.title_date,
          date: c.pickup.date,
          icon: c.pickup.icon
        } : undefined
      } as CompraApiDto;
    });

    const compras: CompraApiDto[] = comprasRaw.filter((c: CompraApiDto) => (c.numeroDocumento || '').trim().length > 0);

    const mapped = {
      usuario: resp.usuario || resp.user || undefined,
      compras,
      total: resp.total || compras.length,
      page: resp.page || 1,
      perPage: resp.perPage || compras.length,
      totalPages: resp.totalPages || 1
    };
    // eslint-disable-next-line no-console
    return mapped;
  }

  // Se asignará en mapResponse; tipado público para reutilización.
  private sanitizeNumero: (val: any) => string = (v: any) => (v == null ? '' : String(v));
}

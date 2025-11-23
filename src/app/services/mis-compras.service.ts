import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface CompraApiDto {
  tipoDocumento: string;
  numeroDocumento: string;
  fechaCompra: string;
  tipoEntrega: string;
  direccionEntrega: string;
  trazabilidad: Array<{ glosa: string; fechaRegistro: string; estado: string }>;
  esDimensionado: boolean;
  total: number;
  facturasAsociadas?: Array<{ numeroFactura: string; fechaEmision: string; idFactura: number }>; // optional
  productos?: any[]; // incluir productos crudos para tracking
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

  constructor(private http: HttpClient, private authService: AuthService) {}

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
   * Siempre fuerza page=1 como lo requiere el flujo de "ver detalle".
   * Sanitiza el número removiendo prefijos N°, Nº y ceros a la izquierda.
   */
  public buscarDocumento(rut: string | number, numero: string, page: number = 1): Observable<MisComprasResponseDto> {
    const r = typeof rut === 'number' ? rut.toString() : rut;
    const sanitized = this.sanitizeNumero(numero);
    const url = `${this.baseUrl}/clients/${r}/documents?buscar=${encodeURIComponent(sanitized)}&page=${page}`;
    return this.getToken().pipe(
      switchMap(() => this.http.get<any>(url).pipe(map(resp => this.mapResponse(resp)))),
      catchError(err => {
        console.error('[MisComprasService] Error buscando documento', err);
        return of({ compras: [], page, perPage: 0, totalPages: 1 } as MisComprasResponseDto);
      })
    );
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
      const trazabilidad = (c.trazabilidad || c.traceability || []).map((t: any) => ({
        glosa: t.glosa || t.label || '',
        fechaRegistro: t.fechaRegistro || t.date || '',
        estado: t.estado || t.state || ''
      }));

      type Asociada = { numeroFactura: string; fechaEmision: string; idFactura: number };
      const asociadas: Asociada[] = (c.facturasAsociadas || c.associatedInvoices || [])
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

      const productos = c.productos || c.items || [];
      return {
        tipoDocumento: c.tipoDocumento || c.documentType || '',
        numeroDocumento: sanitizeNumber(c.numeroDocumento || c.number || ''),
        fechaCompra: c.fechaCompra || c.purchaseDate || '',
        tipoEntrega: c.tipoEntrega || c.deliveryType || '',
        direccionEntrega: c.direccionEntrega || c.deliveryAddress || '',
        trazabilidad,
        esDimensionado: c.esDimensionado || c.dimensionado || false,
        total: c.total || c.amount || 0,
        facturasAsociadas: asociadas,
        productos
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
    console.log('[MisComprasService.mapResponse] compras mapped (productos lengths):', mapped.compras.map(c => (c.productos || []).length));
    return mapped;
  }

  // Se asignará en mapResponse; tipado público para reutilización.
  private sanitizeNumero: (val: any) => string = (v: any) => (v == null ? '' : String(v));
}

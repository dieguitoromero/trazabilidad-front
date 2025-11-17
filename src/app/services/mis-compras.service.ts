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
  private baseUrl = environment.baseMisComprasApiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  public getCompras(rut: string | number): Observable<MisComprasResponseDto> {
    const r = typeof rut === 'number' ? rut.toString() : rut;
    return this.getToken().pipe(
      switchMap(() => {
        return this.http.get<any>(`${this.baseUrl}/clients/${r}/documents`).pipe(
          map(resp => this.mapResponse(resp))
        );
      }),
      catchError(err => {
        console.error('[MisComprasService] Error fetching compras', err);
        return of({ compras: [] } as MisComprasResponseDto);
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
    const compras: CompraApiDto[] = (resp.compras || resp.documents || []).map((c: any) => ({
      tipoDocumento: c.tipoDocumento || c.documentType || '',
      numeroDocumento: sanitizeNumber(c.numeroDocumento || c.number || ''),
      fechaCompra: c.fechaCompra || c.purchaseDate || '',
      tipoEntrega: c.tipoEntrega || c.deliveryType || '',
      direccionEntrega: c.direccionEntrega || c.deliveryAddress || '',
      trazabilidad: (c.trazabilidad || c.traceability || []).map((t: any) => ({
        glosa: t.glosa || t.label || '',
        fechaRegistro: t.fechaRegistro || t.date || '',
        estado: t.estado || t.state || ''
      })),
      esDimensionado: c.esDimensionado || c.dimensionado || false,
      total: c.total || c.amount || 0,
      facturasAsociadas: ((c.facturasAsociadas || c.associatedInvoices || []).map((f: any) => ({
        numeroFactura: sanitizeNumber(f.numeroFactura || f.number || ''),
        fechaEmision: (f.fechaEmision || f.fecha || ''),
        idFactura: f.idFactura || f.id || 0
      })) as Array<{numeroFactura: string; fechaEmision: string; idFactura: number}>).sort((a, b) => {
        const aNonZero = a.numeroFactura && a.numeroFactura !== '0' ? 1 : 0;
        const bNonZero = b.numeroFactura && b.numeroFactura !== '0' ? 1 : 0;
        if (aNonZero !== bNonZero) return bNonZero - aNonZero; // no-cero primero
        const ta = parseDateDMY(a.fechaEmision);
        const tb = parseDateDMY(b.fechaEmision);
        if (tb !== ta) return tb - ta; // más reciente primero
        return (b.idFactura || 0) - (a.idFactura || 0);
      })
    }));

    return {
      usuario: resp.usuario || resp.user || undefined,
      compras,
      total: resp.total || compras.length,
      page: resp.page || 1,
      perPage: resp.perPage || compras.length,
      totalPages: resp.totalPages || 1
    };
  }
}

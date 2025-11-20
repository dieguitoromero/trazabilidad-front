import {Injectable} from '@angular/core';
import {from, Observable, of} from 'rxjs';
import {switchMap, map, catchError} from 'rxjs/operators';
import { MisComprasService, CompraApiDto } from './mis-compras.service';
import {InvoiceModel} from '../core/models/invoice.model';
import {TrackingRepository} from '../repositories/tracking.repository';

@Injectable()
export class TrackingService {

    constructor(private trackingRepository: TrackingRepository, private misComprasService: MisComprasService) {

    }

    public trakingExist(invoiceId: number, invoiceType: string): Observable<boolean> {
        return this.trackingRepository.trackingExist(this.padInvoiceNumber(invoiceId, 10), invoiceType);
    }


    public getInvoiceTracking(invoiceId: number, invoiceType: string): Observable<InvoiceModel | undefined> {
        return this.trackingRepository.getTracking(this.padInvoiceNumber(invoiceId, 10), invoiceType);
    }
    public getInvoiceTrackingV2(invoiceId: number, invoiceType: string): Observable<InvoiceModel | undefined> {
        return this.trackingRepository.getTrackingV2(this.padInvoiceNumber(invoiceId, 10), invoiceType);
    }

    /**
     * Nuevo flujo: usar endpoint de búsqueda de documentos para obtener data y mapear a InvoiceModel.
     * Si el documento ya trae trazabilidad, se usa directamente; si no, se intenta fallback a V2.
     */
    public getInvoiceFromDocumentsSearch(invoiceId: number, invoiceType: string): Observable<InvoiceModel | undefined> {
        const rut = '762530058'; // reutilizar environment.clienteId si se prefiere inyectar
        return this.misComprasService.buscarDocumento(rut, invoiceId.toString(), 1).pipe(
            switchMap(resp => {
                const doc = resp.compras && resp.compras.length > 0 ? resp.compras[0] : undefined;
                if (!doc) { return of(undefined); }
                const mapped = this.mapCompraDtoToInvoice(doc);
                const hasSteps = mapped.trackingSteps && mapped.trackingSteps.length > 0;
                if (hasSteps) { return of(mapped); }
                // Fallback a V2 sólo si no hay pasos
                return this.getInvoiceTrackingV2(invoiceId, invoiceType).pipe(
                    map(v2 => {
                        if (v2?.trackingSteps?.length) {
                            mapped.trackingSteps = v2.trackingSteps;
                        }
                        return mapped;
                    }),
                    catchError(() => of(mapped))
                );
            })
        );
    }

    private mapCompraDtoToInvoice(dto: CompraApiDto): InvoiceModel {
        const model = new InvoiceModel();
        model.printedNumber = dto.numeroDocumento;
        model.documentType = this.mapTipoDocumentoToCode(dto.tipoDocumento);
        model.documentLabel = dto.tipoDocumento;
        model.total = dto.total;
        // parse fechaCompra (dd-MM-yyyy) or ISO
        let dateIssue: Date | undefined;
        const raw = (dto.fechaCompra || '').trim();
        const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (m) {
            const d = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10) - 1;
            const y = parseInt(m[3], 10);
            dateIssue = new Date(y, mo, d);
        } else {
            const t = Date.parse(raw);
            if (!isNaN(t)) dateIssue = new Date(t);
        }
        model.issueDate = dateIssue as any;
        // map pasos: preservar íconos si vienen desde legacy traceability (usar URLs si existen en otra fuente)
        model.trackingSteps = (dto.trazabilidad || []).map(t => ({
            title: { text: this.normalizeGlosa(t.glosa) },
            date: t.fechaRegistro,
            icon: t.estado === 'finalizado' ? 'https://dvimperial.blob.core.windows.net/traceability/timeline_complete_icon.svg' : 'pending'
        })) as any;
        // productos y seller quedan vacíos en este flujo (si el endpoint entrega luego detalles se puede ampliar)
        return model;
    }

    private normalizeGlosa(glosa: string): string {
        if (!glosa) return glosa;
        const g = glosa.trim().toLowerCase();
        const map: Record<string,string> = {
            'pedido ingresado':'Pedido Ingresado',
            'pedido pagado':'Pedido pagado',
            'pedido aprobado':'Pedido pagado',
            'preparacion de pedido':'Preparacion de Pedido',
            'preparación de pedido':'Preparacion de Pedido',
            'disponible para retiro':'Disponible para retiro',
            'pedido entregado':'Pedido Entregado'
        };
        return map[g] || glosa;
    }

    private mapTipoDocumentoToCode(tipo: string): string {
        const t = (tipo || '').toLowerCase();
        if (t.includes('boleta')) return 'BLV';
        if (t.includes('factura')) return 'FCV';
        if (t.includes('nota') && t.includes('venta')) return 'NVV';
        return 'BLV';
    }

    public getInvoiceDocument(invoiceId: number, invoiceType: string): Observable<InvoiceModel | undefined> {
        const padded = this.padInvoiceNumber(invoiceId, 10);
        return this.trackingRepository.getDocument(padded, invoiceType).pipe(
            switchMap(doc => {
                if (!doc) { return of(undefined); }
                // Si el documento no trae pasos de trazabilidad, intentamos obtenerlos vía V2
                const hasSteps = doc.trackingSteps && doc.trackingSteps.length > 0;
                if (hasSteps) { return of(doc); }
                return this.trackingRepository.getTrackingV2(padded, invoiceType).pipe(
                    map(v2 => {
                        if (v2 && v2.trackingSteps && v2.trackingSteps.length > 0) {
                            doc.trackingSteps = v2.trackingSteps;
                        }
                        return doc;
                    }),
                    catchError(() => of(doc))
                );
            })
        );
    }


    private padInvoiceNumber(invoiceId: number, lenght: number): string {
        let num = invoiceId.toString();
        while (num.length < lenght) {
            num = '0' + num;
        }
        return num;
    }
}

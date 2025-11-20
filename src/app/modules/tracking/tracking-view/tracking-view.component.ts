import {Component, ElementRef, ViewChild} from '@angular/core';
import {InvoiceModel} from '../../../core/models/invoice.model';
import {SearchModel} from '../models/search-model';
import {take} from 'rxjs/operators';
import {TrackingService} from '../../../services/tracking.service';
import { TrackingDataService } from '../../../services/tracking-data.service';
import {ActivatedRoute, Router} from '@angular/router';
import { TrackingStepModel } from '../../../core/models/tracking-step.model';

@Component({
    templateUrl: './tracking-view.template.html',
    styleUrls: ['./tracking-view.scss', './tracking-view.mobile.scss']
})
export class TrackingViewComponent {

    public invoice: InvoiceModel | undefined;
    // Objeto adaptado para PurchaseTimelineComponent
    public compraAdaptada: any | undefined;
    // Pasos derivados de 'trazabilidad' (o invoice.trackingSteps) para alimentar el nuevo componente stepper
    public stepperSteps: TrackingStepModel[] = [];
    public working = false;
    public hasError = false;
    public searchModel: SearchModel | undefined;
    public hideSearch = false;
    private autoSearched = false;

    @ViewChild('trackingStepperView')
    public trackingStepperView: ElementRef | undefined;
    @ViewChild('orderDetailsView')
    public orderDetailsView: ElementRef | undefined;

    constructor(private trackingService: TrackingService,
                private router: Router,
                private activeRoute: ActivatedRoute,
                private trackingData: TrackingDataService) {

        this.activeRoute.params.subscribe((params) => {
            if (params.invoiceId || params.invoiceType) {
                this.hideSearch = true;
                const id = Number(params.invoiceId);
                const type = params.invoiceType;
                this.searchModel = new SearchModel(id, type);
                this.triggerAutoSearch();
                this.applyHideHeroBg();
            }
        });

        this.activeRoute.queryParams.subscribe((params) => {
            if (params.folioDocumento || params.tipoDocumento) {
                this.hideSearch = true;
                const id = Number(params.folioDocumento);
                const type = params.tipoDocumento;
                this.searchModel = new SearchModel(id, type);
                // Si viene api=v1, usaremos v1 en onSearch
                (this.searchModel as any).api = params.api || 'doc';
                (this.searchModel as any).section = params.section;
                // Intentar consumir payload transportado para evitar nueva llamada
                const transport = this.trackingData.consumeCompraPayload();
                if (transport && transport.compras && transport.compras.length > 0) {
                    const raw = transport.compras[0];
                    // Mapear a estructura mínima que espera la vista
                    this.invoice = {
                        printedNumber: raw.numeroDocumento?.replace(/^N[°º]?\s*/i,'').replace(/^0+/, ''),
                        documentType: this.mapTipoDocumentoToCode(raw.tipoDocumento),
                        documentLabel: raw.tipoDocumento,
                        issueDate: this.parseDate(raw.fechaCompra),
                        trackingSteps: (raw.trazabilidad || []).map((t: any) => ({
                            title: { text: this.normalizeGlosa(t.glosa) },
                            date: t.fechaRegistro,
                            icon: 'done'
                        })),
                        orderProducts: raw.productos || [],
                        hasProductDetails: (raw.productos || []).length > 0
                    } as any;
                                        this.compraAdaptada = {
                                            trazabilidad: (raw.trazabilidad || []).map((t: any) => ({
                                                glosa: this.normalizeGlosa(t.glosa),
                                                fechaRegistro: t.fechaRegistro,
                                                estado: t.estado || 'activo',
                                                observacion: t.observacion || ''
                                            })),
                                            productos: raw.productos || []
                                        };
                    // Derivar pasos para el stepper desde la trazabilidad cruda
                    this.stepperSteps = this.mapTrazabilidadToSteps(raw.trazabilidad || []);
                    // eslint-disable-next-line no-console
                    console.log('[TrackingView] Invoice (transported) preloaded:', this.invoice);
                    this.hideSearch = true;
                    this.applyHideHeroBg();
                    // Evitar auto búsqueda si ya cargamos invoice
                    return;
                }
                this.triggerAutoSearch();
                this.applyHideHeroBg();
            }
        });

    }


    public onSearch(search: SearchModel): void {
        const api = (search as any).api || 'doc';
        // Nuevo flujo: intentar siempre con documents search primero (api='doc'), luego fallback según tipo
        let source$ = this.trackingService.getInvoiceFromDocumentsSearch(search.invoiceId, search.invoiceType);
        if (api === 'v1') {
            source$ = this.trackingService.getInvoiceTracking(search.invoiceId, search.invoiceType);
        } else if (api === 'v2') {
            source$ = this.trackingService.getInvoiceTrackingV2(search.invoiceId, search.invoiceType);
        } else if (api === 'doc') {
            // ya definido arriba
        }

        source$
            .pipe(take(1))
            .subscribe({next: this.onSuccess.bind(this), error: this.onError.bind(this)});

        const snapshot = this.activeRoute.snapshot;

        if (snapshot.url.toString().indexOf('tracking') >= 0) {
            this.router.navigate(['tracking'], {
                queryParams: {
                    folioDocumento: search.invoiceId,
                    tipoDocumento: search.invoiceType,
                    api
                },
                queryParamsHandling: 'merge'
            });
        //} else {
        //    this.router.navigate(['/', search.invoiceId, search.invoiceType]);
        }


    }

    private onSuccess(invoice: InvoiceModel | undefined): void {

        if (!invoice) {
            this.router.navigate(['not-found']);
        }

        // eslint-disable-next-line no-console
        console.log('[TrackingView] Invoice loaded:', invoice);

        const section = (this.searchModel as any)?.section;
        // Si se pide 'details' y hay detalles, ir primero a detalles
        if (section === 'details' && invoice?.hasProductDetails) {
            setTimeout(() => {
                this.orderDetailsView?.nativeElement.scrollIntoView({ behavior: 'smooth' });
            }, 400);
        } else if (invoice?.trackingSteps && invoice.trackingSteps.length > 0) {
            // Scroll siempre si hay pasos (no limitar sólo a los que tienen machinable orders)
            setTimeout(() => {
                this.trackingStepperView?.nativeElement.scrollIntoView({ behavior: 'smooth' });
            }, 400);
        }

        this.invoice = invoice;
        this.working = false;
        if (invoice) {
            this.hideSearch = true;
            this.applyHideHeroBg();
                        this.compraAdaptada = {
                            trazabilidad: (invoice.trackingSteps || []).map(s => ({
                                glosa: s.title?.text,
                                fechaRegistro: s.date,
                                estado: s.icon === 'done' ? 'activo' : 'pendiente',
                                observacion: ''
                            })),
                            productos: invoice.orderProducts || []
                        };
            // Si ya vienen trackingSteps directos, derivar pasos para el componente
            if (invoice.trackingSteps && invoice.trackingSteps.length) {
                this.stepperSteps = invoice.trackingSteps;
            }
            // Refuerzo: si compraAdaptada existe, regenerar desde su trazabilidad (aplica normalización)
            if (this.compraAdaptada?.trazabilidad) {
                this.stepperSteps = this.mapTrazabilidadToSteps(this.compraAdaptada.trazabilidad);
            }
        }
    }

    private onError(err: InvoiceModel): void {
        this.hasError = true;
        this.working = false;
    }

    private triggerAutoSearch(): void {
        if (!this.autoSearched && this.searchModel && this.searchModel.invoiceId && this.searchModel.invoiceType) {
            this.autoSearched = true;
            setTimeout(() => this.onSearch(this.searchModel as SearchModel), 0);
        }
    }

    /** Convierte arreglo de items de trazabilidad crudos en TrackingStepModel[] para el stepper nuevo */
    private mapTrazabilidadToSteps(trazabilidad: any[]): TrackingStepModel[] {
        if (!trazabilidad || !Array.isArray(trazabilidad)) { return []; }
        return trazabilidad.map((t: any) => {
            const step = new TrackingStepModel();
            step.title = { text: this.normalizeGlosa(t.glosa), color: '', isBold: false } as any;
            step.description = t.observacion || '';
            step.date = this.parseFechaRegistro(t.fechaRegistro) as any;
            step.icon = this.computeIconFromEstado(t.estado);
            return step;
        });
    }

    private computeIconFromEstado(estado: string | undefined): string {
        const e = (estado || '').toLowerCase();
        if (!e) return 'pending';
        const doneStates = ['activo','finalizado','completado','entregado'];
        return doneStates.some(ds => e.indexOf(ds) >= 0) ? 'done' : 'pending';
    }

    private parseFechaRegistro(raw: string): Date | undefined {
        if (!raw) return undefined;
        // Intentar parseo directo (ISO / timestamp)
        const direct = Date.parse(raw);
        if (!isNaN(direct)) return new Date(direct);
        // Intentar formato dd-MM-yyyy
        const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (m) {
            const d = parseInt(m[1],10); const mo = parseInt(m[2],10)-1; const y = parseInt(m[3],10);
            return new Date(y,mo,d);
        }
        return undefined;
    }

    public showPickupDate(): boolean {
        if (!this.invoice || !this.invoice.trackingSteps || this.invoice.trackingSteps.length === 0) {
            return false;
        }
        const steps = this.invoice.trackingSteps;
        const last = steps[steps.length - 1];
        const lastTitle = (last.title && last.title.text) ? last.title.text.toLowerCase() : '';
        const isDeliveredTitle = lastTitle.indexOf('entregado') >= 0;
        const isNotPending = last.icon.indexOf('pending') < 0;
        return isDeliveredTitle && isNotPending;
    }

    public volver(): void {
        this.router.navigate(['/mis-compras']);
    }

    ngOnDestroy(): void {
        document.body.classList.remove('hide-hero-bg');
    }

    private applyHideHeroBg(): void {
        if (this.hideSearch) {
            document.body.classList.add('hide-hero-bg');
        } else {
            document.body.classList.remove('hide-hero-bg');
        }
    }

    public statusActual(): string {
        const pasosOrden = [
            'Pedido ingresado',
            'Pedido pagado',
            'Preparación de pedido',
            'Disponible para retiro',
            'Pedido entregado'
        ];

        if (!this.invoice || !this.invoice.trackingSteps || this.invoice.trackingSteps.length === 0) {
            return pasosOrden[0];
        }

        const titles = new Set(
            this.invoice.trackingSteps
                .map(s => (s.title && s.title.text ? s.title.text.toLowerCase() : ''))
        );

        let last = pasosOrden[0];
        for (const p of pasosOrden) {
            if (titles.has(p.toLowerCase())) {
                last = p;
            }
        }
        return last;
    }

    private mapTipoDocumentoToCode(tipo: string): string {
        const t = (tipo || '').toLowerCase();
        if (t.includes('boleta')) return 'BLV';
        if (t.includes('factura')) return 'FCV';
        if (t.includes('nota') && t.includes('venta')) return 'NVV';
        return 'BLV';
    }

    private parseDate(fecha: string): Date | undefined {
        const m = (fecha || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (!m) return undefined;
        const d = parseInt(m[1],10); const mo = parseInt(m[2],10)-1; const y = parseInt(m[3],10);
        return new Date(y,mo,d);
    }

    private normalizeGlosa(glosa: string): string {
        if (!glosa) return glosa;
        const g = glosa.trim().toLowerCase();
        const map: Record<string,string> = {
          'pedido ingresado':'Pedido ingresado',
          'pedido pagado':'Pedido pagado',
          'pedido aprobado':'Pedido pagado',
          'preparacion de pedido':'Preparación de pedido',
          'preparación de pedido':'Preparación de pedido'
        };
        return map[g] || glosa;
    }

    public resumenTipoEntrega(): string | undefined {
        // Preferir pickup info si existe
        if (this.invoice?.pickup) {
            // Asumimos que si hay pickup es retiro en tienda
            return 'Retiro en Tienda';
        }
        // Si no hay pickup, fallback por tipo de documento u otros flags (simplificado)
        return 'Despacho a domicilio';
    }

    public resumenDireccion(): string | undefined {
        // Intentar obtener dirección desde pickup (suponiendo propiedades standard)
        const p: any = this.invoice?.pickup as any;
        if (p) {
            // Construir dirección legible si existen partes
            const parts = [p.address, p.commune, p.city, p.region].filter(Boolean);
            if (parts.length) return parts.join(', ');
        }
        return undefined;
    }

    public resumenFechaRetiro(): string | undefined {
        // Usar issueDate como placeholder si no tenemos pickup date específica
        if (this.invoice?.issueDate) {
            const d = this.invoice.issueDate;
            const dd = String(d.getDate()).padStart(2,'0');
            const mm = String(d.getMonth()+1).padStart(2,'0');
            const yyyy = d.getFullYear();
            return `${dd}-${mm}-${yyyy}`;
        }
        return undefined;
    }
}

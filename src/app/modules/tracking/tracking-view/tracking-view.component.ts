import { Component, ElementRef, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
import { SearchModel } from '../models/search-model';
import { take } from 'rxjs/operators';
import { TrackingService } from '../../../services/tracking.service';
import { TrackingDataService } from '../../../services/tracking-data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TrackingStepModel } from '../../../core/models/tracking-step.model';

@Component({
    templateUrl: './tracking-view.template.html',
    styleUrls: ['./tracking-view.scss', './tracking-view.mobile.scss']
})
export class TrackingViewComponent implements OnInit {

    public invoice: any = null;
    // Base href usado para resolver rutas a assets en tiempo de ejecución
    public baseHref: string = '/';
    // Objeto adaptado para PurchaseTimelineComponent
    public compraAdaptada: any | undefined;
    // Pasos derivados de 'trazabilidad' (o invoice.trackingSteps) para alimentar el nuevo componente stepper
    public stepperSteps: TrackingStepModel[] = [];
    public working = false;
    public hasError = false;
    public clienteIdRequerido = false; // Indica que falta el parámetro clienteId en la URL
    public searchModel: SearchModel | undefined;
    public hideSearch = false;
    public documentInfoText = '';
    private autoSearched = false;
    private clienteId: string | null = null;
    private readonly canonicalEtapas = [
        { key: 'pedido ingresado', label: 'Pedido Ingresado' },
        { key: 'pedido aprobado', label: 'Pedido Aprobado', aliases: ['pedido pagado'] },
        { key: 'preparacion de pedido', label: 'Preparacion de Pedido' },
        { key: 'pendiente de envio', label: 'Pendiente de Envío', aliases: ['disponible para retiro'] },
        { key: 'pedido en ruta', label: 'Pedido en Ruta' },
        { key: 'pedido entregado', label: 'Pedido Entregado' }
    ];
    private readonly maxTraceabilitySteps = this.canonicalEtapas.length;
    private readonly timelineCompleteIcon = 'https://dvimperial.blob.core.windows.net/traceability/timeline_complete_icon.svg';
    private readonly etapaAliasMap = this.buildEtapaAliasMap();

    @ViewChild('trackingStepperView')
    public trackingStepperView: ElementRef | undefined;
    @ViewChild('orderDetailsView')
    public orderDetailsView: ElementRef | undefined;

        constructor(private trackingService: TrackingService,
        private router: Router,
        private activeRoute: ActivatedRoute,
        private trackingData: TrackingDataService,
        private cdr: ChangeDetectorRef) {
        const nav = this.router.getCurrentNavigation();
        const state = nav && nav.extras && nav.extras.state ? nav.extras.state : undefined;
        const buscarResp = state && (state as any).compraBuscarDocumentoResp ? (state as any).compraBuscarDocumentoResp : undefined;
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
            // Obtener clienteId de los query params (requerido)
            if (params.clienteId && typeof params.clienteId === 'string' && params.clienteId.trim()) {
                this.clienteId = params.clienteId.trim();
                this.clienteIdRequerido = false;
            }
            
            if (params.folioDocumento || params.tipoDocumento) {
                this.hideSearch = true;
                const id = Number(params.folioDocumento);
                const type = params.tipoDocumento;
                this.searchModel = new SearchModel(id, type);
                // Si viene api=v1, usaremos v1 en onSearch
                (this.searchModel as any).api = params.api || 'doc';
                (this.searchModel as any).section = params.section;
                // Intentar consumir payload transportado para evitar nueva llamada
                const invoiceTransport = this.trackingData.consumeInvoicePayload();
                if (invoiceTransport) {
                    const mapped: any = invoiceTransport; // usar payload directo, sin modelo
                    if (mapped) {
                        this.formatInvoiceForStepper(mapped);
                        // eslint-disable-next-line no-console
                        this.hideSearch = true;
                        this.applyHideHeroBg();
                        // Si hay payload transportado, no requerir clienteId
                        this.clienteIdRequerido = false;
                        return;
                    }
                }
                const transport = this.trackingData.consumeCompraPayload();
                if (transport && transport.compras && transport.compras.length > 0) {
                    const raw = transport.compras[0];
                    this.formatCompraDtoForStepper(raw);
                    // eslint-disable-next-line no-console
                    this.hideSearch = true;
                    this.applyHideHeroBg();
                    // Si hay payload transportado, no requerir clienteId
                    this.clienteIdRequerido = false;
                    // Evitar auto búsqueda si ya cargamos invoice
                    return;
                }
                // Solo requerir clienteId si no hay payload transportado y vamos a hacer búsqueda
                if (!this.clienteId) {
                    this.clienteIdRequerido = true;
                }
                this.triggerAutoSearch();
                this.applyHideHeroBg();
            } else {
                // Si no hay folioDocumento ni tipoDocumento, verificar si falta clienteId
                if (!this.clienteId) {
                    this.clienteIdRequerido = true;
                }
            }
        });

        // Determinar el base href actual (desde la etiqueta <base> en index.html)
        try {
            const b = document.getElementsByTagName('base')[0];
            const href = b ? (b.getAttribute('href') || '/') : '/';
            this.baseHref = href.endsWith('/') ? href : href + '/';
        } catch (e) {
            this.baseHref = '/';
        }

    }

    ngOnInit(): void {
        // Intento adicional de consumir payloads o state de navigation que podrían no haber llegado en el constructor
        try {
            const nav = this.router.getCurrentNavigation();
            const state = nav && nav.extras && nav.extras.state ? nav.extras.state : (window && (window.history && (window.history.state || undefined)));
            const buscarResp = state && (state as any).compraBuscarDocumentoResp ? (state as any).compraBuscarDocumentoResp : undefined;
            if (buscarResp && buscarResp.compras && buscarResp.compras.length > 0) {
                // formato directo desde el payload transportado
                const raw = buscarResp.compras[0];
                this.formatCompraDtoForStepper(raw);
                this.hideSearch = true;
                this.applyHideHeroBg();
                // Si hay payload transportado, no requerir clienteId
                this.clienteIdRequerido = false;
                this.scheduleDetectChanges();
                return;
            }

            // Intentar consumir cualquier payload aún no consumido por trackingData
            const invoiceTransport = this.trackingData.consumeInvoicePayload();
            if (invoiceTransport) {
                this.formatInvoiceForStepper(invoiceTransport);
                this.hideSearch = true;
                this.applyHideHeroBg();
                // Si hay payload transportado, no requerir clienteId
                this.clienteIdRequerido = false;
                this.scheduleDetectChanges();
                return;
            }
            const transport = this.trackingData.consumeCompraPayload();
            if (transport && transport.compras && transport.compras.length > 0) {
                const raw = transport.compras[0];
                this.formatCompraDtoForStepper(raw);
                this.hideSearch = true;
                this.applyHideHeroBg();
                // Si hay payload transportado, no requerir clienteId
                this.clienteIdRequerido = false;
                this.scheduleDetectChanges();
                return;
            }
        } catch (e) {
            // no bloquear si algo falla
        }
    }


    public onSearch(search: SearchModel): void {
        // Validar que clienteId esté disponible
        if (!this.clienteId) {
            // Intentar obtener de query params si no está disponible
            const qp = this.activeRoute.snapshot.queryParams;
            this.clienteId = (qp.clienteId && typeof qp.clienteId === 'string' && qp.clienteId.trim()) 
                ? qp.clienteId.trim() 
                : null;
            
            if (!this.clienteId) {
                this.clienteIdRequerido = true;
                this.hasError = false;
                this.working = false;
                return;
            }
        }
        
        // Si clienteId está disponible, asegurar que no se muestre el mensaje de requerido
        this.clienteIdRequerido = false;
        
        const api = (search as any).api || 'doc';
        // Nuevo flujo: intentar siempre con documents search primero (api='doc'), luego fallback según tipo
        let source$ = this.trackingService.getInvoiceFromDocumentsSearch(search.invoiceId, search.invoiceType, this.clienteId);
        if (api === 'v1') {
            source$ = this.trackingService.getInvoiceTracking(search.invoiceId, search.invoiceType);
        } else if (api === 'v2') {
            source$ = this.trackingService.getInvoiceTrackingV2(search.invoiceId, search.invoiceType);
        } else if (api === 'doc') {
            // ya definido arriba
        }

        source$
            .pipe(take(1))
            .subscribe({ next: this.onSuccess.bind(this), error: this.onError.bind(this) });

        const snapshot = this.activeRoute.snapshot;

        if (snapshot.url.toString().indexOf('tracking') >= 0) {
            this.router.navigate(['tracking'], {
                queryParams: {
                    folioDocumento: search.invoiceId,
                    tipoDocumento: search.invoiceType,
                    api,
                    clienteId: this.clienteId
                },
                queryParamsHandling: 'merge'
            });
            //} else {
            //    this.router.navigate(['/', search.invoiceId, search.invoiceType]);
        }


    }

    private onSuccess(invoice: any | undefined): void {

        if (!invoice) {
            this.router.navigate(['not-found']);
        }

        // eslint-disable-next-line no-console

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
            this.formatInvoiceForStepper(invoice);
        }
    }

    private onError(err: any): void {
        this.hasError = true;
        this.working = false;
        this.documentInfoText = '';
    }

    private triggerAutoSearch(): void {
        if (!this.autoSearched && this.searchModel && this.searchModel.invoiceId && this.searchModel.invoiceType) {
            this.autoSearched = true;
            setTimeout(() => this.onSearch(this.searchModel as SearchModel), 0);
        }
    }

    /** Mapea la trazabilidad a los 6 pasos canónicos, priorizando la etiqueta de etapa enviada por el servicio */
    private mapTrazabilidadToSteps(trazabilidad: any[]): TrackingStepModel[] {
        const items = Array.isArray(trazabilidad) ? trazabilidad : [];
        return this.canonicalEtapas.map((canonical, index) => {
            const match = this.findEtapaMatch(items, canonical);
            const titleText = this.resolveTitleFromMatch(match, canonical.label);
            const step = new TrackingStepModel();
            step.title = { text: titleText, color: '', isBold: false } as any;

            if (match) {
                const indProcesado = match.indProcesado !== undefined ? match.indProcesado : null;
                
                // Siempre usar el label canónico
                step.title.text = canonical.label;
                
                // Preferir campos calculados del backend si están disponibles, sino calcular manualmente
                if (match.title) {
                    step.title.color = match.title.color || this.computeTitleColor(indProcesado, match.estado);
                    step.title.isBold = match.title.isBold !== undefined ? match.title.isBold : this.computeIsBold(indProcesado, match.estado);
                } else {
                    step.title.color = this.computeTitleColor(indProcesado, match.estado);
                    step.title.isBold = this.computeIsBold(indProcesado, match.estado);
                }
                
                // Usar description calculada del backend si está disponible
                if (match.description !== undefined) {
                    step.description = match.description || '';
                } else {
                    step.description = this.composeStepDescription(match.glosa, match.observacion);
                }
                
                // Usar date calculada del backend si está disponible (puede ser null)
                if (match.date !== undefined) {
                    step.date = match.date !== null ? this.parseFechaRegistro(match.date) as any : undefined;
                } else {
                    // Fallback: calcular fecha manualmente
                    const fechaRegistro = (indProcesado !== null && match.fechaRegistro && match.fechaRegistro.trim()) 
                        ? match.fechaRegistro 
                        : undefined;
                    step.date = fechaRegistro ? this.parseFechaRegistro(fechaRegistro) as any : undefined;
                }
                
                // Usar icon calculado del backend si está disponible
                if (match.icon) {
                    step.icon = match.icon;
                } else {
                    step.icon = this.computeIconFromEstado(match.estado, indProcesado);
                }
            } else {
                step.description = '';
                step.date = undefined as any;
                step.icon = 'pending';
                step.title.color = '#575962'; // gris medio para pendiente
                step.title.isBold = false;
            }

            (step as any).canonicalKey = canonical.key;
            (step as any).rawEtapa = match?.etapa;
            (step as any).rawGlosa = match?.glosa;
            (step as any).orden = typeof match?.orden === 'number' ? match?.orden : index;
            (step as any).indProcesado = match?.indProcesado;
            return step;
        });
    }

    private composeStepDescription(glosa: string | undefined, observacion: string | undefined): string {
        const trimmedObs = (observacion || '').trim();
        if (trimmedObs) { return trimmedObs; }
        const trimmedGlosa = (glosa || '').trim();
        return trimmedGlosa;
    }

    private resolveTitleFromMatch(match: any, fallback: string): string {
        // Siempre usar el label canónico para mantener consistencia con Mis Compras
        return fallback;
    }

    private findEtapaMatch(entries: any[], canonical: { key: string; aliases?: string[] }): any | undefined {
        const accepted = [canonical.key, ...(canonical.aliases || [])];
        return entries.find((t: any) => {
            const etapaNorm = this.normalizeEtapaLabel(t?.etapa);
            const glosaNorm = this.normalizeEtapaLabel(t?.glosa);
            return accepted.includes(etapaNorm) || accepted.includes(glosaNorm);
        });
    }

    private normalizeEtapaLabel(value: string | undefined): string {
        if (!value) { return ''; }
        const normalized = value
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        return this.etapaAliasMap[normalized] || normalized;
    }

    private buildEtapaAliasMap(): Record<string, string> {
        const map: Record<string, string> = {};
        this.canonicalEtapas.forEach(canonical => {
            map[canonical.key] = canonical.key;
            (canonical.aliases || []).forEach(alias => {
                map[alias] = canonical.key;
            });
        });
        return map;
    }

    private computeIconFromEstado(estado: string | undefined, indProcesado?: number | null): string {
        // Priorizar indProcesado si está disponible
        if (indProcesado !== undefined && indProcesado !== null) {
            if (indProcesado === 1) {
                return this.timelineCompleteIcon; // Completado
            } else if (indProcesado === 0) {
                return this.timelineCompleteIcon; // En progreso (usar mismo ícono o timeline_in_progress_icon.svg si existe)
            } else {
                return 'pending'; // Pendiente
            }
        }
        // Fallback al estado anterior para compatibilidad
        const e = (estado || '').toLowerCase();
        if (!e) return 'pending';
        const doneStates = ['activo', 'finalizado', 'completado', 'entregado'];
        return doneStates.some(ds => e.indexOf(ds) >= 0) ? this.timelineCompleteIcon : 'pending';
    }

    private computeTitleColor(indProcesado?: number | null, estado?: string): string {
        if (indProcesado === 1) {
            return '#4d4f57'; // gris oscuro para completado
        } else if (indProcesado === 0) {
            return '#00aa00'; // verde para en progreso (opcional, puede usar #4d4f57)
        }
        return '#575962'; // gris medio para pendiente
    }

    private computeIsBold(indProcesado?: number | null, estado?: string): boolean {
        if (indProcesado === 1 || indProcesado === 0) {
            return true; // Negrita para completado o en progreso
        }
        return false; // No negrita para pendiente
    }

    private parseFechaRegistro(raw: string | null | undefined): Date | undefined {
        // Manejar null explícitamente (nuevo formato del backend)
        if (raw === null || raw === undefined) return undefined;
        if (!raw || !raw.trim()) return undefined;
        
        // Intentar parseo directo (ISO 8601: yyyy-MM-ddTHH:mm:ss o yyyy-MM-ddTHH:mm:ss.fff)
        // Date.parse() maneja automáticamente el formato con milisegundos
        const direct = Date.parse(raw);
        if (!isNaN(direct)) return new Date(direct);
        
        // Intentar formato ISO 8601 sin T: yyyy-MM-dd HH:mm:ss
        const isoSpaceMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
        if (isoSpaceMatch) {
            const y = parseInt(isoSpaceMatch[1], 10);
            const mo = parseInt(isoSpaceMatch[2], 10) - 1;
            const d = parseInt(isoSpaceMatch[3], 10);
            const h = parseInt(isoSpaceMatch[4], 10);
            const mi = parseInt(isoSpaceMatch[5], 10);
            const s = parseInt(isoSpaceMatch[6], 10);
            return new Date(y, mo, d, h, mi, s);
        }
        // Intentar formato ISO 8601 solo fecha: yyyy-MM-dd
        const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoDateMatch) {
            const y = parseInt(isoDateMatch[1], 10);
            const mo = parseInt(isoDateMatch[2], 10) - 1;
            const d = parseInt(isoDateMatch[3], 10);
            return new Date(y, mo, d);
        }
        // Intentar formato legacy dd-MM-yyyy
        const legacyMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (legacyMatch) {
            const d = parseInt(legacyMatch[1], 10);
            const mo = parseInt(legacyMatch[2], 10) - 1;
            const y = parseInt(legacyMatch[3], 10);
            return new Date(y, mo, d);
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
        const params = this.activeRoute.snapshot.queryParams || {};
        // Intentar preservar el identificador de cliente (rut/clienteId) y la paginación de origen
        const clienteIdToSend = this.clienteId || params.clienteId || null;
        const query: any = {};

        if (clienteIdToSend) {
            query.clienteId = clienteIdToSend;
            // MisCompras acepta rut o clienteId
            query.rut = clienteIdToSend;
        }
        if (params.page) query.page = params.page;
        if (params.perPage) query.perPage = params.perPage;
        if (params.buscar) query.buscar = params.buscar;

        this.router.navigate(['/mis-compras'], { queryParams: query });
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
            'Pedido Ingresado',
            'Pedido Aprobado',
            'Preparacion de Pedido',
            'Pendiente de Envío',
            'Pedido en Ruta',
            'Pedido Entregado'
        ];

        if (!this.invoice || !this.invoice.trackingSteps || this.invoice.trackingSteps.length === 0) {
            return pasosOrden[0];
        }

        const titles = new Set(
            this.invoice.trackingSteps
                .map((s: any) => (s.title && s.title.text ? s.title.text.toLowerCase() : ''))
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
        if (!fecha || !fecha.trim()) return undefined;
        // Intentar parseo ISO 8601 primero
        const direct = Date.parse(fecha);
        if (!isNaN(direct)) return new Date(direct);
        // Intentar formato ISO 8601: yyyy-MM-dd
        const isoMatch = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            const y = parseInt(isoMatch[1], 10);
            const mo = parseInt(isoMatch[2], 10) - 1;
            const d = parseInt(isoMatch[3], 10);
            return new Date(y, mo, d);
        }
        // Intentar formato legacy dd-MM-yyyy
        const legacyMatch = fecha.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (legacyMatch) {
            const d = parseInt(legacyMatch[1], 10);
            const mo = parseInt(legacyMatch[2], 10) - 1;
            const y = parseInt(legacyMatch[3], 10);
            return new Date(y, mo, d);
        }
        return undefined;
    }

    // private normalizeGlosa(glosa: string): string {
    //     if (!glosa) return glosa;
    //     const g = glosa.trim().toLowerCase();
    //     const map: Record<string, string> = {
    //         'pedido ingresado': 'Pedido Ingresado',
    //         'pedido pagado': 'Pedido Aprobado',
    //         'pedido aprobado': 'Pedido Aprobado',
    //         'preparacion de pedido': 'Preparación de Pedido',
    //         'preparación de pedido': 'Preparación de Pedido'
    //     };
    //     return map[g] || glosa;
    // }

    private mapRawSteps(trazabilidad: any[]): TrackingStepModel[] {
        if (!Array.isArray(trazabilidad) || trazabilidad.length === 0) return [];

        // Sort by 'orden'
        const sorted = [...trazabilidad].sort((a, b) => (a.orden || 0) - (b.orden || 0));

        return sorted.map(t => {
            const step = new TrackingStepModel();
            const indProcesado = t.indProcesado !== undefined ? t.indProcesado : null;
            
            // Preferir campos calculados del backend si están disponibles
            if (t.title && t.description !== undefined && t.date !== undefined && t.icon) {
                // Usar campos calculados del backend
                step.title = {
                    text: t.etapa || t.title.text || '',
                    color: t.title.color || this.computeTitleColor(indProcesado, t.estado),
                    isBold: t.title.isBold !== undefined ? t.title.isBold : this.computeIsBold(indProcesado, t.estado)
                } as any;
                step.description = t.description || '';
                step.date = t.date !== null ? this.parseFechaRegistro(t.date) as any : undefined;
                step.icon = t.icon || this.computeIconFromEstado(t.estado, indProcesado);
            } else {
                // Fallback: calcular manualmente
                step.title = { 
                    text: t.etapa || '', 
                    color: this.computeTitleColor(indProcesado, t.estado), 
                    isBold: this.computeIsBold(indProcesado, t.estado) 
                } as any;
                step.description = this.composeStepDescription(t.glosa, t.observacion);
                
                // La fecha solo se muestra si indProcesado !== null (completado o en progreso)
                const fechaRegistro = (indProcesado !== null && t.fechaRegistro && t.fechaRegistro.trim()) 
                    ? t.fechaRegistro 
                    : undefined;
                step.date = fechaRegistro ? this.parseFechaRegistro(fechaRegistro) as any : undefined;
                step.icon = this.computeIconFromEstado(t.estado, indProcesado);
            }

            (step as any).rawEtapa = t.etapa;
            (step as any).rawGlosa = t.glosa;
            (step as any).orden = t.orden;
            (step as any).indProcesado = indProcesado;

            return step;
        });
    }

    private formatInvoiceForStepper(invoice: any): void {
        if (!invoice) {
            return;
        }
        const normalizedInvoice: any = { ...invoice };
        const rawProducts = (normalizedInvoice.orderProducts && normalizedInvoice.orderProducts.length)
            ? normalizedInvoice.orderProducts
            : normalizedInvoice.productos;
        
        normalizedInvoice.orderProducts = this.mapOrderProducts(rawProducts);
        normalizedInvoice.deliveryType = normalizedInvoice.deliveryType || normalizedInvoice.tipoEntrega || normalizedInvoice.delivery_type;
        normalizedInvoice.deliveryAddress = normalizedInvoice.deliveryAddress || normalizedInvoice.direccionEntrega || normalizedInvoice.direccion || normalizedInvoice.delivery_address;

        const sourceSteps = this.resolveInvoiceTrackingSteps(normalizedInvoice);
        // Use raw steps if available from resolveInvoiceTrackingSteps (which now handles rawTrazabilidad)
        // If sourceSteps came from canonical mapping (legacy), we might want to keep it, 
        // but for the new requirement we prefer raw mapping if 'trazabilidad' exists.

        // However, resolveInvoiceTrackingSteps calls mapTrazabilidadToSteps for rawTrazabilidad.
        // We should change that logic or handle it here.
        // Let's check if we have rawTrazabilidad and use mapRawSteps directly.

        let steps: TrackingStepModel[] = [];
        if (normalizedInvoice.trazabilidad && Array.isArray(normalizedInvoice.trazabilidad) && normalizedInvoice.trazabilidad.length > 0) {
            // Siempre mapear a los 6 pasos canónicos (igual que en mis-compras)
            steps = this.mapTrazabilidadToSteps(normalizedInvoice.trazabilidad);
        } else {
            // Fallback to existing logic for legacy/other sources
            steps = this.padCanonicalSteps(sourceSteps);
        }

        // Preservar íconos originales cuando son URLs
        const normalizedSteps = steps.map(s => {
            const m = new TrackingStepModel();
            // Do NOT normalize glosa here for raw steps
            m.title = { text: s.title?.text, color: s.title?.color, isBold: s.title?.isBold } as any;
            m.description = s.description || '';
            m.date = s.date;
            m.icon = s.icon === 'done' ? this.timelineCompleteIcon : (s.icon || 'pending');
            m.machinable = s.machinable;
            return m;
        });

        normalizedInvoice.trackingSteps = normalizedSteps.map(step => ({ ...step }));
        this.stepperSteps = normalizedSteps;
        this.invoice = normalizedInvoice;
        this.compraAdaptada = {
            trazabilidad: steps.map((s, idx) => ({
                etapa: (s as any).rawEtapa || s.title?.text,
                glosa: (s as any).rawGlosa || s.title?.text, // Do not normalize
                fechaRegistro: s.date ? (typeof s.date === 'string' ? s.date : s.date.toISOString()) : undefined,
                estado: s.icon?.indexOf('timeline_complete_icon') >= 0 ? 'finalizado' : (s.icon?.indexOf('pending') >= 0 ? 'pendiente' : 'activo'),
                observacion: s.description || '',
                orden: idx,
                indProcesado: (s as any).indProcesado !== undefined ? (s as any).indProcesado : null
            })),
            productos: normalizedInvoice.orderProducts ? [...normalizedInvoice.orderProducts] : [],
            documentLabel: normalizedInvoice.documentLabel || normalizedInvoice.tipoDocumento,
            numeroDocumento: normalizedInvoice.printedNumber || normalizedInvoice.numeroDocumento || normalizedInvoice.documentNumber
        };
        this.documentInfoText = this.buildDocumentInfoString(this.invoice);
        // Forzar detección por si la asignación llega fuera del ciclo de Angular
        this.scheduleDetectChanges();
    }

    private resolveInvoiceTrackingSteps(invoice: any): TrackingStepModel[] {
        const normalizedSteps = Array.isArray(invoice?.trackingSteps) ? invoice.trackingSteps : [];
        if (normalizedSteps.length) {
            return TrackingStepModel.mapFromObjs(normalizedSteps);
        }
        const legacyTraceability = invoice?.traceability?.steps;
        if (Array.isArray(legacyTraceability) && legacyTraceability.length) {
            return TrackingStepModel.mapFromObjs(legacyTraceability);
        }
        const rawTrazabilidad = invoice?.trazabilidad;
        if (Array.isArray(rawTrazabilidad) && rawTrazabilidad.length) {
            return this.mapTrazabilidadToSteps(rawTrazabilidad);
        }
        return [];
    }

    private formatCompraDtoForStepper(raw: any): void {
        const mappedProductos = this.mapOrderProducts(raw.productos || raw.orderProducts);

        // Siempre mapear a los 6 pasos canónicos (igual que en mis-compras)
        let steps: TrackingStepModel[] = [];
        if (raw.trazabilidad && Array.isArray(raw.trazabilidad) && raw.trazabilidad.length > 0) {
            steps = this.mapTrazabilidadToSteps(raw.trazabilidad);
        } else {
            // Fallback a mapeo canónico si no hay trazabilidad
            const rawSteps = this.mapTrazabilidadToSteps(raw.trazabilidad || []);
            steps = this.padCanonicalSteps(rawSteps);
        }

        this.invoice = {
            printedNumber: raw.numeroDocumento?.replace(/^N[°º]?\s*/i, '').replace(/^0+/, ''),
            documentType: this.mapTipoDocumentoToCode(raw.tipoDocumento),
            documentLabel: raw.tipoDocumento,
            issueDate: this.parseDate(raw.fechaCompra),
            availablePickupDate: this.parseDate((raw as any).fechaDisponibleRetiro),
            deliveryAddress: raw.direccionEntrega || raw.direccion || undefined,
            deliveryType: raw.tipoEntrega || undefined,
            trackingSteps: steps.map(step => ({ ...step })),
            orderProducts: mappedProductos,
            hasProductDetails: mappedProductos.length > 0
        } as any;
        this.stepperSteps = steps;
        this.compraAdaptada = {
            trazabilidad: (raw.trazabilidad || []).map((t: any) => ({
                etapa: t.etapa,
                glosa: t.glosa, // Do not normalize
                fechaRegistro: t.fechaRegistro,
                estado: t.estado || 'activo',
                observacion: t.observacion || '',
                orden: t.orden,
                indProcesado: t.indProcesado !== undefined ? (t.indProcesado === null ? null : Number(t.indProcesado)) : undefined
            })),
            productos: mappedProductos,
            direccionEntrega: raw.direccionEntrega || raw.direccion || '',
            documentLabel: raw.tipoDocumento,
            numeroDocumento: raw.numeroDocumento
        };
        this.documentInfoText = this.buildDocumentInfoString(this.invoice);
        // Diagnóstico dirección
        // eslint-disable-next-line no-console
        try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
    }

    private padCanonicalSteps(existing: TrackingStepModel[]): TrackingStepModel[] {
        const order = this.canonicalEtapas.map(c => c.label);
        const normalizedExisting = existing.map(s => ({
            key: this.normalizeEtapaLabel((((s as any).canonicalKey) || (s.title?.text || ''))),
            step: s
        }));
        const hasMap = new Map<string, TrackingStepModel>();
        normalizedExisting.forEach(e => hasMap.set(e.key, e.step));
        const result: TrackingStepModel[] = [];
        order.forEach(label => {
            const key = this.normalizeEtapaLabel(label);
            if (hasMap.has(key)) {
                result.push(hasMap.get(key)!);
            } else {
                const pending = new TrackingStepModel();
                pending.title = { text: label, color: '#4d4f57', isBold: true } as any;
                pending.description = '';
                pending.date = undefined as any;
                pending.icon = 'pending';
                result.push(pending);
            }
        });
        return result;
    }

    private mapOrderProducts(rawProducts: any): any[] {
        const items = Array.isArray(rawProducts) ? rawProducts : [];
        return items.map((p: any) => ({
            order: p.order,
            lineNumber: p.lineNumber,
            internalNumber: p.internalNumber,
            documentType: p.documentType,
            quantity: p.quantity !== undefined ? p.quantity : p.cantidad,
            codeUnimed: p.codeUnimed,
            image: p.image || p.imagen || (this.baseHref + 'assets/not-image.jpg'),
            description: p.description || p.nombre || p.descripcion,
            descriptionUnimed: p.descriptionUnimed,
            code: p.code !== undefined ? p.code : p.codigo,
            stateDescription: p.stateDescription || p.estado,
            state_description: p.state_description || p.stateDescription || p.estado,
            nombre: p.nombre,
            descripcion: p.descripcion,
            sku: p.sku,
            unidadMedida: p.unidadMedida,
            cantidad: p.cantidad,
            codigo: p.codigo
        }));
    }

    public completedCount(): number {
        return this.stepperSteps.filter(s => s.icon !== 'pending').length;
    }

    public totalCanonical(): number { return 6; }

    public resumenTipoEntrega(): string | undefined {
        if (!this.invoice) return undefined;
        const tipo = (this.invoice as any)?.deliveryType?.toLowerCase();
        if (tipo) {
            if (tipo.includes('retiro')) return 'Retiro en Tienda';
            if (tipo.includes('despacho') || tipo.includes('domicilio')) return 'Despacho a domicilio';
        }
        if (this.invoice?.pickup) return 'Retiro en Tienda';
        return 'Despacho a domicilio';
    }

    public resumenDireccion(): string | undefined {
        // Intentar obtener dirección desde pickup (suponiendo propiedades standard)
        const p: any = this.invoice?.pickup as any;
        if (p?.text) return p.text; // usar texto directo si existe
        if (p) {
            const parts = [p.address, p.commune, p.city, p.region, p.text].filter(Boolean);
            if (parts.length) return parts.join(', ');
        }
        // Fallback a deliveryAddress directo del JSON
        const d: any = (this.invoice as any)?.deliveryAddress;
        if (d) return d;
        if (this.compraAdaptada?.direccionEntrega) return this.compraAdaptada.direccionEntrega;
        return undefined;
    }

    public direccionEntrega(): string | undefined {
        if (!this.invoice) return undefined;
        const pickupText = ((this.invoice as any)?.pickup?.text || '').trim();
        if (pickupText) return pickupText;
        const invDir = ((this.invoice as any)?.deliveryAddress || '').trim();
        if (invDir) return invDir;
        const adaptDir = (this.compraAdaptada?.direccionEntrega || '').trim();
        return adaptDir || undefined;
    }

    public resumenFechaRetiro(): string {
        const inv: any = this.invoice as any;
        if (!inv) return '';

        // Priorizar siempre fechaDisponibleRetiro (availablePickupDate) si viene del servicio
        const d: Date | undefined = inv?.availablePickupDate || this.invoice?.issueDate;

        if (!d) {
            // Si no hay fecha en el invoice, intentar leer directamente del payload adaptado
            const rawDate: string | undefined = (this.compraAdaptada as any)?.fechaDisponibleRetiro
                || (this.compraAdaptada as any)?.fechaRetiro;
            if (!rawDate) {
                return '';
            }
            const parsed = this.parseDate(rawDate);
            if (!parsed) {
                return '';
            }
            const ddR = String(parsed.getDate()).padStart(2, '0');
            const mmR = String(parsed.getMonth() + 1).padStart(2, '0');
            const yyyyR = parsed.getFullYear();
            return `${ddR}-${mmR}-${yyyyR}`;
        }

        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }

    public onImgError(ev: Event): void {
        const img = ev.target as HTMLImageElement;
        if (!img) return;
        img.src = this.baseHref + 'assets/not-image.jpg';
    }

    public productSubtitle(): string {
        // Mostrar 'Producto Entregado' si el último paso es entregado y hay productos
        const has = this.invoice?.orderProducts?.length;
        if (has) {
            const last = this.stepperSteps[this.stepperSteps.length - 1];
            const title = (last?.title?.text || '').toLowerCase();
            if (title.includes('entregado') && last.icon !== 'pending') {
                return 'Producto Entregado';
            }
        }
        return 'Productos';
    }

    // Steps a mostrar: usa los mapeados desde compra (si existen) o los locales
    public get displaySteps(): TrackingStepModel[] {
        if (this.stepperSteps && this.stepperSteps.length > 0) return this.stepperSteps;
        return this.mapTrazabilidadToSteps(this.compraAdaptada?.trazabilidad || []);
    }

    // ---- Inlined stepper helpers ----
    private statusMap: any = {
        'Pedido Ingresado': ['Pendiente', 'Pendiente de despacho'],
        'Pedido Aprobado': [],
        'Pedido pagado': ['Pendiente', 'Pendiente de despacho'],
        'Preparación de Pedido': ['Pendiente'],
        'Preparacion de Pedido': ['Pendiente'],
        'Pendiente de Envío': ['Pendiente de despacho'],
        'Pedido en Ruta': ['En Ruta'],
        'Disponible para retiro': ['Producto Listo para Retiro'],
        'Pedido Entregado': ['Entregado', 'Producto Entregado']
    };

    public isStepCompleted(step: TrackingStepModel): boolean {
        return step.icon.indexOf('pending') < 0;
    }

    public isLastStepCompleted(index: number): boolean {
        const steps = this.displaySteps;
        if (steps) {
            if (steps[index + 1] !== undefined) {
                const currentIsDone = steps[index].icon.indexOf('pending') < 0;
                const nextIsPending = steps[index + 1].icon.indexOf('pending') >= 0;
                return currentIsDone && nextIsPending;
            } else if (index === steps.length - 1) {
                return true;
            } else {
                return steps[index].icon.indexOf('pending') < 0;
            }
        }
        return false;
    }

    public isStepInProgress(step: TrackingStepModel, index: number): boolean {
        const nextStepsItems = this.displaySteps.slice(index + 1);
        const itemsNextSteps = nextStepsItems.filter(s => this.numberOfItemsOnStatus(s.title as any, this.displaySteps.indexOf(s)) > 0).length;
        const currentIsDone = step.icon.indexOf('pending') < 0;
        if (currentIsDone && this.isLastStepCompleted(index) && itemsNextSteps <= 0) {
            return false;
        }
        return itemsNextSteps > 0 || this.numberOfItemsOnStatus(step.title as any, index) > 0;
    }

    public numberOfItemsOnStatus(stepTitle: any, index: number): number {
        const orderDetails = this.invoice?.orderProducts || [];
        const steps = this.displaySteps;
        if (!orderDetails || orderDetails.length === 0 || !steps) {
            return 0;
        }
        const isDeliveredStep = index === steps.length - 1 && this.normalizeEtapaLabel(stepTitle?.text) === 'pedido entregado';
        if (!isDeliveredStep) {
            return 0;
        }
        const isLastCompleted = this.isLastStepCompleted(index);
        if (!isLastCompleted && steps[index].icon.indexOf('pending') < 0) {
            return 0;
        }
        const allowedStatus = this.statusMap[stepTitle.text];
        if (!allowedStatus) return 0;
        if (index > 0) {
            const prevStepAllowedStatus = this.statusMap[steps[index - 1].title.text];
            if (prevStepAllowedStatus && prevStepAllowedStatus[0] === allowedStatus[0] && allowedStatus.length === prevStepAllowedStatus.length && steps[index - 1].icon.indexOf('in_progress') > 0) {
                return 0;
            }
        }
        return orderDetails.filter((p: any) => allowedStatus.indexOf((p as any).stateDescription) >= 0).length;
    }

    public productCount(): number {
        return this.invoice?.orderProducts ? this.invoice.orderProducts.length : 0;
    }

    public showDeliveredBadge(step: TrackingStepModel): boolean {
        const title = (step.title?.text || '').toLowerCase();
        return title === 'pedido entregado' && this.productCount() > 0;
    }
    // Verifica si un paso tiene pasos pendientes despu�s
    public hasPendingAfter(step: TrackingStepModel, index: number): boolean {
        const steps = this.displaySteps;
        if (!steps || index >= steps.length - 1) return false;
        
        const nextStep = steps[index + 1];
        const isCurrentDone = step.icon.indexOf('pending') < 0;
        const isNextPending = nextStep.icon.indexOf('pending') >= 0;
        
        return isCurrentDone && isNextPending;
    }

    // Verifica si un paso pendiente viene despu�s de un completado/en progreso
    public hasPendingFrom(step: TrackingStepModel, index: number): boolean {
        const steps = this.displaySteps;
        if (!steps || index <= 0) return false;
        
        const isPending = step.icon.indexOf('pending') >= 0;
        if (!isPending) return false;
        
        // Buscar hacia atr�s hasta encontrar un paso completado
        for (let i = index - 1; i >= 0; i--) {
            const prevStep = steps[i];
            if (prevStep.icon.indexOf('pending') < 0) {
                return true;
            }
        }
        return false;
    }

    public purchaseSummaryTitle(): string {
        return 'Resumen de tu compra';
    }

    private buildDocumentInfoString(inv: any): string {
        const label = this.firstNonEmpty([
            inv?.documentLabel,
            inv?.tipoDocumento,
            inv?.documentType,
            this.compraAdaptada?.documentLabel,
            (this.compraAdaptada as any)?.tipoDocumento
        ]) || '';

        const rawNumber = this.firstNonEmpty([
            inv?.printedNumber,
            inv?.numeroDocumento,
            inv?.documentNumber,
            inv?.number_printed,
            this.compraAdaptada?.printedNumber,
            (this.compraAdaptada as any)?.numeroDocumento,
            (this.compraAdaptada as any)?.documentNumber
        ]) || '';

        if (!label && !rawNumber) {
            return '';
        }

        let cleanNum = rawNumber.replace(/^N[°º]?\s*/i, '').trim();
        cleanNum = cleanNum.replace(/^0+/, '');
        if (!cleanNum && rawNumber.match(/[0-9]/)) {
            cleanNum = '0';
        }

        const parts = [label, cleanNum].filter(Boolean);
        return parts.join(' ').trim();
    }

    private firstNonEmpty(values: Array<any>): string | undefined {
        for (const value of values) {
            if (value === undefined || value === null) {
                continue;
            }
            const str = value.toString().trim();
            if (str.length > 0) {
                return str;
            }
        }
        return undefined;
    }

    public getDocumentType(): string {
        if (!this.invoice) {
            return 'Documento';
        }

        const tipo = this.firstNonEmpty([
            this.invoice?.documentLabel,
            this.invoice?.tipoDocumento,
            this.invoice?.documentType,
            this.compraAdaptada?.documentLabel,
            (this.compraAdaptada as any)?.tipoDocumento
        ]) || '';

        if (!tipo) {
            return 'Documento';
        }

        // Normalizar el tipo de documento
        const tipoLower = tipo.toLowerCase().trim();
        if (tipoLower.includes('nota') && tipoLower.includes('venta')) {
            return 'Nota de Venta';
        } else if (tipoLower.includes('factura')) {
            return 'Factura';
        } else if (tipoLower.includes('boleta')) {
            return 'Boleta';
        }

        // Si no coincide con ninguno, devolver el valor original capitalizado
        return tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
    }

    public getDocumentNumber(): string {
        if (!this.invoice) {
            return '';
        }

        const rawNumber = this.firstNonEmpty([
            this.invoice?.printedNumber,
            this.invoice?.numeroDocumento,
            this.invoice?.documentNumber,
            this.invoice?.number_printed,
            this.compraAdaptada?.printedNumber,
            (this.compraAdaptada as any)?.numeroDocumento,
            (this.compraAdaptada as any)?.documentNumber
        ]) || '';

        if (!rawNumber) {
            return '';
        }

        let cleanNum = rawNumber.replace(/^N[°º]?\s*/i, '').trim();
        cleanNum = cleanNum.replace(/^0+/, '');
        if (!cleanNum && rawNumber.match(/[0-9]/)) {
            cleanNum = '0';
        }

        return cleanNum;
    }

    public getDocumentString(): string {
        const inv: any = this.invoice || this.compraAdaptada;
        return this.buildDocumentInfoString(inv);
    }

    private scheduleDetectChanges(): void {
        // Schedule detectChanges asynchronously to avoid running it during Angular's own CD cycle
        Promise.resolve().then(() => {
            try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
        });
    }

    public isDeliveredTitle(title: string | undefined): boolean {
        return this.normalizeEtapaLabel(title || '') === 'pedido entregado';
    }
}
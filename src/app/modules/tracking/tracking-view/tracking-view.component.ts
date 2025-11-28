import {Component, ElementRef, ViewChild} from '@angular/core';
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

    public invoice: any
    // Objeto adaptado para PurchaseTimelineComponent
    public compraAdaptada: any | undefined;
    // Pasos derivados de 'trazabilidad' (o invoice.trackingSteps) para alimentar el nuevo componente stepper
    public stepperSteps: TrackingStepModel[] = [];
    public working = false;
    public hasError = false;
    public searchModel: SearchModel | undefined;
    public hideSearch = false;
    private autoSearched = false;
    private readonly canonicalEtapas = [
        { key: 'pedido ingresado', label: 'Pedido Ingresado' },
        { key: 'pedido aprobado', label: 'Pedido Aprobado', aliases: ['pedido pagado'] },
        { key: 'preparacion de pedido', label: 'Preparación de Pedido' },
        { key: 'disponible para retiro', label: 'Disponible para retiro' },
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
                private trackingData: TrackingDataService) {
                    console.log("COSNTRUCTOR TrackingViewComponent");
        const nav = this.router.getCurrentNavigation();
        const state = nav && nav.extras && nav.extras.state ? nav.extras.state : undefined;
    const buscarResp = state && (state as any).compraBuscarDocumentoResp ? (state as any).compraBuscarDocumentoResp : undefined;
        try {
            // eslint-disable-next-line no-console
            console.log('este es el constructor de TrackingViewComponent1', buscarResp && buscarResp.compras ? JSON.stringify({ compras: buscarResp.compras, total: buscarResp.total, page: buscarResp.page, perPage: buscarResp.perPage, totalPages: buscarResp.totalPages }, null, 2) : 'sin respuesta transportada');
        } catch {
            // eslint-disable-next-line no-console
            console.log('este es el constructor de TrackingViewComponent1', 'error serializando respuesta');
        }
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
                const invoiceTransport = this.trackingData.consumeInvoicePayload();
                if (invoiceTransport) {
                    const mapped: any = invoiceTransport; // usar payload directo, sin modelo
                    if (mapped) {
                        this.formatInvoiceForStepper(mapped);
                        // eslint-disable-next-line no-console
                        this.hideSearch = true;
                        this.applyHideHeroBg();
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
    }

    private triggerAutoSearch(): void {
        if (!this.autoSearched && this.searchModel && this.searchModel.invoiceId && this.searchModel.invoiceType) {
            this.autoSearched = true;
            setTimeout(() => this.onSearch(this.searchModel as SearchModel), 0);
        }
    }

    /** Mapea la trazabilidad a los 5 pasos canónicos, priorizando la etiqueta de etapa enviada por el servicio */
    private mapTrazabilidadToSteps(trazabilidad: any[]): TrackingStepModel[] {
        const items = Array.isArray(trazabilidad) ? trazabilidad : [];
        return this.canonicalEtapas.map((canonical, index) => {
            const match = this.findEtapaMatch(items, canonical);
            const titleText = this.resolveTitleFromMatch(match, canonical.label);
            const step = new TrackingStepModel();
            step.title = { text: titleText, color: '', isBold: false } as any;

            if (match) {
                step.description = this.composeStepDescription(match.glosa, match.observacion);
                step.date = this.parseFechaRegistro(match.fechaRegistro) as any;
                step.icon = this.computeIconFromEstado(match.estado);
            } else {
                step.description = '';
                step.date = undefined as any;
                step.icon = 'pending';
            }

            (step as any).canonicalKey = canonical.key;
            (step as any).rawEtapa = match?.etapa;
            (step as any).rawGlosa = match?.glosa;
            (step as any).orden = typeof match?.orden === 'number' ? match?.orden : index;
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
        const etapa = (match?.etapa || '').trim();
        return etapa || fallback;
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

    private buildEtapaAliasMap(): Record<string,string> {
        const map: Record<string,string> = {};
        this.canonicalEtapas.forEach(canonical => {
            map[canonical.key] = canonical.key;
            (canonical.aliases || []).forEach(alias => {
                map[alias] = canonical.key;
            });
        });
        return map;
    }

    private computeIconFromEstado(estado: string | undefined): string {
        const e = (estado || '').toLowerCase();
        if (!e) return 'pending';
        const doneStates = ['activo','finalizado','completado','entregado'];
        return doneStates.some(ds => e.indexOf(ds) >= 0) ? this.timelineCompleteIcon : 'pending';
    }

    private parseFechaRegistro(raw: string): Date | undefined {
        if (!raw) return undefined;
        // Intentar parseo directo (ISO / timestamp, incluyendo milisegundos y zona)
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
            'Pedido Ingresado',
            'Pedido Aprobado',
            'Preparación de Pedido',
            'Disponible para retiro',
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
        const m = (fecha || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (!m) return undefined;
        const d = parseInt(m[1],10); const mo = parseInt(m[2],10)-1; const y = parseInt(m[3],10);
        return new Date(y,mo,d);
    }

    private normalizeGlosa(glosa: string): string {
        if (!glosa) return glosa;
        const g = glosa.trim().toLowerCase();
                const map: Record<string,string> = {
                    'pedido ingresado':'Pedido Ingresado',
                    'pedido pagado':'Pedido Aprobado',
                    'pedido aprobado':'Pedido Aprobado',
                    'preparacion de pedido':'Preparación de Pedido',
                    'preparación de pedido':'Preparación de Pedido'
                };
        return map[g] || glosa;
    }

    private formatInvoiceForStepper(invoice: any): void {
        const normalizedInvoice: any = { ...invoice };
        const rawProducts = (normalizedInvoice.orderProducts && normalizedInvoice.orderProducts.length)
            ? normalizedInvoice.orderProducts
            : normalizedInvoice.productos;
        normalizedInvoice.orderProducts = this.mapOrderProducts(rawProducts);

        this.invoice = normalizedInvoice;
        const steps = this.padCanonicalSteps((normalizedInvoice as any).trackingSteps || []);
        // Preservar íconos originales cuando son URLs, normalizar glosa si es necesario
        const normalizedSteps = steps.map(s => {
            const m = new TrackingStepModel();
            m.title = { text: this.normalizeGlosa(s.title?.text), color: s.title?.color, isBold: s.title?.isBold } as any;
            m.description = s.description || '';
            m.date = s.date;
            m.icon = s.icon === 'done' ? this.timelineCompleteIcon : (s.icon || 'pending');
            m.machinable = s.machinable;
            return m;
        });
        if (!this.stepperSteps.length) {
            this.stepperSteps = normalizedSteps;
        }
        this.compraAdaptada = {
            trazabilidad: steps.map((s, idx) => ({
                etapa: (s as any).rawEtapa || s.title?.text,
                glosa: (s as any).rawGlosa || this.normalizeGlosa(s.title?.text),
                fechaRegistro: s.date,
                estado: s.icon?.indexOf('timeline_complete_icon') >= 0 ? 'finalizado' : (s.icon?.indexOf('pending') >= 0 ? 'pendiente' : 'activo'),
                observacion: s.description || '',
                orden: idx
            })),
            productos: normalizedInvoice.orderProducts ? [...normalizedInvoice.orderProducts] : []
        };
    }

    private formatCompraDtoForStepper(raw: any): void {
        const mappedProductos = this.mapOrderProducts(raw.productos || raw.orderProducts);

        const canonicalSteps = this.mapTrazabilidadToSteps(raw.trazabilidad || []);
        const paddedSteps = this.padCanonicalSteps(canonicalSteps);

        this.invoice = {
            printedNumber: raw.numeroDocumento?.replace(/^N[°º]?\s*/i,'').replace(/^0+/, ''),
            documentType: this.mapTipoDocumentoToCode(raw.tipoDocumento),
            documentLabel: raw.tipoDocumento,
            issueDate: this.parseDate(raw.fechaCompra),
            deliveryAddress: raw.direccionEntrega || raw.direccion || undefined,
            deliveryType: raw.tipoEntrega || undefined,
            trackingSteps: paddedSteps.map(step => ({ ...step })),
            orderProducts: mappedProductos,
            hasProductDetails: mappedProductos.length > 0
        } as any;
        this.stepperSteps = paddedSteps;
        this.compraAdaptada = {
            trazabilidad: (raw.trazabilidad || []).map((t: any) => ({
                etapa: t.etapa,
                glosa: this.normalizeGlosa(t.glosa),
                fechaRegistro: t.fechaRegistro,
                estado: t.estado || 'activo',
                observacion: t.observacion || '',
                orden: t.orden
            })),
            productos: mappedProductos,
            direccionEntrega: raw.direccionEntrega || raw.direccion || ''
        };
        // Diagnóstico dirección
        // eslint-disable-next-line no-console
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
            image: p.image || p.imagen || 'assets/not-image.jpg',
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

    public totalCanonical(): number { return 5; }

    public resumenTipoEntrega(): string | undefined {
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
        const pickupText = ((this.invoice as any)?.pickup?.text || '').trim();
        if (pickupText) return pickupText;
        const invDir = ((this.invoice as any)?.deliveryAddress || '').trim();
        if (invDir) return invDir;
        const adaptDir = (this.compraAdaptada?.direccionEntrega || '').trim();
        return adaptDir || undefined;
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

    public onImgError(ev: Event): void {
        const img = ev.target as HTMLImageElement;
        if (!img) return;
        img.src = 'assets/not-image.jpg';
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

    public purchaseSummaryTitle(): string {
        // Construir: "Resumen de tu compra - {label} {numeroSinCeros}"
        const base = 'Resumen de tu compra';
        const label = (this.invoice?.documentLabel || '').trim();
        let num = (this.invoice?.printedNumber || '').toString();
        // remover todos los caracteres no numéricos y ceros a la izquierda
        const digits = num.replace(/\D+/g, '');
        if (digits.length > 0) {
            // quitar ceros a la izquierda
            num = digits.replace(/^0+/, '') || '0';
        } else {
            // si no hay dígitos, usar tal cual quitando prefijos tipo 'N°' y espacios
            num = (this.invoice?.printedNumber || '').toString().replace(/^N[°º]?\s*/i, '').trim();
        }
        const parts = [label, num].filter(p => (p || '').length > 0);
        return parts.length ? `${base} - ${parts.join(' ')}` : base;
    }
}

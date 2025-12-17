import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { InvoiceModel } from '../../../core/models/invoice.model';
import { SearchModel } from '../models/search-model';
import { take } from 'rxjs/operators';
import { TrackingService } from '../../../services/tracking.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TrackingDataService } from '../../../services/tracking-data.service';
import { TrackingStepModel } from '../../../core/models/tracking-step.model';
import { MachinableProcessModel } from '../../../core/models/machinable-process.model';
import { OrderDetailsModel } from '../../../core/models/order-details.model';
import { combineLatest } from 'rxjs';

@Component({
    selector: 'app-tracking-view',
    templateUrl: './tracking-view.template.html',
    styleUrls: ['./tracking-view.scss', './tracking-view.mobile.scss']
})
export class TrackingViewComponent implements OnInit {

    public invoice: InvoiceModel | undefined;
    public working = false;
    public hasError = false;
    public searchModel: SearchModel | undefined;
    public showSearchBox = true; // Por defecto mostrar el buscador
    public isDetailView = false; // Indica si estamos en la vista de detalle desde mis-compras

    @ViewChild('trackingStepperView')
    public trackingStepperView: ElementRef | undefined;
    public stepperOrderDetails: OrderDetailsModel[] | undefined;

    // Para navegar de vuelta a mis-compras
    private returnPage: number = 1;
    private returnPerPage: number = 10;
    private returnRut: string | null = null;

    constructor(private trackingService: TrackingService,
        private router: Router,
        private activeRoute: ActivatedRoute,
        private trackingDataService: TrackingDataService) {
    }

    ngOnInit(): void {
        // Suscribirse combinando Params (Ruta) y QueryParams (Legacy/Retorno)
        combineLatest([this.activeRoute.params, this.activeRoute.queryParams])
            .subscribe(([params, queryParams]) => {
                // 1. Prioridad: Parámetros de Ruta Semántica (/detalle/:id/:tipo)
                let folio = params.invoiceId;
                let tipo = params.invoiceType;

                // 2. Fallback: Query Params Legacy (?folio=...&tipo=...)
                if (!folio) folio = queryParams.folio || queryParams.folioDocumento;
                if (!tipo) tipo = queryParams.tipo || queryParams.tipoDocumento;

                // Guardar parámetros de retorno (paginación de mis-compras)
                this.returnPage = queryParams.page ? Number(queryParams.page) : 1;
                this.returnPerPage = queryParams.perPage ? Number(queryParams.perPage) : 10;
                this.returnRut = queryParams.cliente || queryParams.clienteId || queryParams.rut || null;

                // Configurar modo vista detalle (sin buscador)
                if (queryParams.detalle === '1' || queryParams.section === 'details') {
                    this.showSearchBox = false;
                    this.isDetailView = true;
                }

                // Iniciar carga si tenemos los identificadores
                if (folio && tipo) {
                    // Evitar recargar si ya estamos mostrando el mismo documento
                    // (aunque combineLatest puede emitir varias veces, la verificación simple ayuda)
                    if (this.searchModel && this.searchModel.invoiceId == folio && this.searchModel.invoiceType == tipo && this.invoice) {
                        return;
                    }

                    this.searchModel = new SearchModel(folio, tipo);
                    this.loadInvoiceData(folio, tipo);
                }
            });
    }

    private loadInvoiceData(folio: string, tipo: string): void {
        // Intentar obtener datos del servicio de datos primero (payload desde mis-compras)
        const invoicePayload = this.trackingDataService.consumeInvoicePayload();

        if (invoicePayload) {
            // Usar los datos transportados
            this.processInvoicePayload(invoicePayload);
        } else if (this.returnRut) {
            // Nuevo flujo: usar búsqueda de documentos en Mis Compras (BD local + Legacy)
            this.working = true;
            this.trackingService.getInvoiceFromDocumentsSearch(Number(folio), tipo, this.returnRut)
                .pipe(take(1))
                .subscribe({
                    next: (invoice) => {
                        if (invoice) {
                            this.onSuccess(invoice);
                        } else {
                            // Si no hay resultado, fallback a API legacy directa
                            this.onSearch(this.searchModel!);
                        }
                    },
                    error: () => {
                        // En caso de error, fallback a API legacy directa
                        this.onSearch(this.searchModel!);
                    }
                });
        } else {
            // Fallback: cargar desde API antigua directamente
            this.onSearch(this.searchModel!);
        }
    }

    /**
     * Procesa el payload de invoice transportado desde mis-compras
     */
    private processInvoicePayload(payload: any): void {
        const invoice = new InvoiceModel();

        invoice.printedNumber = payload.number_printed || '';
        invoice.documentType = payload.type_document || '';
        invoice.documentLabel = payload.label_document || '';
        invoice.total = payload.total || 0;
        invoice.issueDate = payload.date_issue ? new Date(payload.date_issue) : new Date();
        invoice.payId = payload.id_pay || 0;

        // Pickup
        if (payload.pickup) {
            invoice.pickup = {
                title: payload.pickup.title || '',
                text: payload.pickup.text || '',
                dateTitle: payload.pickup.title_date || '',
                date: payload.pickup.date ? new Date(payload.pickup.date) : undefined,
                icon: payload.pickup.icon || ''
            } as any;
        }

        // Delivery info
        invoice.deliveryType = payload.pickup?.title || '';
        invoice.deliveryAddress = payload.pickup?.text || '';

        // Tracking steps con machinable
        if (payload.traceability?.steps || payload.trackingSteps) {
            const rawSteps = payload.traceability?.steps || payload.trackingSteps || [];
            // Determinar si es retiro en tienda para filtrar "Pedido en Ruta"
            const isRetiroEnTienda = payload.pickup?.title?.toLowerCase().includes('retiro') ||
                payload.pickup?.title?.toLowerCase().includes('tienda');
            invoice.trackingSteps = rawSteps
                .filter((step: any) => {
                    // Filtrar "Pedido en Ruta" si es retiro en tienda
                    if (isRetiroEnTienda) {
                        const stepTitle = step.title?.text || step.title || '';
                        const normalizedTitle = stepTitle.toLowerCase().trim();
                        return normalizedTitle !== 'pedido en ruta';
                    }
                    return true;
                })
                .map((step: any) => {
                    const trackingStep = new TrackingStepModel();
                    trackingStep.title = {
                        text: step.title?.text || '',
                        color: step.title?.color || '#4d4f57',
                        isBold: step.title?.isBold || false
                    } as any;
                    trackingStep.description = step.description || '';
                    trackingStep.date = step.date ? new Date(step.date) : undefined as any;
                    trackingStep.icon = step.icon || '';

                    // Procesar machinable si existe
                    if (step.machinable && step.machinable.orders && step.machinable.orders.length > 0) {
                        trackingStep.machinable = MachinableProcessModel.MapFromObj(step.machinable);
                    }

                    return trackingStep;
                });
        }

        // Productos - buscar en 'productos' primero, luego fallback a 'DetailsProduct'
        const rawProducts = payload.productos?.length > 0
            ? payload.productos
            : (payload.DetailsProduct || []);

        if (rawProducts.length > 0) {
            invoice.orderProducts = rawProducts.map((p: any) => ({
                quantity: p.cantidad || p.quantity || 1,
                code: p.codigo || p.code || '',
                codeUnimed: p.unidadMedida || p.codeUnimed || p.code_unimed || '',
                image: p.imagen || p.image || '',
                description: p.descripcion || p.description || p.nombre || '',
                descriptionUnimed: p.unidadMedida || p.description_unimed || '',
                stateDescription: p.estado || p.state_description || ''
            }));
        }

        // Seller
        if (payload.seller) {
            invoice.seller = {
                title: payload.seller.title || '',
                name: payload.seller.name || '',
                mail: payload.seller.mail || '',
                phone: payload.seller.phone || '',
                iconPrincipal: payload.seller.icon_principal || '',
                iconPhone: payload.seller.icon_phone || '',
                iconMail: payload.seller.icon_mail || ''
            } as any;
        }

        this.onSuccess(invoice);
    }

    public onSearch(search: SearchModel): void {
        this.working = true;
        this.trackingService.getInvoiceTracking(search.invoiceId, search.invoiceType)
            .pipe(take(1))
            .subscribe({ next: this.onSuccess.bind(this), error: this.onError.bind(this) });

        const snapshot = this.activeRoute.snapshot;

        if (snapshot.url.toString().indexOf('tracking') >= 0) {
            this.router.navigate(['tracking'], {
                queryParams: {
                    folioDocumento: search.invoiceId,
                    tipoDocumento: search.invoiceType
                },
                queryParamsHandling: 'merge'
            });
        } else {
            this.router.navigate(['/tracking/detalle', search.invoiceId, search.invoiceType]);
        }
    }

    private onSuccess(invoice: InvoiceModel | undefined): void {
        if (!invoice) {
            this.router.navigate(['/tracking/no-encontrado']);
            return;
        }

        // Si hay pasos con machinable, hacer scroll hacia la sección
        if (invoice?.trackingSteps.find(t => t.machinable !== null &&
            t.machinable?.orders !== undefined &&
            t.machinable?.orders?.length > 0)) {

            setTimeout(() => {
                this.trackingStepperView?.nativeElement.scrollIntoView({ behavior: 'smooth' });
            }, 600);
        }

        this.invoice = invoice;

        // Simulación inteligente para el Stepper (PDP)
        // Generamos una copia de los productos para manipular el estado visual del stepper sin afectar la lista real.
        this.stepperOrderDetails = invoice?.orderProducts ? [...invoice.orderProducts] : [];

        // CORRECCIÓN VISUAL DE ICONO 'ENTREGADO'
        // Igualando comportamiento con trazabilidad-app:
        // Si el paso es 'Entregado', forzamos el ícono de check (completado) visualmente.
        if (this.invoice?.trackingSteps) {
            this.invoice.trackingSteps.forEach(step => {
                const text = step.title.text.toLowerCase();
                if (text.includes('entregado') || text.includes('recibido')) {
                    // Si el ícono no es de 'completo', lo forzamos.
                    // Nota: Usamos la URL completa del blob si es necesario, o verificamos cómo se asigna.
                    // En trazabilidad-app se asignaba 'step_complete', pero aquí parece que usamos URLs completas.
                    // Si el backend envía URL, intentamos reemplazarla por la versión complete.
                    // PERO SOLO SI NO ES PENDING (es decir, si está en progreso 'verde' incorrectamente).
                    if (step.icon && !step.icon.includes('complete') && !step.icon.includes('pending')) {
                        // Reemplazar cualquier icono (ej. timeline_in_progress) por timeline_complete_icon
                        step.icon = 'https://dvimperial.blob.core.windows.net/traceability/timeline_complete_icon.svg';
                    }
                }
            });
        }

        this.working = false;
    }

    private isOlderThanMonths(dateInput: string | Date, months: number): boolean {
        if (!dateInput) return false;

        let date: Date;

        if (dateInput instanceof Date) {
            date = dateInput;
        } else {
            // Parser string
            try {
                // Normalizar fecha: eliminar "de", "del", espacios extra, y pasar a minúsculas
                let cleanDate = dateInput.toLowerCase()
                    .replace(/ de /g, ' ')
                    .replace(/ del /g, ' ')
                    .replace(/\s+/g, ' ') // Unificar espacios
                    .trim();

                // Mapeo meses español a inglés para Date.parse
                const monthsEs = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                monthsEs.forEach((m, i) => {
                    if (cleanDate.includes(m)) {
                        cleanDate = cleanDate.replace(m, monthsEn[i]);
                    }
                });

                date = new Date(cleanDate);
            } catch (e) {
                return false;
            }
        }

        if (isNaN(date.getTime())) return false; // Fecha inválida

        const today = new Date();
        // Calcular diferencia en meses
        let diffMonths = (today.getFullYear() - date.getFullYear()) * 12;
        diffMonths -= date.getMonth();
        diffMonths += today.getMonth();

        return diffMonths > months;
    }

    private onError(err: any): void {
        this.hasError = true;
        this.working = false;
    }

    /**
     * Navega de vuelta a mis-compras manteniendo el estado de paginación
     */
    public goBack(): void {
        const queryParams: any = {
            page: this.returnPage,
            perPage: this.returnPerPage
        };

        if (this.returnRut) {
            queryParams.rut = this.returnRut;
        }

        this.router.navigate(['/mis-compras'], { queryParams });
    }

    /**
     * Verifica si hay datos de machinable para mostrar
     */
    public hasMachinableData(): boolean {
        if (!this.invoice?.trackingSteps) return false;
        return this.invoice.trackingSteps.some(step =>
            step.machinable &&
            step.machinable.orders &&
            step.machinable.orders.length > 0
        );
    }

    /**
     * Elimina los ceros a la izquierda del número de documento, igual que en Mis Compras
     */
    public getFormattedDocumentNumber(): string {
        if (!this.invoice?.printedNumber) return '';
        const num = Number(this.invoice.printedNumber);
        return isNaN(num) ? this.invoice.printedNumber : num.toString();
    }
}

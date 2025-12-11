import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {InvoiceModel} from '../../../core/models/invoice.model';
import {SearchModel} from '../models/search-model';
import {take} from 'rxjs/operators';
import {TrackingService} from '../../../services/tracking.service';
import {ActivatedRoute, Router} from '@angular/router';
import {TrackingDataService} from '../../../services/tracking-data.service';
import {TrackingStepModel} from '../../../core/models/tracking-step.model';
import {MachinableProcessModel} from '../../../core/models/machinable-process.model';

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
        // Suscribirse a los parámetros de ruta
        this.activeRoute.params.subscribe((params) => {
            if (params.invoiceId || params.invoiceType) {
                this.searchModel = new SearchModel(params.invoiceId, params.invoiceType);
            }
        });

        // Suscribirse a los query params
        this.activeRoute.queryParams.subscribe((params) => {
            // Guardar parámetros de retorno - soportar ambos formatos (nuevo y legacy)
            this.returnPage = params.page ? Number(params.page) : 1;
            this.returnPerPage = params.perPage ? Number(params.perPage) : 10;
            this.returnRut = params.cliente || params.clienteId || params.rut || null;

            // Si viene de la vista de detalle (nuevo: detalle=1, legacy: section=details)
            if (params.detalle === '1' || params.section === 'details') {
                this.showSearchBox = false;
                this.isDetailView = true;
            }

            // Soportar ambos formatos de parámetros (nuevo y legacy)
            const folioDocumento = params.folio || params.folioDocumento;
            const tipoDocumento = params.tipo || params.tipoDocumento;

            if (folioDocumento || tipoDocumento) {
                this.searchModel = new SearchModel(folioDocumento, tipoDocumento);
                
                // Intentar obtener datos del servicio de datos primero
                const invoicePayload = this.trackingDataService.consumeInvoicePayload();
                
                if (invoicePayload) {
                    // Usar los datos transportados desde mis-compras
                    this.processInvoicePayload(invoicePayload);
                } else if (this.returnRut) {
                    // Usar el nuevo endpoint de documentos
                    this.loadFromDocumentApi(Number(folioDocumento), tipoDocumento, this.returnRut);
                } else {
                    // Fallback: cargar desde API antigua
                    this.onSearch(this.searchModel!);
                }
            }
        });
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

    /**
     * Carga los datos desde el nuevo endpoint de documentos
     */
    private loadFromDocumentApi(invoiceId: number, invoiceType: string, clienteId: string): void {
        this.working = true;
        this.trackingService.getInvoiceDocument(invoiceId, invoiceType, clienteId)
            .pipe(take(1))
            .subscribe({
                next: (invoice) => {
                    if (invoice) {
                        this.onSuccess(invoice);
                    } else {
                        // Fallback a V2
                        this.loadFromV2Api(invoiceId, invoiceType);
                    }
                },
                error: () => {
                    this.loadFromV2Api(invoiceId, invoiceType);
                }
            });
    }

    /**
     * Fallback a la API V2
     */
    private loadFromV2Api(invoiceId: number, invoiceType: string): void {
        this.trackingService.getInvoiceTrackingV2(invoiceId, invoiceType)
            .pipe(take(1))
            .subscribe({
                next: this.onSuccess.bind(this),
                error: this.onError.bind(this)
            });
    }

    public onSearch(search: SearchModel): void {
        this.working = true;
        this.trackingService.getInvoiceTracking(search.invoiceId, search.invoiceType)
            .pipe(take(1))
            .subscribe({next: this.onSuccess.bind(this), error: this.onError.bind(this)});

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
            this.router.navigate(['/', search.invoiceId, search.invoiceType]);
        }
    }

    private onSuccess(invoice: InvoiceModel | undefined): void {
        if (!invoice) {
            this.router.navigate(['not-found']);
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
        this.working = false;
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
}

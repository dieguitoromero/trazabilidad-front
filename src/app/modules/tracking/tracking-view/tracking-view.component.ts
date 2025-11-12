import {Component, ElementRef, ViewChild} from '@angular/core';
import {InvoiceModel} from '../../../core/models/invoice.model';
import {SearchModel} from '../models/search-model';
import {take} from 'rxjs/operators';
import {TrackingService} from '../../../services/tracking.service';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
    templateUrl: './tracking-view.template.html',
    styleUrls: ['./tracking-view.scss', './tracking-view.mobile.scss']
})
export class TrackingViewComponent {

    public invoice: InvoiceModel | undefined;
    public working = false;
    public hasError = false;
    public searchModel: SearchModel | undefined;
    public hideSearch = false;
    private autoSearched = false;

    @ViewChild('trackingStepperView')
    public trackingStepperView: ElementRef | undefined;

    constructor(private trackingService: TrackingService,
                private router: Router,
                private activeRoute: ActivatedRoute) {

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
                this.triggerAutoSearch();
                this.applyHideHeroBg();
            }
        });

    }


    public onSearch(search: SearchModel): void {

        // Llama al servicio V2 (token + uuid) con padding (10 dígitos) y tipo de documento (BLV/FCV/NVV)
        this.trackingService.getInvoiceTrackingV2(search.invoiceId, search.invoiceType)
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
        //} else {
        //    this.router.navigate(['/', search.invoiceId, search.invoiceType]);
        }


    }

    private onSuccess(invoice: InvoiceModel | undefined): void {

        if (!invoice) {
            this.router.navigate(['not-found']);
        }

        if (invoice?.trackingSteps.find(t => t.machinable !== null &&
            t.machinable?.orders !== undefined &&
            t.machinable?.orders?.length > 0)) {

            setTimeout(() => {
                this.trackingStepperView?.nativeElement.scrollIntoView({ behavior: 'smooth' });
            }, 600);

        }

        this.invoice = invoice;
        this.working = false;
        if (invoice) {
            this.hideSearch = true;
            this.applyHideHeroBg();
        }
    }

    private onError(err: InvoiceModel): void {
        this.hasError = true;
        this.working = false;
    }

    private triggerAutoSearch(): void {
        if (!this.autoSearched && this.searchModel && this.searchModel.invoiceId && this.searchModel.invoiceType) {
            this.autoSearched = true;
            // Ejecutar en el siguiente tick para asegurar que Angular procese bindings
            setTimeout(() => this.onSearch(this.searchModel as SearchModel), 0);
        }
    }

    public showPickupDate(): boolean {
        if (!this.invoice || !this.invoice.trackingSteps || this.invoice.trackingSteps.length === 0) {
            return false;
        }
        const steps = this.invoice.trackingSteps;
        const last = steps[steps.length - 1];
        // Consider delivered if last step is not pending and its title mentions Entregado
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

    // Estado compacto para móvil: toma el último paso disponible
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
}

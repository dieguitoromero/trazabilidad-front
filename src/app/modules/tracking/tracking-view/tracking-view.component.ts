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

    @ViewChild('trackingStepperView')
    public trackingStepperView: ElementRef | undefined;

    constructor(private trackingService: TrackingService,
                private router: Router,
                private activeRoute: ActivatedRoute) {

        this.activeRoute.params.subscribe((params) => {
            if (params.invoiceId || params.invoiceType) {
                this.searchModel = new SearchModel(params.invoiceId, params.invoiceType);
            }

        });

        this.activeRoute.queryParams.subscribe((params) => {
            if (params.folioDocumento || params.tipoDocumento) {
                this.searchModel = new SearchModel(params.folioDocumento, params.tipoDocumento);
            }

        });

    }


    public onSearch(search: SearchModel): void {

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
    }

    private onError(err: InvoiceModel): void {
        this.hasError = true;
        this.working = false;
    }
}

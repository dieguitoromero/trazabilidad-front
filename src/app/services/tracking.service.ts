import {Injectable} from '@angular/core';
import {from, Observable, of} from 'rxjs';
import {switchMap, map, catchError} from 'rxjs/operators';
import {InvoiceModel} from '../core/models/invoice.model';
import {TrackingRepository} from '../repositories/tracking.repository';

@Injectable()
export class TrackingService {

    constructor(private trackingRepository: TrackingRepository) {

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

import {Injectable} from '@angular/core';
import {from, Observable} from 'rxjs';
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


    private padInvoiceNumber(invoiceId: number, lenght: number): string {
        let num = invoiceId.toString();
        while (num.length < lenght) {
            num = '0' + num;
        }
        return num;
    }
}

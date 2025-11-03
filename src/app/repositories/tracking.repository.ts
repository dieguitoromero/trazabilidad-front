import {environment} from '../../environments/environment';
import {Observable} from 'rxjs';
import {InvoiceModel} from '../core/models/invoice.model';
import {HttpClient} from '@angular/common/http';
import {map} from 'rxjs/operators';
import {Injectable} from '@angular/core';

@Injectable()
export class TrackingRepository {
    public baseApiUrl: string = environment.baseApiUrl;

    constructor(private http: HttpClient) {
    }


    public getTracking(invoiceId: string, invoiceType: string): Observable<InvoiceModel | undefined> {

        return this.http.get(`${this.baseApiUrl}/traceability/v1/traceability/${invoiceId}/${invoiceType}`)
            .pipe(
                map((o: any) => {
                    const t = InvoiceModel.mapFromObj(o);

                    if (!o.number_printed) {
                        return;
                    }

                    return t;
                })
            );
    }

    public trackingExist(invoiceId: string, invoiceType: string): Observable<boolean> {
        return this.getTracking(invoiceId, invoiceType).pipe(map(i => i != null));
    }
}

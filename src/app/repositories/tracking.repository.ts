import { environment } from "../../environments/environment";
// Nota: clienteId ya no se obtiene de environment, debe pasarse como parámetro desde la URL
import { EMPTY, Observable, of, throwError } from "rxjs";
import { InvoiceModel } from "../core/models/invoice.model";
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from "@angular/common/http";
import { catchError, map, switchMap, tap } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { InvoiceTokenModel } from "../core/models/invoice-token.model";

@Injectable()
export class TrackingRepository {
  // Usar base relativa para aprovechar el proxy de Angular (`proxy.conf.json`)
  // y evitar dependencias directas a hosts externos (APIM).
  private readonly baseApiUrl: string = '/MisCompras';

  // Headers anti-caché para forzar datos frescos
  private noCacheHeaders = new HttpHeaders({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache'
  });

  constructor(private http: HttpClient) {}

  public getTracking(
    invoiceId: string,
    invoiceType: string
  ): Observable<InvoiceModel | undefined> {
    return this.http
      .get(
        `${this.baseApiUrl}/api/clients/${invoiceId}/${invoiceType}`,
        { headers: this.noCacheHeaders }
      )
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

  public trackingExist(
    invoiceId: string,
    invoiceType: string
  ): Observable<boolean> {
    return this.getTracking(invoiceId, invoiceType).pipe(map((i) => i != null));
  }
}

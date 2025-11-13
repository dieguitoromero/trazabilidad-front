import { environment } from "../../environments/environment";
import { EMPTY, Observable, of, throwError } from "rxjs";
import { InvoiceModel } from "../core/models/invoice.model";
import { HttpClient, HttpErrorResponse, HttpResponse } from "@angular/common/http";
import { catchError, map, switchMap, tap } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { InvoiceTokenModel } from "../core/models/invoice-token.model";

@Injectable()
export class TrackingRepository {
  public baseApiUrl: string = environment.baseApiUrl;
  baseApiUrlV2: string = environment.baseApiUrlV2;

  constructor(private http: HttpClient) {}

  public getTracking(
    invoiceId: string,
    invoiceType: string
  ): Observable<InvoiceModel | undefined> {
    return this.http
      .get(
        `${this.baseApiUrl}/traceability/v1/traceability/${invoiceId}/${invoiceType}`
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

  public getTrackingV2(invoiceId: string, invoiceType: string): Observable<InvoiceModel | undefined> {
    const body = {
      Number_Printed: invoiceId,
      Document_Type: invoiceType,
    };

    return this.http
      .post(`${this.baseApiUrlV2}/traceabilityV2/v1/traceability`, body, {
        observe: "response",
      })
      .pipe(
        switchMap((response: HttpResponse<any>) => {
          if (response.status !== 200 || !response.body) {
            return of(undefined);
          }

          const tokenVal = InvoiceTokenModel.mapFromObj(response.body);

          return this.http
            .get(`${this.baseApiUrlV2}/traceabilityV2/v1/traceability/${tokenVal!.uuid}`)
            .pipe(
              map((objectResponse: any) => {
                if (!objectResponse) {
                  return undefined;
                }
                return InvoiceModel.mapFromObj(objectResponse);
              })
            );
        }),
        catchError((error: any) => {
          if (error instanceof HttpErrorResponse) {
            if (error.status === 404) {
              return of(undefined);
            }
          }

          if (
            error.message
              .toLowerCase()
              .includes(
                "you provided an invalid object where a stream was expected"
              )
          ) {
            return of(undefined);
          }

          return throwError(() => error);
        })
      );
  }
}

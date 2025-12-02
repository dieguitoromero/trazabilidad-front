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
  // Use unified baseUrl (APIM host) and append '/api' for documents endpoint
  private apimBase: string = `${environment.baseUrl}/api`;

  constructor(private http: HttpClient) {}

  public getTracking(
    invoiceId: string,
    invoiceType: string
  ): Observable<InvoiceModel | undefined> {
    return this.http
      .get(
        `${this.baseApiUrl}/api/clients/${invoiceId}/${invoiceType}`
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

  public getDocument(invoiceId: string, invoiceType: string): Observable<InvoiceModel | undefined> {
    // Requisito: usar URL absoluta con clienteId para facturas (FCV)
    // https://apim-imperial-dev-ues-001.azure-api.net/api/documents/FCV/(numero)/?clienteId=762530058
    const clienteId = environment.clienteId;
    const url = `${this.apimBase}/documents/${invoiceType}/${invoiceId}/?clienteId=${clienteId}`;
    return this.http.get<any>(url).pipe(
      map(resp => {
        if (!resp) { return undefined; }
        return InvoiceModel.mapFromObj(resp);
      }),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          return of(undefined);
        }
        return throwError(() => err);
      })
    );
  }
}

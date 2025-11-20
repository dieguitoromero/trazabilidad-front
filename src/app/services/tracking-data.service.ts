import { Injectable } from '@angular/core';

/**
 * Servicio simple para transportar la última respuesta de MisCompras (buscarDocumento)
 * hacia la vista de tracking sin necesidad de re-llamar a la API.
 */
@Injectable({ providedIn: 'root' })
export class TrackingDataService {
  private compraPayload: any | undefined;
  private invoicePayload: any | undefined;

  public setCompraPayload(payload: any): void {
    this.compraPayload = payload;
  }

  public consumeCompraPayload(): any | undefined {
    const p = this.compraPayload;
    this.compraPayload = undefined; // evitar reutilización accidental
    return p;
  }

  public setInvoicePayload(payload: any): void {
    this.invoicePayload = payload;
  }

  public consumeInvoicePayload(): any | undefined {
    const p = this.invoicePayload;
    this.invoicePayload = undefined;
    return p;
  }
}

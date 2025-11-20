import { Injectable } from '@angular/core';

/**
 * Servicio simple para transportar la última respuesta de MisCompras (buscarDocumento)
 * hacia la vista de tracking sin necesidad de re-llamar a la API.
 */
@Injectable({ providedIn: 'root' })
export class TrackingDataService {
  private compraPayload: any | undefined;

  public setCompraPayload(payload: any): void {
    this.compraPayload = payload;
  }

  public consumeCompraPayload(): any | undefined {
    const p = this.compraPayload;
    this.compraPayload = undefined; // evitar reutilización accidental
    return p;
  }
}

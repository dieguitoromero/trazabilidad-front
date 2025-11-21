import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-purchase-overview-card',
  templateUrl: './purchase-overview-card.component.html',
  styleUrls: ['./purchase-overview-card.component.scss']
})
export class PurchaseOverviewCardComponent {
  // tipoEntrega raw string (e.g. "Retiro en tienda")
  @Input() tipoEntrega: string | undefined;
  // dirección, puede venir vacía; mostrar '-' si no existe
  @Input() direccion: string | undefined;
  // fechaCompra (Date) para fallback
  @Input() fechaCompra: Date | undefined;
  // flag si todos los pasos están completos
  @Input() isCompletadoTotal = false;
  // fecha final de retiro/entrega (si viene desde invoice.pickup.date o similar)
  @Input() fechaFinal: Date | undefined;

  public direccionDisplay(): string { return (this.direccion && this.direccion.trim()) ? this.direccion : '-'; }

  public fechaRetiroDisplay(): string {
    const baseDate = this.isCompletadoTotal && this.fechaFinal ? this.fechaFinal : this.fechaCompra;
    if (!baseDate) return '-';
    const dd = String(baseDate.getDate()).padStart(2,'0');
    const mm = String(baseDate.getMonth() + 1).padStart(2,'0');
    const yyyy = baseDate.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
}

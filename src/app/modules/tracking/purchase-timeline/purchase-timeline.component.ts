import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-purchase-timeline',
  templateUrl: './purchase-timeline.component.html',
  styleUrls: ['./purchase-timeline.component.scss']
})
export class PurchaseTimelineComponent {
  @Input() compra: any | undefined;

  readonly baseOrder = [
    'Pedido ingresado',
    'Pedido pagado',
    'Preparación de pedido',
    'Disponible para retiro',
    'Pedido entregado'
  ];

  get renderSteps() {
    if (!this.compra) return [];
    const reached = new Map<string, any>();
    (this.compra.trazabilidad || []).forEach((t: any) => {
      const key = (t.glosa || '').trim().toLowerCase();
      if (!reached.has(key)) reached.set(key, t);
    });
    return this.baseOrder.map(label => {
      const k = label.toLowerCase();
      const found = reached.get(k);
      return {
        label,
        fechaRegistro: found?.fechaRegistro || '',
        observacion: found?.observacion || this.defaultObservacion(label),
        estado: found?.estado || 'pendiente',
        active: !!found
      };
    });
  }

  private defaultObservacion(label: string): string {
    switch (label) {
      case 'Pedido ingresado': return 'Estamos validando tu compra';
      case 'Pedido pagado': return 'Tu compra fue aprobada';
      case 'Preparación de pedido': return 'Estamos preparando tu pedido';
      case 'Disponible para retiro': return 'Tu pedido está listo para retiro';
      case 'Pedido entregado': return 'Tu pedido fue entregado';
      default: return '';
    }
  }
}

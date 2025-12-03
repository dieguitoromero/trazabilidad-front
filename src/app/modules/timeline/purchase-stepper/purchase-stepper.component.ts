import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-purchase-stepper',
  template: `
    <div class="purchase-stepper" [class.compact]="!showSecondary" *ngIf="steps && steps.length">
      <div class="step" *ngFor="let s of steps; let i = index"
           [class.completed]="i <= lastReachedIndex"
           [class.current]="i === lastReachedIndex">
        <div class="icon-wrapper" *ngIf="i <= lastReachedIndex">
          <img src="/trazabilidad-app/assets/timeline_complete_icon.svg" alt="Paso completado" />
        </div>
        <div class="dot" *ngIf="i > lastReachedIndex"></div>
        <div class="label">{{ s }}</div>
        <div class="secondary" *ngIf="showSecondary && i <= lastReachedIndex">
          <div class="text">{{ defaultObservacion(s) }}</div>
          <div class="date">{{ fechaPaso(s) }}</div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./purchase-stepper.component.scss']
})
export class PurchaseStepperComponent {
  @Input() trazabilidad: Array<{ glosa: string; fechaRegistro?: string }> = [];
  @Input() steps: string[] = [
    'Pedido ingresado',
    'Pedido pagado',
    'Preparación de pedido',
    'Disponible para retiro',
    'Pedido entregado'
  ];
  // Permite ocultar textos secundarios y fechas (para vista Mis Compras original)
  @Input() showSecondary = true;

  private normalize(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  get lastReachedIndex(): number {
    const reached = new Set((this.trazabilidad||[]).map(t => this.normalize(t.glosa)));
    let last = -1;
    this.steps.forEach((p, idx) => { if (reached.has(this.normalize(p))) last = idx; });
    return last;
  }

  fechaPaso(step: string): string {
    const target = this.normalize(step);
    const item = (this.trazabilidad||[]).find(t => this.normalize(t.glosa) === target);
    if (!item || !item.fechaRegistro) return '';
    const m = item.fechaRegistro.match(/^(\d{2}-\d{2}-\d{4})/); // tomar sólo fecha dd-MM-YYYY
    return m ? m[1] : item.fechaRegistro.split(' ')[0];
  }

  defaultObservacion(label: string): string {
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
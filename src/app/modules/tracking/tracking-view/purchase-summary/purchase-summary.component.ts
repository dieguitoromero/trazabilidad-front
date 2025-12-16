import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

// Interfaz para el objeto pickup que puede venir del backend
interface PickupData {
  title?: string;       // "Retiro en Tienda" o "Despacho a Domicilio"
  text?: string;        // Dirección de entrega o tienda
  title_date?: string;  // "Retira a partir del " o "Llega a partir del "
  dateTitle?: string;   // alias para title_date (compatibilidad con modelo antiguo)
  date?: string | Date; // Fecha ISO 8601 o Date
  icon?: string;        // URL del ícono
}

@Component({
  selector: 'app-purchase-summary',
  templateUrl: './purchase-summary.component.html',
  styleUrls: ['./purchase-summary.component.scss']
})
export class PurchaseSummaryComponent implements OnChanges {
  // Inputs individuales (legacy)
  @Input() tipoEntrega: string | undefined;
  @Input() direccionEntrega: string | undefined;
  @Input() fechaRetiro: string | undefined; // fecha formateada dd-MM-YYYY
  
  // Nuevo: Objeto pickup completo del backend
  @Input() pickup: PickupData | undefined;
  
  // Modo compacto para usar en listados (sin el título "Resumen de tu compra")
  @Input() compact: boolean = false;

  // Propiedades computadas que se usan en el template
  displayTipoEntrega: string = '';
  displayDireccion: string = '';
  displayFechaTexto: string = '';
  displayIcon: string = '';
  isRetiroEnTienda: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
    this.computeDisplayValues();
  }

  private computeDisplayValues(): void {
    // Priorizar el objeto pickup si está disponible
    if (this.pickup) {
      this.displayTipoEntrega = this.pickup.title || this.tipoEntrega || '';
      this.displayDireccion = this.pickup.text || this.direccionEntrega || '';
      
      // Determinar si es retiro en tienda
      const tipoLower = this.displayTipoEntrega.toLowerCase();
      this.isRetiroEnTienda = tipoLower.includes('retiro') || tipoLower.includes('tienda');
      
      // Calcular texto de fecha
      const dateTitle = this.pickup.title_date || this.pickup.dateTitle || 
        (this.isRetiroEnTienda ? 'Retira a partir del ' : 'Llega a partir del ');
      
      let fechaFormateada = '';
      if (this.pickup.date) {
        const dateObj = this.pickup.date instanceof Date 
          ? this.pickup.date 
          : new Date(this.pickup.date);
        if (!isNaN(dateObj.getTime())) {
          fechaFormateada = this.formatDate(dateObj);
        }
      } else if (this.fechaRetiro) {
        fechaFormateada = this.fechaRetiro;
      }
      
      this.displayFechaTexto = fechaFormateada ? `${dateTitle}${fechaFormateada}` : '';
      
      // Ícono
      this.displayIcon = this.pickup.icon || 
        (this.isRetiroEnTienda 
          ? 'assets/tienda-icon.svg' 
          : 'assets/domicilio-icon.svg');
    } else {
      // Fallback a campos individuales
      this.displayTipoEntrega = this.tipoEntrega || '';
      this.displayDireccion = this.direccionEntrega || '';
      
      const tipoLower = this.displayTipoEntrega.toLowerCase();
      this.isRetiroEnTienda = tipoLower.includes('retiro') || tipoLower.includes('tienda');
      
      this.displayFechaTexto = this.fechaRetiro 
        ? `${this.isRetiroEnTienda ? 'Retira a partir del ' : 'Llega a partir del '}${this.fechaRetiro}` 
        : '';
      
      this.displayIcon = this.isRetiroEnTienda 
        ? 'assets/tienda-icon.svg' 
        : 'assets/domicilio-icon.svg';
    }
  }

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  get hasContent(): boolean {
    return !!(this.displayTipoEntrega || this.displayDireccion || this.displayFechaTexto);
  }
}

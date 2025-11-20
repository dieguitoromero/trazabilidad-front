import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-purchase-summary',
  templateUrl: './purchase-summary.component.html',
  styleUrls: ['./purchase-summary.component.scss']
})
export class PurchaseSummaryComponent {
  @Input() tipoEntrega: string | undefined;
  @Input() direccionEntrega: string | undefined;
  @Input() fechaRetiro: string | undefined; // fecha formateada dd-MM-YYYY
}

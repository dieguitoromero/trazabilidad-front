import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ActivatedRoute } from '@angular/router'; // Importa ActivatedRoute
import { SearchModel } from '../models/search-model';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TrackingHintModalComponent } from '../tracking-hint-modal/tracking-hint-modal.component';
import { TrackingService } from '../../../services/tracking.service';

@Component({
  selector: 'app-tracking-search-box',
  templateUrl: './tracking-search-box.template.html',
  styleUrls: ['./tracking-search-box.scss', './tracking-search-box.mobile.scss']
})
export class TrackingSearchBoxComponent implements OnChanges {
  @Output() search: EventEmitter<any> = new EventEmitter<any>();
  @Input() searchModel: SearchModel | undefined;

  public searchForm!: FormGroup;
  public working = false;
  private allowedInvoiceTypes = ['BLV', 'FCV', 'NVV'];
  public esBoleta = false; // 30 DE SEPTIEMBRE 2023 , SA, Agrega una variable para controlar la habilitación de los radio buttons

  constructor(
    private fb: FormBuilder,
    private trackingService: TrackingService,
    private matDialog: MatDialog,
    private route: ActivatedRoute // Inyecta ActivatedRoute
  ) {
    this.buildForm();
  }

  private buildForm(): void {
    
     // 30 DE SEPTIEMBRE 2023 , SA, Obtener el valor del parámetro 'Channel' de la URL
    this.route.queryParams.subscribe(params => {
      const channelParam = params['Channel'];
      if (channelParam) {
        // Si Channel está definido en la URL, establece esBoleta en función del valor del parámetro
        this.esBoleta = channelParam === 'b2c';
      } else {
        // Si Channel no está definido en la URL, establece esBoleta en true (Boleta por defecto)
        this.esBoleta = true;
      }

      const defaultInvoiceType = this.esBoleta ? 'BLV' : 'FCV';
      this.searchForm = this.fb.group({
        invoiceType: [defaultInvoiceType, [Validators.required, this.validateAllowedValue.bind(this)]],
        invoiceId: [
          null,
          [Validators.required, Validators.max(9999999999), Validators.pattern(/^[0-9]\d*$/)]
        ]
      });
      // Actualiza el estado de habilitación de los radio buttons en el formulario
    //const invoiceTypeControl = this.searchForm.get('invoiceType');
    //if (invoiceTypeControl) {
      //if (this.esBoleta) {
        //invoiceTypeControl.enable();
      //} else {
       // invoiceTypeControl.disable();
      //}
    //}

    });
  }

  public onSubmit(): void {
    if (this.searchForm.valid) {
      const invoiceId: number = this.searchForm.get('invoiceId')?.value;
      const invoiceType: string = this.searchForm.get('invoiceType')?.value;
      this.search.next(new SearchModel(invoiceId, invoiceType));
    }
  }

  public openHint(): void {
    this.matDialog.open(TrackingHintModalComponent, { maxWidth: '600px', panelClass: 'hint-modal-container' });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.searchModel && changes.searchModel.currentValue) {
      this.searchForm.setValue(changes.searchModel.currentValue);
      setTimeout(() => {
        this.onSubmit();
      }, 400);
    }
  }

  validateAllowedValue(control: FormControl): any {
    return control.value && this.allowedInvoiceTypes.find(a => a === control.value) !== undefined ? null : { 'not-valid-option': true };
  }
}


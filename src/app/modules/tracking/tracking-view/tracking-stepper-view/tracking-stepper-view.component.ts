import { Component, Input } from '@angular/core';
import { TrackingStepModel } from '../../../../core/models/tracking-step.model';
import { OrderDetailsModel } from '../../../../core/models/order-details.model';
import { TrackingStepTitleModel } from '../../../../core/models/tracking-step-title.model';

@Component({
    selector: 'app-tracking-stepper-view',
    templateUrl: './tracking-stepper-view.template.html',
    styleUrls: ['./tracking-stepper-view.scss', 'tracking-stepper-view.mobile.scss']
})
export class TrackingStepperViewComponent {
    @Input() steps: TrackingStepModel[] | undefined = [];
    @Input() orderDetails: OrderDetailsModel[] | undefined;
    @Input() vertical = false;

    private status: any = {
        'Pedido Ingresado': ['Pendiente', 'Pendiente de despacho'],
        'Pedido Aprobado': [], // No tiene items asociados
        'Pedido pagado': ['Pendiente', 'Pendiente de despacho'],
        'Preparacion de Pedido': ['Pendiente'],
        'Proceso de fabricacion': ['Pendiente'], // Agregado para soportar dimensionados
        'Pendiente de Envío': ['Pendiente de despacho'],
        'Pedido en Ruta': ['En Ruta'],
        'Disponible para retiro': ['Producto Listo para Retiro'],
        'Pedido Entregado': ['Entregado', 'Producto Entregado']
    };

    public isStepCompleted(step: TrackingStepModel): boolean {

        return step.icon.indexOf('pending') < 0;
    }

    public isLastStepCompleted(index: number): boolean {
        if (this.steps) {
            if (this.steps[index + 1] !== undefined) {
                const stepIcon = this.steps[index].icon;
                return this.steps[index + 1].icon.indexOf('pending') > 0 && (stepIcon.indexOf('in_progress') >= 0 || stepIcon.indexOf('complete') >= 0);
            } else if (index === this.steps.length - 1) {
                return true;
            } else {
                return this.steps[index].icon.indexOf('pending') > 0;
            }
        }

        return false;
    }

    public isStepInProgress(step: TrackingStepModel, index: number): boolean {

        if (this.isStepCompleted(step) && !this.isLastStepCompleted(index)) {
            return false;
        }

        if (this.steps === undefined) {
            return false;
        }

        const nextStepsItems = this.steps?.slice(index + 1);

        const itemsNextSteps = nextStepsItems.filter(s => {
            if (!this.steps) {
                return false;
            }

            return this.numberOfItemsOnStatus(s.title, this.steps.indexOf(s)) > 0;
        }).length;

        if ((step.icon.indexOf('in_progress') > 0 || step.icon.indexOf('complete') > 0) && this.isLastStepCompleted(index) && itemsNextSteps <= 0) {
            return false;
        } else {
            return itemsNextSteps > 0 || this.numberOfItemsOnStatus(step.title, index) > 0;
        }
    }

    public numberOfItemsOnStatus(stepTitle: TrackingStepTitleModel, index: number): number {
        if (!this.orderDetails || this.orderDetails.length === 0 || !this.steps) {
            return 0;
        }

        const allowedStatus = this.status[stepTitle.text.trim()]; // Agregado trim() para robustez

        // CORRECCION CRITICA: Si el estado no está mapeado, devolver 0 en lugar de crashear
        if (!allowedStatus) {
            console.warn(`Estado no mapeado en stepper: '${stepTitle.text}'`);
            return 0;
        }

        const isLastCompleted = this.isLastStepCompleted(index);

        if (!isLastCompleted && this.steps[index].icon.indexOf('pending') < 0) {
            return 0;
        }

        if (index > 0) {
            const prevTitleText = this.steps[index - 1].title.text;
            const prevStepAllowedStatus = this.status[prevTitleText];
            const isInProgress = this.steps[index - 1].icon.indexOf('in_progress') > 0;

            // Verificación defensiva extra
            if (prevStepAllowedStatus && allowedStatus && prevStepAllowedStatus[0] === allowedStatus[0] && allowedStatus.length === prevStepAllowedStatus.length && isInProgress) {
                return 0;
            }
        }

        return this.orderDetails.filter(p => {
            return allowedStatus.indexOf(p.stateDescription) >= 0;
        }).length;
    }

}

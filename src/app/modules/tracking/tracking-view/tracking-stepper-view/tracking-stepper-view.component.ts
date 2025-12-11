import {Component, Input} from '@angular/core';
import {TrackingStepModel} from '../../../../core/models/tracking-step.model';
import {OrderDetailsModel} from '../../../../core/models/order-details.model';
import {TrackingStepTitleModel} from '../../../../core/models/tracking-step-title.model';
import { normalizeGlosa } from '../../../../core/helpers/glosa-normalizer';

@Component({
    selector: 'app-tracking-stepper-view',
    templateUrl: './tracking-stepper-view.template.html',
    styleUrls: ['./tracking-stepper-view.scss', 'tracking-stepper-view.mobile.scss']
})
export class TrackingStepperViewComponent {
    @Input() steps: TrackingStepModel[] | undefined = [];
    @Input() orderDetails: OrderDetailsModel[] | undefined;
    @Input() vertical = false;

    // Mapa de estados de productos por paso (para calcular el badge)
    // NOTA: Este mapa debería actualizarse para usar los estados reales que envía el backend
    // en lugar de estados canónicos hardcodeados. El backend debería enviar esta información.
    private status: any = {
        // Estados canónicos (mantener para compatibilidad)
        'Pedido Ingresado': ['Pendiente', 'Pendiente de despacho'],
        'Pedido Aprobado': [],
        'Preparacion de Pedido': ['Pendiente'],
        'Pendiente de Envío': ['Pendiente de despacho'],
        'Pedido en Ruta': ['En Ruta'],
        'Pedido Entregado': ['Entregado', 'Producto Entregado'],
        // Variaciones que el backend puede enviar
        'Pedido pagado': ['Pendiente', 'Pendiente de despacho'],
        'Disponible para retiro': ['Producto Listo para Retiro'],
        'Proceso de fabricacion': ['Pendiente'],
        // Agregar más variaciones según los estados reales que envía el backend
    };

    /**
     * Normaliza un texto para comparación (minúsculas, sin acentos, etc.)
     */
    private normalize(s: string): string {
        return (normalizeGlosa(s) || '').toLowerCase();
    }

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

        const isLastCompleted = this.isLastStepCompleted(index);

        if (!isLastCompleted && this.steps[index].icon.indexOf('pending') < 0) {
            return 0;
        }

        // Buscar en statusMap usando el label exacto o variaciones normalizadas
        let allowedStatus = this.status[stepTitle.text];
        if (!allowedStatus) {
            // Intentar con variaciones normalizadas
            const normalizedLabel = this.normalize(stepTitle.text);
            for (const [key, states] of Object.entries(this.status)) {
                if (this.normalize(key) === normalizedLabel) {
                    allowedStatus = states;
                    break;
                }
            }
        }

        if (!allowedStatus || allowedStatus.length === 0) {
            return 0;
        }

        if (index > 0) {
            const prevStepTitle = this.steps[index - 1].title.text;
            let prevStepAllowedStatus = this.status[prevStepTitle];
            if (!prevStepAllowedStatus) {
                // Intentar con variaciones normalizadas
                const normalizedPrevLabel = this.normalize(prevStepTitle);
                for (const [key, states] of Object.entries(this.status)) {
                    if (this.normalize(key) === normalizedPrevLabel) {
                        prevStepAllowedStatus = states;
                        break;
                    }
                }
            }
            const isInProgress = this.steps[index - 1].icon.indexOf('in_progress') > 0;
            
            if (prevStepAllowedStatus && prevStepAllowedStatus[0] === allowedStatus[0]  && allowedStatus.length === prevStepAllowedStatus.length && isInProgress) {
                return 0;
            }
        }

        return this.orderDetails.filter(p => {
            return allowedStatus.indexOf(p.stateDescription) >= 0;
        }).length;
    }

}

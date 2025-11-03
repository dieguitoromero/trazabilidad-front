import {Component, Input} from '@angular/core';
import {MachinableProcessOrderModel} from '../../../../core/models/machinable-process-order.model';

@Component({
    selector: 'app-tracking-machinable-order-viewer',
    templateUrl: './tracking-machinable-order-viewer.template.html',
    styleUrls: ['./tracking-machinable-order-viewer.scss', './tracking-machinable-order-viewer.mobile.scss']
})
export class TrackingMachinableOrderViewerComponent {

    @Input() machinableOrders: MachinableProcessOrderModel[] | undefined;
    @Input() icon: string | undefined;

    step = -1;

    setStep(index: number): void {
        this.step = index;
    }

    nextStep(): void {
        this.step++;
    }

    prevStep(): void {
        this.step--;
    }

    isNextBtnEnable(): boolean | undefined {
        return this.machinableOrders && this.machinableOrders.length > 0 && this.step < (this.machinableOrders.length - 1);
    }

    isPrevBtnEnable(): boolean | undefined {
        return this.machinableOrders && this.machinableOrders.length > 0 && this.step > 0;
    }

}

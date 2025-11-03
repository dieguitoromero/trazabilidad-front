import {Component, Input} from '@angular/core';
import {MachinableProcessModel} from '../../../../core/models/machinable-process.model';

@Component({
    selector: 'app-tracking-machinable-process',
    templateUrl: './tracking-machinable-process.template.html',
    styleUrls: ['./tracking-machinable-process.scss', './tracking-machinable-process.mobile.scss']
})
export class TrackingMachinableProcessComponent {
    @Input() machinableProcess: MachinableProcessModel | undefined;

    constructor() {

    }

}

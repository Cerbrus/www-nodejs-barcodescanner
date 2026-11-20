import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core';

import { RemarkPointerDirective } from './remark-pointer.directive';

@Component({
    standalone: true,
    imports: [RemarkPointerDirective],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    templateUrl: './pointer-host.component.html'
})
export class PointerHostComponent {}

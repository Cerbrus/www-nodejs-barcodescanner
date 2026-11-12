import { Injectable, Pipe, PipeTransform } from '@angular/core';

import { I18nDateFns } from '../utils/i18n-date-fns.util';

@Injectable({ providedIn: 'root' })
@Pipe({
    name: 'relativeDate',
    pure: true,
    standalone: true,
})
export class RelativeDatePipe implements PipeTransform {
    constructor(private readonly i18nDateFns: I18nDateFns) {}

    public transform(date?: Date, relativeTo: Date = new Date()): string | undefined {
        return date ? this.i18nDateFns.formatRelative(date, relativeTo) : undefined;
    }
}

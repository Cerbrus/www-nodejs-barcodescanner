import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';

import { PullRefreshService } from './pull-refresh.service';

describe('PullRefreshService', () => {
    const reload = (): Observable<unknown> => of(undefined);

    @Component({ selector: 'app-probe', standalone: true, template: '' })
    class ProbeComponent {
        constructor() {
            inject(PullRefreshService).use(reload);
        }
    }

    it('knows the reload of the page that registered it, and forgets it when that page goes', () => {
        const service = TestBed.inject(PullRefreshService);
        expect(service.current()).toBeUndefined();

        const fixture = TestBed.createComponent(ProbeComponent);
        expect(service.current()).toBe(reload);

        fixture.destroy();
        expect(service.current()).toBeUndefined();
    });
});

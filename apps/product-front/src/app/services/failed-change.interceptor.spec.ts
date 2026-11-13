import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { QUIET_FAILURE, QUIET_WITHOUT_CONNECTION, reportFailedChanges } from './failed-change.interceptor';
import { ToastService } from './toast.service';

describe('reportFailedChanges', () => {
    let http: HttpClient;
    let server: HttpTestingController;
    const shown = (): Array<string> =>
        TestBed.inject(ToastService)
            .toasts()
            .map((toast) => `${toast.kind}: ${toast.text}`);
    const fail = (status: number): void => {
        const request = server.expectOne('/thing');
        if (status) {
            request.flush('', { status, statusText: 'failed' });
        } else {
            request.error(new ProgressEvent('error'));
        }
    };

    beforeEach(() => {
        vi.useFakeTimers();
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([reportFailedChanges])),
                provideHttpClientTesting(),
                { provide: TranslateService, useValue: { instant: (key: string): string => key } }
            ]
        });
        http = TestBed.inject(HttpClient);
        server = TestBed.inject(HttpTestingController);
    });

    afterEach(() => vi.useRealTimers());

    it('tells the user when a change fails, with a text that fits the answer', () => {
        for (const [status, text] of [
            [409, 'error.conflict'],
            [404, 'error.notFound'],
            [400, 'error.invalid'],
            [500, 'error.generic'],
            [0, 'error.noConnection']
        ] as Array<[number, string]>) {
            http.post('/thing', {}).subscribe({ error: () => undefined });
            fail(status);

            expect(shown().at(-1)).toBe(`error: ${text}`);
        }
    });

    it('still passes the failure on to the caller', () => {
        let status = 0;
        http.post('/thing', {}).subscribe({ error: (error: { status: number }) => (status = error.status) });
        fail(409);

        expect(status).toBe(409);
    });

    it('stays silent for reading, for a login that ran out, and for calls marked quiet', () => {
        http.get('/thing').subscribe({ error: () => undefined });
        fail(500);
        http.post('/thing', {}).subscribe({ error: () => undefined });
        fail(401);
        http.post('/thing', {}, { context: new HttpContext().set(QUIET_FAILURE, true) }).subscribe({ error: () => undefined });
        fail(500);

        expect(shown()).toEqual([]);
    });

    it('stays silent without a connection only for calls that queue their change', () => {
        const queued = new HttpContext().set(QUIET_WITHOUT_CONNECTION, true);
        http.patch('/thing', {}, { context: queued }).subscribe({ error: () => undefined });
        fail(0);
        expect(shown()).toEqual([]);

        http.patch('/thing', {}, { context: queued }).subscribe({ error: () => undefined });
        fail(500);

        expect(shown()).toEqual(['error: error.generic']);
    });
});

import { TestBed } from '@angular/core/testing';

import { ApiService } from './api.service';
import { PageLogService } from './page-log.service';

describe('PageLogService', () => {
    let service: PageLogService;

    const sentLine = (): { address: string; request: RequestInit; body: { level: string; message: string } } => {
        const [address, request] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];

        return { address, request, body: JSON.parse(request.body as string) };
    };

    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.reject(new Error('offline')))
        );
        TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { baseUrl: '/api/v1' } }] });
        service = TestBed.inject(PageLogService);
    });

    afterEach(() => vi.unstubAllGlobals());

    it('posts the line to the system log in a request that outlives a page load, and names the device', () => {
        service.add('swap done');

        const { address, request, body } = sentLine();
        expect(address).toBe('/api/v1/logs');
        expect(request.method).toBe('POST');
        expect(request.keepalive).toBe(true);
        expect(body.level).toBe('info');
        expect(body.message).toMatch(/^web app on .+: swap done$/);
    });

    it('cuts a line to what the system log accepts', () => {
        service.add('x'.repeat(900));

        expect(sentLine().body.message).toHaveLength(500);
    });
});

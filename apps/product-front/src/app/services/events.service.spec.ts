import { TestBed } from '@angular/core/testing';

import { ApiService } from './api.service';
import { EventsService } from './events.service';

class FakeEventSource {
    public static readonly OPEN = 1;
    public static readonly CLOSED = 2;
    public static created: Array<FakeEventSource> = [];

    public readyState = 0;
    public closed = false;
    public onopen?: () => void;
    public onerror?: () => void;

    private readonly listeners = new Map<string, (event: { data: string }) => void>();

    constructor(public readonly url: string) {
        FakeEventSource.created.push(this);
    }

    public addEventListener(type: string, listener: (event: { data: string }) => void): void {
        this.listeners.set(type, listener);
    }

    public close(): void {
        this.closed = true;
        this.readyState = FakeEventSource.CLOSED;
    }

    public open(): void {
        this.readyState = FakeEventSource.OPEN;
        this.onopen?.();
    }

    public fail(): void {
        this.readyState = FakeEventSource.CLOSED;
        this.onerror?.();
    }

    public send(type: string, data: unknown): void {
        this.listeners.get(type)?.({ data: JSON.stringify(data) });
    }
}

describe('EventsService', () => {
    let service: EventsService;
    let resumed: number;
    let visibility: string;
    const latest = (): FakeEventSource => FakeEventSource.created[FakeEventSource.created.length - 1];
    const showPage = (): void => {
        visibility = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
    };

    beforeEach(() => {
        vi.useFakeTimers();
        FakeEventSource.created = [];
        resumed = 0;
        visibility = 'visible';
        vi.stubGlobal('EventSource', FakeEventSource);
        vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility as DocumentVisibilityState);
        TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { baseUrl: '/api/v1' } }] });
        service = TestBed.inject(EventsService);
        service.resumed.subscribe(() => resumed++);
    });

    afterEach(() => {
        service.stop();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('connects to the event stream on first use and reports the connection', () => {
        expect(latest().url).toBe('/api/v1/events');
        expect(service.connected()).toBe(false);

        latest().open();

        expect(service.connected()).toBe(true);
        expect(resumed).toBe(0);
    });

    it('hands out events of the asked types only', () => {
        const received: Array<unknown> = [];
        service.on('list', 'scan').subscribe((data) => received.push(data));

        latest().send('list', { id: 1 });
        latest().send('log', { id: 2 });
        latest().send('scan', { id: 3 });

        expect(received).toEqual([{ id: 1 }, { id: 3 }]);
    });

    it('connects again three seconds after the stream closed, and says it resumed', () => {
        latest().open();
        latest().fail();
        expect(service.connected()).toBe(false);
        expect(FakeEventSource.created.length).toBe(1);

        vi.advanceTimersByTime(3000);
        latest().open();

        expect(FakeEventSource.created.length).toBe(2);
        expect(service.connected()).toBe(true);
        expect(resumed).toBe(1);
    });

    it('says it resumed when the page comes back and the stream is still alive', () => {
        latest().open();
        showPage();

        expect(FakeEventSource.created.length).toBe(1);
        expect(resumed).toBe(1);
    });

    it('connects again when the page comes back after a long silence', () => {
        latest().open();
        vi.advanceTimersByTime(41000);
        showPage();

        expect(FakeEventSource.created.length).toBe(2);
        expect(FakeEventSource.created[0].closed).toBe(true);
    });

    it('counts a ping as a sign of life', () => {
        latest().open();
        vi.advanceTimersByTime(30000);
        latest().send('ping', {});
        vi.advanceTimersByTime(30000);
        showPage();

        expect(FakeEventSource.created.length).toBe(1);
    });

    it('does nothing when the page is hidden', () => {
        latest().open();
        visibility = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));

        expect(resumed).toBe(0);
    });

    it('stays closed after stop', () => {
        latest().open();
        service.stop();
        latest().fail();
        vi.advanceTimersByTime(10000);

        expect(FakeEventSource.created.length).toBe(1);
        expect(service.connected()).toBe(false);
    });
});

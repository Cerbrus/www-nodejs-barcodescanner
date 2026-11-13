import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ScanPage } from './scan.page';
import { ScanOutcome } from '../../models';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

const camera = vi.hoisted(() => ({
    decoded: undefined as ((result?: { getText(): string }) => void) | undefined,
    refuse: false,
    starts: 0,
    stop: vi.fn()
}));

vi.mock('@zxing/browser', () => ({
    BrowserMultiFormatReader: class {
        public decodeFromConstraints(_: unknown, __: unknown, callback: (result?: { getText(): string }) => void): Promise<{ stop(): void }> {
            camera.starts++;
            if (camera.refuse) {
                return Promise.reject(new Error('NotAllowedError'));
            }
            camera.decoded = callback;

            return Promise.resolve({ stop: camera.stop });
        }
    }
}));

const MILK = '8710400000001';
const BREAD = '8710400000002';
const outcome = (code: string, result: ScanOutcome['result']): ScanOutcome => ({ scanId: 1, code, result, itemName: 'Melk', quantity: 1 });

describe('ScanPage', () => {
    let fixture: ComponentFixture<ScanPage>;
    const api = { scan: vi.fn(), undoScan: vi.fn() };
    const store = { refreshListAndInbox: vi.fn() };

    const open = async (): Promise<HTMLElement> => {
        fixture = TestBed.createComponent(ScanPage);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        return fixture.nativeElement as HTMLElement;
    };
    const see = (code: string): void => {
        camera.decoded?.({ getText: () => code });
        fixture.detectChanges();
    };
    const toasts = (): Array<string> =>
        TestBed.inject(ToastService)
            .toasts()
            .map((toast) => `${toast.kind}: ${toast.text}`);
    const offerCamera = (): void => {
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
    };

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.clearAllMocks();
        camera.decoded = undefined;
        camera.refuse = false;
        camera.starts = 0;
        api.scan.mockImplementation((code: string) => of(outcome(code, 'added')));
        api.undoScan.mockReturnValue(of({}));
        store.refreshListAndInbox.mockReturnValue(of(undefined));
        offerCamera();

        TestBed.configureTestingModule({
            imports: [ScanPage, TranslateModule.forRoot()],
            providers: [
                { provide: ApiService, useValue: api },
                { provide: ShoppingStore, useValue: store }
            ]
        });
        TestBed.overrideComponent(ScanPage, { set: { imports: [FormsModule, TranslateModule], schemas: [CUSTOM_ELEMENTS_SCHEMA] } });
    });

    afterEach(() => {
        Reflect.deleteProperty(navigator, 'mediaDevices');
        vi.useRealTimers();
    });

    it('says so when the browser has no camera access at all', async () => {
        Reflect.deleteProperty(navigator, 'mediaDevices');

        expect((await open()).querySelector('.notice')?.textContent).toContain('scan.camera.unsupported');
        expect(camera.starts).toBe(0);
    });

    it('says so when the camera is refused', async () => {
        camera.refuse = true;

        expect((await open()).querySelector('.notice')?.textContent).toContain('scan.camera.blocked');
    });

    it('shows the scan frame once the camera runs', async () => {
        const page = await open();

        expect(page.querySelector('.frame')).not.toBeNull();
        expect(page.querySelector('.notice')).toBeNull();
    });

    it('registers a code the camera reads, refreshes the list and offers undo', async () => {
        const page = await open();
        see(MILK);

        expect(api.scan).toHaveBeenCalledWith(MILK);
        expect(store.refreshListAndInbox).toHaveBeenCalledTimes(1);
        expect(toasts()).toEqual(['ok: scan.added']);
        expect(page.querySelector('.last')?.textContent).toContain(MILK);

        TestBed.inject(ToastService).toasts()[0].action?.();

        expect(api.undoScan).toHaveBeenCalledTimes(1);
    });

    it('ignores the same code for three seconds, but not another code', async () => {
        await open();
        see(MILK);
        vi.advanceTimersByTime(2900);
        see(MILK);
        see(BREAD);

        expect(api.scan.mock.calls.map(([code]) => code)).toEqual([MILK, BREAD]);

        vi.advanceTimersByTime(3100);
        see(BREAD);

        expect(api.scan).toHaveBeenCalledTimes(3);
    });

    it('ignores what is not a product code', async () => {
        await open();
        see('https://example.com/qr');
        see('1234567');

        expect(api.scan).not.toHaveBeenCalled();
    });

    it('stops the camera and asks for a name when the product is unknown, and reads nothing meanwhile', async () => {
        api.scan.mockImplementation((code: string) => of(outcome(code, 'needs_name')));
        const page = await open();
        see(MILK);

        expect(camera.stop).toHaveBeenCalledTimes(1);
        expect(page.querySelector('app-naming-prompt')).not.toBeNull();
        expect(toasts()).toEqual([]);

        see(BREAD);

        expect(api.scan).toHaveBeenCalledTimes(1);
    });

    it('starts the camera again when the naming prompt closes', async () => {
        api.scan.mockImplementation((code: string) => of(outcome(code, 'needs_name')));
        const page = await open();
        see(MILK);

        page.querySelector('app-naming-prompt')?.dispatchEvent(new CustomEvent('closed'));
        fixture.detectChanges();

        expect(page.querySelector('app-naming-prompt')).toBeNull();
        expect(camera.starts).toBe(2);
    });

    it('shows nothing for a scan the server ignored as a repeat', async () => {
        api.scan.mockImplementation((code: string) => of(outcome(code, 'ignored')));
        await open();
        see(MILK);

        expect(toasts()).toEqual([]);
    });

    it('says the scan failed when the server cannot be reached', async () => {
        api.scan.mockReturnValue(throwError(() => new Error('offline')));
        await open();
        see(MILK);

        expect(toasts()).toEqual(['error: scan.failed']);
    });

    it('registers a typed code and empties the field, and refuses what is not a code', async () => {
        const page = await open();
        const field = page.querySelector('input') as HTMLInputElement;
        const submit = (text: string): void => {
            field.value = text;
            field.dispatchEvent(new Event('input'));
            page.querySelector('form')?.dispatchEvent(new Event('submit'));
            fixture.detectChanges();
        };

        submit('abc');
        submit(` ${MILK} `);

        expect(api.scan.mock.calls.map(([code]) => code)).toEqual([MILK]);
    });
});

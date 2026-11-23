import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { TranslateTesting } from '../../../testing/translate';
import { ScanOutcome } from '../../models';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';
import { ScanPage } from './scan.page';

const camera = vi.hoisted(() => ({
    decoded: undefined as ((result?: { getText(): string }) => void) | undefined,
    refuse: false,
    starts: 0,
    stop: vi.fn()
}));

vi.mock('@zxing/browser', () => ({
    BrowserMultiFormatReader: class {
        public decodeFromConstraints(
            _: unknown,
            __: unknown,
            callback: (result?: { getText(): string }) => void
        ): Promise<{ stop(): void }> {
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
const SOUP = 'R1;Soep;7*2:vers;9';
const outcome = (code: string, result: ScanOutcome['result']): ScanOutcome => ({
    scanId: 1,
    code,
    result,
    itemName: 'Melk',
    quantity: 1
});

describe('ScanPage', () => {
    let fixture: ComponentFixture<ScanPage>;
    const api = { scan: vi.fn(), undoScan: vi.fn() };
    const store = {
        refreshListAndInbox: vi.fn(),
        collecting: signal(false),
        recipes: signal<Array<{ name: string }>>([]),
        putRecipeOnList: vi.fn()
    };
    const sheet = (page: HTMLElement): (HTMLElement & { savable?: boolean; name?: string }) | null =>
        page.querySelector('app-recipe-sheet');

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
        store.collecting.set(false);
        store.recipes.set([]);
        store.putRecipeOnList.mockReturnValue(of(undefined));
        api.scan.mockImplementation((code: string) => of(outcome(code, 'added')));
        api.undoScan.mockReturnValue(of({}));
        store.refreshListAndInbox.mockReturnValue(of(undefined));
        offerCamera();

        TestBed.configureTestingModule({
            imports: [ScanPage, TranslateTesting],
            providers: [
                { provide: ApiService, useValue: api },
                { provide: ShoppingStore, useValue: store }
            ]
        });
        TestBed.overrideComponent(ScanPage, {
            set: { imports: [FormsModule, TranslatePipe], schemas: [CUSTOM_ELEMENTS_SCHEMA] }
        });
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

        expect(api.scan).toHaveBeenCalledWith(MILK, false);
        expect(store.refreshListAndInbox).toHaveBeenCalledTimes(1);
        expect(toasts()).toEqual(['ok: scan.added']);
        expect(page.querySelector('.last')?.textContent).toContain(MILK);

        TestBed.inject(ToastService).toasts()[0].action?.();

        expect(api.undoScan).toHaveBeenCalledTimes(1);
    });

    it('collects from the list once the toggle is on, and keeps it on for the next visit', async () => {
        api.scan.mockImplementation((code: string) => of(outcome(code, 'collected')));
        const page = await open();
        const toggle = page.querySelector('.collect') as HTMLButtonElement;
        expect(toggle.getAttribute('aria-pressed')).toBe('false');

        toggle.click();
        fixture.detectChanges();
        see(MILK);

        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(api.scan).toHaveBeenCalledWith(MILK, true);
        expect(toasts()).toEqual(['ok: scan.collected']);
        expect(TestBed.inject(ToastService).toasts()[0].action).toBeDefined();

        fixture.destroy();
        expect((await open()).querySelector('.collect')?.getAttribute('aria-pressed')).toBe('true');
    });

    it('says so, without undo, when a collected product is not on the list', async () => {
        store.collecting.set(true);
        api.scan.mockImplementation((code: string) => of(outcome(code, 'not_on_list')));
        await open();
        see(MILK);

        expect(toasts()).toEqual(['attention: scan.not_on_list']);
        expect(TestBed.inject(ToastService).toasts()[0].action).toBeUndefined();
    });

    it('lets the naming prompt offer the list while collecting', async () => {
        store.collecting.set(true);
        api.scan.mockImplementation((code: string) => of(outcome(code, 'needs_name')));
        const page = await open();
        see(MILK);

        expect((page.querySelector('app-naming-prompt') as unknown as { collecting: boolean }).collecting).toBe(true);
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

    it('stops the camera for a recipe code and opens the tick sheet, with the box to keep a recipe it does not have', async () => {
        const page = await open();
        see(SOUP);

        expect(camera.stop).toHaveBeenCalledTimes(1);
        expect(sheet(page)?.name).toBe('Soep');
        expect(sheet(page)?.savable).toBe(true);
        expect(api.scan).not.toHaveBeenCalled();

        see(MILK);

        expect(api.scan).not.toHaveBeenCalled();
    });

    it('offers no box to keep a recipe whose name the app has', async () => {
        store.recipes.set([{ name: 'Soep' }]);
        const page = await open();
        see(SOUP);

        expect(sheet(page)?.savable).toBe(false);
    });

    it('puts the ticked products on the list with the code, and starts the camera again', async () => {
        const page = await open();
        see(SOUP);
        const ingredients = [{ catalogItemId: 7, quantity: 2, note: 'vers' }];
        sheet(page)?.dispatchEvent(Object.assign(new CustomEvent('confirmed'), { ingredients, save: true }));
        fixture.detectChanges();

        expect(store.putRecipeOnList).toHaveBeenCalledWith({ name: 'Soep', ingredients }, { code: SOUP, save: true });
        expect(sheet(page)).toBeNull();
        expect(camera.starts).toBe(2);

        see(SOUP);
        expect(sheet(page)).toBeNull();

        vi.advanceTimersByTime(3001);
        see(SOUP);
        expect(sheet(page)).not.toBeNull();
    });

    it('starts the camera again when the tick sheet is closed, and says so when the addition fails', async () => {
        store.putRecipeOnList.mockReturnValue(throwError(() => new Error('offline')));
        const page = await open();
        see(SOUP);
        sheet(page)?.dispatchEvent(new CustomEvent('closed'));
        fixture.detectChanges();

        expect(sheet(page)).toBeNull();
        expect(camera.starts).toBe(2);
        expect(store.putRecipeOnList).not.toHaveBeenCalled();

        vi.advanceTimersByTime(3001);
        see(SOUP);
        sheet(page)?.dispatchEvent(Object.assign(new CustomEvent('confirmed'), { ingredients: [], save: false }));

        expect(toasts()).toEqual(['error: scan.failed']);
    });

    it('says so when a recipe code cannot be read', async () => {
        const page = await open();
        see('R1;Soep;zeven');

        expect(sheet(page)).toBeNull();
        expect(camera.stop).not.toHaveBeenCalled();
        expect(toasts()).toEqual(['attention: scan.recipeUnreadable']);
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

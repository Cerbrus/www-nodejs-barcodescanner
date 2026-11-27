import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TranslateTesting } from '../../../testing/translate';
import { PictureCutComponent } from './picture-cut.component';

describe('PictureCutComponent', () => {
    let fixture: ComponentFixture<PictureCutComponent>;
    let sheet: HTMLElement;
    const cut = vi.fn();
    const cancelled = vi.fn();
    const drawn = vi.fn();
    const made = new Blob(['cut'], { type: 'image/jpeg' });

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const image = (): HTMLImageElement => sheet.querySelector('.frame img') as HTMLImageElement;
    const load = async (width: number, height: number): Promise<void> => {
        Object.defineProperty(image(), 'naturalWidth', { value: width, configurable: true });
        Object.defineProperty(image(), 'naturalHeight', { value: height, configurable: true });
        image().dispatchEvent(new Event('load'));
        await settle();
    };
    const pointer = (kind: string, id: number, x: number, y: number): void => {
        const event = new Event(kind, { bubbles: true });
        Object.assign(event, { pointerId: id, clientX: x, clientY: y });
        (sheet.querySelector('.frame') as HTMLElement).dispatchEvent(event);
    };
    const button = (label: string): HTMLButtonElement =>
        sheet.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

    beforeEach(async () => {
        vi.clearAllMocks();
        HTMLDialogElement.prototype.showModal ??= vi.fn();
        HTMLDialogElement.prototype.close ??= vi.fn();
        URL.createObjectURL = vi.fn(() => 'blob:chosen');
        URL.revokeObjectURL = vi.fn();
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: drawn })) as never;
        HTMLCanvasElement.prototype.toBlob = vi.fn((done: BlobCallback) => done(made));
        TestBed.configureTestingModule({ imports: [PictureCutComponent, TranslateTesting] });
        fixture = TestBed.createComponent(PictureCutComponent);
        fixture.componentRef.setInput('picture', new Blob(['chosen'], { type: 'image/png' }));
        fixture.componentInstance.finished.subscribe(cut);
        fixture.componentInstance.cancelled.subscribe(cancelled);
        sheet = fixture.nativeElement as HTMLElement;
        await settle();
        vi.spyOn(sheet.querySelector('.frame') as HTMLElement, 'getBoundingClientRect').mockReturnValue({
            width: 400,
            height: 300
        } as DOMRect);
    });

    it('shows the chosen picture and offers no cut until it has loaded', async () => {
        expect(image().getAttribute('src')).toBe('blob:chosen');
        expect(button('recipe.pictureUse').disabled).toBe(true);

        await load(3000, 1500);

        expect(button('recipe.pictureUse').disabled).toBe(false);
        expect([image().style.width, image().style.height, image().style.left, image().style.top]).toEqual([
            '150%',
            '100%',
            '-25%',
            '0%'
        ]);
    });

    it('cuts the middle of the picture when nothing was moved', async () => {
        await load(3000, 1500);
        button('recipe.pictureUse').click();

        expect(drawn).toHaveBeenCalledWith(image(), 500, 0, 2000, 1500, 0, 0, 1600, 1200);
        expect(cut).toHaveBeenCalledWith(made);
    });

    it('moves the picture with one finger, and stops at its edge', async () => {
        await load(3000, 1500);
        pointer('pointerdown', 1, 200, 100);
        pointer('pointermove', 1, 260, 180);
        pointer('pointerup', 1, 260, 180);
        pointer('pointermove', 1, 0, 0);
        await settle();
        button('recipe.pictureUse').click();

        expect(drawn).toHaveBeenCalledWith(image(), 200, 0, 2000, 1500, 0, 0, 1600, 1200);

        pointer('pointerdown', 1, 0, 0);
        pointer('pointermove', 1, 4000, 0);
        await settle();
        button('recipe.pictureUse').click();

        expect(drawn).toHaveBeenLastCalledWith(image(), 0, 0, 2000, 1500, 0, 0, 1600, 1200);
    });

    it('enlarges with the slider and with two fingers', async () => {
        await load(800, 600);
        const zoom = sheet.querySelector('#picture-zoom') as HTMLInputElement;
        zoom.value = '2';
        zoom.dispatchEvent(new Event('input'));
        await settle();
        button('recipe.pictureUse').click();

        expect(drawn).toHaveBeenLastCalledWith(image(), 200, 150, 400, 300, 0, 0, 400, 300);

        pointer('pointerdown', 1, 100, 100);
        pointer('pointerdown', 2, 200, 100);
        pointer('pointermove', 2, 300, 100);
        await settle();
        button('recipe.pictureUse').click();

        expect(zoom.value).toBe('4');
        expect(drawn).toHaveBeenLastCalledWith(image(), 300, 225, 200, 150, 0, 0, 200, 150);
    });

    it('says so when the picture cannot be read, and leaves without a cut', async () => {
        image().dispatchEvent(new Event('error'));
        await settle();

        expect(sheet.querySelector('.empty')?.textContent?.trim()).toBe('recipe.pictureUnreadable');
        expect(button('recipe.pictureUse').disabled).toBe(true);

        button('common.cancel').click();

        expect(cancelled).toHaveBeenCalled();
        expect(cut).not.toHaveBeenCalled();
    });
});

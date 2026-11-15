import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { FakeRemarks, click, fakeRemarks, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { RemarkService } from '../../services/remark.service';
import { ToastService } from '../../services/toast.service';
import { RemarkPointerDirective } from './remark-pointer.directive';
import { RemarkSheetComponent } from './remark-sheet.component';

@Component({
    standalone: true,
    imports: [RemarkPointerDirective],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    template: `
        <main appRemarkPointer>
            <app-item-tile
                ><button class="tile" id="tile"><span id="name">Melk</span></button></app-item-tile
            >
            <input id="field" placeholder="Zoeken" />
        </main>
        <button id="outside">Tab</button>
    `
})
class PointerHostComponent {}

describe('RemarkSheetComponent', () => {
    let fixture: ComponentFixture<RemarkSheetComponent>;
    let page: HTMLElement;
    let remarks: FakeRemarks;

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const toasts = (): Array<string> =>
        TestBed.inject(ToastService)
            .toasts()
            .map((toast) => toast.text);
    const sendButton = (): HTMLButtonElement => page.querySelector('button.primary') as HTMLButtonElement;

    beforeEach(async () => {
        remarks = fakeRemarks();
        TestBed.configureTestingModule({
            imports: [RemarkSheetComponent, TranslateTesting],
            providers: [{ provide: RemarkService, useValue: remarks }]
        });
        fixture = TestBed.createComponent(RemarkSheetComponent);
        page = fixture.nativeElement as HTMLElement;
        await settle();
    });

    it('shows nothing until a remark is started', async () => {
        expect(page.querySelector('dialog')).toBeNull();

        remarks.write();
        await settle();

        expect(page.querySelector('dialog')?.hasAttribute('open')).toBe(true);
        expect(page.querySelector('.about')).toBeNull();
    });

    it('offers bug, wish and note, starts on bug, and asks a question that fits the kind', async () => {
        remarks.write();
        await settle();
        expect(texts(page, '.segment')).toEqual([
            'bug_report remark.kind.bug',
            'lightbulb remark.kind.wish',
            'sticky_note_2 remark.kind.note'
        ]);
        expect(texts(page, '.segment.chosen')).toEqual(['bug_report remark.kind.bug']);
        expect(texts(page, 'label.field-label')).toEqual(['remark.text.bug']);

        click(page, '.segment', 1);
        await settle();

        expect(texts(page, 'label.field-label')).toEqual(['remark.text.wish']);
    });

    it('says what the remark is about when a part was pointed at', async () => {
        remarks.write({ component: 'app-item-tile', text: 'Melk' });
        await settle();
        expect(texts(page, '.about span')).toEqual(['remark.about: Melk']);

        remarks.write({ component: 'app-item-tile', label: 'Opties', text: 'more_horiz' });
        await settle();
        expect(texts(page, '.about span')).toEqual(['remark.about: Opties']);
    });

    it('cannot send an empty remark', async () => {
        remarks.write();
        await settle();
        expect(sendButton().disabled).toBe(true);

        type(page, 'textarea', '   ');
        await settle();
        expect(sendButton().disabled).toBe(true);
    });

    it('sends the kind and the text, thanks the writer, and starts empty the next time', async () => {
        remarks.write();
        await settle();
        click(page, '.segment', 2);
        type(page, 'textarea', 'Check the buzzer');
        await settle();
        sendButton().click();

        expect(remarks.send).toHaveBeenCalledWith('note', 'Check the buzzer');
        expect(toasts()).toEqual(['remark.thanks']);

        remarks.write();
        await settle();
        expect((page.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
    });

    it('says the remark is kept when there is no connection', async () => {
        remarks.send.mockReturnValue(of('kept'));
        remarks.write();
        await settle();
        type(page, 'textarea', 'x');
        await settle();
        sendButton().click();

        expect(toasts()).toEqual(['remark.kept']);
    });

    it('cannot send twice while the first is under way, and keeps the text when the server refuses', async () => {
        const answer = new Subject<'sent'>();
        remarks.send.mockReturnValue(answer);
        remarks.write();
        await settle();
        type(page, 'textarea', 'x');
        await settle();
        sendButton().click();
        await settle();
        expect(sendButton().disabled).toBe(true);

        answer.error(new Error('429'));
        await settle();

        expect(sendButton().disabled).toBe(false);
        expect((page.querySelector('textarea') as HTMLTextAreaElement).value).toBe('x');
        expect(toasts()).toEqual([]);

        remarks.send.mockReturnValue(throwError(() => new Error('429')));
    });

    it('closes on cancel and on Escape when nothing was written', async () => {
        remarks.write();
        await settle();
        click(page, 'button.btn');
        await settle();
        expect(page.querySelector('dialog')).toBeNull();

        remarks.write();
        await settle();
        (page.querySelector('dialog') as HTMLDialogElement).dispatchEvent(new Event('cancel', { cancelable: true }));
        await settle();
        expect(remarks.draft()).toBeUndefined();
    });

    it('sends with Ctrl+Enter or Cmd+Enter, and not when empty or with Enter alone', async () => {
        const press = async (init: KeyboardEventInit): Promise<void> => {
            (page.querySelector('textarea') as HTMLTextAreaElement).dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...init })
            );
            await settle();
        };
        remarks.write();
        await settle();
        await press({ ctrlKey: true });
        expect(remarks.send).not.toHaveBeenCalled();

        type(page, 'textarea', 'Via keyboard');
        await settle();
        await press({});
        expect(remarks.send).not.toHaveBeenCalled();

        await press({ ctrlKey: true });
        expect(remarks.send).toHaveBeenCalledWith('bug', 'Via keyboard');

        remarks.write();
        await settle();
        type(page, 'textarea', 'On a Mac');
        await settle();
        await press({ metaKey: true });
        expect(remarks.send).toHaveBeenLastCalledWith('bug', 'On a Mac');
    });

    describe('closing what was written', () => {
        const write = async (): Promise<void> => {
            remarks.write();
            await settle();
            click(page, '.segment', 1);
            type(page, 'textarea', 'Half a thought');
            await settle();
        };
        const choose = async (label: string): Promise<void> => {
            click(page, 'button.btn', ['remark.keepWriting', 'remark.closeKeep', 'remark.closeClear'].indexOf(label));
            await settle();
        };

        it('asks on Cancel, on a click outside and on Escape, and goes back to writing on request', async () => {
            await write();
            click(page, 'button.btn');
            await settle();
            expect(texts(page, 'p.text-sm')).toEqual(['remark.closeAsk']);
            expect(texts(page, 'button.btn')).toEqual([
                'arrow_back remark.keepWriting',
                'close remark.closeKeep',
                'delete remark.closeClear'
            ]);
            expect(remarks.draft()).toBeDefined();

            await choose('remark.keepWriting');
            expect(page.querySelector('p.text-sm')).toBeNull();

            (page.querySelector('dialog') as HTMLDialogElement).click();
            await settle();
            expect(texts(page, 'p.text-sm')).toEqual(['remark.closeAsk']);
            await choose('remark.keepWriting');

            (page.querySelector('dialog') as HTMLDialogElement).dispatchEvent(
                new Event('cancel', { cancelable: true })
            );
            await settle();
            expect(texts(page, 'p.text-sm')).toEqual(['remark.closeAsk']);
            expect(remarks.draft()).toBeDefined();
        });

        it('closes and keeps the text and kind when asked to just close', async () => {
            await write();
            click(page, 'button.btn');
            await settle();
            await choose('remark.closeKeep');
            expect(page.querySelector('dialog')).toBeNull();

            remarks.write();
            await settle();
            expect((page.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Half a thought');
            expect(texts(page, '.segment.chosen')).toEqual(['lightbulb remark.kind.wish']);
            expect(page.querySelector('p.text-sm')).toBeNull();
        });

        it('closes and clears the text and kind when asked to clear as well', async () => {
            await write();
            click(page, 'button.btn');
            await settle();
            await choose('remark.closeClear');
            expect(page.querySelector('dialog')).toBeNull();

            remarks.write();
            await settle();
            expect((page.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
            expect(texts(page, '.segment.chosen')).toEqual(['bug_report remark.kind.bug']);
        });
    });
});

describe('RemarkPointerDirective', () => {
    let page: HTMLElement;
    let remarks: FakeRemarks;

    const rightClick = (selector: string): Event => {
        const event = new Event('contextmenu', { bubbles: true, cancelable: true });
        page.querySelector(selector)?.dispatchEvent(event);

        return event;
    };

    beforeEach(() => {
        remarks = fakeRemarks();
        TestBed.configureTestingModule({
            imports: [PointerHostComponent],
            providers: [{ provide: RemarkService, useValue: remarks }]
        });
        const fixture = TestBed.createComponent(PointerHostComponent);
        fixture.detectChanges();
        page = fixture.nativeElement as HTMLElement;
    });

    afterEach(() => vi.restoreAllMocks());

    it('leaves taps alone while not pointing', () => {
        const tapped = vi.fn();
        page.querySelector('#tile')?.addEventListener('click', tapped);
        click(page, '#name');

        expect(tapped).toHaveBeenCalledTimes(1);
        expect(remarks.draft()).toBeUndefined();
    });

    it('while pointing, takes the tap for itself and starts a remark about the tapped part', () => {
        const tapped = vi.fn();
        page.querySelector('#tile')?.addEventListener('click', tapped);
        remarks.startPointing();
        click(page, '#name');

        expect(tapped).not.toHaveBeenCalled();
        expect(remarks.draft()?.target).toEqual(expect.objectContaining({ component: 'app-item-tile', text: 'Melk' }));
        expect(remarks.pointing()).toBe(false);
    });

    it('does not take taps outside its area, so the tabs keep working while pointing', () => {
        const tapped = vi.fn();
        page.querySelector('#outside')?.addEventListener('click', tapped);
        remarks.startPointing();
        click(page, '#outside');

        expect(tapped).toHaveBeenCalledTimes(1);
        expect(remarks.pointing()).toBe(true);
    });

    it('starts a remark on a right click, in place of the browser menu', () => {
        const event = rightClick('#name');

        expect(event.defaultPrevented).toBe(true);
        expect(remarks.draft()?.target?.text).toBe('Melk');
    });

    it('leaves the browser menu on a text field, for paste and spelling', () => {
        const event = rightClick('#field');

        expect(event.defaultPrevented).toBe(false);
        expect(remarks.draft()).toBeUndefined();
    });
});

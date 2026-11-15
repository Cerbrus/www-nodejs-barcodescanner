import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { RemarksPage } from './remarks.page';
import { FakeEvents, FakeRemarks, fakeEvents, fakeRemarks, texts } from '../../../testing/fakes';
import { AuthState, IssueDraft, Remark } from '../../models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { RemarkService } from '../../services/remark.service';
import { ToastService } from '../../services/toast.service';

const OWNER: AuthState = { enabled: true, authenticated: true, owner: true, email: 'owner@example.com' };
const GUEST: AuthState = { enabled: true, authenticated: true, owner: false, email: 'guest@example.com' };
const remark = (id: number, extra: Partial<Remark> = {}): Remark => ({
    id,
    kind: 'bug',
    text: `Remark ${id}`,
    state: 'open',
    page: '#/list',
    account: 'guest@example.com',
    createdAt: '2026-11-14T10:00:00.000Z',
    ...extra
});
const DRAFT: IssueDraft = { title: 'Remark 1', body: '### What happened\n\nRemark 1', labels: ['bug'] };

describe('RemarksPage', () => {
    let fixture: ComponentFixture<RemarksPage>;
    let page: HTMLElement;
    let events: FakeEvents;
    let remarks: FakeRemarks;
    const state = signal<AuthState | undefined>(OWNER);
    const api = { getRemarks: vi.fn(), setRemarkState: vi.fn(), rejectRemark: vi.fn(), getIssueDraft: vi.fn(), sendRemarkToGitHub: vi.fn() };

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const open = async (who: AuthState, list: Array<Remark>, canSendToGitHub = true): Promise<void> => {
        state.set(who);
        api.getRemarks.mockReturnValue(of({ remarks: list, canSendToGitHub }));
        fixture = TestBed.createComponent(RemarksPage);
        page = fixture.nativeElement as HTMLElement;
        await settle();
    };
    const buttons = (index = 0): Array<string> => texts(page.querySelectorAll('article')[index], 'button');
    const press = async (label: string, root: Element = page): Promise<void> => {
        (Array.from(root.querySelectorAll('button')).find((button) => (button.textContent ?? '').includes(label)) as HTMLElement).click();
        await settle();
    };

    const toggle = async (index: number): Promise<void> => {
        (page.querySelectorAll('article')[index].querySelector('button.toggle') as HTMLElement).click();
        await settle();
    };

    beforeEach(() => {
        vi.clearAllMocks();
        events = fakeEvents();
        remarks = fakeRemarks();
        api.setRemarkState.mockReturnValue(of(remark(1, { state: 'closed' })));
        api.rejectRemark.mockReturnValue(of(undefined));
        api.getIssueDraft.mockReturnValue(of(DRAFT));
        api.sendRemarkToGitHub.mockReturnValue(of(remark(1, { issueNumber: 12, issueUrl: 'https://github.example/issues/12' })));
        TestBed.configureTestingModule({
            imports: [RemarksPage, TranslateModule.forRoot()],
            providers: [
                provideRouter([]),
                { provide: ApiService, useValue: api },
                { provide: EventsService, useValue: events },
                { provide: RemarkService, useValue: remarks },
                { provide: AuthService, useValue: { state, owner: computed(() => state()?.owner ?? false) } }
            ]
        });
    });

    it('lists the remarks with kind, text, page and what was pointed at', async () => {
        await open(OWNER, [remark(2, { kind: 'wish', target: { text: 'Melk' } }), remark(1, { state: 'closed' })]);

        expect(texts(page, 'article .font-semibold')).toEqual(['remark.kind.wish', 'remark.kind.bug']);
        expect(texts(page, 'article .text')).toEqual(['Remark 2', 'Remark 1']);
        expect(texts(page, 'article .where')[0]).toBe('#/list · Melk · guest@example.com');
        expect(texts(page, 'article .state')).toEqual(['remark.closed']);
        expect(page.querySelectorAll('article.opacity-60').length).toBe(1);
    });

    it('collapses a handled remark to its message, and opens it again on request', async () => {
        await open(OWNER, [remark(1), remark(2, { state: 'closed', issueNumber: 12, issueUrl: 'https://github.example/issues/12' })]);

        expect(texts(page, 'article .text')).toEqual(['Remark 1', 'Remark 2']);
        expect(texts(page, 'article .where')).toEqual(['#/list · guest@example.com']);
        expect(buttons(1)).toEqual(['expand_more']);
        expect(page.querySelectorAll('article')[1].querySelector('a.issue')).toBeNull();
        expect(page.querySelectorAll('button.toggle').length).toBe(1);

        await toggle(1);
        expect(texts(page, 'article .where').length).toBe(2);
        expect(buttons(1)).toEqual(['expand_less', 'undo remark.reopen']);
        expect(page.querySelectorAll('article')[1].querySelector('button.toggle')?.getAttribute('aria-expanded')).toBe('true');

        await toggle(1);
        expect(texts(page, 'article .where').length).toBe(1);
    });

    it('says loading, then that there is no feedback yet', async () => {
        const answer = new Subject<{ remarks: Array<Remark>; canSendToGitHub: boolean }>();
        api.getRemarks.mockReturnValue(answer);
        fixture = TestBed.createComponent(RemarksPage);
        page = fixture.nativeElement as HTMLElement;
        await settle();
        expect(texts(page, '.empty')).toEqual(['common.loading']);

        answer.next({ remarks: [], canSendToGitHub: false });
        await settle();
        expect(texts(page, '.empty')).toEqual(['remark.empty']);
        expect(remarks.count).toHaveBeenCalledWith([]);
    });

    it('shows another account its remarks without any owner buttons or account names', async () => {
        await open(GUEST, [remark(1)], false);

        expect(buttons()).toEqual(['block remark.reject']);
        expect(texts(page, 'article .where')).toEqual(['#/list']);
    });

    it('starts a new remark from the page, and shows how many wait for a connection', async () => {
        remarks.waiting.set(1);
        await open(GUEST, []);
        expect(texts(page, 'p.muted')).toEqual(['remark.waiting']);

        await press('remark.write');

        expect(remarks.draft()).toEqual({ target: undefined });
    });

    it('lets the owner mark a remark as handled and reopen it', async () => {
        await open(OWNER, [remark(1), remark(2, { state: 'closed' })]);
        await press('remark.close');
        await toggle(1);
        await press('remark.reopen');

        expect(api.setRemarkState.mock.calls).toEqual([
            [1, 'closed'],
            [2, 'open']
        ]);
        expect(api.getRemarks).toHaveBeenCalledTimes(3);
    });

    it('rejects a remark only after a confirmation, and reloads the list', async () => {
        await open(OWNER, [remark(1)]);
        await press('remark.reject');
        expect(api.rejectRemark).not.toHaveBeenCalled();

        await press('common.cancel');
        await press('remark.reject');
        await press('remark.reject', page.querySelector('article') as Element);

        expect(api.rejectRemark).toHaveBeenCalledWith(1);
        expect(api.getRemarks).toHaveBeenCalledTimes(2);
        expect(texts(page, 'article p.text-sm')).toEqual([]);
    });

    it('lets a writer reject their own remark, but not one that is already on GitHub', async () => {
        await open(GUEST, [remark(1), remark(2, { issueNumber: 12, issueUrl: 'https://github.example/issues/12' })], false);

        expect(buttons(0)).toEqual(['block remark.reject']);
        expect(buttons(1)).toEqual([]);

        await open(OWNER, [remark(2, { issueNumber: 12, issueUrl: 'https://github.example/issues/12' })]);
        expect(buttons(0)).toEqual(['check remark.close']);
    });

    it('offers "to GitHub" only when a token is set and the remark is not there yet, and links to the issue once it is', async () => {
        await open(OWNER, [remark(1), remark(2, { issueNumber: 12, issueUrl: 'https://github.example/issues/12' })]);
        expect(buttons(0)).toEqual(['check remark.close', 'outbox remark.toGitHub', 'block remark.reject']);
        expect(buttons(1)).toEqual(['check remark.close']);
        expect(page.querySelector('a.issue')?.getAttribute('href')).toBe('https://github.example/issues/12');

        await open(OWNER, [remark(1)], false);
        expect(buttons(0)).toEqual(['check remark.close', 'block remark.reject']);
    });

    it('shows exactly what would be sent, warns that it is public, and asks the agent to look at it unless unticked', async () => {
        await open(OWNER, [remark(1)]);
        await press('remark.toGitHub');

        expect(api.getIssueDraft).toHaveBeenCalledWith(1, { includeDevice: false, includeAccount: false, investigate: true });
        expect(texts(page, 'app-sheet .muted.text-sm')).toEqual(['remark.publicWarning']);
        expect(texts(page, '.preview .font-semibold')).toEqual(['Remark 1']);
        expect(texts(page, '.preview pre')[0]).toContain('### What happened');
        expect(texts(page, 'label.option span')).toEqual(['remark.option.investigate', 'remark.option.includeDevice', 'remark.option.includeAccount']);
        const boxes = Array.from(page.querySelectorAll('label.option input')) as Array<HTMLInputElement>;
        expect(boxes.map((box) => box.checked)).toEqual([true, false, false]);
    });

    it('shows the preview again after a tick, and sends with what was ticked', async () => {
        await open(OWNER, [remark(1)]);
        await press('remark.toGitHub');
        const tick = async (index: number, checked = true): Promise<void> => {
            const box = page.querySelectorAll('label.option input')[index] as HTMLInputElement;
            box.checked = checked;
            box.dispatchEvent(new Event('change'));
            await settle();
        };

        await tick(1);
        await tick(0, false);
        expect(api.getIssueDraft).toHaveBeenLastCalledWith(1, { includeDevice: true, includeAccount: false, investigate: false });

        await press('remark.sendToGitHub');

        expect(api.sendRemarkToGitHub).toHaveBeenCalledWith(1, { includeDevice: true, includeAccount: false, investigate: false });
        expect(page.querySelector('app-sheet')).toBeNull();
        expect(TestBed.inject(ToastService).toasts().map((toast) => toast.text)).toEqual(['remark.sentToGitHub']);
    });

    it('starts each "to GitHub" with only the agent ticked', async () => {
        await open(OWNER, [remark(1), remark(2)]);
        await press('remark.toGitHub');
        const box = page.querySelectorAll('label.option input')[1] as HTMLInputElement;
        box.checked = true;
        box.dispatchEvent(new Event('change'));
        await settle();
        await press('common.cancel');
        await press('remark.toGitHub', page.querySelectorAll('article')[1]);

        expect(api.getIssueDraft).toHaveBeenLastCalledWith(2, { includeDevice: false, includeAccount: false, investigate: true });
    });

    it('keeps the sheet open when GitHub refuses, so the owner can try again', async () => {
        api.sendRemarkToGitHub.mockReturnValue(throwError(() => new Error('502')));
        await open(OWNER, [remark(1)]);
        await press('remark.toGitHub');
        await press('remark.sendToGitHub');

        expect(page.querySelector('app-sheet')).not.toBeNull();
        expect((Array.from(page.querySelectorAll('button')).find((button) => (button.textContent ?? '').includes('remark.sendToGitHub')) as HTMLButtonElement).disabled).toBe(false);
    });

    it('reloads when a remark comes in, and keeps what it shows when the server cannot be reached', async () => {
        await open(OWNER, [remark(1)]);
        api.getRemarks.mockReturnValue(throwError(() => new Error('down')));
        events.emit('remark', { id: 2 });
        await settle();

        expect(api.getRemarks).toHaveBeenCalledTimes(2);
        expect(texts(page, 'article .text')).toEqual(['Remark 1']);
    });
});

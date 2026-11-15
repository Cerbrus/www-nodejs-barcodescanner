import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { FakeEvents, FakeRemarks, fakeEvents, fakeRemarks, texts } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { AuthState, IssueDraft, Remark } from '../../models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { RemarkService } from '../../services/remark.service';
import { ToastService } from '../../services/toast.service';
import { RemarksPage } from './remarks.page';

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
    const api = {
        getRemarks: vi.fn(),
        setRemarkState: vi.fn(),
        rejectRemark: vi.fn(),
        getIssueDraft: vi.fn(),
        sendRemarkToGitHub: vi.fn()
    };

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
    const buttons = (index = 0): Array<string> =>
        texts(page.querySelectorAll('article')[index], 'button:not(.backdrop)');
    const menuItems = (index = 0): Array<string> => texts(page.querySelectorAll('article')[index], '.menu button');
    const openMenu = async (index = 0): Promise<void> => {
        (page.querySelectorAll('article')[index].querySelector('.menu-anchor > button') as HTMLElement).click();
        await settle();
    };
    const press = async (label: string, root: Element = page): Promise<void> => {
        (
            Array.from(root.querySelectorAll('button')).find((button) =>
                (button.textContent ?? '').includes(label)
            ) as HTMLElement
        ).click();
        await settle();
    };

    const showHandled = async (): Promise<void> => {
        (page.querySelector('button.group') as HTMLElement).click();
        await settle();
    };

    beforeEach(() => {
        vi.clearAllMocks();
        events = fakeEvents();
        remarks = fakeRemarks();
        api.setRemarkState.mockReturnValue(of(remark(1, { state: 'closed' })));
        api.rejectRemark.mockReturnValue(of(undefined));
        api.getIssueDraft.mockReturnValue(of(DRAFT));
        api.sendRemarkToGitHub.mockReturnValue(
            of(remark(1, { issueNumber: 12, issueUrl: 'https://github.example/issues/12' }))
        );
        TestBed.configureTestingModule({
            imports: [RemarksPage, TranslateTesting],
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
        await showHandled();

        expect(texts(page, 'article .font-semibold')).toEqual(['remark.kind.wish', 'remark.kind.bug']);
        expect(texts(page, 'article .text')).toEqual(['Remark 2', 'Remark 1']);
        expect(texts(page, 'article .where')[0]).toBe('#/list · Melk · guest@example.com');
        expect(page.querySelectorAll('article.opacity-60').length).toBe(1);
    });

    it('keeps handled remarks behind a "handled" item with their number, and shows them on request', async () => {
        await open(OWNER, [
            remark(1),
            remark(2, { state: 'closed', issueNumber: 12, issueUrl: 'https://github.example/issues/12' }),
            remark(3, { state: 'closed' })
        ]);

        expect(texts(page, 'article .text')).toEqual(['Remark 1']);
        expect(texts(page, 'button.group')).toEqual(['expand_moreremark.closed2']);
        expect(page.querySelector('button.group')?.getAttribute('aria-expanded')).toBe('false');

        await showHandled();
        expect(texts(page, 'article .text')).toEqual(['Remark 1', 'Remark 2', 'Remark 3']);
        expect(page.querySelector('a.issue')).not.toBeNull();
        expect(page.querySelector('button.group')?.getAttribute('aria-expanded')).toBe('true');

        await showHandled();
        expect(texts(page, 'article .text')).toEqual(['Remark 1']);
    });

    it('shows no "handled" item when nothing is handled, and the empty text when only handled remarks exist', async () => {
        await open(OWNER, [remark(1)]);
        expect(page.querySelector('button.group')).toBeNull();

        await open(OWNER, [remark(1, { state: 'closed' })]);
        expect(page.querySelector('.empty')).toBeNull();
        expect(page.querySelectorAll('article').length).toBe(0);
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
        expect(page.querySelector('.menu-anchor')).toBeNull();
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
        await openMenu();
        await press('remark.close');
        await showHandled();
        await openMenu(1);
        await press('remark.reopen');

        expect(api.setRemarkState.mock.calls).toEqual([
            [1, 'closed'],
            [2, 'open']
        ]);
        expect(api.getRemarks).toHaveBeenCalledTimes(3);
    });

    it('rejects a remark only after a confirmation, and reloads the list', async () => {
        await open(OWNER, [remark(1)]);
        await openMenu();
        await press('remark.reject');
        expect(api.rejectRemark).not.toHaveBeenCalled();

        await press('common.cancel');
        await openMenu();
        await press('remark.reject');
        await press('remark.reject', page.querySelector('article') as Element);

        expect(api.rejectRemark).toHaveBeenCalledWith(1);
        expect(api.getRemarks).toHaveBeenCalledTimes(2);
        expect(texts(page, 'article p.text-sm')).toEqual([]);
    });

    it('lets a writer reject their own remark, but not one that is already on GitHub', async () => {
        await open(
            GUEST,
            [remark(1), remark(2, { issueNumber: 12, issueUrl: 'https://github.example/issues/12' })],
            false
        );

        expect(buttons(0)).toEqual(['block remark.reject']);
        expect(buttons(1)).toEqual([]);

        await open(OWNER, [remark(2, { issueNumber: 12, issueUrl: 'https://github.example/issues/12' })]);
        expect(buttons(0)).toEqual(['check remark.close']);
        await press('remark.close');
        expect(api.setRemarkState).toHaveBeenCalledWith(2, 'closed');
    });

    it('offers "to GitHub" only when a token is set and the remark is not there yet, and links to the issue once it is', async () => {
        await open(OWNER, [remark(1), remark(2, { issueNumber: 12, issueUrl: 'https://github.example/issues/12' })]);
        expect(buttons(0)).toEqual(['more_vert']);
        expect(buttons(1)).toEqual(['check remark.close']);
        await openMenu();
        expect(menuItems()).toEqual(['check remark.close', 'outbox remark.toGitHub', 'block remark.reject']);
        expect(page.querySelector('a.issue')?.getAttribute('href')).toBe('https://github.example/issues/12');

        await open(OWNER, [remark(1)], false);
        await openMenu();
        expect(menuItems()).toEqual(['check remark.close', 'block remark.reject']);
    });

    it('shows exactly what would be sent, warns that it is public, and asks the agent to look at it unless unticked', async () => {
        await open(OWNER, [remark(1)]);
        await openMenu();
        await press('remark.toGitHub');

        expect(api.getIssueDraft).toHaveBeenCalledWith(1, {
            includeDevice: false,
            includeAccount: false,
            investigate: true
        });
        expect(texts(page, 'app-sheet .muted.text-sm')).toEqual(['remark.publicWarning']);
        expect(texts(page, '.preview .font-semibold')).toEqual(['Remark 1']);
        expect(texts(page, '.preview pre')[0]).toContain('### What happened');
        expect(texts(page, 'label.option span')).toEqual([
            'remark.option.investigate',
            'remark.option.includeDevice',
            'remark.option.includeAccount'
        ]);
        const boxes = Array.from(page.querySelectorAll('label.option input')) as Array<HTMLInputElement>;
        expect(boxes.map((box) => box.checked)).toEqual([true, false, false]);
    });

    it('shows a single action as a button, and two or more in the menu, which closes after a choice', async () => {
        await open(GUEST, [remark(1)], false);
        await press('remark.reject');
        expect(texts(page, 'article p.text-sm')).toEqual(['remark.rejectConfirm']);

        await open(OWNER, [remark(1)]);
        expect(page.querySelector('.menu')).toBeNull();
        await openMenu();
        await press('remark.reject', page.querySelector('.menu') as Element);

        expect(page.querySelector('.menu')).toBeNull();
        expect(texts(page, 'article p.text-sm')).toEqual(['remark.rejectConfirm']);
    });

    it('closes the Actions menu again with a tap beside it', async () => {
        await open(OWNER, [remark(1)]);
        await openMenu();
        expect(page.querySelector('.menu')).not.toBeNull();

        (page.querySelector('.backdrop') as HTMLElement).click();
        await settle();

        expect(page.querySelector('.menu')).toBeNull();
    });

    it('shows the preview again after a tick, and sends with what was ticked', async () => {
        await open(OWNER, [remark(1)]);
        await openMenu();
        await press('remark.toGitHub');
        const tick = async (index: number, checked = true): Promise<void> => {
            const box = page.querySelectorAll('label.option input')[index] as HTMLInputElement;
            box.checked = checked;
            box.dispatchEvent(new Event('change'));
            await settle();
        };

        await tick(1);
        await tick(0, false);
        expect(api.getIssueDraft).toHaveBeenLastCalledWith(1, {
            includeDevice: true,
            includeAccount: false,
            investigate: false
        });

        await press('remark.sendToGitHub');

        expect(api.sendRemarkToGitHub).toHaveBeenCalledWith(1, {
            includeDevice: true,
            includeAccount: false,
            investigate: false
        });
        expect(page.querySelector('app-sheet')).toBeNull();
        expect(
            TestBed.inject(ToastService)
                .toasts()
                .map((toast) => toast.text)
        ).toEqual(['remark.sentToGitHub']);
    });

    it('starts each "to GitHub" with only the agent ticked', async () => {
        await open(OWNER, [remark(1), remark(2)]);
        await openMenu();
        await press('remark.toGitHub');
        const box = page.querySelectorAll('label.option input')[1] as HTMLInputElement;
        box.checked = true;
        box.dispatchEvent(new Event('change'));
        await settle();
        await press('common.cancel');
        await openMenu(1);
        await press('remark.toGitHub', page.querySelectorAll('article')[1]);

        expect(api.getIssueDraft).toHaveBeenLastCalledWith(2, {
            includeDevice: false,
            includeAccount: false,
            investigate: true
        });
    });

    it('keeps the sheet open when GitHub refuses, so the owner can try again', async () => {
        api.sendRemarkToGitHub.mockReturnValue(throwError(() => new Error('502')));
        await open(OWNER, [remark(1)]);
        await openMenu();
        await press('remark.toGitHub');
        await press('remark.sendToGitHub');

        expect(page.querySelector('app-sheet')).not.toBeNull();
        expect(
            (
                Array.from(page.querySelectorAll('button')).find((button) =>
                    (button.textContent ?? '').includes('remark.sendToGitHub')
                ) as HTMLButtonElement
            ).disabled
        ).toBe(false);
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

import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { SystemPage } from './system.page';
import { FakeEvents, click, fakeEvents, texts } from '../../../testing/fakes';
import { AgentStatus, AuthState } from '../../models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { PushService, PushStatus } from '../../services/push.service';
import { ToastService } from '../../services/toast.service';

const OWNER: AuthState = { enabled: true, authenticated: true, owner: true, email: 'owner@example.com' };
const GUEST: AuthState = { enabled: true, authenticated: true, owner: false, email: 'guest@example.com' };
const LOGIN_OFF: AuthState = { enabled: false, authenticated: true, owner: true };

describe('SystemPage', () => {
    let fixture: ComponentFixture<SystemPage>;
    let page: HTMLElement;
    let events: FakeEvents;
    const state = signal<AuthState | undefined>(OWNER);
    const auth = { state, owner: computed(() => state()?.owner ?? false), logout: vi.fn(() => of(undefined)) };
    const push = { status: signal<PushStatus>('off'), busy: signal(false), enable: vi.fn(() => Promise.resolve()), disable: vi.fn(() => Promise.resolve()) };
    const api = { getAgentStatus: vi.fn(), getHealth: vi.fn(), sendTestPush: vi.fn() };

    const open = async (who: AuthState): Promise<void> => {
        state.set(who);
        fixture = TestBed.createComponent(SystemPage);
        page = fixture.nativeElement as HTMLElement;
        await settle();
    };
    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const groups = (): Array<string> => texts(page, '.section-title');
    const row = (label: string): HTMLElement =>
        Array.from(page.querySelectorAll('.row')).find((candidate) => (candidate.querySelector('.label')?.textContent ?? '').includes(label)) as HTMLElement;
    const scanner = (status: Partial<AgentStatus>): void => {
        api.getAgentStatus.mockReturnValue(of(status));
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        delete document.documentElement.dataset['theme'];
        events = fakeEvents();
        push.status.set('off');
        push.busy.set(false);
        api.getHealth.mockReturnValue(of({ status: 'ok', version: '1.1.32', commit: 'c96a5b5d1a16', builtAt: '2026-11-13T21:29:08Z' }));
        api.sendTestPush.mockReturnValue(of({ sent: 1, failed: 0 }));
        scanner({ agentOnline: true, scanner: 'connected', lastHandheldScanAt: '2026-11-13T20:41:00Z' });
        TestBed.configureTestingModule({
            imports: [SystemPage, TranslateModule.forRoot()],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: auth },
                { provide: PushService, useValue: push },
                { provide: ApiService, useValue: api },
                { provide: EventsService, useValue: events }
            ]
        });
    });

    it('shows the owner three groups, with the management rows in order and the version below', async () => {
        await open(OWNER);

        expect(groups()).toEqual(['system.device', 'login.account', 'system.management']);
        expect(Array.from(page.querySelectorAll('a.row.link'), (link) => link.getAttribute('href'))).toEqual(['/sounds', '/history', '/log']);
        expect(texts(page, '.version')[0]).toContain('1.1.32 (c96a5b5)');
    });

    it('shows another account only this device and the account, and asks the server for nothing of the owner', async () => {
        await open(GUEST);

        expect(groups()).toEqual(['system.device', 'login.account']);
        expect(page.querySelector('.version')).toBeNull();
        expect(page.querySelector('a.row.link')).toBeNull();
        expect(api.getAgentStatus).not.toHaveBeenCalled();
        expect(texts(page, '.row .truncate')).toEqual(['guest@example.com']);
    });

    it('leaves the account group out when login is switched off', async () => {
        await open(LOGIN_OFF);

        expect(groups()).toEqual(['system.device', 'system.management']);
    });

    it('switches language and remembers it on this device', async () => {
        await open(GUEST);
        const use = vi.spyOn(TestBed.inject(TranslateService), 'use');

        click(row('system.language'), '.segment', 1);
        await settle();

        expect(use).toHaveBeenCalledWith('en');
        expect(localStorage.getItem('language')).toBe('en');
        expect(texts(row('system.language'), '.segment.chosen')).toEqual(['language.en']);
    });

    it('switches appearance, applies it to the page and remembers it', async () => {
        await open(GUEST);
        click(row('system.theme'), '.segment', 2);
        await settle();

        expect(document.documentElement.dataset['theme']).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('dark');

        click(row('system.theme'), '.segment', 0);

        expect(document.documentElement.dataset['theme']).toBeUndefined();
    });

    it('offers to turn notifications on with an explanation, and says so when that fails', async () => {
        await open(GUEST);
        expect(texts(row('push.title'), '.hint')).toEqual(['push.state.off']);
        expect(texts(page, '.note')).toEqual(['push.intro']);

        push.enable.mockReturnValueOnce(Promise.reject(new Error('refused')));
        click(row('push.title'), 'button.primary');
        await settle();

        expect(push.enable).toHaveBeenCalledTimes(1);
        expect(TestBed.inject(ToastService).toasts().map((toast) => toast.text)).toEqual(['push.failed']);
    });

    it('explains why when notifications are blocked or not supported, without a button', async () => {
        push.status.set('denied');
        await open(GUEST);

        expect(texts(page, '.note')).toEqual(['push.denied']);
        expect(row('push.title').querySelector('button')).toBeNull();

        push.status.set('unsupported');
        await settle();

        expect(texts(page, '.note')).toEqual(['push.unsupported']);
    });

    it('lets everyone turn notifications off, and only the owner send a test notification', async () => {
        push.status.set('on');
        await open(GUEST);
        expect(texts(row('push.title'), 'button')).toEqual(['notifications_off push.disable']);
        expect(page.querySelector('.note')).toBeNull();

        click(row('push.title'), 'button');
        expect(push.disable).toHaveBeenCalledTimes(1);

        await open(OWNER);
        click(row('push.title'), 'button', 0);

        expect(api.sendTestPush).toHaveBeenCalledTimes(1);
        expect(TestBed.inject(ToastService).toasts().at(-1)?.text).toBe('push.testResult');
    });

    it('logs out only after a confirmation', async () => {
        await open(GUEST);
        click(page, 'button.danger');
        await settle();
        expect(auth.logout).not.toHaveBeenCalled();
        expect(texts(page, '.note')).toContain('login.logoutConfirm');

        (Array.from(page.querySelectorAll('button')).find((button) => (button.textContent ?? '').includes('common.cancel')) as HTMLElement).click();
        await settle();
        expect(texts(page, '.note')).not.toContain('login.logoutConfirm');

        click(page, 'button.danger');
        await settle();
        click(page, 'button.danger');

        expect(auth.logout).toHaveBeenCalledTimes(1);
    });

    it('shows the live connection and the scanner with a green dot, and the last scan', async () => {
        await open(OWNER);

        expect(texts(row('system.connection'), '.value')).toEqual(['log.live']);
        expect(row('system.connection').querySelector('.dot.bad')).toBeNull();
        expect(texts(row('system.scanner'), '.value')).toEqual(['system.scannerState.connected']);
        expect(row('system.scanner').querySelector('.dot.bad')).toBeNull();
        expect(texts(row('system.scanner'), '.hint')[0]).toContain('system.lastHandheldScan');
    });

    it('turns the dots red when the connection is down or the scanner is away', async () => {
        scanner({ agentOnline: true });
        await open(OWNER);
        events.connected.set(false);
        await settle();

        expect(row('system.connection').querySelector('.dot.bad')).not.toBeNull();
        expect(texts(row('system.scanner'), '.value')).toEqual(['system.scannerState.waiting']);
        expect(row('system.scanner').querySelector('.dot.bad')).not.toBeNull();
    });

    it('says the scanner service is not reachable when it is down or cannot be asked', async () => {
        scanner({ agentOnline: false, scanner: 'connected' });
        await open(OWNER);
        expect(texts(row('system.scanner'), '.value')).toEqual(['system.scannerState.offline']);

        api.getAgentStatus.mockReturnValue(throwError(() => new Error('403')));
        events.emit('agent', {});
        await settle();

        expect(texts(row('system.scanner'), '.value')).toEqual(['system.scannerState.offline']);
    });

    it('asks for the scanner status again after a scan', async () => {
        await open(OWNER);
        events.emit('scan', {});

        expect(api.getAgentStatus).toHaveBeenCalledTimes(2);
    });

    it('shows a version without commit, and dots while the server has not answered', async () => {
        api.getHealth.mockReturnValue(of({ status: 'ok', version: 'dev' }));
        await open(OWNER);
        expect(texts(page, '.version .font-mono')).toEqual(['dev']);

        api.getHealth.mockReturnValue(throwError(() => new Error('down')));
        await open(OWNER);
        expect(texts(page, '.version .font-mono')).toEqual(['…']);
    });
});

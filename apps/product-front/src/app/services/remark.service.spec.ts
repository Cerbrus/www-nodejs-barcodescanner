import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ApiService } from './api.service';
import { EventsService } from './events.service';
import { describeElement, isTextField } from './remark-target';
import { RemarkDelivery, RemarkService } from './remark.service';
import { ShoppingStore } from './shopping.store';
import { ToastService } from './toast.service';
import { FakeEvents, fakeEvents } from '../../testing/fakes';
import { RemarkInput } from '../models';

const noConnection = (): HttpErrorResponse => new HttpErrorResponse({ status: 0 });

describe('RemarkService', () => {
    let events: FakeEvents;
    let online: boolean;
    const api = { getHealth: vi.fn(), sendRemark: vi.fn() };

    const create = (): RemarkService => {
        TestBed.configureTestingModule({
            providers: [
                { provide: ApiService, useValue: api },
                { provide: EventsService, useValue: events },
                { provide: ShoppingStore, useValue: { pending: signal([{ catalogItemId: 1 }]) } },
                { provide: TranslateService, useValue: { currentLang: 'nl', instant: (key: string): string => key } }
            ]
        });
        const service = TestBed.inject(RemarkService);
        service.start();

        return service;
    };
    const send = (service: RemarkService, text = 'It is white on white'): RemarkDelivery | 'failed' => {
        let outcome: RemarkDelivery | 'failed' = 'failed';
        service.send('bug', text).subscribe({ next: (delivery) => (outcome = delivery), error: () => undefined });

        return outcome;
    };
    const queued = (): Array<RemarkInput> => JSON.parse(localStorage.getItem('remark-outbox') ?? '[]');
    const sentRemark = (call = 0): RemarkInput => api.sendRemark.mock.calls[call][0];

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        events = fakeEvents();
        online = true;
        vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
        api.getHealth.mockReturnValue(of({ status: 'ok', version: '1.1.40', commit: '5ed181e' }));
        api.sendRemark.mockReturnValue(of({ id: 1 }));
        window.location.hash = '#/list';
    });

    afterEach(() => vi.restoreAllMocks());

    it('opens a draft, with or without a part of the app, and closes it', () => {
        const service = create();
        service.write();
        expect(service.draft()).toEqual({ target: undefined });

        service.write({ text: 'Melk' });
        expect(service.draft()?.target).toEqual({ text: 'Melk' });

        service.cancel();
        expect(service.draft()).toBeUndefined();
    });

    it('switches pointing on, and off again once a part is picked or the user cancels', () => {
        const service = create();
        service.write();
        service.startPointing();
        expect([service.pointing(), service.draft()]).toEqual([true, undefined]);

        service.write({ text: 'Melk' });
        expect(service.pointing()).toBe(false);

        service.startPointing();
        service.cancel();
        expect(service.pointing()).toBe(false);
    });

    it('sends a remark with the page, the part pointed at, and facts about the device and the moment', () => {
        const service = create();
        TestBed.inject(ToastService).show({ kind: 'ok', text: 'Melk afgevinkt' });
        service.write({ component: 'app-item-tile', text: 'Melk' });

        expect(send(service, '  It is white on white ')).toBe('sent');

        const remark = sentRemark();
        expect([remark.kind, remark.text, remark.page]).toEqual(['bug', 'It is white on white', '#/list']);
        expect(remark.target).toEqual({ component: 'app-item-tile', text: 'Melk' });
        expect(remark.context).toEqual(
            expect.objectContaining({ version: '1.1.40', commit: '5ed181e', language: 'nl', theme: 'auto', online: true, waitingChanges: 1, recentMessages: ['Melk afgevinkt'] })
        );
        expect(remark.context?.viewport).toMatch(/^\d+ × \d+$/);
        expect(Date.parse(remark.writtenAt ?? '')).not.toBeNaN();
        expect(service.draft()).toBeUndefined();
    });

    it('keeps a remark when there is no connection, without asking the server', () => {
        online = false;
        const service = create();
        service.write();

        expect(send(service)).toBe('kept');
        expect(api.sendRemark).not.toHaveBeenCalled();
        expect(queued().map((remark) => remark.text)).toEqual(['It is white on white']);
        expect(service.waiting()).toBe(1);
    });

    it('keeps a remark when the connection drops while sending, but passes on a refusal by the server', () => {
        const service = create();
        api.sendRemark.mockReturnValue(throwError(noConnection));
        expect(send(service)).toBe('kept');

        api.sendRemark.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
        expect(send(service, 'second')).toBe('failed');
        expect(queued().length).toBe(1);
    });

    it('sends kept remarks in order when the connection is back, and says so', () => {
        online = false;
        const service = create();
        send(service, 'first');
        send(service, 'second');

        online = true;
        events.resumed.next();

        expect(api.sendRemark.mock.calls.map(([remark]) => remark.text)).toEqual(['first', 'second']);
        expect(queued()).toEqual([]);
        expect(service.waiting()).toBe(0);
        expect(TestBed.inject(ToastService).toasts().map((toast) => toast.text)).toEqual(['remark.sentLater']);
    });

    it('sends remarks kept by an earlier visit at start', () => {
        localStorage.setItem('remark-outbox', JSON.stringify([{ kind: 'note', text: 'from yesterday', page: '#/list' }]));
        create();

        expect(sentRemark().text).toBe('from yesterday');
        expect(queued()).toEqual([]);
    });

    it('keeps what still cannot be sent, and drops what the server refuses for good', () => {
        online = false;
        const service = create();
        send(service, 'refused');
        send(service, 'no connection');
        online = true;
        api.sendRemark.mockImplementation((remark: RemarkInput) => throwError(remark.text === 'refused' ? () => new HttpErrorResponse({ status: 400 }) : noConnection));

        window.dispatchEvent(new Event('online'));

        expect(queued().map((remark) => remark.text)).toEqual(['no connection']);
        expect(service.waiting()).toBe(1);
    });

    it('reads a broken queue as empty, and survives a browser that cannot store', () => {
        localStorage.setItem('remark-outbox', '{broken');
        online = false;
        const service = create();
        expect(service.waiting()).toBe(0);

        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        expect(send(service)).toBe('kept');
    });

    it('still sends without a version when the server did not say which one runs', () => {
        api.getHealth.mockReturnValue(throwError(noConnection));
        const service = create();
        send(service);

        expect(sentRemark().context?.version).toBeUndefined();
    });
});

describe('what was pointed at', () => {
    const inside = (html: string, selector: string): Element => {
        document.body.innerHTML = html;

        return document.querySelector(selector) as Element;
    };

    afterEach(() => (document.body.innerHTML = ''));

    it('describes the tile a tap landed in, not the icon inside it', () => {
        const icon = inside('<app-list-page><app-item-tile><button class="tile buy"><span class="icon"><img id="hit"></span><span class="name"> Melk\n halfvol </span></button></app-item-tile></app-list-page>', '#hit');

        expect(describeElement(icon)).toEqual({
            component: 'app-item-tile',
            text: 'Melk halfvol',
            path: 'app-list-page > app-item-tile > button.tile'
        });
    });

    it('takes the label of a button without text, and the placeholder of a field but never what was typed', () => {
        const button = inside('<app-shell><button id="hit" aria-label="Wissen"><i>close</i></button></app-shell>', '#hit');
        expect(describeElement(button).label).toBe('Wissen');

        const field = inside('<input id="hit" placeholder="Product toevoegen…" value="my secret">', '#hit');
        expect(describeElement(field).text).toBe('Product toevoegen…');
        expect(JSON.stringify(describeElement(field))).not.toContain('my secret');
    });

    it('cuts long texts, skips generated class names, and copes with a bare element', () => {
        const long = inside(`<div class="card"><p id="hit">${'x'.repeat(300)}</p></div>`, '#hit');
        expect(describeElement(long).text?.length).toBe(120);

        const generated = inside('<div class="ng-star-inserted page"><span id="hit"></span></div>', '#hit');
        expect(describeElement(generated)).toEqual({ path: 'div.page > span' });
    });

    it('knows a text field from anything else', () => {
        expect(isTextField(inside('<label><input id="hit"></label>', '#hit'))).toBe(true);
        expect(isTextField(inside('<textarea id="hit"></textarea>', '#hit'))).toBe(true);
        expect(isTextField(inside('<button id="hit"></button>', '#hit'))).toBe(false);
        expect(isTextField(null)).toBe(false);
    });
});

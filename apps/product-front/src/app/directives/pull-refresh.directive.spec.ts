import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PullRefreshDirective } from './pull-refresh.directive';

@Component({
    selector: 'app-host',
    standalone: true,
    imports: [PullRefreshDirective],
    template: '<div appPullRefresh (pulled)="count = count + 1"></div>'
})
class HostComponent {
    public count = 0;
}

describe('PullRefreshDirective', () => {
    const setup = (): { host: HostComponent; element: HTMLElement } => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();

        return { host: fixture.componentInstance, element: fixture.nativeElement.querySelector('div') as HTMLElement };
    };
    const touch = (element: HTMLElement, type: string, y?: number): void => {
        const event = new Event(type, { cancelable: true });
        Object.defineProperty(event, 'touches', {
            value: y === undefined ? [] : [{ clientY: y }]
        });
        element.dispatchEvent(event);
    };

    it('emits when pulled down far enough from the top', () => {
        const { host, element } = setup();

        touch(element, 'touchstart', 100);
        touch(element, 'touchmove', 300);
        touch(element, 'touchend');

        expect(host.count).toBe(1);
    });

    it('ignores a short pull', () => {
        const { host, element } = setup();

        touch(element, 'touchstart', 100);
        touch(element, 'touchmove', 150);
        touch(element, 'touchend');

        expect(host.count).toBe(0);
    });

    it('ignores a pull that starts while the page is scrolled down', () => {
        const { host, element } = setup();
        element.scrollTop = 50;
        Object.defineProperty(element, 'scrollTop', { configurable: true, value: 50 });

        touch(element, 'touchstart', 100);
        touch(element, 'touchmove', 400);
        touch(element, 'touchend');

        expect(host.count).toBe(0);
    });

    it('ignores a swipe upwards', () => {
        const { host, element } = setup();

        touch(element, 'touchstart', 400);
        touch(element, 'touchmove', 100);
        touch(element, 'touchend');

        expect(host.count).toBe(0);
    });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ChangelogPage } from './changelog.page';
import { click, texts } from '../../../testing/fakes';
import { Release } from '../../models';
import { ApiService } from '../../services/api.service';

const RELEASES: Array<Release> = [
    {
        version: '1.1.60',
        released: '2026-11-15T02:35:08+01:00',
        summary: 'Newest summary',
        notes: ['Newest summary', 'Earlier note']
    },
    { version: '1.1.57', released: '2026-11-15T02:28:18+01:00', summary: 'Older summary', notes: ['Older summary'] }
];

describe('ChangelogPage', () => {
    const api = { getChangelog: vi.fn() };

    const open = (): { fixture: ComponentFixture<ChangelogPage>; page: HTMLElement } => {
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [provideRouter([]), { provide: ApiService, useValue: api }]
        });
        const fixture = TestBed.createComponent(ChangelogPage);
        fixture.detectChanges();

        return { fixture, page: fixture.nativeElement as HTMLElement };
    };

    it('lists the releases with summary, version and date, their notes closed', () => {
        api.getChangelog.mockReturnValue(of(RELEASES));
        const { page } = open();

        expect(texts(page, '.head .font-semibold')).toEqual(['Newest summary', 'Older summary']);
        expect(texts(page, '.head .font-mono')).toEqual(['1.1.60', '1.1.57']);
        expect(page.querySelector('.notes')).toBeNull();
    });

    it('opens the notes of a release on a tap, one at a time, and closes them on a second tap', () => {
        api.getChangelog.mockReturnValue(of(RELEASES));
        const { fixture, page } = open();

        click(page, '.head', 0);
        fixture.detectChanges();
        expect(texts(page, '.notes li')).toEqual(['Newest summary', 'Earlier note']);

        click(page, '.head', 1);
        fixture.detectChanges();
        expect(texts(page, '.notes li')).toEqual(['Older summary']);

        click(page, '.head', 1);
        fixture.detectChanges();
        expect(page.querySelector('.notes')).toBeNull();
    });

    it('says so when there are no releases or the file cannot be loaded', () => {
        api.getChangelog.mockReturnValue(throwError(() => new Error('offline')));
        const { page } = open();

        expect(texts(page, '.empty')).toEqual(['changelog.empty']);
    });
});

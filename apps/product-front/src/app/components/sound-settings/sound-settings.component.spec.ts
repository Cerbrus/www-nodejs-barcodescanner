import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { click, texts } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { FeedbackSettings, SoundBlock } from '../../models';
import { ApiService } from '../../services/api.service';
import { SoundSettingsComponent } from './sound-settings.component';

const beep: Array<SoundBlock> = [{ kind: 'beep', ms: 80 }];
const SETTINGS: FeedbackSettings = {
    events: [
        { event: 'added', soundId: 'beep', steps: [] },
        { event: 'ignored', soundId: 'none', steps: [] }
    ],
    sounds: [
        { id: 'beep', blocks: beep, steps: [] },
        { id: 'a1b2c3d4', name: 'Fanfare', blocks: [{ kind: 'trill', ms: 500, rate: 12 }], steps: [] }
    ]
};

describe('SoundSettingsComponent', () => {
    let fixture: ComponentFixture<SoundSettingsComponent>;
    let page: HTMLElement;
    const api = {
        getFeedbackSettings: vi.fn(),
        setFeedbackSound: vi.fn(),
        testSound: vi.fn(() => of(undefined)),
        testSoundBlocks: vi.fn(() => of(undefined)),
        createSound: vi.fn(),
        changeSound: vi.fn(),
        deleteSound: vi.fn()
    };

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        api.getFeedbackSettings.mockReturnValue(of(SETTINGS));
        api.setFeedbackSound.mockImplementation((event: string, soundId: string) =>
            of({ ...SETTINGS, events: SETTINGS.events.map((row) => (row.event === event ? { ...row, soundId } : row)) })
        );
        TestBed.configureTestingModule({
            imports: [SoundSettingsComponent, TranslateTesting],
            providers: [{ provide: ApiService, useValue: api }]
        });
        fixture = TestBed.createComponent(SoundSettingsComponent);
        page = fixture.nativeElement as HTMLElement;
        await settle();
    });

    it('shows each event with its sound and a timeline, and the presets with their names', () => {
        expect(texts(page, '.row.event .text-xs')).toEqual(['sound.event.added', 'sound.event.ignored']);
        expect(texts(page, '.row.event .font-semibold')).toEqual(['sound.name.beep', 'sound.none']);
        expect(page.querySelectorAll('.row.event app-sound-timeline').length).toBe(1);
        expect(texts(page, '.row.preset .font-semibold')).toEqual(['sound.name.beep', 'Fanfare']);
    });

    it('plays a preset on request', () => {
        click(page, '.row.preset button[aria-label="sound.play"]', 1);

        expect(api.testSound).toHaveBeenCalledWith('a1b2c3d4');
    });

    it('picks another sound for an event in a popup, saves it and plays it, and marks the current one', async () => {
        click(page, '.row.event', 1);
        await settle();
        expect(texts(page, 'app-sheet .page-title')).toEqual(['sound.choose']);
        expect(texts(page, 'app-sheet .row.chosen .font-semibold')).toEqual(['sound.none']);
        expect(page.querySelectorAll('app-sheet .row.option .check').length).toBe(3);
        expect(page.querySelectorAll('app-sheet .row.option .check:not(.invisible)').length).toBe(1);

        click(page, 'app-sheet .row.option', 2);
        await settle();

        expect(api.setFeedbackSound).toHaveBeenCalledWith('ignored', 'a1b2c3d4');
        expect(api.testSound).toHaveBeenCalledWith('a1b2c3d4');
        expect(page.querySelector('app-sheet')).toBeNull();
        expect(texts(page, '.row.event .font-semibold')[1]).toBe('Fanfare');
    });

    it('saves "no sound" without playing', async () => {
        click(page, '.row.event', 0);
        await settle();
        click(page, 'app-sheet .row.option', 0);
        await settle();

        expect(api.setFeedbackSound).toHaveBeenCalledWith('added', 'none');
        expect(api.testSound).not.toHaveBeenCalled();
    });

    it('makes a new sound from the popup of an event and gives it to that event', async () => {
        const created: FeedbackSettings = {
            ...SETTINGS,
            sounds: [...SETTINGS.sounds, { id: 'new12345', name: 'Toeter', blocks: beep, steps: [] }]
        };
        api.createSound.mockReturnValue(of(created));
        click(page, '.row.event', 0);
        await settle();
        click(page, 'app-sheet button.new');
        await settle();

        const name = page.querySelector('#sound-name') as HTMLInputElement;
        name.value = 'Toeter';
        name.dispatchEvent(new Event('input'));
        await settle();
        click(page, 'app-sound-editor button.save');
        await settle();

        expect(api.createSound).toHaveBeenCalledWith('Toeter', [{ kind: 'beep', ms: 100 }]);
        expect(api.setFeedbackSound).toHaveBeenCalledWith('added', 'new12345');
        expect(page.querySelector('app-sound-editor')).toBeNull();
    });

    it('opens a preset for editing, and knows whether it is in use', async () => {
        click(page, '.row.preset button[aria-label="sound.edit"]', 0);
        await settle();

        expect((page.querySelector('#sound-name') as HTMLInputElement).value).toBe('sound.name.beep');
        expect(texts(page, 'app-sound-editor button.danger')).toEqual(['delete sound.inUse']);
    });
});

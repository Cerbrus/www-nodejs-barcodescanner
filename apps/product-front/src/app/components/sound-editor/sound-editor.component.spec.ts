import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { click, texts, type } from '../../../testing/fakes';
import { TranslateTesting } from '../../../testing/translate';
import { FeedbackSettings, Sound } from '../../models';
import { ApiService } from '../../services/api.service';
import { SoundEditorComponent, SoundSaved } from './sound-editor.component';

const DOUBLE: Sound = {
    id: 'double',
    blocks: [
        { kind: 'beep', ms: 60 },
        { kind: 'pause', ms: 70 },
        { kind: 'beep', ms: 60 }
    ],
    steps: []
};
const SETTINGS: FeedbackSettings = { events: [], sounds: [{ id: 'made1234', name: 'Nieuw', blocks: [], steps: [] }] };

describe('SoundEditorComponent', () => {
    let fixture: ComponentFixture<SoundEditorComponent>;
    let page: HTMLElement;
    const saved: Array<SoundSaved> = [];
    const api = {
        testSoundBlocks: vi.fn(() => of(undefined)),
        createSound: vi.fn(() => of(SETTINGS)),
        changeSound: vi.fn(() => of(SETTINGS)),
        deleteSound: vi.fn(() => of(SETTINGS))
    };

    const settle = async (): Promise<void> => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };
    const open = async (sound?: Sound, shownName = '', inUse = false): Promise<void> => {
        fixture = TestBed.createComponent(SoundEditorComponent);
        fixture.componentRef.setInput('sound', sound);
        fixture.componentRef.setInput('shownName', shownName);
        fixture.componentRef.setInput('inUse', inUse);
        fixture.componentInstance.saved.subscribe((event) => saved.push(event));
        page = fixture.nativeElement as HTMLElement;
        await settle();
    };
    const slide = async (index: number, value: number): Promise<void> => {
        const slider = page.querySelectorAll('input[type=range]')[index] as HTMLInputElement;
        slider.value = String(value);
        slider.dispatchEvent(new Event('input'));
        await settle();
    };
    const button = (selector: string): HTMLButtonElement => page.querySelector(selector) as HTMLButtonElement;

    beforeEach(() => {
        vi.clearAllMocks();
        saved.length = 0;
        TestBed.configureTestingModule({
            imports: [SoundEditorComponent, TranslateTesting],
            providers: [{ provide: ApiService, useValue: api }]
        });
    });

    it('shows the blocks of a preset with their kind, duration and the total', async () => {
        await open(DOUBLE, 'Twee tikken');

        expect((page.querySelector('#sound-name') as HTMLInputElement).value).toBe('Twee tikken');
        expect(
            Array.from(page.querySelectorAll('.block select'), (select) => (select as HTMLSelectElement).value)
        ).toEqual(['beep', 'pause', 'beep']);
        expect(page.querySelectorAll('input[type=range]').length).toBe(3);
        expect(texts(page, '.text-xs')).toEqual(['sound.total']);
    });

    it('changes, adds, moves and removes blocks, in steps of duration, with a speed only for trills and buzzes', async () => {
        await open(DOUBLE, 'Twee tikken');
        await slide(0, 14);
        const kind = page.querySelectorAll('.block select')[2] as HTMLSelectElement;
        kind.value = 'trill';
        kind.dispatchEvent(new Event('change'));
        await settle();
        expect(page.querySelectorAll('input[type=range]').length).toBe(4);
        await slide(3, 30);

        click(page, 'button.add', 3);
        await settle();
        click(page, 'button[aria-label="sound.moveUp"]', 3);
        await settle();
        click(page, 'button[aria-label="sound.remove"]', 1);
        await settle();
        click(page, 'button.play');

        expect(api.testSoundBlocks).toHaveBeenCalledWith([
            { kind: 'beep', ms: 200 },
            { kind: 'buzz', ms: 300, rate: 400 },
            { kind: 'trill', ms: 60, rate: 30 }
        ]);
    });

    it('refuses a sound that is too long or makes no sound, and says why', async () => {
        await open(DOUBLE, 'Twee tikken');
        await slide(0, 30);

        expect(texts(page, 'p.problem')).toEqual(['sound.tooLong']);
        expect(button('button.save').disabled).toBe(true);
        expect(button('button.play').disabled).toBe(true);

        await slide(0, 5);
        click(page, 'button[aria-label="sound.remove"]', 2);
        await settle();
        click(page, 'button[aria-label="sound.remove"]', 0);
        await settle();

        expect(texts(page, 'p.problem')).toEqual(['sound.needsSound']);
    });

    it('keeps the translated name of a starting preset unless it is changed', async () => {
        await open(DOUBLE, 'Twee tikken');
        click(page, 'button.save');
        await settle();
        type(page, '#sound-name', 'Dubbel');
        await settle();
        click(page, 'button.save');
        await settle();

        expect(api.changeSound.mock.calls).toEqual([
            ['double', undefined, DOUBLE.blocks],
            ['double', 'Dubbel', DOUBLE.blocks]
        ]);
        expect(saved[0]).toEqual({ settings: SETTINGS, soundId: undefined });
    });

    it('saves a copy as a new sound and tells which one was made', async () => {
        await open(DOUBLE, 'Twee tikken');
        click(page, 'button.save-new');
        await settle();

        expect(api.createSound).toHaveBeenCalledWith('Twee tikken', DOUBLE.blocks);
        expect(saved[0].soundId).toBe('made1234');
    });

    it('needs a name for a new sound, and has no copy or delete', async () => {
        await open();

        expect(button('button.save').disabled).toBe(true);
        expect(page.querySelector('button.save-new')).toBeNull();
        expect(page.querySelector('button.danger')).toBeNull();

        type(page, '#sound-name', 'Toeter');
        await settle();
        expect(button('button.save').disabled).toBe(false);
    });

    it('deletes a sound that is not in use, and cannot delete one that is', async () => {
        await open(DOUBLE, 'Twee tikken', true);
        expect(button('button.danger').disabled).toBe(true);

        fixture.componentRef.setInput('inUse', false);
        await settle();
        click(page, 'button.danger');
        await settle();

        expect(api.deleteSound).toHaveBeenCalledWith('double');
        expect(saved.length).toBe(1);
    });
});

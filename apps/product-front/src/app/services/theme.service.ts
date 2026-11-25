import { Injectable, computed, signal } from '@angular/core';

import { seasonSkin } from '../season';
import { SKINS, Skin } from '../skins';

export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const THEME_STORAGE_KEY = 'theme';
const SKIN_STORAGE_KEY = 'skin';
const SEASONAL_STORAGE_KEY = 'seasonal';
const SHOWN_SKIN_STORAGE_KEY = 'shownSkin';
const SEASONAL_ON = 'on';
const SEASONAL_OFF = 'off';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    public readonly theme = signal<Theme>(this.storedTheme());
    public readonly skin = signal<Skin>(this.storedSkin());
    public readonly seasonal = signal(localStorage.getItem(SEASONAL_STORAGE_KEY) === SEASONAL_ON);

    private readonly now = signal(new Date());

    public readonly season = computed(() => (this.seasonal() ? seasonSkin(this.now()) : undefined));
    public readonly shown = computed(() => this.season() ?? this.skin());

    constructor() {
        this.apply();
        window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => this.paintBrowserBar());
        document.addEventListener('visibilitychange', () => this.lookAtTheDate());
    }

    public use(theme: Theme): void {
        this.theme.set(theme);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        this.apply();
    }

    public useSkin(skin: Skin): void {
        this.skin.set(skin);
        localStorage.setItem(SKIN_STORAGE_KEY, skin);
        this.apply();
    }

    public useSeasonal(seasonal: boolean): void {
        this.seasonal.set(seasonal);
        localStorage.setItem(SEASONAL_STORAGE_KEY, seasonal ? SEASONAL_ON : SEASONAL_OFF);
        this.apply();
    }

    private lookAtTheDate(): void {
        this.now.set(new Date());
        this.apply();
    }

    private storedTheme(): Theme {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        return THEMES.find((theme) => theme === stored) ?? 'auto';
    }

    private storedSkin(): Skin {
        const stored = localStorage.getItem(SKIN_STORAGE_KEY);
        return SKINS.find((skin) => skin === stored) ?? 'default';
    }

    private apply(): void {
        const settings = document.documentElement.dataset;
        const theme = this.theme();
        const skin = this.shown();

        if (theme === 'auto') {
            delete settings['theme'];
        } else {
            settings['theme'] = theme;
        }

        if (skin === 'default') {
            delete settings['skin'];
        } else {
            settings['skin'] = skin;
        }

        this.rememberShown(skin);
        this.paintBrowserBar();
    }

    private rememberShown(skin: Skin): void {
        try {
            if (localStorage.getItem(SHOWN_SKIN_STORAGE_KEY) !== skin) {
                localStorage.setItem(SHOWN_SKIN_STORAGE_KEY, skin);
            }
        } catch {
            return;
        }
    }

    private paintBrowserBar(): void {
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

        if (accent) {
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', accent);
        }
    }
}

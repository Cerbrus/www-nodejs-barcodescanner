import { Injectable, signal } from '@angular/core';

export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const THEME_STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    public readonly theme = signal<Theme>(this.stored());

    constructor() {
        this.apply(this.theme());
    }

    public use(theme: Theme): void {
        this.theme.set(theme);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        this.apply(theme);
    }

    private stored(): Theme {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        return THEMES.find((theme) => theme === stored) ?? 'auto';
    }

    private apply(theme: Theme): void {
        if (theme === 'auto') {
            delete document.documentElement.dataset['theme'];
        } else {
            document.documentElement.dataset['theme'] = theme;
        }
    }
}

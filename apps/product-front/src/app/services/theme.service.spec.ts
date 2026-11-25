import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { TestBed } from '@angular/core/testing';

import { SKINS, SKIN_GROUPS } from '../skins';
import { ThemeService } from './theme.service';

const SOURCE_FOLDER = join(process.cwd(), 'apps/product-front/src');
const SKIN_RULE = /:root\[data-skin='([a-z]+)'\] \{([^}]*)\}/g;
const SHARED_FILES = ['comic-shape.css'];
const BOOT_SCRIPT_SKIN = "localStorage.getItem('shownSkin') || localStorage.getItem('skin')";
const BOOT_RULE = /html\[data-skin='([a-z]+)'\] \{([^}]*)\}/g;
const SKIN_COLOUR = /--(page|surface|line): ([^;]+);/g;
const BOOT_COLOUR = /--boot-(page|surface|line): ([^;]+);/g;

function source(file: string): string {
    return readFileSync(join(SOURCE_FOLDER, file), 'utf-8');
}

function colours(content: string, rule: RegExp, colour: RegExp): Record<string, Record<string, string>> {
    return Object.fromEntries(
        Array.from(content.matchAll(rule), ([, skin, body]) => [
            skin,
            Object.fromEntries(Array.from(body.matchAll(colour), ([, name, value]) => [name, value]))
        ])
    );
}

describe('ThemeService', () => {
    const root = document.documentElement;
    const browserBar = (): string | null =>
        document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;

    beforeEach(() => {
        localStorage.clear();
        delete root.dataset['theme'];
        delete root.dataset['skin'];
        root.style.removeProperty('--accent');
        document.querySelector('meta[name="theme-color"]')?.remove();
    });

    it('starts with the remembered theme, and with the standard one when the stored value is unknown', () => {
        localStorage.setItem('skin', 'comic');
        expect(TestBed.inject(ThemeService).skin()).toBe('comic');
        expect(root.dataset['skin']).toBe('comic');

        TestBed.resetTestingModule();
        localStorage.setItem('skin', 'purple');
        delete root.dataset['skin'];

        expect(TestBed.inject(ThemeService).skin()).toBe('default');
        expect(root.dataset['skin']).toBeUndefined();
    });

    it('applies a chosen theme beside light or dark, remembers it, and drops it for the standard one', () => {
        const service = TestBed.inject(ThemeService);

        service.use('dark');
        service.useSkin('console');

        expect([root.dataset['theme'], root.dataset['skin']]).toEqual(['dark', 'console']);
        expect([localStorage.getItem('theme'), localStorage.getItem('skin')]).toEqual(['dark', 'console']);

        service.useSkin('default');

        expect([root.dataset['theme'], root.dataset['skin']]).toEqual(['dark', undefined]);
        expect(localStorage.getItem('skin')).toBe('default');
    });

    it('shows the theme of the season instead of the chosen one, and the chosen one again when the season is over', () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 11, 26, 23) });
        localStorage.setItem('skin', 'tron');
        localStorage.setItem('seasonal', 'on');
        const service = TestBed.inject(ThemeService);

        expect([service.skin(), service.season(), service.shown()]).toEqual(['tron', 'christmas', 'christmas']);
        expect([root.dataset['skin'], localStorage.getItem('shownSkin')]).toEqual(['christmas', 'christmas']);

        service.useSkin('neon');

        expect([root.dataset['skin'], localStorage.getItem('skin')]).toEqual(['christmas', 'neon']);

        vi.setSystemTime(new Date(2026, 11, 27, 9));
        document.dispatchEvent(new Event('visibilitychange'));

        expect([service.season(), service.shown()]).toEqual([undefined, 'neon']);
        expect([root.dataset['skin'], localStorage.getItem('shownSkin')]).toEqual(['neon', 'neon']);
        vi.useRealTimers();
    });

    it('leaves the seasons alone while the seasonal switch is off', () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 31, 12) });
        const service = TestBed.inject(ThemeService);

        expect([service.season(), root.dataset['skin']]).toEqual([undefined, undefined]);

        service.useSeasonal(true);

        expect([service.season(), root.dataset['skin']]).toEqual(['halloween', 'halloween']);
        vi.useRealTimers();
    });

    it("paints the browser's bar in the accent colour of the theme", () => {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#0f766e';
        document.head.append(meta);
        const service = TestBed.inject(ThemeService);

        expect(browserBar()).toBe('#0f766e');

        root.style.setProperty('--accent', 'rgb(51, 255, 102)');
        service.useSkin('console');

        expect(browserBar()).toBe('rgb(51, 255, 102)');
    });

    it('has a file of its own with its colours, a name in both languages and start colours for every theme', () => {
        const named = SKINS.filter((skin) => skin !== 'default');
        const files = readdirSync(join(SOURCE_FOLDER, 'themes')).filter((file) => !SHARED_FILES.includes(file));
        const styled: Record<string, Record<string, string>> = Object.assign(
            {},
            ...files.map((file) => colours(source(`themes/${file}`), SKIN_RULE, SKIN_COLOUR))
        );
        const booted = colours(source('index.html'), BOOT_RULE, BOOT_COLOUR);

        expect(files.sort()).toEqual(named.map((skin) => `${skin}.css`).sort());
        expect(Object.keys(styled).sort()).toEqual([...named].sort());
        expect(booted).toEqual(styled);
        expect(source('index.html')).toContain(BOOT_SCRIPT_SKIN);

        for (const language of ['en', 'nl']) {
            const texts = JSON.parse(source(`assets/i18n/${language}.json`)) as Record<
                'skin' | 'skinGroup',
                Record<string, string>
            >;

            expect(Object.keys(texts.skin)).toEqual([...SKINS]);
            expect(Object.keys(texts.skinGroup)).toEqual(SKIN_GROUPS.map((group) => group.name));
        }
    });
});

export const SKIN_GROUPS = [
    { name: 'basic', skins: ['default', 'contrast'] },
    { name: 'editors', skins: ['darcula', 'solarized', 'nord'] },
    { name: 'shops', skins: ['ah', 'jumbo'] },
    { name: 'screens', skins: ['console', 'neon', 'tron', 'synthwave', 'gameboy', 'commodore', 'lcd', 'windows'] },
    { name: 'paper', skins: ['receipt', 'comic', 'ink', 'blueprint', 'newspaper', 'chalkboard', 'sticky'] },
    { name: 'decades', skins: ['sixties', 'seventies', 'memphis'] },
    { name: 'season', skins: ['koningsdag', 'easter', 'pride', 'halloween', 'sinterklaas', 'christmas'] }
] as const;
export type Skin = (typeof SKIN_GROUPS)[number]['skins'][number];

export const SKINS: ReadonlyArray<Skin> = SKIN_GROUPS.flatMap((group): ReadonlyArray<Skin> => group.skins);

export const BLOCK_KINDS = ['beep', 'pause', 'trill', 'buzz'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export interface SoundBlock {
    kind: BlockKind;
    ms: number;
    rate?: number;
}

export interface SoundStep {
    kind: 'on' | 'off' | 'gate';
    seconds: number;
    hz?: number;
    duty?: number;
}

export interface Sound {
    id: string;
    name?: string;
    blocks: Array<SoundBlock>;
    steps: Array<SoundStep>;
}

export const MAX_SOUND_MILLISECONDS = 1000;
export const SOUND_RATES = { trill: { min: 4, max: 40, step: 1 }, buzz: { min: 100, max: 1000, step: 50 } };

export type ListState = 'to_buy' | 'recent';
export type ScanSource = 'handheld' | 'phone';
export type ScanResult = 'added' | 'incremented' | 'needs_name' | 'ignored';

export const BLOCK_KINDS = ['beep', 'pause', 'trill', 'buzz'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export interface SoundBlock {
    kind: BlockKind;
    ms: number;
    rate?: number;
}

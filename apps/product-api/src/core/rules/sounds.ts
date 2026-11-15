import { BLOCK_KINDS, SoundBlock } from '../../data/entities';

export { BLOCK_KINDS, SoundBlock };

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

export const FEEDBACK_EVENTS = ['added', 'incremented', 'needs_name', 'ignored', 'held', 'error', 'updated'] as const;
export type FeedbackEvent = (typeof FEEDBACK_EVENTS)[number];

export const NO_SOUND = 'none';
export const MAX_MILLISECONDS = 1000;
export const MIN_BLOCK_MILLISECONDS = 10;
export const MAX_BLOCKS = MAX_MILLISECONDS / MIN_BLOCK_MILLISECONDS;
export const MAX_NAME_LENGTH = 40;
export const RATES: Record<'trill' | 'buzz', { min: number; max: number }> = {
    trill: { min: 4, max: 40 },
    buzz: { min: 100, max: 1000 }
};

const GATE_DUTY = 50;

export const DEFAULT_SOUND_IDS: Record<FeedbackEvent, string> = {
    added: 'beep',
    incremented: 'double',
    needs_name: 'long',
    ignored: NO_SOUND,
    held: 'longShort',
    error: 'triple',
    updated: 'shortShortLong'
};

function blockProblem(block: SoundBlock, index: number): string | undefined {
    const at = `block ${index + 1}`;
    if (!BLOCK_KINDS.includes(block.kind)) {
        return `${at} has an unknown kind`;
    }
    if (!Number.isInteger(block.ms) || block.ms < MIN_BLOCK_MILLISECONDS || block.ms % MIN_BLOCK_MILLISECONDS) {
        return `${at} must last a whole number of ${MIN_BLOCK_MILLISECONDS} ms steps`;
    }
    if (block.kind === 'trill' || block.kind === 'buzz') {
        const { min, max } = RATES[block.kind];
        if (!Number.isInteger(block.rate) || (block.rate ?? 0) < min || (block.rate ?? 0) > max) {
            return `${at} needs a rate from ${min} to ${max} a second`;
        }
    }

    return undefined;
}

export function soundProblem(blocks: Array<SoundBlock>): string | undefined {
    if (!blocks.some((block) => block.kind !== 'pause')) {
        return 'a sound needs at least one block that makes sound';
    }
    if (blocks.length > MAX_BLOCKS) {
        return `a sound has at most ${MAX_BLOCKS} blocks`;
    }
    if (blocks.reduce((total, block) => total + block.ms, 0) > MAX_MILLISECONDS) {
        return `a sound lasts at most ${MAX_MILLISECONDS} ms`;
    }

    return blocks.map(blockProblem).find((problem) => problem);
}

export function toSteps(blocks: Array<SoundBlock>): Array<SoundStep> {
    return blocks.map(({ kind, ms, rate }): SoundStep => {
        const seconds = ms / 1000;
        if (kind === 'beep') {
            return { kind: 'on', seconds };
        }
        if (kind === 'pause') {
            return { kind: 'off', seconds };
        }

        return { kind: 'gate', hz: rate, duty: GATE_DUTY, seconds };
    });
}

export function cleanBlocks(blocks: Array<SoundBlock>): Array<SoundBlock> {
    return blocks.map(({ kind, ms, rate }) =>
        kind === 'trill' || kind === 'buzz' ? { kind, ms, rate } : { kind, ms }
    );
}

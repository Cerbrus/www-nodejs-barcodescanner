import { BLOCK_KINDS, MAX_SOUND_MILLISECONDS, SOUND_RATES, SoundBlock, SoundStep } from '@barcodescanner/shared';

export const FEEDBACK_EVENTS = [
    'added',
    'incremented',
    'collected',
    'not_on_list',
    'needs_name',
    'ignored',
    'held',
    'error',
    'updated'
] as const;
export type FeedbackEvent = (typeof FEEDBACK_EVENTS)[number];

export const NO_SOUND = 'none';
export const MIN_BLOCK_MILLISECONDS = 10;
export const MAX_BLOCKS = MAX_SOUND_MILLISECONDS / MIN_BLOCK_MILLISECONDS;
export const MAX_NAME_LENGTH = 40;
const GATE_DUTY = 50;

export const DEFAULT_SOUND_IDS: Record<FeedbackEvent, string> = {
    added: 'beep',
    incremented: 'double',
    collected: 'blip',
    not_on_list: 'longShort',
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
        const { min, max } = SOUND_RATES[block.kind];
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
    if (blocks.reduce((total, block) => total + block.ms, 0) > MAX_SOUND_MILLISECONDS) {
        return `a sound lasts at most ${MAX_SOUND_MILLISECONDS} ms`;
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

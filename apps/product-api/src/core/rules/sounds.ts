export interface SoundStep {
    kind: 'on' | 'off' | 'gate';
    seconds: number;
    hz?: number;
    duty?: number;
}

export interface Sound {
    id: string;
    steps: Array<SoundStep>;
}

export const FEEDBACK_EVENTS = ['added', 'incremented', 'needs_name', 'ignored', 'error'] as const;
export type FeedbackEvent = (typeof FEEDBACK_EVENTS)[number];

export const NO_SOUND = 'none';

const BLIP = 0.06;
const GAP = 0.07;

const on = (seconds: number): SoundStep => ({ kind: 'on', seconds });
const off = (seconds: number): SoundStep => ({ kind: 'off', seconds });
const gate = (hz: number, seconds: number, duty = 50): SoundStep => ({ kind: 'gate', hz, duty, seconds });

export const SOUNDS: Array<Sound> = [
    { id: 'tick', steps: [on(0.02)] },
    { id: 'blip', steps: [on(0.05)] },
    { id: 'beep', steps: [on(0.08)] },
    { id: 'clean', steps: [on(0.25)] },
    { id: 'long', steps: [on(0.45)] },
    { id: 'longer', steps: [on(0.8)] },
    { id: 'double', steps: [on(BLIP), off(GAP), on(BLIP)] },
    { id: 'triple', steps: [on(0.08), off(GAP), on(0.08), off(GAP), on(0.08)] },
    { id: 'shortShortLong', steps: [on(BLIP), off(BLIP), on(BLIP), off(BLIP), on(0.3)] },
    { id: 'longShort', steps: [on(0.3), off(BLIP), on(BLIP)] },
    { id: 'trill8', steps: [gate(8, 0.9)] },
    { id: 'trill15', steps: [gate(15, 0.9)] },
    { id: 'trill30', steps: [gate(30, 0.9)] },
    { id: 'shortTrill', steps: [gate(20, 0.3)] },
    { id: 'blipThenTrill', steps: [on(BLIP), off(GAP), gate(20, 0.4)] },
    { id: 'rough200', steps: [gate(200, 0.6)] },
    { id: 'rough500', steps: [gate(500, 0.6)] },
    { id: 'rough1000', steps: [gate(1000, 0.6)] },
    { id: 'shortRough', steps: [gate(300, 0.15)] },
    { id: 'soft20', steps: [gate(2000, 0.6, 20)] },
    { id: 'soft5', steps: [gate(2000, 0.6, 5)] },
    { id: 'softBlip', steps: [gate(2000, 0.08, 15)] }
];

export const DEFAULT_SOUND_IDS: Record<FeedbackEvent, string> = {
    added: 'beep',
    incremented: 'double',
    needs_name: 'long',
    ignored: NO_SOUND,
    error: 'triple'
};

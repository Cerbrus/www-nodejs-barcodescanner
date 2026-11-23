import {
    IssueDraft,
    IssueOptions,
    IssueProgress,
    IssueStage,
    RemarkContext,
    RemarkKind,
    RemarkTarget
} from '@barcodescanner/shared';

export const REMARK_STATES = ['open', 'closed'] as const;
export type RemarkState = (typeof REMARK_STATES)[number];
export const REJECTED_STATE = 'rejected';

export const MAX_REMARK_TEXT_LENGTH = 2000;
export const MAX_REMARKS_PER_HOUR = 30;
export const INVESTIGATE_LABEL = 'investigate';

export interface RemarkContent {
    id: number;
    kind: RemarkKind;
    text: string;
    page: string;
    target?: RemarkTarget | null;
    context?: RemarkContext | null;
    account: string;
}

export interface IssueSnapshot {
    state: 'open' | 'closed';
    labels: Array<string>;
    pullRequests: Array<{ number: number; title: string; url: string; state: 'open' | 'closed'; merged: boolean }>;
}

const MAX_FIELD_LENGTH = 300;
const MAX_MESSAGES = 5;
const MAX_TITLE_LENGTH = 80;
const TARGET_FIELDS = ['component', 'label', 'text', 'path'] as const;
const CONTEXT_TEXT_FIELDS = ['version', 'commit', 'userAgent', 'viewport', 'language', 'theme'] as const;
const CONTEXT_FLAG_FIELDS = ['installed', 'online'] as const;
const AUTHORITY =
    'Sent to GitHub by the owner (admin) of this app. It is his decision that this is to be done, not a suggestion: implement it unless a real question is open.';
const HEADING: Record<RemarkKind, string> = { bug: 'What happened', wish: 'What is wished', note: 'Note' };
const LABEL: Record<RemarkKind, Array<string>> = { bug: ['bug'], wish: ['enhancement'], note: [] };

const VERDICT_STAGES: Record<string, IssueStage> = {
    'agent: needs answers': 'needsAnswers',
    'agent: too large': 'tooLarge',
    'agent: not possible': 'notPossible',
    [INVESTIGATE_LABEL]: 'investigating'
};

const cut = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim()
        ? value.trim().replace(/\s+/g, ' ').slice(0, MAX_FIELD_LENGTH)
        : undefined;
const fields = (source: unknown): Record<string, unknown> =>
    typeof source === 'object' && source !== null && !Array.isArray(source) ? (source as Record<string, unknown>) : {};
const withoutEmpty = <T extends object>(value: T): T =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

export function cleanTarget(source: unknown): RemarkTarget | undefined {
    const given = fields(source);
    const target = withoutEmpty(
        Object.fromEntries(TARGET_FIELDS.map((name) => [name, cut(given[name])])) as RemarkTarget
    );

    return Object.keys(target).length ? target : undefined;
}

export function cleanContext(source: unknown): RemarkContext {
    const given = fields(source);
    const messages = Array.isArray(given['recentMessages'])
        ? given['recentMessages'].map(cut).filter((message): message is string => message !== undefined)
        : [];
    const waiting = given['waitingChanges'];

    return withoutEmpty({
        ...(Object.fromEntries(CONTEXT_TEXT_FIELDS.map((name) => [name, cut(given[name])])) as RemarkContext),
        ...(Object.fromEntries(
            CONTEXT_FLAG_FIELDS.map((name) => [name, typeof given[name] === 'boolean' ? given[name] : undefined])
        ) as RemarkContext),
        waitingChanges: typeof waiting === 'number' && Number.isInteger(waiting) && waiting >= 0 ? waiting : undefined,
        recentMessages: messages.length ? messages.slice(-MAX_MESSAGES) : undefined
    });
}

export function tooManyRemarks(writtenInTheLastHour: number): boolean {
    return writtenInTheLastHour >= MAX_REMARKS_PER_HOUR;
}

export function issueFromRemark(remark: RemarkContent, options: IssueOptions): IssueDraft {
    const firstLine = remark.text.trim().split(/\r?\n/)[0];
    const title = firstLine.length > MAX_TITLE_LENGTH ? `${firstLine.slice(0, MAX_TITLE_LENGTH - 1)}…` : firstLine;
    const context = remark.context ?? {};
    const sections = [
        section(HEADING[remark.kind], [remark.text.trim()]),
        section('Where in the app', whereLines(remark)),
        section('Version', [
            [context.version, context.commit ? `(${context.commit})` : undefined].filter(Boolean).join(' ') || 'unknown'
        ])
    ];

    if (options.includeDevice) {
        sections.push(section('Device', deviceLines(context)));
    }
    if (options.includeAccount) {
        sections.push(section('Sent by', [remark.account]));
    }
    sections.push(section('Authority', [AUTHORITY]));
    sections.push(`_Sent from the app as remark ${remark.id}._`);

    return {
        title,
        body: sections.join('\n\n'),
        labels: [...LABEL[remark.kind], ...(options.investigate ? [INVESTIGATE_LABEL] : [])]
    };
}

export function isFinalStage(stage: IssueStage): boolean {
    return stage === 'live' || stage === 'closed';
}

export function parseVersion(version: string): Array<number> | undefined {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);

    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

export function compareVersions(first: string, second: string): number {
    const [a, b] = [parseVersion(first) ?? [], parseVersion(second) ?? []];

    return a.reduce((difference, part, index) => difference || part - (b[index] ?? 0), 0);
}

export function withRelease(progress: IssueProgress, version: string | undefined, running: string): IssueProgress {
    if (progress.stage !== 'merged' || !version) {
        return progress;
    }
    const live = parseVersion(running) !== undefined && compareVersions(running, version) >= 0;

    return { ...progress, stage: live ? 'live' : 'released', version };
}

export function progressOfIssue(issue: IssueSnapshot): IssueProgress {
    const merged = issue.pullRequests.filter((pull) => pull.merged).at(-1);
    const open = issue.pullRequests.filter((pull) => pull.state === 'open').at(-1);
    const shown = (pull?: IssueSnapshot['pullRequests'][number]): IssueProgress['pullRequest'] =>
        pull ? { number: pull.number, title: pull.title, url: pull.url } : undefined;

    if (issue.state === 'closed') {
        return withoutEmpty({ stage: merged ? 'merged' : 'closed', pullRequest: shown(merged) });
    }
    if (open) {
        return { stage: 'review', pullRequest: shown(open) };
    }
    const verdict = issue.labels.map((label) => VERDICT_STAGES[label]).find(Boolean);

    return { stage: verdict ?? 'sent' };
}

function section(heading: string, lines: Array<string>): string {
    return `### ${heading}\n\n${lines.join('\n')}`;
}

function whereLines(remark: RemarkContent): Array<string> {
    const target = remark.target ?? {};

    return [
        `- Page: \`${remark.page || 'unknown'}\``,
        ...(target.label ? [`- Pointed at: ${target.label}`] : []),
        ...(target.text ? [`- Its text: "${target.text}"`] : []),
        ...(target.component ? [`- Component: \`${target.component}\``] : []),
        ...(target.path ? [`- Path: \`${target.path}\``] : [])
    ];
}

function deviceLines(context: RemarkContext): Array<string> {
    const lines = [
        context.userAgent ? `- Browser: ${context.userAgent}` : undefined,
        context.viewport ? `- Viewport: ${context.viewport}` : undefined,
        context.installed === undefined ? undefined : `- Installed as app: ${context.installed ? 'yes' : 'no'}`,
        context.language ? `- Language: ${context.language}` : undefined,
        context.theme ? `- Appearance: ${context.theme}` : undefined,
        context.online === undefined ? undefined : `- Connected: ${context.online ? 'yes' : 'no'}`,
        context.waitingChanges ? `- Changes waiting: ${context.waitingChanges}` : undefined,
        ...(context.recentMessages ?? []).map((message) => `- Message on screen: "${message}"`)
    ].filter((line): line is string => line !== undefined);

    return lines.length ? lines : ['- unknown'];
}

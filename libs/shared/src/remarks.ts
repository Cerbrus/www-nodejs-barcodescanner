export const REMARK_KINDS = ['wish', 'bug', 'note'] as const;
export type RemarkKind = (typeof REMARK_KINDS)[number];

export interface RemarkTarget {
    component?: string;
    label?: string;
    text?: string;
    path?: string;
}

export interface RemarkContext {
    version?: string;
    commit?: string;
    userAgent?: string;
    viewport?: string;
    language?: string;
    theme?: string;
    installed?: boolean;
    online?: boolean;
    waitingChanges?: number;
    recentMessages?: Array<string>;
}

export type IssueStage =
    | 'sent'
    | 'investigating'
    | 'needsAnswers'
    | 'tooLarge'
    | 'notPossible'
    | 'notABug'
    | 'review'
    | 'merged'
    | 'released'
    | 'live'
    | 'closed';

export interface IssueProgress {
    stage: IssueStage;
    pullRequest?: { number: number; title: string; url: string };
    version?: string;
}

export interface IssueOptions {
    includeDevice: boolean;
    includeAccount: boolean;
    investigate: boolean;
}

export interface IssueDraft {
    title: string;
    body: string;
    labels: Array<string>;
}

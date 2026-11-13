import { createHash } from 'crypto';

export type ContentPolicyMode = 'off' | 'report' | 'enforce';

export interface PolicyReport {
    directive: string;
    blocked: string;
    page: string;
}

const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const MAX_FIELD_LENGTH = 200;
const FONT_STYLES = 'https://fonts.googleapis.com';
const FONT_FILES = 'https://fonts.gstatic.com';

export function contentPolicyMode(value?: string): ContentPolicyMode {
    return value === 'off' || value === 'enforce' ? value : 'report';
}

export function inlineScriptHashes(html: string): Array<string> {
    return Array.from(html.matchAll(INLINE_SCRIPT), ([, script]) => `'sha256-${createHash('sha256').update(script).digest('base64')}'`);
}

export function buildPolicy(scriptHashes: Array<string>, reportPath: string): string {
    return [
        "default-src 'self'",
        ["script-src 'self'", ...scriptHashes].join(' '),
        `style-src 'self' 'unsafe-inline' ${FONT_STYLES}`,
        `font-src 'self' ${FONT_FILES}`,
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob:",
        `connect-src 'self' ${FONT_STYLES} ${FONT_FILES}`,
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        `report-uri ${reportPath}`
    ].join('; ');
}

export function policyHeaders(mode: ContentPolicyMode, policy: string): Record<string, string> {
    if (mode === 'enforce') {
        return { 'Content-Security-Policy': policy };
    }

    return mode === 'report' ? { 'Content-Security-Policy-Report-Only': policy } : {};
}

export function readReports(body: unknown): Array<PolicyReport> {
    const entries = Array.isArray(body) ? body.map((entry) => field(entry, 'body')) : [field(body, 'csp-report')];

    return entries
        .map((entry) => ({
            directive: text(field(entry, 'effective-directive') ?? field(entry, 'effectiveDirective') ?? field(entry, 'violated-directive')),
            blocked: text(field(entry, 'blocked-uri') ?? field(entry, 'blockedURL')),
            page: text(field(entry, 'document-uri') ?? field(entry, 'documentURL'))
        }))
        .filter((report) => report.directive && report.blocked);
}

function field(source: unknown, name: string): unknown {
    return typeof source === 'object' && source !== null ? (source as Record<string, unknown>)[name] : undefined;
}

function text(value: unknown): string {
    return typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').slice(0, MAX_FIELD_LENGTH) : '';
}

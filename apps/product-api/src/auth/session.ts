import { createHmac, timingSafeEqual } from 'crypto';

export interface Session {
    email: string;
    issuedAt: number;
    expiresAt: number;
}

export const SESSION_COOKIE = 'session';
export const SESSION_LIFETIME_SECONDS = 90 * 24 * 60 * 60;
export const SESSION_RENEW_AFTER_SECONDS = 24 * 60 * 60;

export function safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);

    return a.length === b.length && timingSafeEqual(a, b);
}

export function newSession(email: string, now: Date): Session {
    const issuedAt = Math.floor(now.getTime() / 1000);

    return { email, issuedAt, expiresAt: issuedAt + SESSION_LIFETIME_SECONDS };
}

export function signSession(session: Session, secret: string): string {
    const payload = Buffer.from(JSON.stringify(session)).toString('base64url');

    return `${payload}.${signature(payload, secret)}`;
}

export function verifySession(token: string | undefined, secret: string, now: Date): Session | undefined {
    const [payload, signed] = (token ?? '').split('.');
    if (!payload || !signed || !safeEqual(signed, signature(payload, secret))) {
        return undefined;
    }

    try {
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
        const valid = typeof session.email === 'string' && session.expiresAt > now.getTime() / 1000;

        return valid ? session : undefined;
    } catch {
        return undefined;
    }
}

export function parseCookies(header?: string): Record<string, string> {
    return Object.fromEntries(
        (header ?? '')
            .split(';')
            .map((part) => part.trim())
            .filter((part) => part.includes('='))
            .map((part) => [part.slice(0, part.indexOf('=')), decodeURIComponent(part.slice(part.indexOf('=') + 1))])
    );
}

export function isAllowedEmail(email: string, allowed: Array<string>): boolean {
    return allowed.includes(email.trim().toLowerCase());
}

function signature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('base64url');
}

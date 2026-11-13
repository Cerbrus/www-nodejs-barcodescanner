export const SECURITY_HEADERS: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Referrer-Policy': 'same-origin'
};

interface HeaderTarget {
    setHeader(name: string, value: string): unknown;
}

export function setSecurityHeaders(response: HeaderTarget): void {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        response.setHeader(name, value);
    }
}

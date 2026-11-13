const FRAMING_ONLY_POLICY = "frame-ancestors 'none'";
const POLICY_HEADER = 'Content-Security-Policy';

const BASE_HEADERS: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin'
};

let headers: Record<string, string> = { ...BASE_HEADERS, [POLICY_HEADER]: FRAMING_ONLY_POLICY };

interface HeaderTarget {
    setHeader(name: string, value: string): unknown;
}

export function useContentPolicyHeaders(policyHeaders: Record<string, string>): void {
    headers = { ...BASE_HEADERS, [POLICY_HEADER]: FRAMING_ONLY_POLICY, ...policyHeaders };
}

export function setSecurityHeaders(response: HeaderTarget): void {
    for (const [name, value] of Object.entries(headers)) {
        response.setHeader(name, value);
    }
}

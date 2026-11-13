export interface CookieOptions {
    httpOnly: boolean;
    sameSite: 'lax';
    secure: boolean;
    path: string;
    maxAge?: number;
}

export interface HttpRequest {
    method: string;
    headers: Record<string, string | Array<string> | undefined>;
}

export type Caller = 'user' | 'agent';

export type CallerRequest = HttpRequest & { caller?: Caller };

export interface HttpResponse {
    cookie(name: string, value: string, options: CookieOptions): void;
    clearCookie(name: string, options: CookieOptions): void;
    redirect(url: string): void;
}

export function cookieHeader(request: HttpRequest): string | undefined {
    const header = request.headers['cookie'];

    return typeof header === 'string' ? header : undefined;
}

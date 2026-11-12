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

export interface HttpResponse {
    cookie(name: string, value: string, options: CookieOptions): void;
    clearCookie(name: string, options: CookieOptions): void;
    redirect(url: string): void;
}

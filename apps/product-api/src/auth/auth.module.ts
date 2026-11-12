import { randomBytes } from 'crypto';

import { Controller, Get, Global, HttpCode, Logger, Module, Post, Query, Req, Res } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthConfig } from './auth.config';
import { AuthGuard, Public, cookieHeader } from './auth.guard';
import { CookieOptions, HttpRequest, HttpResponse } from './http';
import {
    SESSION_COOKIE,
    SESSION_LIFETIME_SECONDS,
    SESSION_RENEW_AFTER_SECONDS,
    isAllowedEmail,
    newSession,
    parseCookies,
    safeEqual,
    signSession
} from './session';

interface AuthState {
    enabled: boolean;
    authenticated: boolean;
    email?: string;
}

interface GoogleIdentity {
    aud?: string;
    iss?: string;
    email?: string;
    email_verified?: boolean;
}

const STATE_COOKIE = 'oauth_state';
const STATE_LIFETIME_MILLISECONDS = 10 * 60 * 1000;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const LOGIN_PAGE = '/#/login';

@Public()
@Controller({ path: 'auth', version: '1' })
export class AuthController {
    private readonly logger = new Logger('Auth');

    constructor(
        private readonly config: AuthConfig,
        private readonly guard: AuthGuard
    ) {
    }

    @Get('me')
    public me(@Req() request: HttpRequest, @Res({ passthrough: true }) response: HttpResponse): AuthState {
        if (!this.config.enabled) {
            return { enabled: false, authenticated: true };
        }

        const session = this.guard.readSession(request);
        if (session && Date.now() / 1000 - session.issuedAt > SESSION_RENEW_AFTER_SECONDS) {
            this.setSession(response, session.email);
        }

        return { enabled: true, authenticated: session !== undefined, email: session?.email };
    }

    @Get('google')
    public start(@Res() response: HttpResponse): void {
        if (!this.config.enabled) {
            response.redirect('/');
            return;
        }

        const state = randomBytes(24).toString('base64url');
        response.cookie(STATE_COOKIE, state, { ...this.cookieOptions(), maxAge: STATE_LIFETIME_MILLISECONDS });
        const query = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: 'openid email',
            prompt: 'select_account',
            state
        });
        response.redirect(`${GOOGLE_AUTH_URL}?${query}`);
    }

    @Get('google/callback')
    public async finish(
        @Req() request: HttpRequest,
        @Res() response: HttpResponse,
        @Query('code') code?: string,
        @Query('state') state?: string
    ): Promise<void> {
        const expectedState = parseCookies(cookieHeader(request))[STATE_COOKIE];
        response.clearCookie(STATE_COOKIE, this.cookieOptions());
        if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
            response.redirect(`${LOGIN_PAGE}?error=failed`);
            return;
        }

        const identity = await this.exchange(code);
        const email = identity?.email?.toLowerCase();
        const genuine = identity?.aud === this.config.clientId && GOOGLE_ISSUERS.includes(identity.iss ?? '') && identity.email_verified;
        if (!email || !genuine) {
            response.redirect(`${LOGIN_PAGE}?error=failed`);
            return;
        }
        if (!isAllowedEmail(email, this.config.allowedEmails)) {
            this.logger.warn(`login refused for ${email}: not in ALLOWED_EMAILS`);
            response.redirect(`${LOGIN_PAGE}?error=not_allowed`);
            return;
        }

        this.setSession(response, email);
        this.logger.log(`${email} logged in`);
        response.redirect('/');
    }

    @Post('logout')
    @HttpCode(204)
    public logout(@Res({ passthrough: true }) response: HttpResponse): void {
        response.clearCookie(SESSION_COOKIE, this.cookieOptions());
    }

    private async exchange(code: string): Promise<GoogleIdentity | undefined> {
        try {
            const answer = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    redirect_uri: this.config.redirectUri,
                    grant_type: 'authorization_code'
                })
            });
            const tokens = (await answer.json()) as { id_token?: string; error?: string };
            if (!answer.ok || !tokens.id_token) {
                this.logger.warn(`Google refused the login code: ${tokens.error ?? answer.status}`);
                return undefined;
            }

            return JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString()) as GoogleIdentity;
        } catch (error) {
            this.logger.warn(`Google could not be reached for the login: ${error}`);
            return undefined;
        }
    }

    private setSession(response: HttpResponse, email: string): void {
        const token = signSession(newSession(email, new Date()), this.config.sessionSecret);
        response.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(), maxAge: SESSION_LIFETIME_SECONDS * 1000 });
    }

    private cookieOptions(): CookieOptions {
        return { httpOnly: true, sameSite: 'lax', secure: this.config.publicUrl.startsWith('https://'), path: '/' };
    }
}

@Global()
@Module({
    controllers: [AuthController],
    providers: [AuthConfig, AuthGuard, { provide: APP_GUARD, useExisting: AuthGuard }],
    exports: [AuthConfig, AuthGuard]
})
export class AuthModule {
}

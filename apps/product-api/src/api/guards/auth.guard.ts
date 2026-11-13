import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PUBLIC_ROUTE } from './public.decorator';
import { AuthConfig } from '../../config/auth.config';
import { SESSION_COOKIE, Session, parseCookies, safeEqual, verifySession } from '../../core/rules/session';
import { HttpRequest } from '../http';

const AGENT_TOKEN_HEADER = 'x-agent-token';
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export type AuthenticatedRequest = HttpRequest & { session?: Session };

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly config: AuthConfig,
        private readonly reflector: Reflector
    ) {
    }

    public canActivate(context: ExecutionContext): boolean {
        if (!this.config.enabled || this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) {
            return true;
        }

        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const agentToken = request.headers[AGENT_TOKEN_HEADER];
        if (this.config.agentToken && typeof agentToken === 'string' && safeEqual(agentToken, this.config.agentToken)) {
            return true;
        }

        const session = this.readSession(request);
        if (!session) {
            throw new UnauthorizedException('Log in first');
        }

        const origin = request.headers['origin'];
        if (!READ_METHODS.includes(request.method) && origin && origin !== this.config.publicUrl) {
            throw new ForbiddenException('Request from another site');
        }

        request.session = session;

        return true;
    }

    public readSession(request: HttpRequest): Session | undefined {
        const session = verifySession(parseCookies(cookieHeader(request))[SESSION_COOKIE], this.config.sessionSecret, new Date());

        return session && this.config.allowedEmails.includes(session.email) ? session : undefined;
    }
}

export function cookieHeader(request: HttpRequest): string | undefined {
    const header = request.headers['cookie'];

    return typeof header === 'string' ? header : undefined;
}

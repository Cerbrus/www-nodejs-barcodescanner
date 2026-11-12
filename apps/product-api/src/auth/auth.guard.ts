import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { AuthConfig } from './auth.config';
import { SESSION_COOKIE, Session, parseCookies, safeEqual, verifySession } from './session';

const PUBLIC_ROUTE = 'publicRoute';
const AGENT_TOKEN_HEADER = 'x-agent-token';
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ROUTE, true);

export type AuthenticatedRequest = Request & { session?: Session };

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

        const origin = request.headers.origin;
        if (!READ_METHODS.includes(request.method) && origin && origin !== this.config.publicUrl) {
            throw new ForbiddenException('Request from another site');
        }

        request.session = session;

        return true;
    }

    public readSession(request: Request): Session | undefined {
        const session = verifySession(parseCookies(request.headers.cookie)[SESSION_COOKIE], this.config.sessionSecret, new Date());

        return session && this.config.allowedEmails.includes(session.email) ? session : undefined;
    }
}

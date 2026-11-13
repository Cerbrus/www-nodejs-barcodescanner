import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PUBLIC_ROUTE } from './public.decorator';
import { AppConfig } from '../../config/app.config';
import { Session, safeEqual } from '../../core/rules/session';
import { SessionService } from '../../core/services/session.service';
import { HttpRequest, cookieHeader } from '../http';

const AGENT_TOKEN_HEADER = 'x-agent-token';
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export type AuthenticatedRequest = HttpRequest & { session?: Session };

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly config: AppConfig,
        private readonly sessions: SessionService,
        private readonly reflector: Reflector
    ) {
    }

    public canActivate(context: ExecutionContext): boolean {
        if (!this.config.loginEnabled || this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) {
            return true;
        }

        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const agentToken = request.headers[AGENT_TOKEN_HEADER];
        if (this.config.agentToken && typeof agentToken === 'string' && safeEqual(agentToken, this.config.agentToken)) {
            return true;
        }

        const session = this.sessions.read(cookieHeader(request));
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
}

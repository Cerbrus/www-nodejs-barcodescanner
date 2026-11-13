import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AGENT_ROUTE } from './agent.decorator';
import { PUBLIC_ROUTE } from './public.decorator';
import { AppConfig } from '../../config/app.config';
import { safeEqual } from '../../core/rules/session';
import { SessionService } from '../../core/services/session.service';
import { CallerRequest, cookieHeader } from '../http';

const AGENT_TOKEN_HEADER = 'x-agent-token';
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly config: AppConfig,
        private readonly sessions: SessionService,
        private readonly reflector: Reflector
    ) {
    }

    public canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<CallerRequest>();
        const agentToken = request.headers[AGENT_TOKEN_HEADER];
        const targets = [context.getHandler(), context.getClass()];

        if (!this.config.loginEnabled) {
            request.caller = agentToken === undefined ? 'user' : 'agent';
            return true;
        }
        if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets)) {
            return true;
        }

        if (this.config.agentToken && typeof agentToken === 'string' && safeEqual(agentToken, this.config.agentToken)) {
            if (!this.reflector.getAllAndOverride<boolean>(AGENT_ROUTE, targets)) {
                throw new ForbiddenException('Not open to the hardware agent');
            }
            request.caller = 'agent';
            return true;
        }

        if (!this.sessions.read(cookieHeader(request))) {
            throw new UnauthorizedException('Log in first');
        }

        const origin = request.headers['origin'];
        if (!READ_METHODS.includes(request.method) && origin && origin !== this.config.publicUrl) {
            throw new ForbiddenException('Request from another site');
        }
        request.caller = 'user';

        return true;
    }
}

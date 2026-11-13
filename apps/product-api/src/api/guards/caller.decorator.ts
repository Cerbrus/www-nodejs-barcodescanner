import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { Caller, CallerRequest } from '../http';

export const CalledBy = createParamDecorator(
    (_: unknown, context: ExecutionContext): Caller => context.switchToHttp().getRequest<CallerRequest>().caller ?? 'user'
);

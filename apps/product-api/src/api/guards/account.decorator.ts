import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { Account, CallerRequest } from '../http';

export const LOCAL_ACCOUNT: Account = { email: 'local', owner: true };

export const CurrentAccount = createParamDecorator(
    (_: unknown, context: ExecutionContext): Account => context.switchToHttp().getRequest<CallerRequest>().account ?? LOCAL_ACCOUNT
);

import { SetMetadata } from '@nestjs/common';

export const AGENT_ROUTE = 'agentRoute';

export const Agent = (): MethodDecorator => SetMetadata(AGENT_ROUTE, true);

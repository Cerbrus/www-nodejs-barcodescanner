import { SetMetadata } from '@nestjs/common';

export const OWNER_ROUTE = 'ownerRoute';

export const OwnerOnly = (): MethodDecorator & ClassDecorator => SetMetadata(OWNER_ROUTE, true);

import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE = 'publicRoute';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ROUTE, true);

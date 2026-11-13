import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';

import { setSecurityHeaders } from './security-headers';

export const API_PREFIX = 'api';

export function configureApi(app: INestApplication): void {
    app.setGlobalPrefix(API_PREFIX);
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.use((_: unknown, response: Parameters<typeof setSecurityHeaders>[0], next: () => void) => {
        setSecurityHeaders(response);
        next();
    });
}

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';

export const API_PREFIX = 'api';

export function configureApi(app: INestApplication): void {
    app.setGlobalPrefix(API_PREFIX);
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
}

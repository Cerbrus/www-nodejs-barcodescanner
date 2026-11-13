import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

import { setSecurityHeaders, useContentPolicyHeaders } from './security-headers';
import { ContentPolicyService } from '../core/services/content-policy.service';

export const API_PREFIX = 'api';

const JSON_BODY_TYPES = ['application/json', 'application/csp-report', 'application/reports+json'];

export function configureApi(app: NestExpressApplication): void {
    app.setGlobalPrefix(API_PREFIX);
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useBodyParser('json', { type: JSON_BODY_TYPES });
    useContentPolicyHeaders(app.get(ContentPolicyService).headers);
    app.use((_: unknown, response: Parameters<typeof setSecurityHeaders>[0], next: () => void) => {
        setSecurityHeaders(response);
        next();
    });
}

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';

import { ContentPolicyService } from '../core/services/content-policy.service';
import { setSecurityHeaders, useContentPolicyHeaders } from './security-headers';

export const API_PREFIX = 'api';

const JSON_BODY_TYPES = ['application/json', 'application/csp-report', 'application/reports+json'];
const EVENT_STREAM_TYPE = 'text/event-stream';

const isCompressed: compression.CompressionFilter = (request, response) =>
    !String(response.getHeader('Content-Type')).startsWith(EVENT_STREAM_TYPE) && compression.filter(request, response);

export function configureApi(app: NestExpressApplication): void {
    app.use(compression({ filter: isCompressed }));
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

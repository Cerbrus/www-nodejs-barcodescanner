import { relative } from 'node:path';

import { VERSIONED_FILE_CACHING, isVersionedFile } from '../core/rules/versioned-file';
import { setSecurityHeaders } from './security-headers';

type HeaderTarget = Parameters<typeof setSecurityHeaders>[0];

export function frontendHeaders(frontendPath: string): (response: HeaderTarget, path: string) => void {
    return (response, path) => {
        setSecurityHeaders(response);
        if (isVersionedFile(relative(frontendPath, path))) {
            response.setHeader('Cache-Control', VERSIONED_FILE_CACHING);
        }
    };
}

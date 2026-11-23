const VERSIONED_FILE = /^(?:media\/)?[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/;

export const VERSIONED_FILE_CACHING = 'public, max-age=31536000, immutable';

export function isVersionedFile(path: string): boolean {
    return VERSIONED_FILE.test(path.replaceAll('\\', '/'));
}

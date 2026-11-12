import { HttpHeaders } from '@angular/common/http';

export interface PaginationData {
    total: number;
    start: number;
    step: number;
}

export function parsePaginationHeaders(headers: HttpHeaders): PaginationData {
    return {
        total: parsePaginationHeader('X-Pagination-Total', headers),
        start: parsePaginationHeader('X-Pagination-Start', headers),
        step: parsePaginationHeader('X-Pagination-Step', headers),
    };
}

function parsePaginationHeader(key: string, headers: HttpHeaders): number {
    if (!headers.has(key)) {
        console.warn(`Expected ${key} header on response, but was not present.`);
        return -1;
    }
    const value = headers.get(key)!;
    try {
        return parseInt(value, 10);
    } catch (e) {
        console.warn(`Expected ${key} header on response to be a valid integer, but it was not: ${key}=${value}`);
        return -1;
    }
}

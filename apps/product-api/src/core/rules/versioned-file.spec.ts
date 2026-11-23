import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isVersionedFile } from './versioned-file';

describe('a file with a version in its name', () => {
    it('knows the scripts, styles and fonts the build names with a hash', () => {
        for (const path of [
            'main-H7KACRIT.js',
            'styles-3WU7KBJ2.css',
            'chunk-BdeX1MsP.js',
            'chunk-BJIikpn_.js',
            'chunk-DWXInOv-.js',
            'media/OCRB Regular-SXUUEP2X.otf',
            'media\\OCRB Regular-SXUUEP2X.otf'
        ]) {
            assert.equal(isVersionedFile(path), true, path);
        }
    });

    it('leaves the page, the service worker, the file list and the assets alone', () => {
        for (const path of [
            'index.html',
            'sw.js',
            'app-files.json',
            'favicon.ico',
            'assets/icons/icon-maskable.png',
            'assets/i18n/nl.json'
        ]) {
            assert.equal(isVersionedFile(path), false, path);
        }
    });
});

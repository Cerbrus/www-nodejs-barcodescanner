import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig } from '@playwright/test';

import { withCheckDigit, writeBarcodeVideo } from './barcode-video.mjs';

const PORT = 3931;
const FAKE_CAMERA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];

export const CAMERA_CODE = withCheckDigit('871040099001');

const video = join(tmpdir(), 'barcodescanner-e2e-camera.y4m');
writeBarcodeVideo(video, CAMERA_CODE);

export default defineConfig({
    testDir: '.',
    workers: 1,
    fullyParallel: false,
    retries: 0,
    timeout: 60_000,
    reporter: [['list']],
    outputDir: join(tmpdir(), 'barcodescanner-e2e-results'),
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        channel: 'chrome',
        viewport: { width: 390, height: 844 },
        locale: 'nl-NL',
        permissions: ['camera']
    },
    projects: [
        {
            name: 'app',
            testMatch: 'shopping.e2e.ts',
            use: { launchOptions: { args: FAKE_CAMERA } }
        },
        {
            name: 'camera',
            testMatch: 'camera.e2e.ts',
            dependencies: ['app'],
            use: { launchOptions: { args: [...FAKE_CAMERA, `--use-file-for-fake-video-capture=${video}`] } }
        }
    ],
    webServer: {
        command: 'node e2e/start-app.mjs',
        cwd: join(__dirname, '..'),
        url: `http://127.0.0.1:${PORT}/api/v1/health`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: { E2E_PORT: String(PORT) }
    }
});

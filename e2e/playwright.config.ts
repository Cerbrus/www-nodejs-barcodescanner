import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig } from '@playwright/test';

import { withCheckDigit, writeBarcodeVideo, writeQrVideo } from './barcode-video.mjs';

const PORT = 3931;
const FAKE_CAMERA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];

export const CAMERA_CODE = withCheckDigit('871040099001');

const video = join(tmpdir(), 'barcodescanner-e2e-camera.y4m');
writeBarcodeVideo(video, CAMERA_CODE);

export const CAMERA_RECIPE = { name: 'Camerasoep', productId: 1, quantity: 2 };

const recipeVideo = join(tmpdir(), 'barcodescanner-e2e-recipe.y4m');
writeQrVideo(recipeVideo, `R1;${CAMERA_RECIPE.name};${CAMERA_RECIPE.productId}*${CAMERA_RECIPE.quantity};999999:weg`);

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
            testMatch: [
                'shopping.e2e.ts',
                'remarks.e2e.ts',
                'changelog.e2e.ts',
                'naming.e2e.ts',
                'sounds.e2e.ts',
                'recipes.e2e.ts',
                'collect-toggle.e2e.ts',
                'barcode-search.e2e.ts',
                'themes.e2e.ts'
            ],
            use: { launchOptions: { args: FAKE_CAMERA } }
        },
        {
            name: 'camera',
            testMatch: 'camera.e2e.ts',
            dependencies: ['app'],
            use: { launchOptions: { args: [...FAKE_CAMERA, `--use-file-for-fake-video-capture=${video}`] } }
        },
        {
            name: 'recipe-camera',
            testMatch: 'recipe-camera.e2e.ts',
            dependencies: ['camera'],
            use: { launchOptions: { args: [...FAKE_CAMERA, `--use-file-for-fake-video-capture=${recipeVideo}`] } }
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

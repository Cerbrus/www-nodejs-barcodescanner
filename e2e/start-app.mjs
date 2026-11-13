import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API_BUNDLE = 'dist/apps/product/main.js';
const WEB_APP = 'dist/apps/product-front/browser';

if (!existsSync(API_BUNDLE) || !existsSync(WEB_APP)) {
    console.error('Build first: yarn product-api:build && yarn product-front:build');
    process.exit(1);
}

const folder = join(tmpdir(), 'barcodescanner-e2e-app');

rmSync(folder, { recursive: true, force: true });
mkdirSync(folder, { recursive: true });
const site = join(folder, 'public');

cpSync(WEB_APP, site, { recursive: true });
writeFileSync(join(site, 'assets', 'appsettings.json'), JSON.stringify({ api: { core: '/api' } }));
writeFileSync(join(site, 'app-files.json'), JSON.stringify(readdirSync(site).filter((file) => /\.(js|css)$/.test(file) && file !== 'sw.js')));

const server = spawn(process.execPath, [API_BUNDLE], {
    stdio: 'inherit',
    env: {
        ...process.env,
        PORT: process.env.E2E_PORT ?? '3931',
        FRONTEND_PATH: site,
        DATABASE_PATH: join(folder, 'app.db'),
        CONNECTORS: 'none',
        GOOGLE_CLIENT_ID: '',
        CSP_MODE: 'report'
    }
});

const stop = () => {
    server.kill();
    rmSync(folder, { recursive: true, force: true });
    process.exit(0);
};

process.on('SIGTERM', stop);
process.on('SIGINT', stop);
server.on('exit', (code) => process.exit(code ?? 0));

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const testFolder = mkdtempSync(join(tmpdir(), 'barcodescanner-test-'));

process.env['DATABASE_PATH'] = join(testFolder, 'test.db');
process.env['SEED_PATH'] = join(process.cwd(), 'data', 'seed-items.json');
process.env['CONNECTORS'] = 'none';

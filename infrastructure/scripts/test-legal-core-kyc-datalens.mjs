/**
 * infrastructure/scripts/test-legal-core-kyc-datalens.mjs
 * Runner for test-legal-core-kyc-datalens.ts via tsx.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tsScript = path.resolve(__dirname, 'test-legal-core-kyc-datalens.ts');

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const child = spawn(npxCmd, ['tsx', tsScript], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, YDB_USE_V2_TABLES: 'true' },
});

child.on('close', (code) => {
  process.exit(code || 0);
});

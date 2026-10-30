import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-lite'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_LITE_PILOT: 'true', VITE_LITE_TEST_CATALOG: 'true', VITE_API_BASE_URL: '/lite-api',
  },
});
if (result.status !== 0) process.exit(result.status || 1);
// Preview-only proxy: authenticate and synchronize through the unchanged official backend.
await writeFile('dist-lite/_redirects', '/lite-api/* https://criativa-field-ops-574.netlify.app/api/:splat 200\n');

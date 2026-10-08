// Bundles the API (and the workspace-only @mccl/shared source) into dist/.
// Real npm dependencies stay external and are installed in the runtime image.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter(d => !d.startsWith('@mccl/'));

await build({
  entryPoints: {
    server: 'src/server.ts',
    instrument: 'src/instrument.ts',
    'set-credentials': 'scripts/set-credentials.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  jsx: 'automatic',
  sourcemap: true,
  external,
  logLevel: 'info',
});

import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const outDir = join(root, 'dist');
const publicDir = join(root, 'public');

rmSync(outDir, { recursive: true, force: true });
cpSync(publicDir, outDir, { recursive: true });
mkdirSync(join(outDir, 'assets'), { recursive: true });

const common = {
  bundle: true,
  sourcemap: false,
  minify: false,
  target: 'es2020',
  platform: 'browser',
  legalComments: 'none'
};

await build({
  ...common,
  entryPoints: [join(root, 'src/content/index.ts')],
  outfile: join(outDir, 'assets/content.js'),
  format: 'iife'
});

await build({
  ...common,
  entryPoints: [join(root, 'src/background/serviceWorker.ts')],
  outfile: join(outDir, 'assets/serviceWorker.js'),
  format: 'iife'
});

await build({
  ...common,
  entryPoints: [join(root, 'src/options/main.ts')],
  outfile: join(outDir, 'assets/options.js'),
  format: 'iife'
});

// Ensure manifest references generated assets (already pointing to assets/*.js)
const manifestPath = join(outDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

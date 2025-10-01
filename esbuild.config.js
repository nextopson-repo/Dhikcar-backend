import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.cjs',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: isDev,
  minify: !isDev,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  loader: {
    '.html': 'text',
    '.css': 'text',
    '.json': 'json',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.gif': 'dataurl',
    '.svg': 'dataurl',
    '.ico': 'dataurl',
    '.webp': 'dataurl'
  },
  external: [
    // Exclude problematic packages that should not be bundled
    '@tensorflow/tfjs-node',
    'sharp',
    'bcrypt',
    'bcryptjs'
  ],
  ignoreAnnotations: true,
  logLevel: 'info'
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});

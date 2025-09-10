import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['./src'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  minify: true,
  treeshake: true,
  noExternal: ['typeorm', './ormconfig.ts'], // Include TypeORM and ormconfig.ts
});

import * as esbuild from 'esbuild';
import { mkdirSync, existsSync } from 'fs';

const isWatch = process.argv.includes('--watch');

if (!existsSync('dist')) {
  mkdirSync('dist', { recursive: true });
}

const buildOptions = {
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ['es2020'],
  format: 'iife',
  globalName: 'SiteAssistant',
  outfile: 'dist/widget.js',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  legalComments: 'none',
  treeShaking: true,
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete: dist/widget.js');
}

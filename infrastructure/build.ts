import * as esbuild from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

async function build() {
  await esbuild.build({
    entryPoints: ['src/handler.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outdir: 'dist',
    external: ['chrome-aws-lambda'],
    plugins: [nodeExternalsPlugin()],
  });
}

build().catch(() => process.exit(1));
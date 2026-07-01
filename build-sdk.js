const path = require('path');
const esbuild = require('esbuild');

esbuild.build({
  entryPoints: [
    path.join(__dirname, 'node_modules', '@cloudbase', 'js-sdk', 'dist', 'index.esm.js'),
  ],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'cloudbaseSdk',
  outfile: path.join(__dirname, 'dist-cloud', 'js', 'cloudbase.full.js'),
  platform: 'browser',
  target: ['es2018'],
  footer: {
    js: ';if (typeof window !== "undefined") { window.cloudbase = cloudbaseSdk.default || cloudbaseSdk; }',
  },
  logLevel: 'info',
}).catch(e => {
  console.error('Build FAILED:', e);
  process.exit(1);
});

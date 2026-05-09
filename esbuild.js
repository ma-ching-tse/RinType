const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

async function build() {
  // Build plugin code (main thread)
  const codeConfig = {
    entryPoints: ['src/code.ts'],
    bundle: true,
    outfile: 'dist/code.js',
    format: 'iife',
    target: 'es2017',
    logLevel: 'info',
  };

  // Build UI code (iframe)
  const uiConfig = {
    entryPoints: ['src/ui.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    logLevel: 'info',
  };

  // Build CSS
  const cssConfig = {
    entryPoints: ['src/ui.css'],
    bundle: true,
    write: false,
    logLevel: 'info',
  };

  if (isWatch) {
    const codeCtx = await esbuild.context(codeConfig);
    await codeCtx.watch();

    // For UI, we rebuild manually on change
    const uiCtx = await esbuild.context({
      ...uiConfig,
      write: true,
      outfile: 'dist/_ui.js',
      plugins: [{
        name: 'inline-html',
        setup(build) {
          build.onEnd(async () => {
            await buildUI();
          });
        }
      }]
    });
    await uiCtx.watch();

    console.log('Watching for changes...');
  } else {
    await esbuild.build(codeConfig);
    await buildUI();
  }

  async function buildUI() {
    const [uiResult, cssResult] = await Promise.all([
      esbuild.build(uiConfig),
      esbuild.build(cssConfig),
    ]);

    const jsCode = uiResult.outputFiles[0].text;
    const cssCode = cssResult.outputFiles[0].text;

    const htmlTemplate = fs.readFileSync(
      path.join(__dirname, 'src', 'ui.html'),
      'utf8'
    );

    const html = htmlTemplate
      .replace('/* INLINE_CSS */', cssCode)
      .replace('/* INLINE_JS */', jsCode);

    fs.mkdirSync('dist', { recursive: true });
    fs.writeFileSync(path.join('dist', 'ui.html'), html);
    console.log('  dist/ui.html built');
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});

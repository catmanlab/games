const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

function build() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(__dirname, 'src', 'main.js')],
    bundle: true,
    format: 'iife',
    write: false,
    legalComments: 'none',
    logLevel: 'silent',
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const tpl = fs.readFileSync(path.join(__dirname, 'src', 'template.html'), 'utf8');
  if (!tpl.includes('/*BUNDLE*/')) throw new Error('template is missing /*BUNDLE*/');
  fs.writeFileSync(path.join(__dirname, 'index.html'), tpl.replace('/*BUNDLE*/', js));
}

if (require.main === module) build();
module.exports = { build };

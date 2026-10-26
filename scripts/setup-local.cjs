const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { root, runtime, modules } = require('./local-paths.cjs');
try {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 ou plus récent est nécessaire.');
  const manifest = fs.readFileSync(path.join(root, 'package.json'));
  const lock = fs.readFileSync(path.join(root, 'package-lock.json'));
  const hash = crypto.createHash('sha256').update(manifest).update(lock).digest('hex');
  const stamp = path.join(runtime, '.dependencies.sha256');
  fs.mkdirSync(runtime, { recursive: true });
  const installed = fs.existsSync(path.join(modules, 'embedded-postgres', 'dist', 'index.js'));
  if (!installed || !fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== hash) {
    console.log('Préparation des dépendances dans le dossier local du Mac…');
    fs.writeFileSync(path.join(runtime, 'package.json'), manifest);
    fs.writeFileSync(path.join(runtime, 'package-lock.json'), lock);
    const installation = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: runtime, stdio: 'inherit' });
    if (installation.error) throw installation.error;
    if (installation.status !== 0) throw new Error('Installation des dépendances échouée. Vérifiez la connexion Internet.');
    fs.writeFileSync(stamp, hash);
  }
  const projectModules = path.join(root, 'node_modules');
  let stat;
  try { stat = fs.lstatSync(projectModules); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const linked = stat?.isSymbolicLink() && path.resolve(root, fs.readlinkSync(projectModules)) === modules;
  if (!linked) {
    if (stat?.isSymbolicLink()) fs.unlinkSync(projectModules);
    else if (stat) fs.renameSync(projectModules, path.join(root, `.node_modules-before-local-${Date.now()}`));
    fs.symlinkSync(modules, projectModules, process.platform === 'win32' ? 'junction' : 'dir');
  }
  console.log(`Fichiers locaux : ${runtime}`);
} catch (error) {
  console.error(`Préparation impossible : ${error.message}`);
  process.exitCode = 1;
}

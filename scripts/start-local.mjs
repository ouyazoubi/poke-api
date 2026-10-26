import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';
import paths from './local-paths.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
dotenv.config({ path: `${root}/.env`, quiet: true });
process.env.LANG = 'C';
process.env.LC_ALL = 'C';
const httpPort = Number(process.env.PORT || 3000);
const address = `http://localhost:${httpPort}`;
const shouldOpen = process.argv.includes('--open');
const development = process.argv.includes('--dev');
let server;
let stopping = false;

function openBrowser() {
  if (shouldOpen && process.platform === 'darwin') {
    const browser = spawn('open', [address], { stdio: 'ignore' });
    browser.on('error', () => {});
    browser.unref();
  }
}
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} a échoué (${signal || code}).`));
    });
  });
}
async function main() {
  if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) throw new Error('PORT invalide dans .env.');
  try {
    const response = await fetch(`${address}/api`, { signal: AbortSignal.timeout(1500) });
    if (response.ok && (await response.json()).service === 'poke-api') {
      console.log(`L’API est déjà lancée : ${address}`);
      openBrowser();
      return;
    }
  } catch {}
  process.env.DATABASE_URL ||= 'postgresql://poke:poke@127.0.0.1:55432/poke';
  const database = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) ||
      !['localhost', '127.0.0.1'].includes(database.hostname)) {
    throw new Error('Le lancement local nécessite un DATABASE_URL sur localhost. Pour une base externe : npm run start:external.');
  }
  const port = Number(database.port || 5432);
  const user = decodeURIComponent(database.username);
  const password = decodeURIComponent(database.password);
  const name = decodeURIComponent(database.pathname.slice(1));
  if (!user || !password || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error('DATABASE_URL doit contenir un utilisateur, un mot de passe et un nom de base simple.');
  }
  const { dataDirectory } = paths;
  let startupLog = '';
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDirectory, user, password, port, persistent: true,
    initdbFlags: ['--locale=C', '--encoding=UTF8'],
    postgresFlags: ['-h', '127.0.0.1'],
    onLog: message => {
      startupLog += String(message);
      if (/FATAL|ERROR/.test(String(message))) console.error(String(message));
    },
    onError: message => console.error(String(message)),
  });
  let started = false;
  const stop = () => {
    stopping = true;
    if (server && server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    console.log('Compilation du projet…');
    await run('npm', ['run', 'build']);
    if (stopping) return;
    if (!existsSync(`${dataDirectory}/PG_VERSION`)) {
      console.log('Création de PostgreSQL local (premier lancement)…');
      await postgres.initialise();
    } else {
      console.log(`Base locale existante : PostgreSQL ${readFileSync(`${dataDirectory}/PG_VERSION`, 'utf8').trim()}.`);
    }
    if (stopping) return;
    console.log(`Démarrage de PostgreSQL sur 127.0.0.1:${port}…`);
    try { await postgres.start(); }
    catch (error) { throw new Error(`Impossible de démarrer PostgreSQL. Le port ${port} doit être libre. ${error?.message || startupLog.slice(-2000)}`); }
    started = true;
    if (stopping) return;
    const client = postgres.getPgClient('postgres', '127.0.0.1');
    await client.connect();
    try {
      const result = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
      if (!result.rowCount) await postgres.createDatabase(name);
    } finally { await client.end(); }
    await run('node', ['dist/db/migrate.js']);
    if (stopping) return;
    server = spawn('node', development ? ['--import', 'tsx', '--watch', 'src/server.ts'] : ['dist/server.js'],
      { cwd: root, stdio: 'inherit', env: process.env });
    const exited = new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('exit', (code, signal) => {
        if (code === 0 || stopping || signal === 'SIGTERM') resolve();
        else reject(new Error(`L’API s’est arrêtée (code ${code}). Vérifiez le port ${httpPort}.`));
      });
    });
    exited.catch(() => {});
    let ready = false;
    for (let attempt = 0; attempt < 40 && !stopping; attempt++) {
      if (server.exitCode !== null || server.signalCode !== null) break;
      try {
        const response = await fetch(`${address}/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready && !stopping) throw new Error('L’API ne répond pas. Consultez les messages ci-dessus.');
    if (ready) {
      console.log(`\nProjet lancé sans Docker : ${address}`);
      console.log('Gardez ce terminal ouvert. Ctrl+C arrête le serveur et PostgreSQL sans effacer les données.\n');
      openBrowser();
    }
    await exited;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (server && server.exitCode === null && server.signalCode === null) {
      await new Promise(resolve => { server.once('exit', resolve); server.kill('SIGTERM'); });
    }
    if (started) { console.log('Arrêt de PostgreSQL ; données conservées.'); await postgres.stop(); }
  }
}
main().catch(error => { console.error(`\nÉchec du lancement : ${error.message}`); process.exitCode = 1; });

const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const identifier = crypto.createHash('sha256').update(root).digest('hex').slice(0, 12);
const local = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support')
  : process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share');
const runtime = path.join(local, 'Poke API', identifier);
module.exports = { root, runtime, dataDirectory: path.join(runtime, 'postgres'), modules: path.join(runtime, 'node_modules') };

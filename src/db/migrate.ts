import { readFile } from 'node:fs/promises';
import { pool, transaction } from './database.js';
try {
  const sql = await readFile(new URL('../../src/db/schema.sql', import.meta.url), 'utf8');
  await transaction(async client => { await client.query(sql); });
  console.log('Schéma PostgreSQL installé.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally { await pool.end(); }

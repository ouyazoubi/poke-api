import 'dotenv/config';
import { Pool, type PoolClient } from 'pg';
export const pool = new Pool({ connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000, max: 10 });
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(761024)');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

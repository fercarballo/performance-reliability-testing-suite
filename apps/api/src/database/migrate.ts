import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool } from './pool';
import { logger } from '../observability/logger';

/**
 * Minimal forward-only migration runner. Each `.sql` file under `sql/` is run
 * once, in lexical order, tracked in a `schema_migrations` table. The schema is
 * also written with `IF NOT EXISTS`, so re-running is harmless — handy for a lab
 * that is torn down and recreated constantly.
 */
const SQL_DIR = join(__dirname, 'sql');

export async function runMigrations(): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const files = (await readdir(SQL_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const already = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [file],
    );
    if (already.rowCount && already.rowCount > 0) continue;

    const sql = await readFile(join(SQL_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
        file,
      ]);
      await client.query('COMMIT');
      logger.info({ migration: file }, 'migration applied');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, migration: file }, 'migration failed');
      throw err;
    } finally {
      client.release();
    }
  }
}

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Standalone migration runner: `tsx db/migrate.ts` (npm run db:migrate).
 *
 * Uses a dedicated single-connection client (`max: 1`) so the process exits
 * cleanly once migrations are applied. Does NOT import `db/index.ts`, which is
 * guarded by `server-only` and would throw under a plain Node/tsx runtime.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Cannot run migrations.');
  }

  const sql = postgres(connectionString, { max: 1 });
  try {
    const db = drizzle(sql);
    console.log('[migrate] applying migrations from ./db/migrations ...');
    await migrate(db, { migrationsFolder: './db/migrations' });
    console.log('[migrate] done — database is up to date.');
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  });

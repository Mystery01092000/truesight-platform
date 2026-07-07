import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

/**
 * Server-only Drizzle client for Truesight.
 *
 * `import 'server-only'` guarantees this module (and the DB credentials it reads)
 * can never be pulled into a client bundle. Standalone scripts (`db/migrate.ts`,
 * `db/seed.ts`) deliberately create their own short-lived connection instead of
 * importing this module, because `server-only` throws outside the React Server
 * bundling condition.
 *
 * In development Next.js hot-reloads modules, which would otherwise leak a new
 * postgres.js pool on every edit; we stash the client + db on `globalThis` and
 * reuse it across reloads.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Expected e.g. postgres://truesight:truesight@localhost:5432/truesight',
  );
}

function createClient(url: string) {
  return postgres(url, {
    max: process.env.NODE_ENV === 'production' ? 10 : 5,
    idle_timeout: 20,
    prepare: true,
  });
}

function createDb(sql: ReturnType<typeof createClient>) {
  return drizzle(sql, { schema, casing: 'snake_case' });
}

type Client = ReturnType<typeof createClient>;
type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __truesightDb?: { client: Client; db: Db } };

const cached =
  globalForDb.__truesightDb ??
  (() => {
    const client = createClient(connectionString);
    return { client, db: createDb(client) };
  })();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__truesightDb = cached;
}

export const client: Client = cached.client;
export const db: Db = cached.db;

export { schema };
export type Database = Db;

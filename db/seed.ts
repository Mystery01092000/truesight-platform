import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { users } from './schema';

/**
 * Standalone seed runner: `tsx db/seed.ts` (npm run db:seed).
 *
 * Seeds the default DevOps Super Admin. Idempotent: `onConflictDoNothing` on the
 * unique email means re-running is a no-op. The password is read from env, hashed
 * with bcrypt (12 rounds), and NEVER logged. Like `db/migrate.ts`, this creates its
 * own single connection rather than importing the `server-only` client.
 */
const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Cannot seed.');
  }

  const email = process.env.ADMIN_EMAIL ?? 'admin';
  const name = process.env.ADMIN_NAME ?? 'DevOps Super Admin';
  // Prefer a pre-computed bcrypt hash (matches prod SSM ADMIN_PASSWORD_HASH and
  // scripts/seed.mjs); fall back to hashing a raw ADMIN_PASSWORD for local dev.
  const passwordHash =
    process.env.ADMIN_PASSWORD_HASH ??
    (await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'akshatcentricity2026', BCRYPT_ROUNDS));

  const sql = postgres(connectionString, { max: 1 });
  try {
    const db = drizzle(sql);

    // Upsert so re-seeding rotates the super admin to the current env values.
    const inserted = await db
      .insert(users)
      .values({ email, name, role: 'admin', passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { name, role: 'admin', passwordHash },
      })
      .returning({ id: users.id, email: users.email });

    console.log(`[seed] ensured admin user "${email}" (role=admin, id=${inserted[0].id}).`);
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });

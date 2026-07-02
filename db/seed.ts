import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { platformAdmins, users } from './schema';

/**
 * Standalone seed runner: `tsx db/seed.ts` (npm run db:seed).
 *
 * Seeds the default DevOps Super Admin and the platform_admins SSO allowlist.
 * Idempotent: unique-email upserts mean re-running just refreshes the rows. The
 * password is read from env, hashed with bcrypt (12 rounds), and NEVER logged.
 * Like `db/migrate.ts`, this creates its own single connection rather than
 * importing the `server-only` client.
 */
const BCRYPT_ROUNDS = 12;

/** Emails granted the mapped role on SSO login (see lib/auth/providers/azure-entra.ts). */
const PLATFORM_ADMIN_ROWS = [
  { email: 'devops@centricity.co.in', role: 'admin', note: 'Akshat Mukhriya — DevOps Super Admin' },
  { email: 'rishabh.arya@centricity.co.in', role: 'admin', note: 'Rishabh Arya — Maintainer' },
] as const;

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

    // Upsert the SSO allowlist so re-seeding refreshes role/note per email.
    for (const row of PLATFORM_ADMIN_ROWS) {
      await db
        .insert(platformAdmins)
        .values(row)
        .onConflictDoUpdate({
          target: platformAdmins.email,
          set: { role: row.role, note: row.note },
        });
      console.log(`[seed] ensured platform admin "${row.email}" (role=${row.role}).`);
    }
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

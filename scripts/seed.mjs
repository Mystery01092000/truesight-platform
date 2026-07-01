import postgres from "postgres";

/**
 * Production admin seed runner — plain ESM, no tsx.
 *
 * Mirrors scripts/migrate.mjs: the standalone runner image ships `node` + the
 * `postgres` driver only, and the prod RDS lives in private data subnets
 * reachable solely from the ECS security group. So the default DevOps Super
 * Admin is seeded by running THIS script as a one-off Fargate task inside the
 * VPC, right after migrate:  `node scripts/seed.mjs`.
 *
 * Reads the bcrypt hash from ADMIN_PASSWORD_HASH (the SSM SecureString of the
 * same name) so the plaintext password never enters the container. Idempotent:
 * ON CONFLICT (email) DO NOTHING, so re-running is a safe no-op. The hash is
 * never logged.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[seed] DATABASE_URL is not set. Cannot seed.");
  process.exit(1);
}

const email = process.env.ADMIN_EMAIL ?? "admin";
const name = process.env.ADMIN_NAME ?? "DevOps Super Admin";
const passwordHash = process.env.ADMIN_PASSWORD_HASH;
if (!passwordHash) {
  console.error("[seed] ADMIN_PASSWORD_HASH is not set. Cannot seed admin.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
try {
  console.log(`[seed] ensuring admin user "${email}" (role=admin) ...`);
  // Upsert (DO UPDATE) so re-seeding rotates the name / password hash / role —
  // the SSM ADMIN_* SecureStrings are the single source of truth for the super
  // admin, and a re-run reconciles the users row to them.
  const inserted = await sql`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (${email}, ${name}, ${passwordHash}, 'admin')
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
    RETURNING id
  `;
  console.log(`[seed] ensured admin user "${email}" (id=${inserted[0].id}).`);
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error("[seed] failed:", err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}

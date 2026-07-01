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
const passwordHash = process.env.ADMIN_PASSWORD_HASH;
if (!passwordHash) {
  console.error("[seed] ADMIN_PASSWORD_HASH is not set. Cannot seed admin.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
try {
  console.log(`[seed] ensuring admin user "${email}" (role=admin) ...`);
  const inserted = await sql`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (${email}, 'DevOps Super Admin', ${passwordHash}, 'admin')
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  if (inserted.length > 0) {
    console.log(`[seed] created admin user "${email}" (id=${inserted[0].id}).`);
  } else {
    console.log(`[seed] admin user "${email}" already exists — left unchanged.`);
  }
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error("[seed] failed:", err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}

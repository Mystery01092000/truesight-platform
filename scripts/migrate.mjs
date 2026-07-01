import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Production migration runner — plain ESM, no tsx/drizzle-kit.
 *
 * The standalone runner image ships `node` only, and the prod RDS lives in
 * private data subnets reachable solely from the ECS security group. So schema
 * is applied by running THIS script as a one-off Fargate task inside the VPC,
 * before the service scales up:  `node scripts/migrate.mjs`.
 *
 * Mirrors db/migrate.ts: a single short-lived connection (max: 1) so the task
 * exits cleanly. Idempotent — drizzle records applied migrations, so a re-run
 * is a no-op, which keeps the Jenkins pre-deploy migration step safe to repeat.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[migrate] DATABASE_URL is not set. Cannot run migrations.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
try {
  const db = drizzle(sql);
  console.log("[migrate] applying migrations from ./db/migrations ...");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("[migrate] done — database is up to date.");
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error("[migrate] failed:", err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { platformAdmins } from "@/db/schema";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Platform-admins allowlist management (admin-only — `settings:write` maps to
 * exactly the admin role).
 *
 * GET    — list every allowlist row.
 * POST   — upsert an email → role mapping (keyed on the unique email column).
 * DELETE — remove a row by `?email=`; refuses (409) to remove the last
 *          remaining admin so the platform can never lock itself out.
 *
 * No audit-log helper exists in lib/ yet, so writes are not audit-logged here.
 */

async function requireAdmin(): Promise<
  { session: SessionPayload; failure: null } | { session: null; failure: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { session: null, failure: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!can(session.role, "settings:write")) {
    return { session: null, failure: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { session, failure: null };
}

async function adminRowCount(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(platformAdmins)
    .where(eq(platformAdmins.role, "admin"));
  return row?.n ?? 0;
}

/** GET /api/settings/admins — the full allowlist, oldest first. */
export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const admins = await db
    .select()
    .from(platformAdmins)
    .orderBy(asc(platformAdmins.createdAt));
  return NextResponse.json({ admins });
}

const POST_BODY = z.object({
  email: z.email().max(320),
  role: z.enum(["admin", "operator", "viewer"]),
  note: z.string().max(500).optional(),
});

/** POST /api/settings/admins — upsert {email, role, note?}. */
export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = POST_BODY.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { role, note } = parsed.data;

  // Demoting the last admin is the same lockout as deleting it — refuse both.
  if (role !== "admin") {
    const [existing] = await db
      .select({ role: platformAdmins.role })
      .from(platformAdmins)
      .where(eq(platformAdmins.email, email))
      .limit(1);
    if (existing?.role === "admin" && (await adminRowCount()) <= 1) {
      return NextResponse.json(
        { error: "last_admin", message: "Cannot demote the last remaining admin." },
        { status: 409 },
      );
    }
  }

  const [row] = await db
    .insert(platformAdmins)
    .values({ email, role, note: note ?? null })
    .onConflictDoUpdate({
      target: platformAdmins.email,
      set: { role, note: note ?? null },
    })
    .returning();

  return NextResponse.json({ ok: true, admin: row });
}

/** DELETE /api/settings/admins?email= — remove a row (never the last admin). */
export async function DELETE(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const raw = new URL(request.url).searchParams.get("email");
  const email = raw?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email query param required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.email, email))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (existing.role === "admin" && (await adminRowCount()) <= 1) {
    return NextResponse.json(
      { error: "last_admin", message: "Cannot remove the last remaining admin." },
      { status: 409 },
    );
  }

  await db.delete(platformAdmins).where(eq(platformAdmins.email, email));
  return NextResponse.json({ ok: true });
}

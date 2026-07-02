import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformAdmins, users } from "@/db/schema";
import type { EntraClaims } from "@/lib/auth/oidc";
import type { AuthProvider, AuthedUser } from "@/lib/auth/providers/types";
import type { Role } from "@/lib/auth/rbac";

/**
 * Azure AD / Entra ID SSO provider. Input is VALIDATED id_token claims — the
 * callback route owns the OIDC dance (lib/auth/oidc.ts) and only calls this after
 * signature/iss/aud/nonce checks pass. Resolves claims to a local `users` row and
 * returns the same AuthedUser shape as the credentials provider.
 */
export type EntraInput = EntraClaims;

export const azureEntraProvider: AuthProvider<EntraInput> = {
  id: "azure-entra",
  async authenticate({ oid, email, name }): Promise<AuthedUser> {
    const normalized = email.trim().toLowerCase();

    // platform_admins allowlist is the db source of truth for elevated roles.
    const [allowlisted] = await db
      .select({ role: platformAdmins.role })
      .from(platformAdmins)
      .where(eq(platformAdmins.email, normalized))
      .limit(1);

    // Upsert by email: link the Entra oid and refresh the display name.
    // passwordHash stays null for SSO-only users. Role: allowlist wins when
    // present; otherwise new users default to viewer and existing users keep
    // whatever role they already have.
    const [row] = await db
      .insert(users)
      .values({
        email: normalized,
        name,
        entraOid: oid,
        ...(allowlisted ? { role: allowlisted.role } : {}),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name,
          entraOid: oid,
          ...(allowlisted ? { role: allowlisted.role } : {}),
        },
      })
      .returning();

    return {
      id: row.id,
      email: row.email,
      name: row.name ?? row.email,
      role: (row.role as Role) ?? "viewer",
    };
  },
};

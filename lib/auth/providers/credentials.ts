import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AuthError, type AuthProvider, type AuthedUser } from "@/lib/auth/providers/types";
import type { Role } from "@/lib/auth/rbac";

export interface CredentialsInput {
  email: string;
  password: string;
}

/** Verifies email + password against the `users` table (bcrypt). */
export const credentialsProvider: AuthProvider<CredentialsInput> = {
  id: "credentials",
  async authenticate({ email, password }) {
    const trimmed = email.trim().toLowerCase();
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, trimmed))
      .limit(1);

    // Constant-ish work whether or not the user exists (avoid user enumeration timing).
    const hash = row?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidin";
    const ok = await bcrypt.compare(password, hash);
    if (!row || !ok) throw new AuthError("Incorrect email or password.");

    const authed: AuthedUser = {
      id: row.id,
      email: row.email,
      name: row.name ?? row.email,
      role: (row.role as Role) ?? "viewer",
    };
    return authed;
  },
};

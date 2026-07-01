import type { Role } from "@/lib/auth/rbac";

/** The identity every auth provider resolves to — the SSO slot's contract. */
export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * A pluggable authentication strategy. `credentials` implements this today;
 * `azure-entra` (OIDC) will implement the same interface later and return the
 * identical AuthedUser, so nothing downstream changes when SSO lands.
 */
export interface AuthProvider<Input = unknown> {
  readonly id: string;
  authenticate(input: Input): Promise<AuthedUser>;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

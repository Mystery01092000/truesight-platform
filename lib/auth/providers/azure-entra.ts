import "server-only";
import { AuthError, type AuthProvider, type AuthedUser } from "@/lib/auth/providers/types";

/**
 * Azure AD / Entra ID SSO slot. Not wired yet — it implements the SAME AuthProvider
 * contract and will return the SAME AuthedUser shape, so enabling SSO later is purely
 * additive (OIDC code-exchange → resolve/link user → identical session JWT).
 *
 * Deliberately throws until configured, rather than silently faking a login.
 */
export interface EntraInput {
  code: string;
  redirectUri: string;
}

export const azureEntraProvider: AuthProvider<EntraInput> = {
  id: "azure-entra",
  async authenticate(): Promise<AuthedUser> {
    throw new AuthError(
      "Azure AD SSO is not enabled yet. Use credential sign-in.",
    );
  },
};

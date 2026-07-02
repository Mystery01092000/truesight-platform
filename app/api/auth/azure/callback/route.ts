import { NextResponse, type NextRequest } from "next/server";
import {
  clearOidcCookies,
  exchangeCode,
  nextFromState,
  oidcConfig,
  readOidcCookies,
  validateIdToken,
} from "@/lib/auth/oidc";
import { azureEntraProvider } from "@/lib/auth/providers/azure-entra";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(next: string | null): string {
  // Only allow same-origin app paths (avoid open-redirect).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/overview";
}

/**
 * Entra redirect target: verify state against its cookie, redeem the code (PKCE),
 * validate the id_token (signature/iss/aud/nonce), resolve the local user, mint the
 * session. Every failure collapses to /login?error=sso — details only go to the
 * server log, never the browser.
 */
export async function GET(req: NextRequest) {
  const { origin } = req.nextUrl;
  try {
    const cfg = oidcConfig();
    if (!cfg) throw new Error("AZURE_SSO_* env vars missing");

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const cookies = await readOidcCookies();
    if (!code || !state || !cookies.state || !cookies.verifier || !cookies.nonce) {
      throw new Error("missing code/state or OIDC transaction cookies");
    }
    if (state !== cookies.state) throw new Error("state mismatch");

    const { idToken } = await exchangeCode(cfg, { code, codeVerifier: cookies.verifier });
    const claims = await validateIdToken(cfg, idToken, cookies.nonce);
    const user = await azureEntraProvider.authenticate(claims);
    await createSession(user);
    await clearOidcCookies();

    return NextResponse.redirect(new URL(safeNext(nextFromState(state)), origin));
  } catch (err) {
    console.error("[auth/azure/callback] SSO sign-in failed:", err);
    await clearOidcCookies();
    return NextResponse.redirect(new URL("/login?error=sso", origin));
  }
}

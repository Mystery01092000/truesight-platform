import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizeUrl, oidcConfig, setOidcCookies } from "@/lib/auth/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(next: string | null): string {
  // Only allow same-origin app paths (avoid open-redirect).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/overview";
}

/** Kick off the Entra sign-in: mint state/PKCE/nonce, park them in cookies, redirect. */
export async function GET(req: NextRequest) {
  const cfg = oidcConfig();
  if (!cfg) {
    return NextResponse.redirect(new URL("/login?error=sso-unconfigured", req.nextUrl.origin));
  }

  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const { url, state, nonce, codeVerifier } = await buildAuthorizeUrl(cfg, next);
  await setOidcCookies({ state, verifier: codeVerifier, nonce });
  return NextResponse.redirect(url);
}

import "server-only";
import { cookies } from "next/headers";
import { base64url, createRemoteJWKSet, jwtVerify } from "jose";
import { serverEnv } from "@/lib/config/env";

/**
 * Azure Entra ID OIDC (authorization-code + PKCE) helpers — jose only, no OIDC
 * client dependency. Tenant-pinned endpoints: multi-tenant sign-in is deliberately
 * NOT supported. Routes under /api/auth/azure own the browser round-trips; this
 * module owns URL building, code exchange, id_token validation and the short-lived
 * transaction cookies.
 */

export interface OidcConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Exact redirect URI registered in the Entra app — derived from APP_URL. */
  redirectUri: string;
}

/** Resolve SSO config from env, or null when any AZURE_SSO_* var is missing. */
export function oidcConfig(): OidcConfig | null {
  const env = serverEnv();
  if (!env.AZURE_SSO_TENANT_ID || !env.AZURE_SSO_CLIENT_ID || !env.AZURE_SSO_CLIENT_SECRET) {
    return null;
  }
  return {
    tenantId: env.AZURE_SSO_TENANT_ID,
    clientId: env.AZURE_SSO_CLIENT_ID,
    clientSecret: env.AZURE_SSO_CLIENT_SECRET,
    redirectUri: new URL("/api/auth/azure/callback", env.APP_URL).toString(),
  };
}

function randomToken(): string {
  return base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
}

async function s256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url.encode(new Uint8Array(digest));
}

export interface AuthorizeRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

/**
 * Build the tenant-pinned authorize URL with fresh state/nonce/PKCE material.
 * `next` (a pre-validated app-relative path) rides inside the state token, so the
 * callback recovers it after the exact-match check against the state cookie.
 */
export async function buildAuthorizeUrl(cfg: OidcConfig, next: string): Promise<AuthorizeRequest> {
  const state = `${randomToken()}.${base64url.encode(new TextEncoder().encode(next))}`;
  const nonce = randomToken();
  const codeVerifier = randomToken();

  const url = new URL(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", await s256Challenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");

  return { url: url.toString(), state, nonce, codeVerifier };
}

/** Recover the `next` path embedded in a state token (call AFTER the cookie match). */
export function nextFromState(state: string): string | null {
  const dot = state.indexOf(".");
  if (dot === -1) return null;
  try {
    return new TextDecoder().decode(base64url.decode(state.slice(dot + 1)));
  } catch {
    return null;
  }
}

/** Redeem the authorization code (client_secret_post + PKCE verifier) for an id_token. */
export async function exchangeCode(
  cfg: OidcConfig,
  opts: { code: string; codeVerifier: string },
): Promise<{ idToken: string }> {
  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: cfg.redirectUri,
      code_verifier: opts.codeVerifier,
      scope: "openid profile email",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`OIDC token exchange failed with status ${res.status}`);
  }
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) {
    throw new Error("OIDC token response missing id_token");
  }
  return { idToken: body.id_token };
}

/** Identity claims the platform needs from a validated Entra id_token. */
export interface EntraClaims {
  oid: string;
  email: string;
  name: string;
}

// Cache the remote JWKS per tenant so key fetches are amortized across logins.
const jwksByTenant = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(tenantId: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksByTenant.get(tenantId);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
    );
    jwksByTenant.set(tenantId, jwks);
  }
  return jwks;
}

/** Verify signature/iss/aud against the tenant JWKS, then nonce, then extract claims. */
export async function validateIdToken(
  cfg: OidcConfig,
  idToken: string,
  expectedNonce: string,
): Promise<EntraClaims> {
  const { payload } = await jwtVerify(idToken, jwksFor(cfg.tenantId), {
    issuer: `https://login.microsoftonline.com/${cfg.tenantId}/v2.0`,
    audience: cfg.clientId,
  });
  if (typeof payload.nonce !== "string" || payload.nonce !== expectedNonce) {
    throw new Error("id_token nonce mismatch");
  }

  const oid = typeof payload.oid === "string" ? payload.oid : null;
  const email =
    typeof payload.email === "string"
      ? payload.email
      : typeof payload.preferred_username === "string"
        ? payload.preferred_username
        : null;
  if (!oid || !email) {
    throw new Error("id_token missing oid or email/preferred_username claim");
  }
  return { oid, email, name: typeof payload.name === "string" ? payload.name : email };
}

/* ----------------------- OIDC transaction cookies ------------------------ */

const OIDC_COOKIES = {
  state: "truesight_oidc_state",
  verifier: "truesight_oidc_verifier",
  nonce: "truesight_oidc_nonce",
} as const;

// Scoped to the SSO routes only, and short-lived: one login round-trip.
const OIDC_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth/azure",
  maxAge: 600,
};

export async function setOidcCookies(values: {
  state: string;
  verifier: string;
  nonce: string;
}): Promise<void> {
  const store = await cookies();
  store.set(OIDC_COOKIES.state, values.state, OIDC_COOKIE_OPTS);
  store.set(OIDC_COOKIES.verifier, values.verifier, OIDC_COOKIE_OPTS);
  store.set(OIDC_COOKIES.nonce, values.nonce, OIDC_COOKIE_OPTS);
}

export async function readOidcCookies(): Promise<{
  state: string | undefined;
  verifier: string | undefined;
  nonce: string | undefined;
}> {
  const store = await cookies();
  return {
    state: store.get(OIDC_COOKIES.state)?.value,
    verifier: store.get(OIDC_COOKIES.verifier)?.value,
    nonce: store.get(OIDC_COOKIES.nonce)?.value,
  };
}

export async function clearOidcCookies(): Promise<void> {
  const store = await cookies();
  // Expire with the same path the cookies were set on — plain delete() targets "/".
  for (const name of Object.values(OIDC_COOKIES)) {
    store.set(name, "", { ...OIDC_COOKIE_OPTS, maxAge: 0 });
  }
}

import { jwtVerify } from "jose";

/**
 * Edge-safe session verification for middleware. Imports ONLY `jose` (no `server-only`,
 * no `next/headers`) so it bundles into the edge runtime. The dev-secret default must
 * match `lib/config/env.ts` so tokens minted in dev verify here.
 */
export async function verifyEdgeToken(
  token: string,
): Promise<{ sub: string; role: string } | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET || "argus-dev-secret-change-me-in-prod",
    );
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: String(payload.role ?? "viewer") };
  } catch {
    return null;
  }
}

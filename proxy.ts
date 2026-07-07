import { NextResponse, type NextRequest } from "next/server";
import { verifyEdgeToken } from "@/lib/auth/edge";

const SESSION_COOKIE = "truesight_session";

/** Authenticated app segments + API. Public: /, /login, /api/health, /api/auth, /api/landing-stats, assets. */
const PROTECTED_PREFIXES = [
  "/overview",
  "/aws",
  "/azure",
  "/github",
  "/topology",
  "/cost",
  "/security",
  "/compliance",
  "/plans",
  "/settings",
  "/developers",
  "/tickets",
  "/kb",
];

function isProtected(pathname: string): boolean {
  if (pathname.startsWith("/api")) {
    return (
      !pathname.startsWith("/api/health") &&
      !pathname.startsWith("/api/auth") &&
      // Coarse, public, unauthenticated landing stats (no secrets, no detail).
      !pathname.startsWith("/api/landing-stats")
    );
  }
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Next.js 16 proxy (formerly `middleware`) — the edge-runtime request gate. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyEdgeToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

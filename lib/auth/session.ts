import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { serverEnv } from "@/lib/config/env";
import type { AuthedUser } from "@/lib/auth/providers/types";
import type { Role } from "@/lib/auth/rbac";

const COOKIE = "truesight_session";
const MAX_AGE_S = 60 * 60 * 8; // 8h sliding session

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(serverEnv().SESSION_SECRET);
}

async function sign(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
}

/** Verify a raw token → payload, or null if invalid/expired. Edge-safe (jose). */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Issue the session cookie for a freshly-authenticated user. */
export async function createSession(user: AuthedUser): Promise<void> {
  const token = await sign({ sub: user.id, email: user.email, name: user.name, role: user.role });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

/** Read + verify the current session from cookies (server components / actions / routes). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;

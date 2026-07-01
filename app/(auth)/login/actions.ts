"use server";

import { redirect } from "next/navigation";
import { credentialsProvider } from "@/lib/auth/providers/credentials";
import { createSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/providers/types";

export interface LoginState {
  error?: string;
}

function safeNext(next: string): string {
  // Only allow same-origin app paths (avoid open-redirect).
  return next.startsWith("/") && !next.startsWith("//") ? next : "/overview";
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/overview"));

  try {
    const user = await credentialsProvider.authenticate({ email, password });
    await createSession(user);
  } catch (e) {
    return {
      error: e instanceof AuthError ? e.message : "Sign-in failed. Please try again.",
    };
  }
  // redirect() throws NEXT_REDIRECT — must run outside the try/catch above.
  redirect(next);
}

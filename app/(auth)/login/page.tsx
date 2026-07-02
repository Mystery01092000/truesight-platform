import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const SSO_ERRORS: Record<string, string> = {
  sso: "Microsoft sign-in failed. Try again or use your email and password.",
  "sso-unconfigured": "Microsoft sign-in is not configured on this environment.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/overview";

  // Already signed in → skip the form.
  if (await getSession()) redirect(next);

  return <LoginForm next={next} ssoError={sp.error ? SSO_ERRORS[sp.error] : undefined} />;
}

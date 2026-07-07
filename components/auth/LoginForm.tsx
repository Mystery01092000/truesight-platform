"use client";

import { useActionState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { loginAction, type LoginState } from "@/app/(auth)/login/actions";
import { Surface } from "@/components/ui/Surface";
import { Button, buttonClass } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Logo } from "@/components/brand/Logo";

export function LoginForm({
  next,
  compact = false,
  ssoError,
}: {
  next: string;
  /**
   * Hero embed: drop the brand mark + heading + tagline (the landing headline
   * already carries the message) and render just a labelled sign-in form.
   * Default is the standalone card used by the /login route.
   */
  compact?: boolean;
  /** SSO failure message resolved server-side from the ?error= query param. */
  ssoError?: string;
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  const emailRef = useRef<HTMLInputElement>(null);

  // Hero embed only: own every same-page "#signin" activation so there is a
  // single, definitive sign-in CTA. Clicking any `a[href="#signin"]` (nav,
  // footer, closing band) — or deep-linking `/#signin` — smooth-scrolls this form
  // into view and moves keyboard focus to the email field. Reduced-motion users
  // get an instant jump. Progressive enhancement: without JS the native anchor
  // still lands on the form.
  useEffect(() => {
    if (!compact) return;

    const scrollToSignin = () => {
      const target = document.getElementById("signin");
      if (!target) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      emailRef.current?.focus({ preventScroll: true });
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const el = e.target as Element | null;
      const anchor = el?.closest('a[href="#signin"]');
      if (!anchor || !document.getElementById("signin")) return;
      e.preventDefault();
      scrollToSignin();
      // Keep the URL deep-linkable without a native re-jump or history spam.
      history.replaceState(null, "", "#signin");
    };

    const onHashChange = () => {
      if (window.location.hash === "#signin") scrollToSignin();
    };

    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHashChange);
    if (window.location.hash === "#signin") {
      // Defer a frame so the target is laid out before we scroll to it.
      requestAnimationFrame(scrollToSignin);
    }

    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [compact]);

  return (
    <Surface
      level={1}
      radius="xl"
      className={compact ? "w-full max-w-sm p-6" : "w-full max-w-sm p-8"}
    >
      {compact ? (
        <span className="text-label font-medium tracking-[0.3px] text-mute">
          Sign in
        </span>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo watching />
          <div>
            <h1 className="text-[20px] font-medium leading-[1.4] text-ink">
              Sign in to Truesight
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute">
              Cloud governance with no blind spots.
            </p>
          </div>
        </div>
      )}

      <form action={formAction} className={cn("flex flex-col gap-4", compact ? "mt-5" : "mt-8")}>
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5">
          <span className="text-label text-mute">Email</span>
          <TextInput
            ref={emailRef}
            name="email"
            type="text"
            autoComplete="username"
            // Standalone /login autofocuses; the hero embed waits for an explicit
            // "Sign in" activation so the landing page doesn't jump on load.
            autoFocus={!compact}
            required
            placeholder="admin"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label text-mute">Password</span>
          <TextInput
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </label>

        {(state.error || ssoError) && (
          <p
            role="alert"
            className="rounded-md bg-accent-red-soft px-3 py-2 text-label leading-[1.5] text-accent-red"
          >
            {state.error ?? ssoError}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={pending} className="mt-2 w-full">
          {pending ? "Signing in…" : "Enter Truesight"}
        </Button>
      </form>

      <div className="mt-4 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-[12px] leading-[1.6] text-mute">or</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <a
        href={`/api/auth/azure/login?next=${encodeURIComponent(next)}`}
        className={buttonClass("secondary", "md", "mt-2 w-full")}
      >
        Continue with Microsoft
      </a>
    </Surface>
  );
}

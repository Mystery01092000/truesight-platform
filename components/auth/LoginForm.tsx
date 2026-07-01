"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils/cn";
import { loginAction, type LoginState } from "@/app/(auth)/login/actions";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Logo } from "@/components/brand/Logo";

export function LoginForm({
  next,
  compact = false,
}: {
  next: string;
  /**
   * Hero embed: drop the brand mark + heading + tagline (the landing headline
   * already carries the message) and render just a labelled sign-in form.
   * Default is the standalone card used by the /login route.
   */
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <Surface
      level={1}
      radius="xl"
      className={compact ? "w-full max-w-sm p-6" : "w-full max-w-sm p-8"}
    >
      {compact ? (
        <span className="text-[13px] font-medium tracking-[0.3px] text-mute">
          Sign in
        </span>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo watching />
          <div>
            <h1 className="text-[20px] font-medium leading-[1.4] text-ink">
              Sign in to Argus
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
          <span className="text-[13px] text-mute">Email</span>
          <TextInput
            name="email"
            type="text"
            autoComplete="username"
            autoFocus
            required
            placeholder="admin"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-mute">Password</span>
          <TextInput
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </label>

        {state.error && (
          <p
            role="alert"
            className="rounded-md bg-accent-red-soft px-3 py-2 text-[13px] leading-[1.5] text-accent-red"
          >
            {state.error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={pending} className="mt-2 w-full">
          {pending ? "Signing in…" : "Enter Argus"}
        </Button>
      </form>
    </Surface>
  );
}

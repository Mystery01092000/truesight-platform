import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Button — the action vocabulary from DESIGN.md.
 * `primary` (the one white CTA pill) anchors every fold; everything else is
 * monochrome. No drop shadows — variants differ only by surface-ladder rung
 * and hairline treatment. Accent color never appears here.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "install"
  | "disabled";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium tracking-[0.2px] transition-colors select-none disabled:cursor-not-allowed disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  // white pill, black label — the universal primary action
  primary: "bg-primary text-on-primary hover:bg-primary-pressed active:bg-primary-pressed",
  // transparent text button — "Sign in", "Learn more"
  secondary: "bg-transparent text-on-dark hover:text-body active:text-mute",
  // soft surface fill — mid-emphasis in-card actions
  tertiary: "bg-surface-elevated text-on-dark hover:bg-surface-card active:bg-surface",
  // transparent + hairline-strong outline — the store "Install" pill
  install: "bg-transparent text-on-dark border border-hairline-strong hover:bg-surface-elevated",
  // dim utility state
  disabled: "bg-surface-elevated text-ash",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-9 px-4 text-[14px] leading-[1.6]",
  sm: "h-8 px-3.5 text-[13px] leading-[1.6]",
};

/** Shared class builder — lets `next/link` anchors wear a button skin without nesting <button> in <a>. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, disabled, ...props }, ref) => {
    const isDisabled = disabled || variant === "disabled";
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={buttonClass(isDisabled ? "disabled" : variant, size, className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

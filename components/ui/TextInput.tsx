import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * TextInput — DESIGN.md text-input. Surface-elevated fill on a hairline border
 * that brightens to hairline-strong on focus. Never a colored ring — the focus
 * cue is a subtle monochrome edge shift, per the system's restraint.
 */
export type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Optional leading glyph (e.g. a search icon), rendered inside the field. */
  icon?: React.ReactNode;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, icon, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-md border border-hairline bg-surface-elevated text-[16px] leading-[1.6] text-on-dark",
          "placeholder:text-ash transition-colors focus:border-hairline-strong focus:outline-none",
          icon ? "pl-9 pr-3" : "px-3",
          className,
        )}
        {...props}
      />
    );
    if (!icon) return input;
    return (
      <div className="relative w-full">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute [&>svg]:size-4"
          aria-hidden
        >
          {icon}
        </span>
        {input}
      </div>
    );
  },
);
TextInput.displayName = "TextInput";

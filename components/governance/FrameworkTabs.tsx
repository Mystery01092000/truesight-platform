"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PillTabs } from "@/components/ui/PillTabs";
import { FRAMEWORK_LIST } from "@/lib/governance/frameworks";
import { cn } from "@/lib/utils/cn";

/**
 * FrameworkTabs — segmented filter that pushes the selected framework into the
 * URL so the server component re-queries and re-renders the checklist section.
 * Navigation runs in a transition so the chrome stays interactive while the
 * filtered data streams.
 */
export function FrameworkTabs({ active }: { active: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const items = [
    { value: "all", label: "All" },
    ...FRAMEWORK_LIST.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <div className={cn(pending && "opacity-60 transition-opacity")}>
      <PillTabs
        aria-label="Filter by framework"
        value={active}
        items={items}
        onChange={(value) => {
          const next = new URLSearchParams(params.toString());
          if (value === "all") next.delete("framework");
          else next.set("framework", value);
          const qs = next.toString();
          startTransition(() =>
            router.replace(qs ? `/compliance?${qs}` : "/compliance", { scroll: false }),
          );
        }}
      />
    </div>
  );
}

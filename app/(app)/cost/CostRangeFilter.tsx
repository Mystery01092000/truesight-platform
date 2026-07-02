"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PillTabs, type PillTabItem } from "@/components/ui/PillTabs";

const ITEMS: PillTabItem[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

/**
 * Cost range filter — segmented control that maps the active window onto the `?range=`
 * query param. Server-side rendering reads the same param, so a tab change re-renders
 * the whole surface with the new window without a separate client fetch.
 */
export function CostRangeFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const onChange = (next: string) => {
    const sp = new URLSearchParams(params?.toString() ?? "");
    sp.set("range", next);
    router.push(`${pathname}?${sp.toString()}`);
  };

  return (
    <PillTabs
      aria-label="Cost time range"
      value={ITEMS.some((i) => i.value === value) ? value : "30d"}
      onChange={onChange}
      items={ITEMS}
    />
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cloud } from "lucide-react";
import { getAwsResources } from "@/lib/estate/query";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { AccountResourceExplorer } from "@/components/estate/AccountResourceExplorer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ account: string }>;
}): Promise<Metadata> {
  const { account } = await params;
  return { title: `AWS · ${decodeURIComponent(account)}` };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AwsAccountPage({
  params,
}: {
  params: Promise<{ account: string }>;
}) {
  const { account } = await params;
  const acct = decodeURIComponent(account);

  // Real rows for this one AWS account (never mocked).
  const resources = await getAwsResources(acct);
  const regionCount = new Set(resources.map((r) => r.region)).size;
  const serviceCount = new Set(resources.map((r) => r.service)).size;

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <div className="mb-5">
          <Link
            href="/aws"
            className="inline-flex items-center gap-1.5 text-[13px] leading-[1.6] text-mute transition-colors hover:text-body"
          >
            <ArrowLeft size={14} />
            AWS estate
          </Link>
        </div>
        <header className="mb-8 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-hairline bg-surface-card"
            aria-hidden
          >
            <Cloud size={22} strokeWidth={1.75} className="text-accent-blue" />
          </span>
          <div>
            <h1 className="font-mono text-[22px] font-medium leading-[1.4] tracking-[0.2px] text-ink tabular-nums">
              {acct}
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute tabular-nums">
              {resources.length > 0
                ? `${plural(resources.length, "resource")} · ${plural(
                    serviceCount,
                    "service",
                  )} · ${plural(regionCount, "region")}`
                : "AWS account"}
            </p>
          </div>
        </header>
      </Reveal>

      {resources.length === 0 ? (
        <Reveal delay={0.1}>
          <Surface level={1} radius="lg" className="p-8 text-center">
            <h2 className="text-[18px] font-medium leading-[1.4] text-ink">
              No resources for this account
            </h2>
            <p className="mx-auto mt-1.5 max-w-prose text-[14px] leading-[1.6] text-body">
              Nothing discovered under{" "}
              <span className="text-on-dark tabular-nums">{acct}</span> yet. Trigger a sync,
              or head back to the estate overview.
            </p>
          </Surface>
        </Reveal>
      ) : (
        <Reveal delay={0.1}>
          <AccountResourceExplorer resources={resources} />
        </Reveal>
      )}
    </div>
  );
}

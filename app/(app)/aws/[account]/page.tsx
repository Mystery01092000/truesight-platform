import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Boxes, Cloud, GitCompareArrows, Globe, Layers } from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { buttonClass } from "@/components/ui/Button";
import { ResourceExplorer } from "@/components/estate/ResourceExplorer";
import { getAwsEstateResources, getDriftedUrns } from "../data";

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
  const [resources, drifted] = await Promise.all([getAwsEstateResources(acct), getDriftedUrns()]);
  const regionCount = new Set(resources.map((r) => r.region)).size;
  const serviceCount = new Set(resources.map((r) => r.service)).size;
  const driftCount = resources.filter((r) => drifted.has(r.urn)).length;

  const stats = [
    { label: "Resources", value: resources.length, icon: <Boxes /> },
    { label: "Services", value: serviceCount, icon: <Layers /> },
    { label: "Regions", value: regionCount, icon: <Globe /> },
    { label: "Drift findings", value: driftCount, icon: <GitCompareArrows /> },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <div className="mb-5">
          <Link
            href="/aws"
            className="inline-flex items-center gap-1.5 text-label leading-[1.6] text-mute transition-colors hover:text-body"
          >
            <ArrowLeft size={14} />
            AWS estate
          </Link>
        </div>
        <PageHeader
          title={acct}
          titleClassName="font-mono tabular-nums"
          icon={<Cloud size={22} strokeWidth={1.75} className="text-accent-blue" />}
          description={
            <span className="tabular-nums">
              {resources.length > 0
                ? `${plural(resources.length, "resource")} · ${plural(
                    serviceCount,
                    "service",
                  )} · ${plural(regionCount, "region")}`
                : "AWS account"}
            </span>
          }
        />
      </Reveal>

      {resources.length === 0 ? (
        <Reveal delay={0.08}>
          <EmptyState
            icon={<Cloud />}
            title="No resources for this account"
            description={`Nothing discovered under ${acct} yet. Trigger a sync, or head back to the estate overview.`}
            action={
              <Link href="/aws" className={buttonClass("install", "sm")}>
                Back to AWS estate
              </Link>
            }
          />
        </Reveal>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={Math.min(i, 8) * 0.04}>
                <StatTile label={s.label} value={s.value} icon={s.icon} />
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.12}>
            <ResourceExplorer
              resources={resources}
              provider="aws"
              storageKey={`argus:aws:account:${acct}`}
            />
          </Reveal>
        </>
      )}
    </div>
  );
}

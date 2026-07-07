import type { Metadata } from "next";
import Link from "next/link";
import { Hammer } from "lucide-react";
import { listPlans } from "@/lib/forge/store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreatePlanButton } from "@/components/forge/CreatePlanButton";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Forge" };
export const dynamic = "force-dynamic";

export default async function ForgePage() {
  const plans = await listPlans();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={<Hammer size={20} strokeWidth={1.5} className="text-mute" />}
        title="Forge"
        description="Design multi-cloud infrastructure on a canvas — Truesight writes and runs the Terraform."
        actions={<CreatePlanButton />}
      />
      {plans.length === 0 ? (
        <EmptyState
          icon={<Hammer />}
          title="Nothing forged yet"
          description="Create a plan, drag AWS and Azure services onto the canvas, and deploy them with Terraform."
        />
      ) : (
        <Surface level={1} radius="lg" className="divide-y divide-hairline">
          {plans.map((p) => (
            <Link
              key={p.id}
              href={`/forge/${p.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-card"
            >
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-ink">{p.name}</div>
                <div className="text-[12px] text-mute">
                  {p.canvasJson.nodes.length} resources · v{p.version} · updated {formatDate(p.updatedAt)}
                </div>
              </div>
              <Badge>{p.status}</Badge>
            </Link>
          ))}
        </Surface>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getPlan } from "@/lib/forge/store";
import { ForgeStudio } from "@/components/forge/ForgeStudio";

export const metadata: Metadata = { title: "Forge studio" };
export const dynamic = "force-dynamic";

export default async function ForgePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/forge");
  if (!can(session.role, "forge:read")) redirect("/overview");

  const { id } = await params;
  const plan = await getPlan(id).catch(() => null);
  if (!plan) notFound();

  return (
    <ForgeStudio
      plan={{ id: plan.id, name: plan.name, status: plan.status, canvasJson: plan.canvasJson }}
      canWrite={can(session.role, "forge:write")}
      canDeploy={can(session.role, "forge:deploy")}
    />
  );
}

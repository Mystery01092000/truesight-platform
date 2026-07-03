import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { KbAskPanel } from "@/components/kb/KbAskPanel";
import { KbSearch } from "@/components/kb/KbSearch";
import { KbStatusCards } from "@/components/kb/KbStatusCards";
import { KbDocumentList } from "@/components/kb/KbDocumentList";
import { KbUploader } from "@/components/kb/KbUploader";

export const metadata: Metadata = { title: "Knowledge Base" };
export const dynamic = "force-dynamic";

export default function KbPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <PageHeader
          title="Knowledge Base"
          iconTone="iris"
          icon={<BookOpen size={22} strokeWidth={1.75} className="text-iris" />}
          description="Query, manage and extend Argus memory across docs, snapshots, GitHub and Terraform state."
        />
      </Reveal>

      <KbStatusCards />

      <Reveal delay={0.08}>
        <div className="mt-4">
          <KbAskPanel />
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <KbSearch />
          </div>
          <div>
            <KbUploader />
          </div>
        </div>
      </Reveal>

      <div className="mt-4">
        <KbDocumentList />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
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
        <header className="mb-8 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
            aria-hidden
          >
            <BookOpen size={22} strokeWidth={1.75} className="text-iris" />
          </span>
          <div>
            <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Knowledge Base
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute">
              Query, manage and extend Argus memory across docs, snapshots, GitHub and Terraform state.
            </p>
          </div>
        </header>
      </Reveal>

      <KbStatusCards />

      <Reveal delay={0.1}>
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

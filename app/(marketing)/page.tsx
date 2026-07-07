import { ArrowRight } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Surface } from "@/components/ui/Surface";
import { LoginForm } from "@/components/auth/LoginForm";
import { CapabilityGrid } from "@/components/marketing/CapabilityGrid";
import { ConnectStrip } from "@/components/marketing/ConnectStrip";
import { EstateAtlas } from "@/components/marketing/EstateAtlas";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { StatsStrip } from "@/components/marketing/StatsStrip";

/*
 * Landing — developer-first hero (split copy + sign-in beside the live estate
 * atlas), a mono stats strip fed by /api/landing-stats, the hybrid capability
 * grid, the one-line trust diagram, and the closing band. Hero uses the
 * mount-triggered Reveal; every below-fold section gets exactly one
 * scroll-into-view SectionReveal.
 */
export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero — narrative + inline sign-in beside a live estate dashboard */}
      <section className="mx-auto grid w-full max-w-[1240px] items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div className="flex w-full flex-col items-start gap-6">
          <Reveal>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[12px] tracking-[0.2px] text-mute">
              <span className="inline-flex items-center gap-2 rounded-sm border border-hairline bg-surface px-2.5 py-1">
                <span className="size-1.5 rounded-full bg-accent-yellow/80" />
                aws · 3 accounts
              </span>
              <span className="inline-flex items-center gap-2 rounded-sm border border-hairline bg-surface px-2.5 py-1">
                <span className="size-1.5 rounded-full bg-accent-blue/80" />
                azure · rg-arcane-prod
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="max-w-xl text-[40px] font-semibold leading-[1.08] tracking-[0.2px] text-ink md:text-[52px]">
              See what&apos;s actually running.
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-lg text-[17px] leading-[1.6] text-body">
              Truesight discovers your AWS and Azure estates read-only, diffs them against
              Terraform state, and keeps the evidence in one pane. No agents to run, no
              state handed over, no blind spots.
            </p>
          </Reveal>
          <Reveal delay={0.16} className="w-full">
            {/* The one definitive sign-in CTA — every #signin anchor scrolls here. */}
            <div id="signin" className="scroll-mt-24">
              <LoginForm next="/overview" compact />
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.12} className="flex justify-center md:justify-end">
          <EstateAtlas />
        </Reveal>
      </section>

      {/* Live estate figures — honest counts or em-dashes, never invented */}
      <section className="border-y border-hairline bg-surface/40">
        <SectionReveal className="mx-auto w-full max-w-[1240px] px-6">
          <StatsStrip />
        </SectionReveal>
      </section>

      {/* Capability grid — one active tile, idle-gated auto-advance */}
      <section className="mx-auto w-full max-w-[1240px] px-6 py-16 md:py-24">
        <SectionReveal>
          <div className="mb-12 flex max-w-xl flex-col gap-3">
            <h2 className="text-[36px] font-medium leading-[1.15] tracking-[0.2px] text-ink">
              One watcher. Five ways it sees.
            </h2>
            <p className="text-[18px] leading-[1.6] text-body">
              From discovery to drift, cost to compliance — every angle of your estate,
              always in focus.
            </p>
          </div>
          <CapabilityGrid />
        </SectionReveal>
      </section>

      {/* How it connects — the trust story in one mono line */}
      <section className="border-y border-hairline">
        <SectionReveal className="mx-auto w-full max-w-[1240px] px-6 py-10">
          <ConnectStrip />
        </SectionReveal>
      </section>

      {/* Closing band */}
      <section className="mx-auto w-full max-w-[1240px] px-6 py-20 md:py-28">
        <SectionReveal>
          <Surface level={1} radius="xl" className="flex flex-col items-center gap-6 px-6 py-16 text-center">
            <h2 className="max-w-2xl text-[36px] font-medium leading-[1.15] tracking-[0.2px] text-ink md:text-[44px]">
              One pane across your entire DevOps lifecycle.
            </h2>
            <p className="max-w-xl text-[18px] leading-[1.6] text-body">
              GitHub, AWS, Azure, and Terraform — discovered, visualized, and governed from a
              single surface. Stateless by design, live by default.
            </p>
            <a href="#signin" className={buttonClass("primary", "md")}>
              Enter Truesight
              <ArrowRight size={16} strokeWidth={2} />
            </a>
          </Surface>
        </SectionReveal>
      </section>
    </div>
  );
}

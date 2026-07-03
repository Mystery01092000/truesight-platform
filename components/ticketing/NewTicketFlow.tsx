"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Ticket, ArrowLeft, Check } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, buttonClass } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { GuidedFlow, type GuidedStep } from "@/components/ui/GuidedFlow";
import { ToolMultiSelect } from "@/components/ticketing/ToolMultiSelect";
import { AccessModeMatrix, type AccessModeMap } from "@/components/ticketing/AccessModeMatrix";
import {
  ResourceIdentityFields,
  type ResourceIdentityMap,
} from "@/components/ticketing/ResourceIdentityFields";
import { TIMELINE_OPTIONS, TOOL_LABELS, type Tool } from "@/lib/ticketing/types";
import { cn } from "@/lib/utils/cn";

const SPRING = { type: "spring", stiffness: 220, damping: 26 } as const;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const STEP_DEFS = [
  { id: "identity", label: "Identity" },
  { id: "tools", label: "Tools & access" },
  { id: "purpose", label: "Purpose & timeline" },
  { id: "review", label: "Review & submit" },
] as const;

type Errors = Partial<Record<string, string>>;

/**
 * NewTicketFlow — the developer-tools access request restructured as a
 * GuidedFlow journey (Identity → Tools & access → Purpose & timeline →
 * Review & submit). Purely presentational: every field name and the
 * POST /api/tickets contract are identical to the previous single-card form.
 */
export function NewTicketFlow() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<boolean[]>(STEP_DEFS.map(() => false));

  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [project, setProject] = useState("");
  const [reportingManager, setReportingManager] = useState("");
  const [tools, setTools] = useState<Tool[]>([]);
  const [purpose, setPurpose] = useState("");
  const [timeline, setTimeline] = useState("");
  const [timelineCustom, setTimelineCustom] = useState("");
  const [accessModes, setAccessModes] = useState<AccessModeMap>({});
  const [resourceIdentities, setResourceIdentities] = useState<ResourceIdentityMap>({});
  const [vpnAccess, setVpnAccess] = useState<boolean | null>(null);
  const [vpnMacAddress, setVpnMacAddress] = useState("");
  const [managerApproved, setManagerApproved] = useState<boolean | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // ---- Validation, partitioned per step -----------------------------------
  const identityErrors: Errors = {};
  if (!name.trim()) identityErrors.name = "Name is required.";
  if (!team.trim()) identityErrors.team = "Team is required.";
  if (!project.trim()) identityErrors.project = "Project is required.";
  if (!reportingManager.trim())
    identityErrors.reportingManager = "Reporting manager is required.";

  const toolsErrors: Errors = {};
  if (tools.length === 0) toolsErrors.tools = "Select at least one tool.";
  for (const t of tools) {
    if (!accessModes[t])
      toolsErrors.tools = `Pick an access mode for each tool (${TOOL_LABELS[t]} missing).`;
  }
  if (vpnAccess === null) toolsErrors.vpnAccess = "Select yes or no.";
  if (vpnAccess && !vpnMacAddress.trim())
    toolsErrors.vpnMacAddress = "MAC address is required when VPN access is yes.";

  const purposeErrors: Errors = {};
  if (!timeline) purposeErrors.timeline = "Select a timeline.";
  else if (timeline === "custom" && !timelineCustom.trim())
    purposeErrors.timelineCustom = "Describe the custom timeline.";
  if (managerApproved === null) purposeErrors.managerApproved = "Confirm manager approval.";
  else if (managerApproved === false)
    purposeErrors.managerApproved =
      "Your reporting manager must approve before the request can be raised.";

  const stepErrors: Errors[] = [identityErrors, toolsErrors, purposeErrors, {}];
  const formValid =
    Object.keys(identityErrors).length === 0 &&
    Object.keys(toolsErrors).length === 0 &&
    Object.keys(purposeErrors).length === 0 &&
    managerApproved === true;

  const errors = (i: number): Errors => (touched[i] ? stepErrors[i] : {});

  // ---- Navigation ----------------------------------------------------------
  function markTouched(i: number) {
    setTouched((prev) => prev.map((t, idx) => (idx === i ? true : t)));
  }

  function handleNext() {
    if (Object.keys(stepErrors[step]).length > 0) {
      markTouched(step);
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_DEFS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  const steps: GuidedStep[] = STEP_DEFS.map((s, i) => ({
    id: s.id,
    label: s.label,
    status: i < step ? "done" : i === step ? "active" : "pending",
  }));

  // ---- Submit (unchanged contract) -----------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(STEP_DEFS.map(() => true));
    setServerError(null);
    if (!formValid) return;

    setSubmitting(true);
    try {
      const resources = tools.map((tool) => ({
        tool,
        accessMode: accessModes[tool]!,
        resourceIdentity: resourceIdentities[tool]?.trim() || undefined,
      }));

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          team: team.trim(),
          project: project.trim(),
          reportingManager: reportingManager.trim(),
          tools,
          purpose: purpose.trim() || undefined,
          timeline,
          timelineCustom: timeline === "custom" ? timelineCustom.trim() : undefined,
          resources,
          vpnAccess,
          vpnMacAddress: vpnAccess ? vpnMacAddress.trim() : undefined,
          managerApproved,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setServerError(
          Array.isArray(data?.errors) ? data.errors.join(" ") : data?.error ?? "Failed to submit.",
        );
        return;
      }
      setCreatedId(data.ticket.id);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Success state -------------------------------------------------------
  if (createdId) {
    return (
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <Surface level={1} radius="lg" className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 grid size-12 place-items-center rounded-lg border border-iris bg-iris-soft">
              <Check size={24} strokeWidth={2} className="text-iris" />
            </div>
            <h1 className="font-display text-[22px] font-medium leading-[1.3] text-ink">
              Request submitted
            </h1>
            <p className="mt-2 max-w-sm text-[14px] leading-[1.6] text-mute">
              Your access request is on its way to Peeyush for review. You&rsquo;ll get an email
              once access is provisioned.
            </p>
            <p className="mt-4 font-mono text-[12px] text-ash">Reference {createdId}</p>
            <div className="mt-6 flex items-center gap-3">
              <Link href={`/tickets/${createdId}`} className={buttonClass("primary", "md")}>
                View request
              </Link>
              <Button variant="secondary" onClick={() => router.push("/tickets")}>
                Back to tickets
              </Button>
            </div>
          </Surface>
        </Reveal>
      </div>
    );
  }

  // ---- Step nav row (rendered inside the animated step content) -----------
  const navRow = (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-hairline pt-4">
      {step === 0 ? (
        <Link href="/tickets" className={buttonClass("tertiary", "sm")}>
          <ArrowLeft size={14} strokeWidth={1.75} />
          Cancel
        </Link>
      ) : (
        <Button type="button" variant="tertiary" size="sm" onClick={handleBack}>
          Back
        </Button>
      )}
      <span className="font-mono text-[12px] tabular-nums text-mute">
        {step + 1} / {STEP_DEFS.length}
      </span>
      {step < STEP_DEFS.length - 1 ? (
        <Button type="button" variant="primary" size="sm" onClick={handleNext}>
          Next
        </Button>
      ) : (
        <Button type="submit" variant="primary" size="sm" disabled={!formValid || submitting}>
          {submitting ? "Submitting…" : "Raise Request"}
        </Button>
      )}
    </div>
  );

  // ---- Form ----------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <PageHeader
          title="Raise access request"
          iconTone="iris"
          icon={<Ticket size={22} strokeWidth={1.75} className="text-iris" />}
          description="Tell us what you need and we'll route it through approval."
        />
      </Reveal>

      <Reveal delay={0.06}>
        {/* Step progress — one 250ms width tween per advance, never looping. */}
        <div className="mb-4 h-0.5 overflow-hidden rounded-full bg-surface-elevated" aria-hidden>
          <motion.div
            className="h-full rounded-full bg-iris"
            initial={false}
            animate={{ width: `${((step + 1) / STEP_DEFS.length) * 100}%` }}
            transition={reduced ? { duration: 0 } : { duration: 0.25, ease: EASE }}
          />
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <GuidedFlow steps={steps} activeIndex={step} readOnly>
            {step === 0 && (
              <div className="space-y-5">
                <FieldRow label="Name" required error={errors(0).name}>
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </FieldRow>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FieldRow label="Team" required error={errors(0).team}>
                    <TextInput
                      value={team}
                      onChange={(e) => setTeam(e.target.value)}
                      placeholder="e.g. ai-services"
                    />
                  </FieldRow>
                  <FieldRow label="Project" required error={errors(0).project}>
                    <TextInput
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      placeholder="Project name"
                    />
                  </FieldRow>
                </div>
                <FieldRow
                  label="Reporting Manager / Lead"
                  required
                  error={errors(0).reportingManager}
                >
                  <TextInput
                    value={reportingManager}
                    onChange={(e) => setReportingManager(e.target.value)}
                    placeholder="Manager or lead"
                  />
                </FieldRow>
                {navRow}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <FieldRow label="Access for tools" required error={errors(1).tools}>
                  <ToolMultiSelect value={tools} onChange={setTools} />
                </FieldRow>

                {tools.length > 0 &&
                  (reduced ? (
                    <div className="space-y-5">
                      <FieldRow label="Access modes" required>
                        <AccessModeMatrix tools={tools} value={accessModes} onChange={setAccessModes} />
                      </FieldRow>
                      <FieldRow label="Resources in scope">
                        <ResourceIdentityFields
                          tools={tools}
                          team={team}
                          value={resourceIdentities}
                          onChange={setResourceIdentities}
                        />
                      </FieldRow>
                    </div>
                  ) : (
                    <motion.div
                      className="space-y-5"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={SPRING}
                    >
                      <FieldRow label="Access modes" required>
                        <AccessModeMatrix tools={tools} value={accessModes} onChange={setAccessModes} />
                      </FieldRow>
                      <FieldRow label="Resources in scope">
                        <ResourceIdentityFields
                          tools={tools}
                          team={team}
                          value={resourceIdentities}
                          onChange={setResourceIdentities}
                        />
                      </FieldRow>
                    </motion.div>
                  ))}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FieldRow
                    label="Already have VPN access?"
                    required
                    error={errors(1).vpnAccess}
                  >
                    <Select
                      value={vpnAccess === null ? "" : vpnAccess ? "yes" : "no"}
                      onChange={(v) => setVpnAccess(v === "yes")}
                      placeholder="Select"
                      options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                      ]}
                    />
                  </FieldRow>
                  {vpnAccess &&
                    (reduced ? (
                      <FieldRow label="MAC address" required error={errors(1).vpnMacAddress}>
                        <TextInput
                          value={vpnMacAddress}
                          onChange={(e) => setVpnMacAddress(e.target.value)}
                          placeholder="00:1A:2B:3C:4D:5E"
                        />
                      </FieldRow>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={SPRING}
                      >
                        <FieldRow label="MAC address" required error={errors(1).vpnMacAddress}>
                          <TextInput
                            value={vpnMacAddress}
                            onChange={(e) => setVpnMacAddress(e.target.value)}
                            placeholder="00:1A:2B:3C:4D:5E"
                          />
                        </FieldRow>
                      </motion.div>
                    ))}
                </div>
                {navRow}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <FieldRow label="Purpose">
                  <TextInput
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Why do you need this access? (optional)"
                  />
                </FieldRow>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FieldRow label="Timeline" required error={errors(2).timeline}>
                    <Select
                      value={timeline}
                      onChange={setTimeline}
                      placeholder="Select duration"
                      options={TIMELINE_OPTIONS}
                    />
                  </FieldRow>
                  {timeline === "custom" && (
                    <FieldRow label="Custom timeline" required error={errors(2).timelineCustom}>
                      <TextInput
                        value={timelineCustom}
                        onChange={(e) => setTimelineCustom(e.target.value)}
                        placeholder="e.g. 6 weeks"
                      />
                    </FieldRow>
                  )}
                </div>
                <FieldRow
                  label="Approved by Reporting Manager / Lead?"
                  required
                  error={errors(2).managerApproved}
                >
                  <Select
                    value={managerApproved === null ? "" : managerApproved ? "yes" : "no"}
                    onChange={(v) => setManagerApproved(v === "yes")}
                    placeholder="Select"
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ]}
                  />
                </FieldRow>
                {navRow}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <Surface level={2} radius="md" className="divide-y divide-hairline">
                  <ReviewSection title="Identity" onEdit={() => setStep(0)}>
                    <ReviewGrid
                      rows={[
                        ["Name", name || "—"],
                        ["Team", team || "—"],
                        ["Project", project || "—"],
                        ["Reporting manager", reportingManager || "—"],
                      ]}
                    />
                  </ReviewSection>

                  <ReviewSection title="Tools & access" onEdit={() => setStep(1)}>
                    {tools.length === 0 ? (
                      <p className="text-label text-mute">No tools selected.</p>
                    ) : (
                      <ul className="space-y-2">
                        {tools.map((t) => (
                          <li key={t} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <span className="text-[14px] font-medium leading-[1.5] text-on-dark">
                              {TOOL_LABELS[t]}
                            </span>
                            <span className="text-label capitalize leading-[1.5] text-body">
                              {accessModes[t] ?? "no mode"}
                            </span>
                            {resourceIdentities[t]?.trim() && (
                              <span className="font-mono text-[12px] text-mute">
                                {resourceIdentities[t]}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <ReviewGrid
                      className="mt-3"
                      rows={[
                        [
                          "VPN access",
                          vpnAccess === null
                            ? "—"
                            : vpnAccess
                              ? `Yes — ${vpnMacAddress || "MAC pending"}`
                              : "No",
                        ],
                      ]}
                    />
                  </ReviewSection>

                  <ReviewSection title="Purpose & timeline" onEdit={() => setStep(2)}>
                    <ReviewGrid
                      rows={[
                        ["Purpose", purpose.trim() || "—"],
                        [
                          "Timeline",
                          timeline
                            ? timeline === "custom"
                              ? `Custom — ${timelineCustom || "—"}`
                              : timeline
                            : "—",
                        ],
                        [
                          "Manager approved",
                          managerApproved === null ? "—" : managerApproved ? "Yes" : "No",
                        ],
                      ]}
                    />
                  </ReviewSection>
                </Surface>

                {serverError && (
                  <p
                    role="alert"
                    className="rounded-md border border-critical-soft bg-critical-soft px-3 py-2 text-label leading-[1.5] text-critical"
                  >
                    {serverError}
                  </p>
                )}
                {!formValid && touched[3] && (
                  <p className="text-right text-[12px] text-ash">
                    Complete all required fields to enable Raise Request.
                  </p>
                )}
                {navRow}
              </div>
            )}
          </GuidedFlow>
        </form>
      </Reveal>
    </div>
  );
}

/* ----------------------------- form primitives ---------------------------- */

function FieldRow({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-label leading-[1.5] text-body">
        {label}
        {required && <span className="ml-0.5 text-iris">*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-[12px] leading-[1.5] text-critical">
          {error}
        </p>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-hairline bg-surface-elevated px-3 pr-8 text-[16px] leading-[1.6] transition-colors",
          "focus:border-hairline-strong focus:outline-none",
          value ? "text-on-dark" : "text-ash",
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface-card text-on-dark">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-mute"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

/* ----------------------------- review primitives -------------------------- */

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-label font-medium uppercase tracking-[0.4px] text-mute">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-sm px-1.5 py-0.5 text-[12px] leading-[1.5] text-iris transition-colors duration-150 ease-smooth hover:text-iris-bright"
        >
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}

function ReviewGrid({
  rows,
  className,
}: {
  rows: [string, string][];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2", className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[12px] uppercase tracking-[0.4px] text-ash">{label}</dt>
          <dd className="mt-0.5 break-words text-[14px] leading-[1.5] text-body">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

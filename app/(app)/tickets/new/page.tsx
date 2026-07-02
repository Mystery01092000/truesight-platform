"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Ticket, ArrowLeft, Check } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { ToolMultiSelect } from "@/components/ticketing/ToolMultiSelect";
import { AccessModeMatrix, type AccessModeMap } from "@/components/ticketing/AccessModeMatrix";
import {
  ResourceIdentityFields,
  type ResourceIdentityMap,
} from "@/components/ticketing/ResourceIdentityFields";
import { TIMELINE_OPTIONS, type Tool } from "@/lib/ticketing/types";
import { cn } from "@/lib/utils/cn";

const SPRING = { type: "spring", stiffness: 220, damping: 26 } as const;

type Field =
  | "name"
  | "team"
  | "project"
  | "reportingManager"
  | "tools"
  | "timeline"
  | "timelineCustom"
  | "vpnMacAddress"
  | "managerApproved";

const TIMELINE_VALUES = TIMELINE_OPTIONS.map((o) => o.value);

export default function NewTicketPage() {
  const router = useRouter();
  const reduced = useReducedMotion();

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
  const [touched, setTouched] = useState(false);

  // ---- Validation ----------------------------------------------------------
  const missing: Partial<Record<Field, string>> = {};
  if (!name.trim()) missing.name = "Name is required.";
  if (!team.trim()) missing.team = "Team is required.";
  if (!project.trim()) missing.project = "Project is required.";
  if (!reportingManager.trim()) missing.reportingManager = "Reporting manager is required.";
  if (tools.length === 0) missing.tools = "Select at least one tool.";
  if (!timeline) missing.timeline = "Select a timeline.";
  else if (timeline === "custom" && !timelineCustom.trim())
    missing.timelineCustom = "Describe the custom timeline.";
  if (vpnAccess && !vpnMacAddress.trim())
    missing.vpnMacAddress = "MAC address is required when VPN access is yes.";
  if (managerApproved === null) missing.managerApproved = "Confirm manager approval.";

  // Each selected tool needs an access mode.
  for (const t of tools) {
    if (!accessModes[t]) missing.tools = `Pick an access mode for each tool (${t} missing).`;
  }

  const formValid = Object.keys(missing).length === 0 && managerApproved === true;

  // ---- Submit --------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
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

  // ---- Form ----------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl">
      <Reveal>
        <header className="mb-6 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
            aria-hidden
          >
            <Ticket size={22} strokeWidth={1.75} className="text-iris" />
          </span>
          <div>
            <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Raise access request
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute">
              Tell us what you need and we&rsquo;ll route it through approval.
            </p>
          </div>
        </header>
      </Reveal>

      <Reveal delay={0.06}>
        <form onSubmit={handleSubmit} noValidate>
          <Surface level={1} radius="lg" className="space-y-5 p-6">
            <FieldRow label="Name" required error={touched ? missing.name : undefined}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            </FieldRow>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldRow label="Team" required error={touched ? missing.team : undefined}>
                <TextInput value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. ai-services" />
              </FieldRow>
              <FieldRow label="Project" required error={touched ? missing.project : undefined}>
                <TextInput value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project name" />
              </FieldRow>
            </div>

            <FieldRow
              label="Reporting Manager / Lead"
              required
              error={touched ? missing.reportingManager : undefined}
            >
              <TextInput
                value={reportingManager}
                onChange={(e) => setReportingManager(e.target.value)}
                placeholder="Manager or lead"
              />
            </FieldRow>

            <FieldRow
              label="Access for tools"
              required
              error={touched ? missing.tools : undefined}
            >
              <ToolMultiSelect value={tools} onChange={setTools} />
            </FieldRow>

            <FieldRow label="Purpose">
              <TextInput
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Why do you need this access? (optional)"
              />
            </FieldRow>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldRow
                label="Timeline"
                required
                error={touched ? missing.timeline : undefined}
              >
                <Select
                  value={timeline}
                  onChange={setTimeline}
                  placeholder="Select duration"
                  options={TIMELINE_OPTIONS}
                />
              </FieldRow>
              {timeline === "custom" && (
                <FieldRow
                  label="Custom timeline"
                  required
                  error={touched ? missing.timelineCustom : undefined}
                >
                  <TextInput
                    value={timelineCustom}
                    onChange={(e) => setTimelineCustom(e.target.value)}
                    placeholder="e.g. 6 weeks"
                  />
                </FieldRow>
              )}
            </div>

            {/* Access modes + resource identity reveal with motion */}
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
                error={touched && vpnAccess === null ? "Select yes or no." : undefined}
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
                  <FieldRow
                    label="MAC address"
                    required
                    error={touched ? missing.vpnMacAddress : undefined}
                  >
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
                    <FieldRow
                      label="MAC address"
                      required
                      error={touched ? missing.vpnMacAddress : undefined}
                    >
                      <TextInput
                        value={vpnMacAddress}
                        onChange={(e) => setVpnMacAddress(e.target.value)}
                        placeholder="00:1A:2B:3C:4D:5E"
                      />
                    </FieldRow>
                  </motion.div>
                ))}
            </div>

            <FieldRow
              label="Approved by Reporting Manager / Lead?"
              required
              error={touched ? missing.managerApproved : undefined}
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

            {serverError && (
              <p className="rounded-md border border-accent-red-soft bg-accent-red-soft px-3 py-2 text-[13px] leading-[1.5] text-accent-red">
                {serverError}
              </p>
            )}

            <div className="flex items-center justify-between gap-4 pt-1">
              <Link href="/tickets" className={buttonClass("secondary", "md")}>
                <ArrowLeft size={15} strokeWidth={1.75} />
                Cancel
              </Link>
              <Button type="submit" disabled={!formValid || submitting}>
                {submitting ? "Submitting…" : "Raise Request"}
              </Button>
            </div>
            {!formValid && touched && (
              <p className="text-right text-[12px] text-ash">
                Complete all required fields to enable Raise Request.
              </p>
            )}
          </Surface>
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
      <label className="mb-1.5 block text-[13px] leading-[1.5] text-body">
        {label}
        {required && <span className="ml-0.5 text-iris">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[12px] leading-[1.5] text-accent-red">{error}</p>}
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

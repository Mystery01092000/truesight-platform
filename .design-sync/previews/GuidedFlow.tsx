import { GuidedFlow, Surface, StatusBadge, TextInput } from "truesight-platform";

// Capture-only shim: the harness pins the page clock (clock.setFixedTime), so
// the AnimatePresence step-content mount animation freezes at opacity 0 and
// the step body captures blank. Forcing the prefers-reduced-motion media query
// makes GuidedFlow render its settled (final) state for a faithful capture.
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) =>
    query.includes("prefers-reduced-motion")
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        } as MediaQueryList)
      : nativeMatchMedia(query);
}

const noop = () => undefined;

const approvalSteps = [
  { id: "scope", label: "Scope", status: "done" },
  { id: "impact", label: "Impact review", status: "done" },
  { id: "approvals", label: "Approvals", status: "active" },
  { id: "apply", label: "Apply", status: "pending" },
];

export const TicketApprovalMidFlow = () => (
  <GuidedFlow steps={approvalSteps} activeIndex={2} onNext={noop} onBack={noop} className="w-[560px]">
    <div className="flex flex-col gap-3">
      <h3 className="text-[14px] font-medium text-ink">Collect approvals</h3>
      <p className="text-[13px] leading-[1.6] text-mute">
        CHG-2094 modifies 3 production resources. Two approvals are required
        before Truesight will queue the apply.
      </p>
      <Surface level={2} radius="md" className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-on-dark-mute">priya.nair — Platform lead</span>
          <StatusBadge status="in_sync" label="Approved" />
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-on-dark-mute">sam.delgado — Security</span>
          <StatusBadge status="medium" label="Awaiting" />
        </div>
      </Surface>
    </div>
  </GuidedFlow>
);

const reconcileSteps = [
  { id: "detect", label: "Detect drift", status: "done" },
  { id: "classify", label: "Classify", status: "done" },
  { id: "plan", label: "Plan fix", status: "done" },
  { id: "confirm", label: "Confirm & apply", status: "active" },
];

export const FinalStepConfirm = () => (
  <GuidedFlow
    steps={reconcileSteps}
    activeIndex={3}
    onNext={noop}
    onBack={noop}
    nextLabel="Apply reconciliation"
    className="w-[560px]"
  >
    <div className="flex flex-col gap-3">
      <h3 className="text-[14px] font-medium text-ink">Confirm reconciliation</h3>
      <p className="text-[13px] leading-[1.6] text-mute">
        Reverting 1 out-of-band ingress rule on sg-0f3a91. Type the resource name
        to confirm the production change.
      </p>
      <TextInput placeholder="sg-0f3a91" className="max-w-xs" />
    </div>
  </GuidedFlow>
);

const onboardingSteps = [
  { id: "connect", label: "Connect AWS", status: "done" },
  { id: "discover", label: "Discovery", status: "done" },
  { id: "baseline", label: "Baseline", status: "skipped" },
  { id: "policies", label: "Policies", status: "done" },
];

export const ReadOnlyCompleted = () => (
  <GuidedFlow steps={onboardingSteps} activeIndex={3} readOnly className="w-[560px]">
    <div className="flex flex-col gap-2">
      <h3 className="text-[14px] font-medium text-ink">Estate onboarding complete</h3>
      <p className="text-[13px] leading-[1.6] text-mute">
        1,284 resources discovered across 4 accounts. Baseline snapshot was
        skipped — drift detection starts from the current declared state.
      </p>
    </div>
  </GuidedFlow>
);

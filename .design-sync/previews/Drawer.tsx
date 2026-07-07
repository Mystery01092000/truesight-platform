import { Drawer, Button, StatusBadge, Surface } from "truesight-platform";
import { Clock3, ShieldCheck, User } from "lucide-react";

const noop = () => undefined;

export const AccessRequestDetail = () => (
  <div className="h-[560px]">
    <Drawer open onClose={noop} title="Access request #4821" width={440}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <StatusBadge status="medium" label="Pending approval" />
          <span className="font-mono text-[12px] tabular-nums text-mute">
            Opened 2h ago
          </span>
        </div>

        <Surface level={2} radius="md" className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-[13px] text-mute">
            <User size={14} />
            <span className="text-ink">maya.okafor@arcane.io</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-mute">
            <ShieldCheck size={14} />
            <span>
              Requesting <span className="text-ink">rds:ModifyDBInstance</span> on
              <span className="text-ink"> prod-payments-db</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-mute">
            <Clock3 size={14} />
            <span>Duration: 4 hours, auto-revoked</span>
          </div>
        </Surface>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium uppercase tracking-wide text-mute">
            Justification
          </span>
          <p className="text-[13px] leading-[1.6] text-on-dark-mute">
            Need to raise the connection pool ceiling on prod-payments-db ahead of
            the quarter-end settlement run. Change ticket CHG-2094 approved by the
            payments platform lead.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium uppercase tracking-wide text-mute">
            Blast radius
          </span>
          <p className="text-[13px] leading-[1.6] text-on-dark-mute">
            1 RDS instance · 3 dependent services · production / us-east-1
          </p>
        </div>

        <div className="mt-2 flex items-center gap-3 border-t border-hairline pt-4">
          <Button variant="primary" size="sm">
            Approve for 4h
          </Button>
          <Button variant="tertiary" size="sm">
            Deny
          </Button>
        </div>
      </div>
    </Drawer>
  </div>
);

export const DriftFindingDetail = () => (
  <div className="h-[560px]">
    <Drawer open onClose={noop} title="Drift — sg-0f3a91 ingress" width={480}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <StatusBadge status="drifted" />
          <StatusBadge status="high" label="High severity" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium uppercase tracking-wide text-mute">
            What changed
          </span>
          <p className="text-[13px] leading-[1.6] text-on-dark-mute">
            Security group <span className="text-ink">sg-0f3a91 (api-edge)</span>{" "}
            gained an ingress rule outside Terraform: port 22 open to 0.0.0.0/0,
            added via console by an IAM user 41 minutes ago.
          </p>
        </div>

        <Surface level={2} radius="md" className="p-4">
          <pre className="overflow-x-auto font-mono text-[12px] leading-[1.7]">
            <span className="text-accent-red">- ingress {"{"} port = 443, cidr = "10.0.0.0/8" {"}"}</span>
            {"\n"}
            <span className="text-accent-green">+ ingress {"{"} port = 22, cidr = "0.0.0.0/0" {"}"}</span>
          </pre>
        </Surface>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium uppercase tracking-wide text-mute">
            Recommended remediation
          </span>
          <p className="text-[13px] leading-[1.6] text-on-dark-mute">
            Revert to the declared state — remove the out-of-band rule and open a
            guided reconciliation to codify any intended change.
          </p>
        </div>

        <div className="mt-2 flex items-center gap-3 border-t border-hairline pt-4">
          <Button variant="primary" size="sm">
            Revert to declared state
          </Button>
          <Button variant="tertiary" size="sm">
            Start reconciliation
          </Button>
        </div>
      </div>
    </Drawer>
  </div>
);

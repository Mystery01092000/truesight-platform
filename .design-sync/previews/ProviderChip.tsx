import { ProviderChip } from "truesight-platform";

export const Providers = () => (
  <div className="flex flex-wrap items-center gap-3">
    <ProviderChip provider="aws" />
    <ProviderChip provider="azure" />
    <ProviderChip provider="github" />
    <ProviderChip provider="terraform" />
  </div>
);

export const GlyphOnly = () => (
  <div className="flex flex-wrap items-center gap-2">
    <ProviderChip provider="aws" label={false} />
    <ProviderChip provider="azure" label={false} />
    <ProviderChip provider="github" label={false} />
    <ProviderChip provider="terraform" label={false} />
  </div>
);

export const InlineWithResource = () => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2 text-body text-[13px]">
      <ProviderChip provider="aws" />
      <span>prod-payments · 142 resources</span>
    </div>
    <div className="flex items-center gap-2 text-body text-[13px]">
      <ProviderChip provider="azure" />
      <span>rg-core-network · 38 resources</span>
    </div>
    <div className="flex items-center gap-2 text-body text-[13px]">
      <ProviderChip provider="github" />
      <span>arcane/iac-truesight-platform · 12 workflows</span>
    </div>
  </div>
);

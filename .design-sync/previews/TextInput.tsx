import { TextInput } from "truesight-platform";
import { Search, KeyRound } from "lucide-react";

export const SearchPlaceholder = () => (
  <div className="w-80">
    <TextInput
      type="search"
      icon={<Search />}
      placeholder="Search resources, ARNs, tags…"
      aria-label="Search resources"
    />
  </div>
);

export const FilledWithIcon = () => (
  <div className="w-80">
    <TextInput
      type="search"
      icon={<Search />}
      defaultValue="env:production provider:aws vpc"
      aria-label="Search resources"
    />
  </div>
);

export const PlainField = () => (
  <div className="w-80">
    <TextInput
      defaultValue="truesight-prod-connector-01"
      aria-label="Connector name"
    />
  </div>
);

export const SecretField = () => (
  <div className="w-80">
    <TextInput
      type="password"
      icon={<KeyRound />}
      defaultValue="aws-cross-account-role-arn"
      aria-label="Cross-account role ARN"
    />
  </div>
);

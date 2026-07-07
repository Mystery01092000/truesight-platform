import { FilterBar } from "truesight-platform";

const noop = () => {};

const FACETS = [
  {
    key: "provider",
    label: "Provider",
    options: [
      { value: "aws", label: "AWS", count: 214 },
      { value: "gcp", label: "GCP", count: 87 },
      { value: "azure", label: "Azure", count: 41 },
    ],
  },
  {
    key: "environment",
    label: "Environment",
    options: [
      { value: "production", label: "Production", count: 156 },
      { value: "staging", label: "Staging", count: 102 },
      { value: "development", label: "Development", count: 84 },
    ],
  },
];

export const ResourceExplorer = () => (
  <FilterBar
    search=""
    onSearchChange={noop}
    searchPlaceholder="Search resources, ARNs, tags…"
    facets={FACETS}
    values={{ provider: "aws", environment: "" }}
    onFacetChange={noop}
    resultCount={214}
    resultNoun="resource"
    onClearAll={noop}
    className="w-full"
  />
);

export const ActiveSearchAndFacets = () => (
  <FilterBar
    search="public s3 buckets"
    onSearchChange={noop}
    searchPlaceholder="Search resources, ARNs, tags…"
    facets={FACETS}
    values={{ provider: "aws", environment: "production" }}
    onFacetChange={noop}
    resultCount={6}
    resultNoun="resource"
    onClearAll={noop}
    className="w-full"
  />
);

export const SearchOnly = () => (
  <FilterBar
    search=""
    onSearchChange={noop}
    searchPlaceholder="Search drift findings…"
    resultCount={1}
    resultNoun="finding"
    className="w-full"
  />
);

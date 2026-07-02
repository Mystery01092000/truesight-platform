/**
 * Access-ticket domain types — shared across the ticketing pillar (API routes,
 * pages, components). The canonical status/access/tool enums live here so the
 * API, the DB layer and the UI never drift on a magic string.
 */

export type TicketStatus =
  | "pending"
  | "peeyush_review"
  | "kamal_review"
  | "approved"
  | "declined"
  | "done";

export type AccessMode = "read" | "write" | "full";

export type Tool = "aws" | "azure" | "jenkins" | "grafana" | "superset";

export const TOOLS: Tool[] = ["aws", "azure", "jenkins", "grafana", "superset"];

export const TOOL_LABELS: Record<Tool, string> = {
  aws: "AWS",
  azure: "Azure",
  jenkins: "Jenkins",
  grafana: "Grafana",
  superset: "Superset",
};

export type ApprovalRole = "peeyush" | "kamal" | "devops";

export type ApprovalDecision = "approved" | "declined" | "need_more_info";

/** Timeline (access duration) dropdown options for the request form. */
export const TIMELINE_OPTIONS: { value: string; label: string }[] = [
  { value: "1 week", label: "1 week" },
  { value: "2 weeks", label: "2 weeks" },
  { value: "1 month", label: "1 month" },
  { value: "3 months", label: "3 months" },
  { value: "custom", label: "Custom" },
];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "Pending",
  peeyush_review: "Peeyush review",
  kamal_review: "Kamal review",
  approved: "Approved",
  declined: "Declined",
  done: "Done",
};

export function isTool(value: string): value is Tool {
  return TOOLS.includes(value as Tool);
}

export function isAccessMode(value: string): value is AccessMode {
  return value === "read" || value === "write" || value === "full";
}

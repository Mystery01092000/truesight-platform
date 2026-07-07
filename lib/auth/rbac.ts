/**
 * Role-based access control. Today there's a single super-admin persona, but every
 * guarded action already routes through `can()` so new roles slot in without rework.
 */
export type Role = "admin" | "operator" | "viewer";

export type Action =
  | "estate:read"
  | "topology:read"
  | "github:read"
  | "cost:read"
  | "security:read"
  | "compliance:read"
  | "sync:trigger"
  | "checklist:write"
  | "dashboard:write"
  | "settings:write"
  | "kb:read"
  | "kb:admin"
  | "tickets:admin"
  | "forge:read"
  | "forge:write"
  | "forge:deploy";

const MATRIX: Record<Role, Action[] | "*"> = {
  // DevOps Super Admin — full platform configurability.
  admin: "*",
  operator: [
    "estate:read",
    "topology:read",
    "github:read",
    "cost:read",
    "security:read",
    "compliance:read",
    "sync:trigger",
    "checklist:write",
    "dashboard:write",
    "kb:read",
    "kb:admin",
    "tickets:admin",
    "forge:read",
    "forge:write",
  ],
  viewer: [
    "estate:read",
    "topology:read",
    "github:read",
    "cost:read",
    "security:read",
    "compliance:read",
    "kb:read",
    "forge:read",
  ],
};

export function can(role: Role, action: Action): boolean {
  const allowed = MATRIX[role];
  return allowed === "*" || allowed.includes(action);
}

export const ROLES: Role[] = ["admin", "operator", "viewer"];

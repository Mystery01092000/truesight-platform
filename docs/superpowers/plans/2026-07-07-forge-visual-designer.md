# Forge Visual Designer/Deployer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/forge` page where users drag AWS/Azure services onto a React Flow canvas, nest them in containers (VPC/Subnet, RG/VNet/Subnet), edit per-service forms, save plans to Postgres, generate Terraform JSON, and run `terraform plan/apply/destroy` in-app with streamed logs.

**Architecture:** Data-driven service catalog (`lib/forge/catalog/`) feeds the palette, the inspector forms, and the tf.json code generator. The canvas graph (stored in `forge_plans.canvas_json`) is the single source of truth; workspaces on disk are disposable. A runner spawns the terraform binary with `DEPLOY_*`-derived credentials only.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions style API routes), React 19, `@xyflow/react` 12, drizzle-orm + postgres.js, zod 4, Vitest (new), Terraform ≥ 1.9 (JSON configuration syntax).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-07-forge-visual-designer-design.md` — read it first.
- `lib/forge/**` MUST be server-safe (no React, no lucide imports). Icons live client-side in `components/forge/`.
- Platform estate credentials (AWS_*, AZURE_*) must NEVER reach the terraform subprocess; only `DEPLOY_*`-mapped values.
- All API inputs validated with zod; responses use `{ success, data, error }` envelope.
- RBAC: `forge:read` (all roles), `forge:write` (admin, operator), `forge:deploy` (admin only).
- Follow existing UI patterns: `Surface`, `PageHeader`, `Button`, `EmptyState`, `DataTable` from `components/ui/`; dark-theme tokens from `app/globals.css`; match Topology's React Flow styling.
- Commit after every task with conventional-commit messages. No `console.log` in production code paths (console.warn/error allowed to match repo conventions).
- TypeScript strict; run `npm run typecheck` before every commit.

---

### Task 1: Vitest test infrastructure

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `"test": "vitest run"` script, `vitest` devDependency)
- Test: `lib/forge/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` runs Vitest over `**/__tests__/**/*.test.ts` with the `@/` path alias working.

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create vitest config with the repo's `@/` alias**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    exclude: ["node_modules", ".next", "ds-bundle"],
  },
});
```

- [ ] **Step 3: Add the script to package.json** (`"test": "vitest run"` in `scripts`)

- [ ] **Step 4: Write a smoke test**

```ts
// lib/forge/__tests__/smoke.test.ts
import { describe, expect, it } from "vitest";

describe("vitest wiring", () => {
  it("resolves the @ alias", async () => {
    const mod = await import("@/lib/utils/cn");
    expect(typeof mod.cn).toBe("function");
  });
});
```

- [ ] **Step 5: Run** `npm test` — expected: 1 passed.

- [ ] **Step 6: Commit** — `chore: add vitest test infrastructure`

---

### Task 2: Forge core types + catalog framework

**Files:**
- Create: `lib/forge/types.ts`
- Create: `lib/forge/catalog/types.ts`
- Create: `lib/forge/slug.ts`
- Test: `lib/forge/__tests__/slug.test.ts`

**Interfaces:**
- Produces:
  - `ForgeCanvas { nodes: ForgeNode[]; edges: ForgeEdge[] }`
  - `ForgeNode { id: string; serviceId: string; name: string; parentId: string | null; position: {x:number;y:number}; size?: {width:number;height:number}; config: Record<string, unknown> }`
  - `ForgeEdge { id: string; source: string; target: string }`
  - `ForgePlanStatus`, `ForgeRunKind`, `ForgeRunStatus` unions (values from spec §Data model)
  - `ForgeService`, `ForgeField`, `TfContext`, `TfFragment` (catalog contract below)
  - `tfSlug(name: string): string` — lowercase, `[a-z0-9_]`, starts with letter, collapsed underscores

- [ ] **Step 1: Write failing slug tests**

```ts
// lib/forge/__tests__/slug.test.ts
import { describe, expect, it } from "vitest";
import { tfSlug } from "@/lib/forge/slug";

describe("tfSlug", () => {
  it("lowercases and underscores", () => expect(tfSlug("Web Server 1")).toBe("web_server_1"));
  it("strips illegal chars", () => expect(tfSlug("api-güte!x")).toBe("api_g_te_x"));
  it("prefixes when starting with a digit", () => expect(tfSlug("3tier")).toBe("r_3tier"));
  it("collapses repeats and trims", () => expect(tfSlug("__a—__b__")).toBe("a_b"));
  it("falls back for empty input", () => expect(tfSlug("˚˚")).toBe("resource"));
});
```

- [ ] **Step 2: Run** `npm test -- slug` — expected FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// lib/forge/slug.ts
/** Terraform resource-name slug: [a-z][a-z0-9_]*, deterministic from a label. */
export function tfSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) return "resource";
  return /^[a-z]/.test(base) ? base : `r_${base}`;
}
```

```ts
// lib/forge/types.ts
/** Canvas graph — the persisted source of truth for a Forge plan. */
export interface ForgeNode {
  id: string;
  serviceId: string;
  name: string;
  parentId: string | null;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  config: Record<string, unknown>;
}
export interface ForgeEdge {
  id: string;
  source: string;
  target: string;
}
export interface ForgeCanvas {
  nodes: ForgeNode[];
  edges: ForgeEdge[];
}

export type ForgePlanStatus =
  | "draft" | "generated" | "planned" | "deploying" | "deployed" | "failed" | "destroyed";
export type ForgeRunKind = "plan" | "apply" | "destroy";
export type ForgeRunStatus = "running" | "succeeded" | "failed";

export interface ForgeValidationIssue {
  nodeId: string | null;
  message: string;
}
```

```ts
// lib/forge/catalog/types.ts
import type { z } from "zod";
import type { ForgeNode } from "@/lib/forge/types";

export type ForgeProvider = "aws" | "azure";
export type ForgeCategory =
  | "network" | "compute" | "storage" | "database"
  | "serverless" | "containers" | "identity" | "observability";

interface FieldBase { key: string; label: string; help?: string; required?: boolean }
export type ForgeField =
  | (FieldBase & { type: "text"; placeholder?: string })
  | (FieldBase & { type: "number"; min?: number; max?: number })
  | (FieldBase & { type: "select"; options: { value: string; label: string }[] })
  | (FieldBase & { type: "toggle" });

/** Everything toTf() may need about the surrounding graph. */
export interface TfContext {
  /** Unique terraform name for a node (slug + collision suffix). */
  tfName(nodeId: string): string;
  /** Nearest ancestor with the given serviceId, if any. */
  ancestorOfService(nodeId: string, serviceId: string): ForgeNode | undefined;
  /** Target nodes of outgoing dependency edges from this node. */
  edgesFrom(nodeId: string): ForgeNode[];
  awsRegion: string;
  azureLocation: string;
}

/** tf.json fragment — merged into the final document. */
export interface TfFragment {
  resource?: Record<string, Record<string, Record<string, unknown>>>;
}

export interface ForgeService {
  id: string;
  provider: ForgeProvider;
  label: string;
  category: ForgeCategory;
  isContainer: boolean;
  /** serviceIds this node may be dropped into; [] = top level only. */
  allowedParents: readonly string[];
  defaultConfig: Record<string, unknown>;
  schema: z.ZodType;
  fields: ForgeField[];
  toTf(node: ForgeNode, ctx: TfContext): TfFragment;
}
```

- [ ] **Step 4: Run** `npm test -- slug` — expected PASS; `npm run typecheck` clean.

- [ ] **Step 5: Commit** — `feat(forge): core canvas types, catalog contract and tf slugger`

---

### Task 3: AWS catalog — network (VPC, Subnet, Security Group)

**Files:**
- Create: `lib/forge/catalog/aws-network.ts`
- Test: `lib/forge/__tests__/aws-network.test.ts`

**Interfaces:**
- Consumes: `ForgeService`, `TfContext`, `tfSlug` from Task 2.
- Produces: `AWS_NETWORK: ForgeService[]` containing ids `aws.vpc` (container), `aws.subnet` (container, parent `aws.vpc`), `aws.security_group` (parent `aws.vpc` or top level).

- [ ] **Step 1: Write failing tests**

```ts
// lib/forge/__tests__/aws-network.test.ts
import { describe, expect, it } from "vitest";
import { AWS_NETWORK } from "@/lib/forge/catalog/aws-network";
import type { ForgeNode } from "@/lib/forge/types";
import type { TfContext } from "@/lib/forge/catalog/types";

const vpcNode: ForgeNode = {
  id: "n1", serviceId: "aws.vpc", name: "main", parentId: null,
  position: { x: 0, y: 0 }, config: { cidrBlock: "10.0.0.0/16" },
};
const subnetNode: ForgeNode = {
  id: "n2", serviceId: "aws.subnet", name: "web a", parentId: "n1",
  position: { x: 0, y: 0 }, config: { cidrBlock: "10.0.1.0/24", availabilityZone: "ap-south-1a", mapPublicIp: true },
};

const ctx: TfContext = {
  tfName: (id) => ({ n1: "main", n2: "web_a" })[id]!,
  ancestorOfService: (id, svc) => (id === "n2" && svc === "aws.vpc" ? vpcNode : undefined),
  edgesFrom: () => [],
  awsRegion: "ap-south-1",
  azureLocation: "centralindia",
};

describe("aws network services", () => {
  it("registers vpc, subnet, security_group", () => {
    expect(AWS_NETWORK.map((s) => s.id).sort()).toEqual(["aws.security_group", "aws.subnet", "aws.vpc"]);
  });
  it("vpc is a top-level container", () => {
    const vpc = AWS_NETWORK.find((s) => s.id === "aws.vpc")!;
    expect(vpc.isContainer).toBe(true);
    expect(vpc.allowedParents).toEqual([]);
  });
  it("vpc emits aws_vpc with cidr", () => {
    const vpc = AWS_NETWORK.find((s) => s.id === "aws.vpc")!;
    expect(vpc.toTf(vpcNode, ctx)).toEqual({
      resource: { aws_vpc: { main: { cidr_block: "10.0.0.0/16", tags: { Name: "main", ManagedBy: "truesight-forge" } } } },
    });
  });
  it("subnet references its parent vpc", () => {
    const subnet = AWS_NETWORK.find((s) => s.id === "aws.subnet")!;
    const tf = subnet.toTf(subnetNode, ctx);
    expect(tf.resource!.aws_subnet!.web_a).toMatchObject({
      vpc_id: "${aws_vpc.main.id}",
      cidr_block: "10.0.1.0/24",
      map_public_ip_on_launch: true,
    });
  });
  it("subnet config rejects a bad CIDR", () => {
    const subnet = AWS_NETWORK.find((s) => s.id === "aws.subnet")!;
    expect(subnet.schema.safeParse({ cidrBlock: "not-a-cidr" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npm test -- aws-network` — expected FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/forge/catalog/aws-network.ts
import { z } from "zod";
import type { ForgeService, TfContext } from "./types";
import type { ForgeNode } from "@/lib/forge/types";

const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
export const zCidr = z.string().regex(CIDR_RE, "Must be CIDR notation, e.g. 10.0.0.0/16");

/** Standard tags stamped on every Forge-managed resource. */
export function forgeTags(name: string): Record<string, string> {
  return { Name: name, ManagedBy: "truesight-forge" };
}

/** `${aws_vpc.<name>.id}` for the nearest VPC ancestor (throws if absent — validation guarantees presence). */
function vpcRef(node: ForgeNode, ctx: TfContext): string {
  const vpc = ctx.ancestorOfService(node.id, "aws.vpc");
  if (!vpc) throw new Error(`${node.name}: must be placed inside a VPC`);
  return `\${aws_vpc.${ctx.tfName(vpc.id)}.id}`;
}

const vpc: ForgeService = {
  id: "aws.vpc",
  provider: "aws",
  label: "VPC",
  category: "network",
  isContainer: true,
  allowedParents: [],
  defaultConfig: { cidrBlock: "10.0.0.0/16" },
  schema: z.object({ cidrBlock: zCidr }),
  fields: [{ key: "cidrBlock", label: "CIDR block", type: "text", required: true, placeholder: "10.0.0.0/16" }],
  toTf: (node, ctx) => ({
    resource: {
      aws_vpc: {
        [ctx.tfName(node.id)]: {
          cidr_block: node.config.cidrBlock,
          tags: forgeTags(node.name),
        },
      },
    },
  }),
};

const subnet: ForgeService = {
  id: "aws.subnet",
  provider: "aws",
  label: "Subnet",
  category: "network",
  isContainer: true,
  allowedParents: ["aws.vpc"],
  defaultConfig: { cidrBlock: "10.0.1.0/24", availabilityZone: "", mapPublicIp: false },
  schema: z.object({
    cidrBlock: zCidr,
    availabilityZone: z.string().default(""),
    mapPublicIp: z.boolean().default(false),
  }),
  fields: [
    { key: "cidrBlock", label: "CIDR block", type: "text", required: true },
    { key: "availabilityZone", label: "Availability zone", type: "text", placeholder: "ap-south-1a" },
    { key: "mapPublicIp", label: "Auto-assign public IP", type: "toggle" },
  ],
  toTf: (node, ctx) => ({
    resource: {
      aws_subnet: {
        [ctx.tfName(node.id)]: {
          vpc_id: vpcRef(node, ctx),
          cidr_block: node.config.cidrBlock,
          ...(node.config.availabilityZone ? { availability_zone: node.config.availabilityZone } : {}),
          map_public_ip_on_launch: node.config.mapPublicIp === true,
          tags: forgeTags(node.name),
        },
      },
    },
  }),
};

const securityGroup: ForgeService = {
  id: "aws.security_group",
  provider: "aws",
  label: "Security Group",
  category: "network",
  isContainer: false,
  allowedParents: ["aws.vpc"],
  defaultConfig: { description: "Managed by Truesight Forge", ingressPort: 443, ingressCidr: "0.0.0.0/0" },
  schema: z.object({
    description: z.string().min(1),
    ingressPort: z.number().int().min(0).max(65535),
    ingressCidr: zCidr,
  }),
  fields: [
    { key: "description", label: "Description", type: "text", required: true },
    { key: "ingressPort", label: "Ingress port", type: "number", min: 0, max: 65535 },
    { key: "ingressCidr", label: "Ingress CIDR", type: "text" },
  ],
  toTf: (node, ctx) => ({
    resource: {
      aws_security_group: {
        [ctx.tfName(node.id)]: {
          name: node.name,
          description: node.config.description,
          vpc_id: vpcRef(node, ctx),
          ingress: [{
            from_port: node.config.ingressPort, to_port: node.config.ingressPort,
            protocol: "tcp", cidr_blocks: [node.config.ingressCidr],
            description: "", ipv6_cidr_blocks: [], prefix_list_ids: [], security_groups: [], self: false,
          }],
          egress: [{
            from_port: 0, to_port: 0, protocol: "-1", cidr_blocks: ["0.0.0.0/0"],
            description: "", ipv6_cidr_blocks: [], prefix_list_ids: [], security_groups: [], self: false,
          }],
          tags: forgeTags(node.name),
        },
      },
    },
  }),
};

export const AWS_NETWORK: ForgeService[] = [vpc, subnet, securityGroup];
```

- [ ] **Step 4: Run** `npm test -- aws-network` — expected PASS.

- [ ] **Step 5: Commit** — `feat(forge): AWS network catalog (VPC, subnet, security group)`

---

### Task 4: AWS catalog — compute/storage/identity (EC2, S3, IAM role)

**Files:**
- Create: `lib/forge/catalog/aws-compute.ts`
- Test: `lib/forge/__tests__/aws-compute.test.ts`

**Interfaces:**
- Consumes: `forgeTags`, `zCidr` from `aws-network.ts`; catalog contract types.
- Produces: `AWS_COMPUTE: ForgeService[]` with `aws.ec2_instance` (parents: `aws.subnet`), `aws.s3_bucket` (top level), `aws.iam_role` (top level).

- [ ] **Step 1: Write failing tests**

```ts
// lib/forge/__tests__/aws-compute.test.ts
import { describe, expect, it } from "vitest";
import { AWS_COMPUTE } from "@/lib/forge/catalog/aws-compute";
import type { ForgeNode } from "@/lib/forge/types";
import type { TfContext } from "@/lib/forge/catalog/types";

const subnetNode: ForgeNode = {
  id: "s1", serviceId: "aws.subnet", name: "web a", parentId: "v1",
  position: { x: 0, y: 0 }, config: { cidrBlock: "10.0.1.0/24" },
};
const sgNode: ForgeNode = {
  id: "g1", serviceId: "aws.security_group", name: "web sg", parentId: "v1",
  position: { x: 0, y: 0 }, config: {},
};
const ec2Node: ForgeNode = {
  id: "e1", serviceId: "aws.ec2_instance", name: "api box", parentId: "s1",
  position: { x: 0, y: 0 }, config: { ami: "ami-0abc", instanceType: "t3.micro" },
};

const ctx: TfContext = {
  tfName: (id) => ({ s1: "web_a", g1: "web_sg", e1: "api_box" })[id]!,
  ancestorOfService: (id, svc) => (id === "e1" && svc === "aws.subnet" ? subnetNode : undefined),
  edgesFrom: (id) => (id === "e1" ? [sgNode] : []),
  awsRegion: "ap-south-1",
  azureLocation: "centralindia",
};

describe("aws compute services", () => {
  it("ec2 wires subnet ancestor and SG edges", () => {
    const ec2 = AWS_COMPUTE.find((s) => s.id === "aws.ec2_instance")!;
    expect(ec2.toTf(ec2Node, ctx).resource!.aws_instance!.api_box).toMatchObject({
      ami: "ami-0abc",
      instance_type: "t3.micro",
      subnet_id: "${aws_subnet.web_a.id}",
      vpc_security_group_ids: ["${aws_security_group.web_sg.id}"],
    });
  });
  it("s3 bucket name must be s3-safe", () => {
    const s3 = AWS_COMPUTE.find((s) => s.id === "aws.s3_bucket")!;
    expect(s3.schema.safeParse({ bucketName: "My_Bad_Bucket", versioning: false }).success).toBe(false);
    expect(s3.schema.safeParse({ bucketName: "good-bucket-1", versioning: true }).success).toBe(true);
  });
  it("iam role assume policy targets the chosen service", () => {
    const role = AWS_COMPUTE.find((s) => s.id === "aws.iam_role")!;
    const node: ForgeNode = { id: "r1", serviceId: "aws.iam_role", name: "lambda exec", parentId: null, position: { x: 0, y: 0 }, config: { assumeService: "lambda.amazonaws.com" } };
    const tf = role.toTf(node, { ...ctx, tfName: () => "lambda_exec" });
    const doc = JSON.parse(tf.resource!.aws_iam_role!.lambda_exec.assume_role_policy as string);
    expect(doc.Statement[0].Principal.Service).toBe("lambda.amazonaws.com");
  });
});
```

- [ ] **Step 2: Run** `npm test -- aws-compute` — expected FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/forge/catalog/aws-compute.ts
import { z } from "zod";
import type { ForgeService } from "./types";
import { forgeTags } from "./aws-network";

const ec2: ForgeService = {
  id: "aws.ec2_instance",
  provider: "aws",
  label: "EC2 Instance",
  category: "compute",
  isContainer: false,
  allowedParents: ["aws.subnet"],
  defaultConfig: { ami: "", instanceType: "t3.micro" },
  schema: z.object({
    ami: z.string().regex(/^ami-[0-9a-f]+$/, "Must be an AMI id (ami-…)"),
    instanceType: z.string().min(2),
  }),
  fields: [
    { key: "ami", label: "AMI id", type: "text", required: true, placeholder: "ami-…" },
    {
      key: "instanceType", label: "Instance type", type: "select",
      options: ["t3.micro", "t3.small", "t3.medium", "m7g.large", "c7g.large"].map((v) => ({ value: v, label: v })),
    },
  ],
  toTf: (node, ctx) => {
    const subnet = ctx.ancestorOfService(node.id, "aws.subnet");
    if (!subnet) throw new Error(`${node.name}: must be placed inside a subnet`);
    const sgs = ctx.edgesFrom(node.id)
      .filter((t) => t.serviceId === "aws.security_group")
      .map((t) => `\${aws_security_group.${ctx.tfName(t.id)}.id}`);
    return {
      resource: {
        aws_instance: {
          [ctx.tfName(node.id)]: {
            ami: node.config.ami,
            instance_type: node.config.instanceType,
            subnet_id: `\${aws_subnet.${ctx.tfName(subnet.id)}.id}`,
            ...(sgs.length ? { vpc_security_group_ids: sgs } : {}),
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const s3: ForgeService = {
  id: "aws.s3_bucket",
  provider: "aws",
  label: "S3 Bucket",
  category: "storage",
  isContainer: false,
  allowedParents: [],
  defaultConfig: { bucketName: "", versioning: false },
  schema: z.object({
    bucketName: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "Lowercase letters, digits, dots, hyphens"),
    versioning: z.boolean().default(false),
  }),
  fields: [
    { key: "bucketName", label: "Bucket name", type: "text", required: true },
    { key: "versioning", label: "Versioning", type: "toggle" },
  ],
  toTf: (node, ctx) => {
    const name = ctx.tfName(node.id);
    return {
      resource: {
        aws_s3_bucket: { [name]: { bucket: node.config.bucketName, tags: forgeTags(node.name) } },
        ...(node.config.versioning === true
          ? {
              aws_s3_bucket_versioning: {
                [name]: {
                  bucket: `\${aws_s3_bucket.${name}.id}`,
                  versioning_configuration: { status: "Enabled" },
                },
              },
            }
          : {}),
      },
    };
  },
};

const iamRole: ForgeService = {
  id: "aws.iam_role",
  provider: "aws",
  label: "IAM Role",
  category: "identity",
  isContainer: false,
  allowedParents: [],
  defaultConfig: { assumeService: "ec2.amazonaws.com" },
  schema: z.object({ assumeService: z.string().regex(/\.amazonaws\.com$/) }),
  fields: [{
    key: "assumeService", label: "Assumed by", type: "select",
    options: ["ec2.amazonaws.com", "lambda.amazonaws.com", "ecs-tasks.amazonaws.com"].map((v) => ({ value: v, label: v })),
  }],
  toTf: (node, ctx) => ({
    resource: {
      aws_iam_role: {
        [ctx.tfName(node.id)]: {
          name: node.name.replace(/\s+/g, "-"),
          assume_role_policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{ Effect: "Allow", Principal: { Service: node.config.assumeService }, Action: "sts:AssumeRole" }],
          }),
          tags: forgeTags(node.name),
        },
      },
    },
  }),
};

export const AWS_COMPUTE: ForgeService[] = [ec2, s3, iamRole];
```

- [ ] **Step 4: Run** `npm test -- aws-compute` — expected PASS.

- [ ] **Step 5: Commit** — `feat(forge): AWS compute/storage/identity catalog (EC2, S3, IAM role)`

---

### Task 5: AWS catalog — data & platform (RDS, Lambda, ECS cluster/service, CloudWatch logs, ECR)

**Files:**
- Create: `lib/forge/catalog/aws-platform.ts`
- Test: `lib/forge/__tests__/aws-platform.test.ts`

**Interfaces:**
- Consumes: `forgeTags` (Task 3), catalog contract.
- Produces: `AWS_PLATFORM: ForgeService[]` with `aws.rds_instance` (parent `aws.subnet` optional → top level or vpc), `aws.lambda_function` (top; edge → `aws.iam_role`), `aws.ecs_cluster` (container, top), `aws.ecs_service` (parent `aws.ecs_cluster`), `aws.cloudwatch_log_group` (top), `aws.ecr_repository` (top).

Follow the exact same file pattern as Task 4. Full definitions:

- [ ] **Step 1: Write failing tests** (same style as Task 4 — assert: rds emits `aws_db_instance` with `engine`, `instance_class`, `allocated_storage`, `username`, `password = "${var.forge_db_password}"` and the fragment also carries a `variable` block via resource merge — see implementation note below; lambda references role edge as `role = "${aws_iam_role.<n>.arn}"` and throws without one; ecs_service references parent cluster `cluster = "${aws_ecs_cluster.<n>.id}"`; log group sets `retention_in_days`; ecr sets `name` + `force_delete: true`.)

```ts
// lib/forge/__tests__/aws-platform.test.ts
import { describe, expect, it } from "vitest";
import { AWS_PLATFORM } from "@/lib/forge/catalog/aws-platform";
import type { ForgeNode } from "@/lib/forge/types";
import type { TfContext } from "@/lib/forge/catalog/types";

const mk = (over: Partial<ForgeNode>): ForgeNode => ({
  id: "x", serviceId: "", name: "thing", parentId: null,
  position: { x: 0, y: 0 }, config: {}, ...over,
});
const roleNode = mk({ id: "r1", serviceId: "aws.iam_role", name: "exec" });
const clusterNode = mk({ id: "c1", serviceId: "aws.ecs_cluster", name: "apps" });
const baseCtx: TfContext = {
  tfName: (id) => ({ r1: "exec", c1: "apps", x: "thing" })[id] ?? "thing",
  ancestorOfService: () => undefined,
  edgesFrom: () => [],
  awsRegion: "ap-south-1",
  azureLocation: "centralindia",
};

describe("aws platform services", () => {
  it("registers all six", () => {
    expect(AWS_PLATFORM.map((s) => s.id).sort()).toEqual([
      "aws.cloudwatch_log_group", "aws.ecr_repository", "aws.ecs_cluster",
      "aws.ecs_service", "aws.lambda_function", "aws.rds_instance",
    ]);
  });
  it("rds uses a terraform variable for the password", () => {
    const rds = AWS_PLATFORM.find((s) => s.id === "aws.rds_instance")!;
    const node = mk({ serviceId: "aws.rds_instance", config: { engine: "postgres", instanceClass: "db.t4g.micro", allocatedStorage: 20, username: "app" } });
    const body = rds.toTf(node, baseCtx).resource!.aws_db_instance!.thing;
    expect(body.password).toBe("${var.forge_db_password}");
    expect(body.engine).toBe("postgres");
  });
  it("lambda requires an IAM role edge", () => {
    const fn = AWS_PLATFORM.find((s) => s.id === "aws.lambda_function")!;
    const node = mk({ serviceId: "aws.lambda_function", config: { runtime: "nodejs22.x", handler: "index.handler" } });
    expect(() => fn.toTf(node, baseCtx)).toThrow(/IAM role/);
    const tf = fn.toTf(node, { ...baseCtx, edgesFrom: () => [roleNode] });
    expect(tf.resource!.aws_lambda_function!.thing.role).toBe("${aws_iam_role.exec.arn}");
  });
  it("ecs service references its parent cluster", () => {
    const svc = AWS_PLATFORM.find((s) => s.id === "aws.ecs_service")!;
    const node = mk({ serviceId: "aws.ecs_service", parentId: "c1", config: { desiredCount: 2, image: "nginx:1.27", cpu: 256, memory: 512 } });
    const tf = svc.toTf(node, { ...baseCtx, ancestorOfService: (_, s) => (s === "aws.ecs_cluster" ? clusterNode : undefined) });
    expect(tf.resource!.aws_ecs_service!.thing.cluster).toBe("${aws_ecs_cluster.apps.id}");
    expect(tf.resource!.aws_ecs_task_definition!.thing).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement** `lib/forge/catalog/aws-platform.ts`:

```ts
import { z } from "zod";
import type { ForgeService } from "./types";
import { forgeTags } from "./aws-network";

const rds: ForgeService = {
  id: "aws.rds_instance",
  provider: "aws",
  label: "RDS Database",
  category: "database",
  isContainer: false,
  allowedParents: ["aws.vpc"],
  defaultConfig: { engine: "postgres", instanceClass: "db.t4g.micro", allocatedStorage: 20, username: "app" },
  schema: z.object({
    engine: z.enum(["postgres", "mysql"]),
    instanceClass: z.string().startsWith("db."),
    allocatedStorage: z.number().int().min(20).max(1024),
    username: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  }),
  fields: [
    { key: "engine", label: "Engine", type: "select", options: [{ value: "postgres", label: "PostgreSQL" }, { value: "mysql", label: "MySQL" }] },
    { key: "instanceClass", label: "Instance class", type: "text", required: true },
    { key: "allocatedStorage", label: "Storage (GB)", type: "number", min: 20, max: 1024 },
    { key: "username", label: "Master username", type: "text", required: true },
  ],
  toTf: (node, ctx) => ({
    resource: {
      aws_db_instance: {
        [ctx.tfName(node.id)]: {
          identifier: node.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
          engine: node.config.engine,
          instance_class: node.config.instanceClass,
          allocated_storage: node.config.allocatedStorage,
          username: node.config.username,
          password: "${var.forge_db_password}", // injected at runtime: TF_VAR_forge_db_password
          skip_final_snapshot: true,
          tags: forgeTags(node.name),
        },
      },
    },
  }),
};

const lambda: ForgeService = {
  id: "aws.lambda_function",
  provider: "aws",
  label: "Lambda Function",
  category: "serverless",
  isContainer: false,
  allowedParents: [],
  defaultConfig: { runtime: "nodejs22.x", handler: "index.handler" },
  schema: z.object({ runtime: z.string().min(3), handler: z.string().min(3) }),
  fields: [
    { key: "runtime", label: "Runtime", type: "select", options: ["nodejs22.x", "python3.12", "go1.x"].map((v) => ({ value: v, label: v })) },
    { key: "handler", label: "Handler", type: "text", required: true },
  ],
  toTf: (node, ctx) => {
    const role = ctx.edgesFrom(node.id).find((t) => t.serviceId === "aws.iam_role");
    if (!role) throw new Error(`${node.name}: connect an IAM role (draw an edge to one)`);
    return {
      resource: {
        aws_lambda_function: {
          [ctx.tfName(node.id)]: {
            function_name: node.name.replace(/\s+/g, "-"),
            role: `\${aws_iam_role.${ctx.tfName(role.id)}.arn}`,
            runtime: node.config.runtime,
            handler: node.config.handler,
            filename: "bootstrap.zip", // placeholder artifact uploaded out-of-band; documented in UI help
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const ecsCluster: ForgeService = {
  id: "aws.ecs_cluster",
  provider: "aws",
  label: "ECS Cluster",
  category: "containers",
  isContainer: true,
  allowedParents: [],
  defaultConfig: {},
  schema: z.object({}),
  fields: [],
  toTf: (node, ctx) => ({
    resource: { aws_ecs_cluster: { [ctx.tfName(node.id)]: { name: node.name.replace(/\s+/g, "-"), tags: forgeTags(node.name) } } },
  }),
};

const ecsService: ForgeService = {
  id: "aws.ecs_service",
  provider: "aws",
  label: "ECS Service (Fargate)",
  category: "containers",
  isContainer: false,
  allowedParents: ["aws.ecs_cluster"],
  defaultConfig: { image: "nginx:latest", desiredCount: 1, cpu: 256, memory: 512 },
  schema: z.object({
    image: z.string().min(3),
    desiredCount: z.number().int().min(0).max(20),
    cpu: z.number().int(),
    memory: z.number().int(),
  }),
  fields: [
    { key: "image", label: "Container image", type: "text", required: true },
    { key: "desiredCount", label: "Desired count", type: "number", min: 0, max: 20 },
    { key: "cpu", label: "CPU units", type: "select", options: [256, 512, 1024].map((v) => ({ value: String(v), label: String(v) })) },
    { key: "memory", label: "Memory (MB)", type: "select", options: [512, 1024, 2048].map((v) => ({ value: String(v), label: String(v) })) },
  ],
  toTf: (node, ctx) => {
    const cluster = ctx.ancestorOfService(node.id, "aws.ecs_cluster");
    if (!cluster) throw new Error(`${node.name}: must be placed inside an ECS cluster`);
    const n = ctx.tfName(node.id);
    const family = node.name.replace(/\s+/g, "-");
    return {
      resource: {
        aws_ecs_task_definition: {
          [n]: {
            family,
            requires_compatibilities: ["FARGATE"],
            network_mode: "awsvpc",
            cpu: String(node.config.cpu),
            memory: String(node.config.memory),
            container_definitions: JSON.stringify([{ name: family, image: node.config.image, essential: true }]),
          },
        },
        aws_ecs_service: {
          [n]: {
            name: family,
            cluster: `\${aws_ecs_cluster.${ctx.tfName(cluster.id)}.id}`,
            task_definition: `\${aws_ecs_task_definition.${n}.arn}`,
            desired_count: node.config.desiredCount,
            launch_type: "FARGATE",
          },
        },
      },
    };
  },
};

const logGroup: ForgeService = {
  id: "aws.cloudwatch_log_group",
  provider: "aws",
  label: "CloudWatch Log Group",
  category: "observability",
  isContainer: false,
  allowedParents: [],
  defaultConfig: { retentionDays: 30 },
  schema: z.object({ retentionDays: z.number().int() }),
  fields: [{ key: "retentionDays", label: "Retention (days)", type: "select", options: [7, 30, 90, 365].map((v) => ({ value: String(v), label: `${v} days` })) }],
  toTf: (node, ctx) => ({
    resource: {
      aws_cloudwatch_log_group: {
        [ctx.tfName(node.id)]: { name: `/forge/${node.name.replace(/\s+/g, "-")}`, retention_in_days: node.config.retentionDays, tags: forgeTags(node.name) },
      },
    },
  }),
};

const ecr: ForgeService = {
  id: "aws.ecr_repository",
  provider: "aws",
  label: "ECR Repository",
  category: "containers",
  isContainer: false,
  allowedParents: [],
  defaultConfig: { scanOnPush: true },
  schema: z.object({ scanOnPush: z.boolean() }),
  fields: [{ key: "scanOnPush", label: "Scan on push", type: "toggle" }],
  toTf: (node, ctx) => ({
    resource: {
      aws_ecr_repository: {
        [ctx.tfName(node.id)]: {
          name: node.name.toLowerCase().replace(/[^a-z0-9/_-]+/g, "-"),
          force_delete: true,
          image_scanning_configuration: { scan_on_push: node.config.scanOnPush === true },
          tags: forgeTags(node.name),
        },
      },
    },
  }),
};

export const AWS_PLATFORM: ForgeService[] = [rds, lambda, ecsCluster, ecsService, logGroup, ecr];
```

- [ ] **Step 4: Run** `npm test -- aws-platform` — expected PASS. (Note: `desiredCount`/`cpu`/`memory` select values arrive as strings from the form — the Inspector (Task 13) coerces `number` fields with `Number(...)` before saving config.)

- [ ] **Step 5: Commit** — `feat(forge): AWS platform catalog (RDS, Lambda, ECS, logs, ECR)`

---

### Task 6: Azure catalog — foundations (Resource Group, VNet, Subnet, NSG)

**Files:**
- Create: `lib/forge/catalog/azure-network.ts`
- Test: `lib/forge/__tests__/azure-network.test.ts`

**Interfaces:**
- Consumes: catalog contract, `zCidr`, `forgeTags` from Task 3.
- Produces: `AZURE_NETWORK: ForgeService[]` with `azure.resource_group` (container, top), `azure.vnet` (container, parent rg), `azure.subnet` (container, parent vnet), `azure.nsg` (parent rg). Also exports two helpers used by every other Azure service:
  - `azureRg(node, ctx): { name: string; location: string }` — `"${azurerm_resource_group.<n>.name}"` / `.location` refs from the nearest RG ancestor (throws when absent).

- [ ] **Step 1: Write failing tests**

```ts
// lib/forge/__tests__/azure-network.test.ts
import { describe, expect, it } from "vitest";
import { AZURE_NETWORK, azureRg } from "@/lib/forge/catalog/azure-network";
import type { ForgeNode } from "@/lib/forge/types";
import type { TfContext } from "@/lib/forge/catalog/types";

const rgNode: ForgeNode = { id: "rg", serviceId: "azure.resource_group", name: "prod rg", parentId: null, position: { x: 0, y: 0 }, config: {} };
const vnetNode: ForgeNode = { id: "vn", serviceId: "azure.vnet", name: "core", parentId: "rg", position: { x: 0, y: 0 }, config: { addressSpace: "10.10.0.0/16" } };

const ctx: TfContext = {
  tfName: (id) => ({ rg: "prod_rg", vn: "core", sn: "apps" })[id]!,
  ancestorOfService: (id, svc) => {
    if (svc === "azure.resource_group" && id !== "rg") return rgNode;
    if (svc === "azure.vnet" && id === "sn") return vnetNode;
    return undefined;
  },
  edgesFrom: () => [],
  awsRegion: "ap-south-1",
  azureLocation: "centralindia",
};

describe("azure network services", () => {
  it("resource group uses the configured location", () => {
    const rg = AZURE_NETWORK.find((s) => s.id === "azure.resource_group")!;
    const tf = rg.toTf(rgNode, ctx);
    expect(tf.resource!.azurerm_resource_group!.prod_rg.location).toBe("centralindia");
  });
  it("azureRg helper resolves refs", () => {
    expect(azureRg(vnetNode, ctx)).toEqual({
      name: "${azurerm_resource_group.prod_rg.name}",
      location: "${azurerm_resource_group.prod_rg.location}",
    });
  });
  it("subnet references vnet + rg by name", () => {
    const subnet = AZURE_NETWORK.find((s) => s.id === "azure.subnet")!;
    const snNode: ForgeNode = { id: "sn", serviceId: "azure.subnet", name: "apps", parentId: "vn", position: { x: 0, y: 0 }, config: { addressPrefix: "10.10.1.0/24" } };
    expect(subnet.toTf(snNode, ctx).resource!.azurerm_subnet!.apps).toMatchObject({
      virtual_network_name: "${azurerm_virtual_network.core.name}",
      resource_group_name: "${azurerm_resource_group.prod_rg.name}",
      address_prefixes: ["10.10.1.0/24"],
    });
  });
});
```

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/forge/catalog/azure-network.ts
import { z } from "zod";
import type { ForgeService, TfContext } from "./types";
import type { ForgeNode } from "@/lib/forge/types";
import { forgeTags, zCidr } from "./aws-network";

/** Resource-group refs for the nearest RG ancestor. Validation (Task 8) guarantees presence. */
export function azureRg(node: ForgeNode, ctx: TfContext): { name: string; location: string } {
  const rg = ctx.ancestorOfService(node.id, "azure.resource_group");
  if (!rg) throw new Error(`${node.name}: must be placed inside a Resource Group`);
  const n = ctx.tfName(rg.id);
  return { name: `\${azurerm_resource_group.${n}.name}`, location: `\${azurerm_resource_group.${n}.location}` };
}

const resourceGroup: ForgeService = {
  id: "azure.resource_group",
  provider: "azure",
  label: "Resource Group",
  category: "network",
  isContainer: true,
  allowedParents: [],
  defaultConfig: {},
  schema: z.object({}),
  fields: [],
  toTf: (node, ctx) => ({
    resource: {
      azurerm_resource_group: {
        [ctx.tfName(node.id)]: {
          name: node.name.replace(/\s+/g, "-"),
          location: ctx.azureLocation,
          tags: forgeTags(node.name),
        },
      },
    },
  }),
};

const vnet: ForgeService = {
  id: "azure.vnet",
  provider: "azure",
  label: "Virtual Network",
  category: "network",
  isContainer: true,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { addressSpace: "10.10.0.0/16" },
  schema: z.object({ addressSpace: zCidr }),
  fields: [{ key: "addressSpace", label: "Address space", type: "text", required: true, placeholder: "10.10.0.0/16" }],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    return {
      resource: {
        azurerm_virtual_network: {
          [ctx.tfName(node.id)]: {
            name: node.name.replace(/\s+/g, "-"),
            address_space: [node.config.addressSpace],
            location: rg.location,
            resource_group_name: rg.name,
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const subnet: ForgeService = {
  id: "azure.subnet",
  provider: "azure",
  label: "Subnet",
  category: "network",
  isContainer: true,
  allowedParents: ["azure.vnet"],
  defaultConfig: { addressPrefix: "10.10.1.0/24" },
  schema: z.object({ addressPrefix: zCidr }),
  fields: [{ key: "addressPrefix", label: "Address prefix", type: "text", required: true }],
  toTf: (node, ctx) => {
    const vn = ctx.ancestorOfService(node.id, "azure.vnet");
    if (!vn) throw new Error(`${node.name}: must be placed inside a Virtual Network`);
    const rg = azureRg(node, ctx);
    return {
      resource: {
        azurerm_subnet: {
          [ctx.tfName(node.id)]: {
            name: node.name.replace(/\s+/g, "-"),
            resource_group_name: rg.name,
            virtual_network_name: `\${azurerm_virtual_network.${ctx.tfName(vn.id)}.name}`,
            address_prefixes: [node.config.addressPrefix],
          },
        },
      },
    };
  },
};

const nsg: ForgeService = {
  id: "azure.nsg",
  provider: "azure",
  label: "Network Security Group",
  category: "network",
  isContainer: false,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { allowPort: 443, sourceCidr: "0.0.0.0/0" },
  schema: z.object({ allowPort: z.number().int().min(0).max(65535), sourceCidr: zCidr }),
  fields: [
    { key: "allowPort", label: "Allow inbound port", type: "number", min: 0, max: 65535 },
    { key: "sourceCidr", label: "Source CIDR", type: "text" },
  ],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    return {
      resource: {
        azurerm_network_security_group: {
          [ctx.tfName(node.id)]: {
            name: node.name.replace(/\s+/g, "-"),
            location: rg.location,
            resource_group_name: rg.name,
            security_rule: [{
              name: `allow-${node.config.allowPort}`,
              priority: 100, direction: "Inbound", access: "Allow", protocol: "Tcp",
              source_port_range: "*", destination_port_range: String(node.config.allowPort),
              source_address_prefix: node.config.sourceCidr, destination_address_prefix: "*",
              description: "", destination_address_prefixes: [], destination_application_security_group_ids: [],
              destination_port_ranges: [], source_address_prefixes: [], source_application_security_group_ids: [],
              source_port_ranges: [],
            }],
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

export const AZURE_NETWORK: ForgeService[] = [resourceGroup, vnet, subnet, nsg];
```

- [ ] **Step 4: Run** — expected PASS.

- [ ] **Step 5: Commit** — `feat(forge): Azure network catalog (RG, VNet, subnet, NSG)`

---

### Task 7: Azure catalog — workloads (VMs, Storage, SQL, Function App, Container App, Log Analytics, ACR)

**Files:**
- Create: `lib/forge/catalog/azure-workloads.ts`
- Create: `lib/forge/catalog/index.ts` (registry)
- Test: `lib/forge/__tests__/azure-workloads.test.ts`, `lib/forge/__tests__/catalog.test.ts`

**Interfaces:**
- Consumes: `azureRg` (Task 6), catalog contract.
- Produces:
  - `AZURE_WORKLOADS: ForgeService[]`: `azure.linux_vm` + `azure.windows_vm` (parent `azure.subnet` — each also emits its `azurerm_network_interface`), `azure.storage_account` (parent rg), `azure.sql` (parent rg — emits `azurerm_mssql_server` + `azurerm_mssql_database`, admin password `"${var.forge_db_password}"`), `azure.function_app` (parent rg — emits `azurerm_service_plan` + `azurerm_linux_function_app`; requires storage-account edge), `azure.container_app` (parent rg — emits `azurerm_container_app_environment` + `azurerm_container_app`), `azure.log_analytics` (parent rg), `azure.acr` (parent rg).
  - Registry: `FORGE_SERVICES: ForgeService[]` (all 24), `getService(id: string): ForgeService | undefined`, `SERVICE_IDS: string[]`.

- [ ] **Step 1: Write failing tests** — registry completeness + representative codegen:

```ts
// lib/forge/__tests__/catalog.test.ts
import { describe, expect, it } from "vitest";
import { FORGE_SERVICES, getService } from "@/lib/forge/catalog";

describe("catalog registry", () => {
  it("has 24 services, 12 per cloud, unique ids", () => {
    expect(FORGE_SERVICES).toHaveLength(24);
    expect(FORGE_SERVICES.filter((s) => s.provider === "aws")).toHaveLength(12);
    expect(FORGE_SERVICES.filter((s) => s.provider === "azure")).toHaveLength(12);
    expect(new Set(FORGE_SERVICES.map((s) => s.id)).size).toBe(24);
  });
  it("every allowedParents entry is a real container service", () => {
    for (const s of FORGE_SERVICES) {
      for (const p of s.allowedParents) {
        const parent = getService(p);
        expect(parent, `${s.id} → ${p}`).toBeTruthy();
        expect(parent!.isContainer).toBe(true);
      }
    }
  });
  it("defaults satisfy each service's own schema (containers exempt from cross-refs)", () => {
    for (const s of FORGE_SERVICES) {
      expect(s.schema.safeParse(s.defaultConfig).success, s.id).toBe(true);
    }
  });
});
```

(azure-workloads.test.ts mirrors Task 6's style: linux_vm inside subnet+rg emits `azurerm_network_interface` + `azurerm_linux_virtual_machine` with `admin_password: "${var.forge_vm_password}"` and `network_interface_ids` referencing the emitted NIC; sql emits server+db pair; function_app throws without a storage-account edge.)

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement.** Same shape as Tasks 5–6; key bodies:

```ts
// lib/forge/catalog/azure-workloads.ts — representative excerpts (implement all 8 services)
const linuxVm: ForgeService = {
  id: "azure.linux_vm", provider: "azure", label: "Linux VM", category: "compute",
  isContainer: false, allowedParents: ["azure.subnet"],
  defaultConfig: { size: "Standard_B2s", adminUsername: "azureuser" },
  schema: z.object({ size: z.string().startsWith("Standard_"), adminUsername: z.string().regex(/^[a-z][a-z0-9]{2,31}$/) }),
  fields: [
    { key: "size", label: "VM size", type: "select", options: ["Standard_B2s", "Standard_D2s_v5", "Standard_D4s_v5"].map((v) => ({ value: v, label: v })) },
    { key: "adminUsername", label: "Admin username", type: "text", required: true },
  ],
  toTf: (node, ctx) => {
    const sn = ctx.ancestorOfService(node.id, "azure.subnet");
    if (!sn) throw new Error(`${node.name}: must be placed inside a Subnet`);
    const rg = azureRg(node, ctx);
    const n = ctx.tfName(node.id);
    return {
      resource: {
        azurerm_network_interface: {
          [n]: {
            name: `${node.name.replace(/\s+/g, "-")}-nic`,
            location: rg.location, resource_group_name: rg.name,
            ip_configuration: [{ name: "primary", subnet_id: `\${azurerm_subnet.${ctx.tfName(sn.id)}.id}`, private_ip_address_allocation: "Dynamic" }],
          },
        },
        azurerm_linux_virtual_machine: {
          [n]: {
            name: node.name.replace(/\s+/g, "-"),
            location: rg.location, resource_group_name: rg.name,
            size: node.config.size,
            admin_username: node.config.adminUsername,
            admin_password: "${var.forge_vm_password}",
            disable_password_authentication: false,
            network_interface_ids: [`\${azurerm_network_interface.${n}.id}`],
            os_disk: { caching: "ReadWrite", storage_account_type: "Standard_LRS" },
            source_image_reference: { publisher: "Canonical", offer: "ubuntu-24_04-lts", sku: "server", version: "latest" },
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};
// windows_vm: same NIC pattern; azurerm_windows_virtual_machine, image MicrosoftWindowsServer/WindowsServer/2022-datacenter-g2.
// storage_account: azurerm_storage_account { name: lowercase alnum ≤24 (schema-enforced regex /^[a-z0-9]{3,24}$/ on config.accountName), account_tier "Standard", account_replication_type "LRS" }.
// sql: azurerm_mssql_server { administrator_login, administrator_login_password "${var.forge_db_password}", version "12.0" } + azurerm_mssql_database { server_id ref, sku_name config }.
// function_app: azurerm_service_plan { os_type "Linux", sku_name "Y1" } + azurerm_linux_function_app { storage_account_name/access_key refs from the storage-account edge target; throws without one; site_config { application_stack { node_version: "22" } } }.
// container_app: azurerm_container_app_environment (+ log_analytics_workspace_id if a log-analytics edge exists) + azurerm_container_app { template { container: [{ name, image: config.image, cpu: 0.5, memory: "1Gi" }] }, revision_mode "Single" }.
// log_analytics: azurerm_log_analytics_workspace { sku "PerGB2018", retention_in_days: config.retentionDays }.
// acr: azurerm_container_registry { sku: config.sku ("Basic"|"Standard"|"Premium"), admin_enabled: false }.
export const AZURE_WORKLOADS: ForgeService[] = [linuxVm, windowsVm, storageAccount, sql, functionApp, containerApp, logAnalytics, acr];
```

**IMPORTANT:** the excerpts above marked with `//` comments must be written out in full in the actual file, following exactly the same structure as `linuxVm` — complete `schema`, `fields`, and `toTf` for each. Every service throws a descriptive `Error` when a required ancestor/edge is missing, mirroring Task 6.

```ts
// lib/forge/catalog/index.ts
import type { ForgeService } from "./types";
import { AWS_NETWORK } from "./aws-network";
import { AWS_COMPUTE } from "./aws-compute";
import { AWS_PLATFORM } from "./aws-platform";
import { AZURE_NETWORK } from "./azure-network";
import { AZURE_WORKLOADS } from "./azure-workloads";

export const FORGE_SERVICES: ForgeService[] = [
  ...AWS_NETWORK, ...AWS_COMPUTE, ...AWS_PLATFORM,
  ...AZURE_NETWORK, ...AZURE_WORKLOADS,
];

const byId = new Map(FORGE_SERVICES.map((s) => [s.id, s]));
export function getService(id: string): ForgeService | undefined {
  return byId.get(id);
}
export const SERVICE_IDS = FORGE_SERVICES.map((s) => s.id);
export type { ForgeService, ForgeField, TfContext, TfFragment, ForgeProvider, ForgeCategory } from "./types";
```

- [ ] **Step 4: Run** `npm test` — all suites PASS.

- [ ] **Step 5: Commit** — `feat(forge): Azure workload catalog and unified service registry`

---

### Task 8: Codegen — validation + tf.json generation + HCL preview

**Files:**
- Create: `lib/forge/terraform.ts`
- Create: `lib/forge/hcl-preview.ts`
- Test: `lib/forge/__tests__/terraform.test.ts`

**Interfaces:**
- Consumes: registry (Task 7), types (Task 2).
- Produces:
  - `validateCanvas(canvas: ForgeCanvas): ForgeValidationIssue[]` — unknown serviceIds, parent-rule violations (against `allowedParents` and container-ness of the actual parent node), schema failures per node config, duplicate tf names.
  - `generateTf(canvas: ForgeCanvas, opts?: { awsRegion?: string; azureLocation?: string }): { tf: Record<string, unknown> | null; issues: ForgeValidationIssue[] }` — returns issues (tf null) when invalid; otherwise the complete tf.json document.
  - `renderHclPreview(tf: Record<string, unknown>): string` — human-readable HCL-ish text.

- [ ] **Step 1: Write failing tests** (representative set — implement all):

```ts
// lib/forge/__tests__/terraform.test.ts
import { describe, expect, it } from "vitest";
import { generateTf, validateCanvas } from "@/lib/forge/terraform";
import type { ForgeCanvas } from "@/lib/forge/types";

const awsCanvas: ForgeCanvas = {
  nodes: [
    { id: "v", serviceId: "aws.vpc", name: "main", parentId: null, position: { x: 0, y: 0 }, config: { cidrBlock: "10.0.0.0/16" } },
    { id: "s", serviceId: "aws.subnet", name: "web", parentId: "v", position: { x: 0, y: 0 }, config: { cidrBlock: "10.0.1.0/24", availabilityZone: "", mapPublicIp: false } },
    { id: "e", serviceId: "aws.ec2_instance", name: "api", parentId: "s", position: { x: 0, y: 0 }, config: { ami: "ami-0abc", instanceType: "t3.micro" } },
  ],
  edges: [],
};

describe("generateTf", () => {
  it("emits providers only for clouds in use", () => {
    const { tf } = generateTf(awsCanvas);
    const doc = tf as { terraform: { required_providers: Record<string, unknown> }; provider: Record<string, unknown> };
    expect(Object.keys(doc.terraform.required_providers)).toEqual(["aws"]);
    expect(doc.provider).toHaveProperty("aws");
    expect(doc.provider).not.toHaveProperty("azurerm");
  });
  it("wires the containment chain", () => {
    const { tf } = generateTf(awsCanvas);
    const r = (tf as { resource: Record<string, Record<string, Record<string, unknown>>> }).resource;
    expect(r.aws_subnet.web.vpc_id).toBe("${aws_vpc.main.id}");
    expect(r.aws_instance.api.subnet_id).toBe("${aws_subnet.web.id}");
  });
  it("deduplicates colliding names deterministically", () => {
    const canvas: ForgeCanvas = {
      nodes: [
        { id: "a", serviceId: "aws.s3_bucket", name: "data", parentId: null, position: { x: 0, y: 0 }, config: { bucketName: "data-a", versioning: false } },
        { id: "b", serviceId: "aws.s3_bucket", name: "data", parentId: null, position: { x: 0, y: 0 }, config: { bucketName: "data-b", versioning: false } },
      ],
      edges: [],
    };
    const { tf } = generateTf(canvas);
    const names = Object.keys((tf as { resource: { aws_s3_bucket: Record<string, unknown> } }).resource.aws_s3_bucket).sort();
    expect(names).toEqual(["data", "data_2"]);
  });
  it("declares var blocks when password variables are referenced", () => {
    const canvas: ForgeCanvas = {
      nodes: [{ id: "d", serviceId: "aws.rds_instance", name: "db", parentId: null, position: { x: 0, y: 0 }, config: { engine: "postgres", instanceClass: "db.t4g.micro", allocatedStorage: 20, username: "app" } }],
      edges: [],
    };
    const { tf } = generateTf(canvas);
    expect((tf as { variable: Record<string, unknown> }).variable).toHaveProperty("forge_db_password");
  });
  it("reports invalid parent placement instead of generating", () => {
    const bad: ForgeCanvas = {
      nodes: [{ id: "x", serviceId: "aws.ec2_instance", name: "loose", parentId: null, position: { x: 0, y: 0 }, config: { ami: "ami-0abc", instanceType: "t3.micro" } }],
      edges: [],
    };
    const { tf, issues } = generateTf(bad);
    expect(tf).toBeNull();
    expect(issues[0]).toMatchObject({ nodeId: "x" });
  });
  it("reports schema violations per node", () => {
    const bad: ForgeCanvas = {
      nodes: [{ id: "v", serviceId: "aws.vpc", name: "main", parentId: null, position: { x: 0, y: 0 }, config: { cidrBlock: "banana" } }],
      edges: [],
    };
    expect(validateCanvas(bad)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/forge/terraform.ts
import { getService } from "./catalog";
import type { TfContext, TfFragment } from "./catalog/types";
import type { ForgeCanvas, ForgeNode, ForgeValidationIssue } from "./types";
import { tfSlug } from "./slug";

const PROVIDER_VERSIONS = {
  aws: { source: "hashicorp/aws", version: "~> 6.0" },
  azurerm: { source: "hashicorp/azurerm", version: "~> 4.0" },
} as const;

/** Password-style variables services may reference; declared only when used. */
const KNOWN_VARIABLES: Record<string, { description: string }> = {
  forge_db_password: { description: "Database master password (TF_VAR_forge_db_password)" },
  forge_vm_password: { description: "VM admin password (TF_VAR_forge_vm_password)" },
};

function buildNameMap(canvas: ForgeCanvas): Map<string, string> {
  const used = new Map<string, number>(); // slug -> count
  const names = new Map<string, string>();
  // Sort for determinism (stable across saves regardless of array order).
  for (const node of [...canvas.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = tfSlug(node.name);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    names.set(node.id, n === 1 ? base : `${base}_${n}`);
  }
  return names;
}

function buildContext(canvas: ForgeCanvas, awsRegion: string, azureLocation: string): TfContext {
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));
  const names = buildNameMap(canvas);
  return {
    tfName: (id) => names.get(id) ?? "unknown",
    ancestorOfService: (id, serviceId) => {
      let cur = byId.get(id)?.parentId ?? null;
      while (cur) {
        const p = byId.get(cur);
        if (!p) return undefined;
        if (p.serviceId === serviceId) return p;
        cur = p.parentId;
      }
      return undefined;
    },
    edgesFrom: (id) =>
      canvas.edges.filter((e) => e.source === id).map((e) => byId.get(e.target)).filter((n): n is ForgeNode => Boolean(n)),
    awsRegion,
    azureLocation,
  };
}

export function validateCanvas(canvas: ForgeCanvas): ForgeValidationIssue[] {
  const issues: ForgeValidationIssue[] = [];
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));
  for (const node of canvas.nodes) {
    const svc = getService(node.serviceId);
    if (!svc) {
      issues.push({ nodeId: node.id, message: `Unknown service "${node.serviceId}"` });
      continue;
    }
    if (!node.name.trim()) issues.push({ nodeId: node.id, message: "Name is required" });
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (node.parentId && !parent) {
      issues.push({ nodeId: node.id, message: "Parent node no longer exists" });
    } else if (parent && !svc.allowedParents.includes(parent.serviceId)) {
      issues.push({ nodeId: node.id, message: `${svc.label} cannot live inside ${getService(parent.serviceId)?.label ?? parent.serviceId}` });
    } else if (!parent && svc.allowedParents.length > 0 && !svc.allowedParents.includes("")) {
      // Services whose only legal home is a container must have one.
      const requiredOnly = svc.allowedParents.filter((p) => p !== "");
      if (requiredOnly.length === svc.allowedParents.length && requiresContainer(svc.id)) {
        issues.push({ nodeId: node.id, message: `${svc.label} must be placed inside: ${svc.allowedParents.map((p) => getService(p)?.label ?? p).join(" or ")}` });
      }
    }
    const parsed = svc.schema.safeParse(node.config);
    if (!parsed.success) {
      for (const err of parsed.error.issues) {
        issues.push({ nodeId: node.id, message: `${String(err.path.join("."))}: ${err.message}` });
      }
    }
  }
  return issues;
}

/** Container-required services: everything with allowedParents except SG/RDS which may also be top level. */
function requiresContainer(serviceId: string): boolean {
  return !["aws.security_group", "aws.rds_instance"].includes(serviceId);
}

export function generateTf(
  canvas: ForgeCanvas,
  opts: { awsRegion?: string; azureLocation?: string } = {},
): { tf: Record<string, unknown> | null; issues: ForgeValidationIssue[] } {
  const issues = validateCanvas(canvas);
  if (issues.length > 0) return { tf: null, issues };
  if (canvas.nodes.length === 0) return { tf: null, issues: [{ nodeId: null, message: "Canvas is empty" }] };

  const awsRegion = opts.awsRegion ?? "ap-south-1";
  const azureLocation = opts.azureLocation ?? "centralindia";
  const ctx = buildContext(canvas, awsRegion, azureLocation);

  const resource: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const node of [...canvas.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const svc = getService(node.serviceId)!;
    let frag: TfFragment;
    try {
      frag = svc.toTf(node, ctx);
    } catch (err) {
      issues.push({ nodeId: node.id, message: err instanceof Error ? err.message : String(err) });
      continue;
    }
    for (const [type, instances] of Object.entries(frag.resource ?? {})) {
      resource[type] = { ...(resource[type] ?? {}), ...instances };
    }
  }
  if (issues.length > 0) return { tf: null, issues };

  const providersInUse = new Set(canvas.nodes.map((n) => getService(n.serviceId)!.provider));
  const requiredProviders: Record<string, unknown> = {};
  const providerBlocks: Record<string, unknown> = {};
  if (providersInUse.has("aws")) {
    requiredProviders.aws = PROVIDER_VERSIONS.aws;
    providerBlocks.aws = { region: awsRegion };
  }
  if (providersInUse.has("azure")) {
    requiredProviders.azurerm = PROVIDER_VERSIONS.azurerm;
    providerBlocks.azurerm = { features: {} };
  }

  // Declare only the variables actually referenced anywhere in the doc.
  const serialized = JSON.stringify(resource);
  const variable: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(KNOWN_VARIABLES)) {
    if (serialized.includes(`\${var.${name}}`)) variable[name] = { type: "string", sensitive: true, description: def.description };
  }

  const tf: Record<string, unknown> = {
    terraform: { required_providers: requiredProviders },
    provider: providerBlocks,
    resource,
    ...(Object.keys(variable).length ? { variable } : {}),
  };
  return { tf, issues: [] };
}
```

```ts
// lib/forge/hcl-preview.ts
/** Best-effort human-readable HCL rendering of a tf.json document (display only). */
export function renderHclPreview(tf: Record<string, unknown>): string {
  const out: string[] = [];
  const resource = (tf.resource ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
  for (const [type, instances] of Object.entries(resource)) {
    for (const [name, body] of Object.entries(instances)) {
      out.push(`resource "${type}" "${name}" {`);
      out.push(renderBody(body, 1));
      out.push("}", "");
    }
  }
  return out.join("\n");
}

function renderBody(obj: Record<string, unknown>, depth: number): string {
  const pad = "  ".repeat(depth);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.every((x) => typeof x === "object" && x !== null)) {
      for (const item of v) lines.push(`${pad}${k} {`, renderBody(item as Record<string, unknown>, depth + 1), `${pad}}`);
    } else if (typeof v === "object") {
      lines.push(`${pad}${k} {`, renderBody(v as Record<string, unknown>, depth + 1), `${pad}}`);
    } else {
      lines.push(`${pad}${k} = ${JSON.stringify(v)}`);
    }
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run** `npm test -- terraform` — expected PASS. Also add one preview assertion: `renderHclPreview` of the awsCanvas output contains `resource "aws_vpc" "main" {`.

- [ ] **Step 5: Commit** — `feat(forge): canvas validation, tf.json generation and HCL preview`

---

### Task 9: DB schema, migration and plan store

**Files:**
- Modify: `db/schema.ts` (append two tables; follow the exact style of `accessTickets` — single quotes, snake_case column names)
- Create: `db/migrations/0005_forge.sql`
- Modify: `db/migrations/meta/_journal.json` (append entry `{ "idx": 5, "version": "7", "when": <epoch ms>, "tag": "0005_forge", "breakpoints": true }` matching existing entries' shape)
- Create: `lib/forge/store.ts`

**Interfaces:**
- Produces (drizzle tables): `forgePlans`, `forgeRuns`.
- Produces (store — all functions take `db` implicitly via `@/db` import):
  - `listPlans(): Promise<ForgePlanRow[]>`
  - `getPlan(id: string): Promise<ForgePlanRow | null>`
  - `createPlan(input: { name: string; description?: string; createdBy: string }): Promise<ForgePlanRow>`
  - `updatePlanCanvas(id: string, canvas: ForgeCanvas): Promise<ForgePlanRow | null>` (bumps `version`, sets status `draft`, touches `updatedAt`)
  - `setPlanGenerated(id: string, tf: Record<string, unknown>): Promise<void>` (status `generated`)
  - `setPlanStatus(id: string, status: ForgePlanStatus): Promise<void>`
  - `deletePlan(id: string): Promise<void>`
  - `createRun(planId: string, kind: ForgeRunKind, triggeredBy: string): Promise<ForgeRunRow>`
  - `appendRunLog(runId: string, chunk: string): Promise<void>` (SQL `log = log || chunk`)
  - `finishRun(runId: string, status: "succeeded" | "failed", exitCode: number | null): Promise<void>`
  - `getRun(runId: string): Promise<ForgeRunRow | null>`
  - `listRuns(planId: string): Promise<ForgeRunRow[]>`
  - `getActiveRun(planId: string): Promise<ForgeRunRow | null>` — also sweeps stale rows: any `running` run started > 30 min ago is marked `failed` first.
  - `snapshotState(planId: string, tfState: string): Promise<void>`

- [ ] **Step 1: Schema** (append to `db/schema.ts`)

```ts
/* ---------------------------------------------------------------------------
 * Forge — visual designer plans + terraform runs.
 * ------------------------------------------------------------------------- */

export const forgePlans = pgTable('forge_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  canvasJson: jsonb('canvas_json').$type<import('@/lib/forge/types').ForgeCanvas>().notNull(),
  tfJson: jsonb('tf_json').$type<Record<string, unknown>>(),
  tfState: text('tf_state'), // last tfstate snapshot (backup of the workspace file)
  status: text('status').notNull().default('draft'), // draft|generated|planned|deploying|deployed|failed|destroyed
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('forge_plans_status_idx').on(t.status)]);

export const forgeRuns = pgTable('forge_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').notNull().references(() => forgePlans.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // plan|apply|destroy
  status: text('status').notNull().default('running'), // running|succeeded|failed
  log: text('log').notNull().default(''),
  exitCode: integer('exit_code'),
  triggeredBy: text('triggered_by').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (t) => [index('forge_runs_plan_idx').on(t.planId)]);
```

- [ ] **Step 2: Migration** `db/migrations/0005_forge.sql`

```sql
CREATE TABLE IF NOT EXISTS "forge_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "canvas_json" jsonb NOT NULL,
  "tf_json" jsonb,
  "tf_state" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_plans_status_idx" ON "forge_plans" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forge_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "forge_plans"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "log" text DEFAULT '' NOT NULL,
  "exit_code" integer,
  "triggered_by" text NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_runs_plan_idx" ON "forge_runs" ("plan_id");
```

- [ ] **Step 3: Store** — `lib/forge/store.ts` imports `db` from `@/db`, tables from `@/db/schema`, uses drizzle `eq/desc/sql`. Every function is a thin typed query; `getActiveRun` runs the stale sweep first:

```ts
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { forgePlans, forgeRuns } from '@/db/schema';
import type { ForgeCanvas, ForgePlanStatus, ForgeRunKind } from './types';

export type ForgePlanRow = typeof forgePlans.$inferSelect;
export type ForgeRunRow = typeof forgeRuns.$inferSelect;

const STALE_RUN_MS = 30 * 60 * 1000;

export async function listPlans(): Promise<ForgePlanRow[]> {
  return db.select().from(forgePlans).orderBy(desc(forgePlans.updatedAt));
}
export async function getPlan(id: string): Promise<ForgePlanRow | null> {
  const rows = await db.select().from(forgePlans).where(eq(forgePlans.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function createPlan(input: { name: string; description?: string; createdBy: string }): Promise<ForgePlanRow> {
  const rows = await db.insert(forgePlans).values({
    name: input.name,
    description: input.description ?? null,
    canvasJson: { nodes: [], edges: [] },
    createdBy: input.createdBy,
  }).returning();
  return rows[0]!;
}
export async function updatePlanCanvas(id: string, canvas: ForgeCanvas): Promise<ForgePlanRow | null> {
  const rows = await db.update(forgePlans)
    .set({ canvasJson: canvas, status: 'draft', version: sql`${forgePlans.version} + 1`, updatedAt: new Date() })
    .where(eq(forgePlans.id, id)).returning();
  return rows[0] ?? null;
}
export async function setPlanGenerated(id: string, tf: Record<string, unknown>): Promise<void> {
  await db.update(forgePlans).set({ tfJson: tf, status: 'generated', updatedAt: new Date() }).where(eq(forgePlans.id, id));
}
export async function setPlanStatus(id: string, status: ForgePlanStatus): Promise<void> {
  await db.update(forgePlans).set({ status, updatedAt: new Date() }).where(eq(forgePlans.id, id));
}
export async function deletePlan(id: string): Promise<void> {
  await db.delete(forgePlans).where(eq(forgePlans.id, id));
}
export async function snapshotState(planId: string, tfState: string): Promise<void> {
  await db.update(forgePlans).set({ tfState }).where(eq(forgePlans.id, planId));
}

export async function createRun(planId: string, kind: ForgeRunKind, triggeredBy: string): Promise<ForgeRunRow> {
  const rows = await db.insert(forgeRuns).values({ planId, kind, triggeredBy }).returning();
  return rows[0]!;
}
export async function appendRunLog(runId: string, chunk: string): Promise<void> {
  await db.update(forgeRuns).set({ log: sql`${forgeRuns.log} || ${chunk}` }).where(eq(forgeRuns.id, runId));
}
export async function finishRun(runId: string, status: 'succeeded' | 'failed', exitCode: number | null): Promise<void> {
  await db.update(forgeRuns).set({ status, exitCode, finishedAt: new Date() }).where(eq(forgeRuns.id, runId));
}
export async function getRun(runId: string): Promise<ForgeRunRow | null> {
  const rows = await db.select().from(forgeRuns).where(eq(forgeRuns.id, runId)).limit(1);
  return rows[0] ?? null;
}
export async function listRuns(planId: string): Promise<ForgeRunRow[]> {
  return db.select().from(forgeRuns).where(eq(forgeRuns.planId, planId)).orderBy(desc(forgeRuns.startedAt));
}
/** Active run for a plan; sweeps runs that died without finishing (stale > 30 min). */
export async function getActiveRun(planId: string): Promise<ForgeRunRow | null> {
  await db.update(forgeRuns)
    .set({ status: 'failed', finishedAt: new Date() })
    .where(and(eq(forgeRuns.status, 'running'), lt(forgeRuns.startedAt, new Date(Date.now() - STALE_RUN_MS))));
  const rows = await db.select().from(forgeRuns)
    .where(and(eq(forgeRuns.planId, planId), eq(forgeRuns.status, 'running'))).limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Apply migration locally** — `DATABASE_URL=postgres://argus:argus@<LAN-IP>:5432/argus npm run db:migrate` (host Postgres shadows Docker on loopback — use the Mac's LAN IP, see memory note). Expected: `0005_forge` applied.

- [ ] **Step 5: Verify** `npm run typecheck` clean, then **Commit** — `feat(forge): plans/runs schema, migration and store`

---

### Task 10: RBAC actions + deploy environment config

**Files:**
- Modify: `lib/auth/rbac.ts` (extend `Action` union + `MATRIX`)
- Modify: `lib/config/env.ts` (add `DEPLOY_*` keys to schema + raw mapping)
- Modify: `.env.example` (new section)
- Create: `lib/forge/deploy-env.ts`
- Test: `lib/forge/__tests__/deploy-env.test.ts`

**Interfaces:**
- Produces:
  - RBAC actions `"forge:read" | "forge:write" | "forge:deploy"`; operator gains `forge:read`+`forge:write`, viewer gains `forge:read` (admin already `*`).
  - `resolveDeployEnv(source?: NodeJS.ProcessEnv): { env: Record<string, string>; clouds: { aws: boolean; azure: boolean } }` — maps `DEPLOY_AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY/REGION` → `AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_REGION`, `DEPLOY_AZURE_CLIENT_ID/CLIENT_SECRET/TENANT_ID/SUBSCRIPTION_ID` → `ARM_CLIENT_ID/ARM_CLIENT_SECRET/ARM_TENANT_ID/ARM_SUBSCRIPTION_ID`, `DEPLOY_DB_PASSWORD` → `TF_VAR_forge_db_password`, `DEPLOY_VM_PASSWORD` → `TF_VAR_forge_vm_password`. NEVER copies the platform's estate credentials. `clouds.aws/azure` true only when that cloud's full credential set is present.

- [ ] **Step 1: Failing test**

```ts
// lib/forge/__tests__/deploy-env.test.ts
import { describe, expect, it } from "vitest";
import { resolveDeployEnv } from "@/lib/forge/deploy-env";

describe("resolveDeployEnv", () => {
  it("maps DEPLOY_AWS_* to AWS_* and reports the cloud ready", () => {
    const { env, clouds } = resolveDeployEnv({
      DEPLOY_AWS_ACCESS_KEY_ID: "AKIAX", DEPLOY_AWS_SECRET_ACCESS_KEY: "s3cr3t", DEPLOY_AWS_REGION: "ap-south-1",
      AWS_ACCESS_KEY_ID: "ESTATE-KEY-MUST-NOT-LEAK",
    });
    expect(env.AWS_ACCESS_KEY_ID).toBe("AKIAX");
    expect(clouds).toEqual({ aws: true, azure: false });
  });
  it("never passes estate credentials through", () => {
    const { env } = resolveDeployEnv({ AWS_ACCESS_KEY_ID: "ESTATE", AZURE_CLIENT_SECRET: "ESTATE" });
    expect(env.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(env.ARM_CLIENT_SECRET).toBeUndefined();
  });
  it("maps azure + password vars", () => {
    const { env, clouds } = resolveDeployEnv({
      DEPLOY_AZURE_CLIENT_ID: "a", DEPLOY_AZURE_CLIENT_SECRET: "b", DEPLOY_AZURE_TENANT_ID: "c", DEPLOY_AZURE_SUBSCRIPTION_ID: "d",
      DEPLOY_DB_PASSWORD: "pw",
    });
    expect(env.ARM_SUBSCRIPTION_ID).toBe("d");
    expect(env.TF_VAR_forge_db_password).toBe("pw");
    expect(clouds.azure).toBe(true);
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement**

```ts
// lib/forge/deploy-env.ts
/**
 * Terraform subprocess environment — built EXCLUSIVELY from DEPLOY_* vars.
 * The platform's read-only estate credentials are never forwarded.
 */
const MAPPING: Record<string, string> = {
  DEPLOY_AWS_ACCESS_KEY_ID: "AWS_ACCESS_KEY_ID",
  DEPLOY_AWS_SECRET_ACCESS_KEY: "AWS_SECRET_ACCESS_KEY",
  DEPLOY_AWS_REGION: "AWS_REGION",
  DEPLOY_AZURE_CLIENT_ID: "ARM_CLIENT_ID",
  DEPLOY_AZURE_CLIENT_SECRET: "ARM_CLIENT_SECRET",
  DEPLOY_AZURE_TENANT_ID: "ARM_TENANT_ID",
  DEPLOY_AZURE_SUBSCRIPTION_ID: "ARM_SUBSCRIPTION_ID",
  DEPLOY_DB_PASSWORD: "TF_VAR_forge_db_password",
  DEPLOY_VM_PASSWORD: "TF_VAR_forge_vm_password",
};

export function resolveDeployEnv(source: NodeJS.ProcessEnv = process.env): {
  env: Record<string, string>;
  clouds: { aws: boolean; azure: boolean };
} {
  const env: Record<string, string> = {};
  for (const [from, to] of Object.entries(MAPPING)) {
    const v = source[from]?.trim();
    if (v) env[to] = v;
  }
  return {
    env,
    clouds: {
      aws: Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY),
      azure: Boolean(env.ARM_CLIENT_ID && env.ARM_CLIENT_SECRET && env.ARM_TENANT_ID && env.ARM_SUBSCRIPTION_ID),
    },
  };
}
```

- [ ] **Step 4:** rbac.ts — add the three actions to the `Action` union; add `"forge:read", "forge:write"` to `operator`'s list and `"forge:read"` to `viewer`'s. env.ts — add optional `DEPLOY_AWS_ACCESS_KEY_ID`, `DEPLOY_AWS_SECRET_ACCESS_KEY`, `DEPLOY_AWS_REGION`, `DEPLOY_AZURE_CLIENT_ID`, `DEPLOY_AZURE_CLIENT_SECRET`, `DEPLOY_AZURE_TENANT_ID`, `DEPLOY_AZURE_SUBSCRIPTION_ID`, `DEPLOY_DB_PASSWORD`, `DEPLOY_VM_PASSWORD` (all `z.string().optional()`) + raw mappings. `.env.example` — new `# ---- Forge (deploy credentials — WRITE access, used only by terraform runs)` section listing all nine, empty values, with a comment that Forge disables Plan/Deploy when unset.

- [ ] **Step 5: Run tests + typecheck, Commit** — `feat(forge): RBAC actions and isolated DEPLOY_* terraform credentials`

---

### Task 11: Terraform runner

**Files:**
- Create: `lib/forge/runner.ts`
- Test: `lib/forge/__tests__/runner.test.ts` (uses a stub `terraform` shell script on PATH)

**Interfaces:**
- Consumes: store (Task 9), `resolveDeployEnv` (Task 10), `generateTf` (Task 8).
- Produces:
  - `forgeVarDir(): string` — `path.join(process.cwd(), "var", "forge")`
  - `prepareWorkspace(planId: string, tf: Record<string, unknown>): Promise<string>` — mkdir -p, writes `main.tf.json`, returns dir
  - `terraformAvailable(): Promise<boolean>` — `terraform version` exits 0
  - `startRun(opts: { planId: string; kind: ForgeRunKind; triggeredBy: string }): Promise<{ runId: string } | { error: string }>` — refuses when: active run exists; plan has no `tfJson` (for plan/apply); needed cloud creds missing; terraform binary missing. Fire-and-forget executes the run, appending logs.

- [ ] **Step 1: Failing tests** — create a stub binary in a temp dir and prepend to PATH:

```ts
// lib/forge/__tests__/runner.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareWorkspace, terraformAvailable, buildCommand } from "@/lib/forge/runner";

let stubDir: string;
beforeAll(() => {
  stubDir = mkdtempSync(path.join(tmpdir(), "tf-stub-"));
  writeFileSync(path.join(stubDir, "terraform"), `#!/bin/sh\necho "stub terraform $@"\nexit 0\n`);
  chmodSync(path.join(stubDir, "terraform"), 0o755);
  process.env.PATH = `${stubDir}:${process.env.PATH}`;
});

describe("runner", () => {
  it("prepares a workspace with main.tf.json", async () => {
    const dir = await prepareWorkspace("test-plan-id", { provider: {} });
    expect(existsSync(path.join(dir, "main.tf.json"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(dir, "main.tf.json"), "utf8"))).toEqual({ provider: {} });
  });
  it("detects the (stub) terraform binary", async () => {
    expect(await terraformAvailable()).toBe(true);
  });
  it("builds the right argv per kind", () => {
    expect(buildCommand("plan")).toEqual(["plan", "-no-color", "-input=false"]);
    expect(buildCommand("apply")).toEqual(["apply", "-no-color", "-input=false", "-auto-approve"]);
    expect(buildCommand("destroy")).toEqual(["destroy", "-no-color", "-input=false", "-auto-approve"]);
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement**

```ts
// lib/forge/runner.ts
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { resolveDeployEnv } from "./deploy-env";
import type { ForgeRunKind } from "./types";
import { getService } from "./catalog";
import {
  appendRunLog, createRun, finishRun, getActiveRun, getPlan,
  setPlanStatus, snapshotState,
} from "./store";

export function forgeVarDir(): string {
  return path.join(process.cwd(), "var", "forge");
}

export async function prepareWorkspace(planId: string, tf: Record<string, unknown>): Promise<string> {
  const dir = path.join(forgeVarDir(), planId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "main.tf.json"), JSON.stringify(tf, null, 2), "utf8");
  return dir;
}

export async function terraformAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("terraform", ["version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

export function buildCommand(kind: ForgeRunKind): string[] {
  const base = [kind, "-no-color", "-input=false"];
  return kind === "plan" ? base : [...base, "-auto-approve"];
}

/** Clouds a plan touches, from its canvas. */
function planClouds(canvas: { nodes: { serviceId: string }[] }): { aws: boolean; azure: boolean } {
  const providers = new Set(canvas.nodes.map((n) => getService(n.serviceId)?.provider));
  return { aws: providers.has("aws"), azure: providers.has("azure") };
}

const STATUS_AFTER: Record<ForgeRunKind, { ok: "planned" | "deployed" | "destroyed"; during?: "deploying" }> = {
  plan: { ok: "planned" },
  apply: { ok: "deployed", during: "deploying" },
  destroy: { ok: "destroyed", during: "deploying" },
};

export async function startRun(opts: { planId: string; kind: ForgeRunKind; triggeredBy: string }):
  Promise<{ runId: string } | { error: string }> {
  const plan = await getPlan(opts.planId);
  if (!plan) return { error: "Plan not found" };
  if (!plan.tfJson) return { error: "Generate Terraform before running" };
  if (await getActiveRun(opts.planId)) return { error: "A run is already in progress for this plan" };
  if (!(await terraformAvailable())) return { error: "terraform binary is not installed on the server" };

  const needed = planClouds(plan.canvasJson);
  const { env, clouds } = resolveDeployEnv();
  if (needed.aws && !clouds.aws) return { error: "DEPLOY_AWS_* credentials are not configured" };
  if (needed.azure && !clouds.azure) return { error: "DEPLOY_AZURE_* credentials are not configured" };

  const run = await createRun(opts.planId, opts.kind, opts.triggeredBy);
  void execute(opts.planId, run.id, opts.kind, plan.tfJson as Record<string, unknown>, env);
  return { runId: run.id };
}

async function execute(
  planId: string, runId: string, kind: ForgeRunKind,
  tf: Record<string, unknown>, deployEnv: Record<string, string>,
): Promise<void> {
  const dir = await prepareWorkspace(planId, tf);
  const during = STATUS_AFTER[kind].during;
  if (during) await setPlanStatus(planId, during);
  try {
    if (!existsSync(path.join(dir, ".terraform"))) {
      const init = await runTerraform(dir, ["init", "-no-color", "-input=false"], deployEnv, runId);
      if (init !== 0) throw new Error(`terraform init exited ${init}`);
    }
    const code = await runTerraform(dir, buildCommand(kind), deployEnv, runId);
    await finishRun(runId, code === 0 ? "succeeded" : "failed", code);
    await setPlanStatus(planId, code === 0 ? STATUS_AFTER[kind].ok : "failed");
  } catch (err) {
    await appendRunLog(runId, `\n[forge] ${err instanceof Error ? err.message : String(err)}\n`);
    await finishRun(runId, "failed", null);
    await setPlanStatus(planId, "failed");
  } finally {
    const statePath = path.join(dir, "terraform.tfstate");
    if (existsSync(statePath)) {
      await snapshotState(planId, await readFile(statePath, "utf8")).catch(() => undefined);
    }
  }
}

/** Spawn terraform with ONLY sanitized base env + deploy creds; stream output to the run log. */
function runTerraform(cwd: string, args: string[], deployEnv: Record<string, string>, runId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("terraform", args, {
      cwd,
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "/tmp", TF_IN_AUTOMATION: "1", ...deployEnv },
    });
    let buffer = "";
    let flushTimer: NodeJS.Timeout | null = null;
    const flush = () => {
      if (!buffer) return;
      const chunk = buffer;
      buffer = "";
      void appendRunLog(runId, chunk);
    };
    const onData = (d: Buffer) => {
      buffer += d.toString("utf8");
      if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 500);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("close", (code) => {
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      resolve(code ?? 1);
    });
  });
}
```

- [ ] **Step 4: Run** `npm test -- runner` — PASS. Note the env allowlist: the child env starts from `{PATH, HOME, TF_IN_AUTOMATION}` only — estate creds are excluded by construction, matching the Task 10 guarantee.

- [ ] **Step 5: Add** `var/` to `.gitignore` (`# forge terraform workspaces` + `var/`). **Commit** — `feat(forge): terraform runner with isolated env and streamed logs`

---

### Task 12: API routes

**Files:**
- Create: `app/api/forge/plans/route.ts` (GET list, POST create)
- Create: `app/api/forge/plans/[id]/route.ts` (GET, PUT canvas, DELETE)
- Create: `app/api/forge/plans/[id]/generate/route.ts` (POST)
- Create: `app/api/forge/plans/[id]/run/route.ts` (POST `{ kind }`)
- Create: `app/api/forge/plans/[id]/runs/route.ts` (GET history + active)
- Create: `app/api/forge/plans/[id]/runs/[runId]/stream/route.ts` (GET SSE)

**Interfaces:**
- Consumes: store, `generateTf`, `renderHclPreview`, `startRun`, `getSession`, `can`.
- Produces JSON envelope `{ success: boolean; data?: T; error?: string }`. Route conventions: `export const runtime = "nodejs"; export const dynamic = "force-dynamic";` like `app/api/tickets/route.ts`.

Gating matrix (return 401 unauthenticated, 403 unauthorized):
| Route | Action |
|---|---|
| GET plans / GET plan / GET runs / stream | `forge:read` |
| POST plans / PUT plan / DELETE plan / generate / run kind=plan | `forge:write` |
| run kind=apply / kind=destroy | `forge:deploy` |

- [ ] **Step 1: Implement plans collection route**

```ts
// app/api/forge/plans/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { createPlan, listPlans } from "@/lib/forge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const zCreate = z.object({ name: z.string().min(1).max(120), description: z.string().max(500).optional() });

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "forge:read")) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ success: true, data: await listPlans() });
  } catch (err) {
    console.error("[forge] list plans failed:", err);
    return NextResponse.json({ success: false, error: "Failed to list plans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "forge:write")) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  const parsed = zCreate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid plan payload" }, { status: 400 });
  try {
    const plan = await createPlan({ ...parsed.data, createdBy: session.email });
    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (err) {
    console.error("[forge] create plan failed:", err);
    return NextResponse.json({ success: false, error: "Failed to create plan" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement the item route.** Same skeleton. `PUT` body schema:

```ts
const zNode = z.object({
  id: z.string().min(1), serviceId: z.string().min(1), name: z.string().min(1).max(80),
  parentId: z.string().nullable(), position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ width: z.number(), height: z.number() }).optional(),
  config: z.record(z.string(), z.unknown()),
});
const zCanvas = z.object({ nodes: z.array(zNode).max(200), edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string() })).max(400) });
```
`PUT` → `updatePlanCanvas`, 404 when store returns null. `DELETE` refuses (409) when `getPlan(id)?.status === "deployed"` — force the user to destroy first. `GET` returns the plan row.

- [ ] **Step 3: Generate route** — loads plan, `generateTf(plan.canvasJson)`; on issues returns `{ success: false, data: { issues } }` with status 422; on success calls `setPlanGenerated` and returns `{ tf, hcl: renderHclPreview(tf), issues: [] }`.

- [ ] **Step 4: Run route** — zod `{ kind: z.enum(["plan","apply","destroy"]) }`; gate `apply|destroy` on `forge:deploy`, `plan` on `forge:write`; call `startRun({ planId, kind, triggeredBy: session.email })`; map `{ error }` → 409/422 with the message; success → `{ success: true, data: { runId } }`.

- [ ] **Step 5: Runs list route** — `{ success: true, data: { runs: await listRuns(id), active: await getActiveRun(id) } }` (active also sweeps stale).

- [ ] **Step 6: SSE stream route**

```ts
// app/api/forge/plans/[id]/runs/[runId]/stream/route.ts
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getRun } from "@/lib/forge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const session = await getSession();
  if (!session || !can(session.role, "forge:read")) return new Response("unauthorized", { status: 401 });
  const { runId } = await params;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let sent = 0;
      const send = (event: string, data: string) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        for (let i = 0; i < 60 * 30; i++) { // hard cap: 30 minutes
          const run = await getRun(runId);
          if (!run) { send("end", "not-found"); break; }
          if (run.log.length > sent) {
            send("log", run.log.slice(sent));
            sent = run.log.length;
          }
          if (run.status !== "running") { send("end", run.status); break; }
          await new Promise((r) => setTimeout(r, 1000));
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
```

- [ ] **Step 7:** `npm run typecheck` clean; manual smoke with curl (list 401 without cookie). **Commit** — `feat(forge): plans/generate/run/stream API routes`

---

### Task 13: UI — nav, plans list, create flow

**Files:**
- Modify: `lib/nav.ts` (add `{ href: "/forge", label: "Forge", icon: Hammer }` after Plans; import `Hammer` from lucide-react)
- Create: `app/(app)/forge/page.tsx`
- Create: `app/(app)/forge/loading.tsx` (mirror `app/(app)/plans/loading.tsx` skeleton pattern)
- Create: `components/forge/CreatePlanButton.tsx`

**Interfaces:**
- Consumes: `listPlans` (server), `PageHeader`, `Surface`, `Badge`, `EmptyState`, `Button` from `components/ui/`.
- Produces: `/forge` list page. Row click → `/forge/[id]`.

- [ ] **Step 1: Plans list page** (server component; follow `app/(app)/plans/page.tsx` structure — PageHeader + Surface list; status → Badge tone map: draft `neutral`, generated `info`, planned `info`, deploying `warning`, deployed `positive`, failed `negative`, destroyed `neutral`).

```tsx
// app/(app)/forge/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Hammer } from "lucide-react";
import { listPlans } from "@/lib/forge/store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreatePlanButton } from "@/components/forge/CreatePlanButton";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Forge" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "positive" | "negative"> = {
  draft: "neutral", generated: "info", planned: "info",
  deploying: "warning", deployed: "positive", failed: "negative", destroyed: "neutral",
};

export default async function ForgePage() {
  const plans = await listPlans();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={Hammer}
        title="Forge"
        description="Design multi-cloud infrastructure on a canvas — Truesight writes and runs the Terraform."
        actions={<CreatePlanButton />}
      />
      {plans.length === 0 ? (
        <EmptyState
          icon={Hammer}
          title="Nothing forged yet"
          description="Create a plan, drag AWS and Azure services onto the canvas, and deploy them with Terraform."
        />
      ) : (
        <Surface level={1} radius="lg" className="divide-y divide-hairline">
          {plans.map((p) => (
            <Link key={p.id} href={`/forge/${p.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-hover">
              <div>
                <div className="text-[14px] font-medium text-ink">{p.name}</div>
                <div className="text-[12px] text-mute">
                  {p.canvasJson.nodes.length} resources · v{p.version} · updated {formatDate(p.updatedAt)}
                </div>
              </div>
              <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
            </Link>
          ))}
        </Surface>
      )}
    </div>
  );
}
```

**Adjustment note:** check `PageHeader`/`Badge`/`EmptyState` props in `components/ui/` before use — match their actual prop names (e.g. Badge `tone` values) rather than inventing new ones.

- [ ] **Step 2: CreatePlanButton** — client component: `Button` opening a small inline form (name + optional description), POST `/api/forge/plans`, on success `router.push(\`/forge/${data.id}\`)`; surfaces API errors inline under the input.

- [ ] **Step 3:** Visit `/forge` in dev, create a plan, land on `/forge/<id>` (404 until Task 14 — acceptable). **Commit** — `feat(forge): nav entry, plans list and create flow`

---

### Task 14: UI — the designer studio (canvas, palette, inspector)

**Files:**
- Create: `app/(app)/forge/[id]/page.tsx`
- Create: `components/forge/flow.ts` (pure ForgeCanvas ↔ React Flow converters)
- Create: `components/forge/ForgeStudio.tsx`
- Create: `components/forge/Palette.tsx`
- Create: `components/forge/ForgeCanvas.tsx`
- Create: `components/forge/nodes/ServiceNode.tsx`
- Create: `components/forge/nodes/ContainerNode.tsx`
- Create: `components/forge/Inspector.tsx`
- Create: `components/forge/service-icons.ts`
- Test: `lib/forge/__tests__/flow.test.ts` (converters are pure — import from `components/forge/flow`)

**Interfaces:**
- Consumes: catalog registry (client-safe — no icons inside), `ForgeCanvas` types, `@xyflow/react`, topology styling patterns from `components/topology/`.
- Produces:
  - `toFlow(canvas: ForgeCanvas, issues: Map<string, string[]>): { nodes: Node[]; edges: Edge[] }` — containers become `type: "container"` with `style: {width,height}`, children get `parentId` + `extent: "parent"`; nodes carry `data: { forge: ForgeNode; label, serviceLabel, provider, errors }`.
  - `fromFlow(nodes: Node[], edges: Edge[]): ForgeCanvas`.
  - `<ForgeStudio plan={...} canWrite canDeploy />` — full-height 3-pane layout.

- [ ] **Step 1: flow.ts converter tests** (round-trip: canvas → flow → canvas is identity for nodes/edges incl. parentId and size; container ordering — parents must precede children in the flow array or React Flow drops them).

- [ ] **Step 2: Implement `flow.ts`**

```ts
// components/forge/flow.ts
import type { Edge, Node } from "@xyflow/react";
import { getService } from "@/lib/forge/catalog";
import type { ForgeCanvas, ForgeNode } from "@/lib/forge/types";

export interface ForgeNodeData extends Record<string, unknown> {
  forge: ForgeNode;
  serviceLabel: string;
  provider: "aws" | "azure";
  isContainer: boolean;
  errors: string[];
}

const DEFAULT_CONTAINER = { width: 420, height: 280 };

export function toFlow(canvas: ForgeCanvas, issues: Map<string, string[]> = new Map()): { nodes: Node<ForgeNodeData>[]; edges: Edge[] } {
  // Parents must precede children for React Flow sub-flows.
  const ordered = [...canvas.nodes].sort((a, b) => depth(canvas, a) - depth(canvas, b));
  const nodes = ordered.map((n) => {
    const svc = getService(n.serviceId);
    const isContainer = svc?.isContainer ?? false;
    return {
      id: n.id,
      type: isContainer ? "container" : "service",
      position: n.position,
      ...(n.parentId ? { parentId: n.parentId, extent: "parent" as const } : {}),
      ...(isContainer ? { style: { width: n.size?.width ?? DEFAULT_CONTAINER.width, height: n.size?.height ?? DEFAULT_CONTAINER.height } } : {}),
      data: {
        forge: n,
        serviceLabel: svc?.label ?? n.serviceId,
        provider: svc?.provider ?? "aws",
        isContainer,
        errors: issues.get(n.id) ?? [],
      },
    } satisfies Node<ForgeNodeData>;
  });
  const edges = canvas.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "default" }));
  return { nodes, edges };
}

function depth(canvas: ForgeCanvas, node: ForgeNode): number {
  let d = 0;
  let cur = node.parentId;
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));
  while (cur) { d++; cur = byId.get(cur)?.parentId ?? null; }
  return d;
}

export function fromFlow(nodes: Node<ForgeNodeData>[], edges: Edge[]): ForgeCanvas {
  return {
    nodes: nodes.map((n) => ({
      ...n.data.forge,
      id: n.id,
      parentId: n.parentId ?? null,
      position: n.position,
      ...(n.data.isContainer
        ? { size: { width: Number(n.style?.width ?? n.width ?? DEFAULT_CONTAINER.width), height: Number(n.style?.height ?? n.height ?? DEFAULT_CONTAINER.height) } }
        : {}),
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}
```

- [ ] **Step 3: Studio + canvas + palette + inspector.** Core behaviors (full components, styled with existing tokens — reference `components/topology/TopologyCanvas.tsx` for React Flow theming):

```tsx
// components/forge/ForgeStudio.tsx — client. State: nodes/edges (useNodesState/useEdgesState
// seeded from toFlow(plan.canvasJson)), selectedId, issues, saving/generating/run state, drawer.
// Toolbar: [Save] [Generate] [Plan] [Deploy] [Destroy] + status pill + validation count.
//  - save(): PUT /api/forge/plans/[id] with fromFlow(nodes, edges); toast errors.
//  - generate(): save() first, then POST .../generate; 422 → set issues map (nodeId → messages[]),
//    re-run toFlow to paint error rings; success → open TfPreview drawer with { tf, hcl }.
//  - runKind(kind): for apply/destroy open ConfirmDialog requiring the user to type the plan
//    name exactly (spec §6); then POST .../run { kind }; on { runId } open RunDrawer streaming.
//  - Palette drag: onDragStart sets e.dataTransfer.setData("application/x-forge-service", svc.id).
//  - Canvas onDrop: const svcId = e.dataTransfer.getData(...); position = screenToFlowPosition(e);
//    target container = topmost intersecting container node whose serviceId ∈ svc.allowedParents
//    (use getIntersectingNodes on a 1×1 rect at the drop point, filter data.isContainer);
//    reject invalid drops (svc.allowedParents non-empty and no valid container) with a transient
//    red toast "EC2 Instance must be dropped inside: Subnet". New node:
//    { id: crypto.randomUUID(), serviceId, name: `${svc.label} ${count+1}`,
//      parentId: container?.id ?? null,
//      position: container ? relativeTo(container) : position, config: { ...svc.defaultConfig } }.
//  - onNodeDragStop: recompute container via intersections; validate allowedParents; snap back
//    (revert to pre-drag position) on invalid reparent.
//  - onConnect: append edge { id: crypto.randomUUID(), source, target }.
//  - Delete key / inspector Delete button: remove node + descendants + touching edges.
//  - Inspector (right, 300px): for selectedId renders name input + catalog fields:
//    text → TextInput, number → TextInput type=number coerced with Number() on change,
//    select → native <select> styled like FilterBar's, toggle → checkbox row. Field errors from
//    issues[nodeId] shown under the matching field. All disabled when !canWrite.
//  - Deploy/Destroy buttons hidden when !canDeploy; whole toolbar read-only when !canWrite.
```

```tsx
// components/forge/nodes/ServiceNode.tsx — compact card: provider dot (aws amber / azure blue,
// same hexes as topology ACCENT_HEX), service label small mono, node name, error ring
// `ring-1 ring-negative` when data.errors.length > 0. Handles: source + target (Position.Left/Right).
// components/forge/nodes/ContainerNode.tsx — translucent rounded rect, dashed hairline border,
// label row top-left (service label + name), NodeResizer (from @xyflow/react) enabled when selected.
```

`service-icons.ts` maps `ForgeCategory` → lucide icon (network→Network, compute→Cpu, storage→Database, database→Database, serverless→Zap, containers→Container, identity→KeyRound, observability→Activity) — used by Palette and ServiceNode.

`app/(app)/forge/[id]/page.tsx` (server): `getSession` → `can(role, "forge:read")`; `getPlan(id)` → `notFound()` when null; render `<ForgeStudio plan={plan} canWrite={can(role, "forge:write")} canDeploy={can(role, "forge:deploy")} />` in a full-height container (`h-[calc(100vh-56px)]`).

- [ ] **Step 4:** Manual test in dev: drag VPC → drop subnet inside → drop EC2 inside subnet → invalid drop of EC2 at top level rejected → edit fields → Save → reload page → canvas restores identically. `npm test` (flow round-trip) PASS.

- [ ] **Step 5: Commit** — `feat(forge): designer studio with palette, canvas containers and inspector`

---

### Task 15: UI — Terraform preview + run drawer (SSE)

**Files:**
- Create: `components/forge/TfPreview.tsx`
- Create: `components/forge/RunDrawer.tsx`
- Create: `components/forge/ConfirmDialog.tsx`
- Modify: `components/forge/ForgeStudio.tsx` (wire the three in)

**Interfaces:**
- Consumes: generate/run/stream routes (Task 12), `Drawer` from `components/ui/Drawer.tsx`.
- Produces:
  - `<TfPreview tf hcl onClose />` — Drawer with HCL/JSON tab toggle (`PillTabs` if its API fits, else two buttons), `<pre className="font-mono text-[12px]">`, Copy + "Download main.tf.json" (Blob URL download).
  - `<RunDrawer planId runId kind onClose onFinished(status) />` — opens EventSource to `/api/forge/plans/${planId}/runs/${runId}/stream`; appends `log` events to a `<pre>` autoscrolled to bottom; `end` event shows status chip (succeeded → positive, failed → negative) and calls `onFinished`; cleanup closes the EventSource on unmount.
  - `<ConfirmDialog planName kind onConfirm onCancel />` — text input; confirm button disabled until input === planName; copy explains exactly what will run (`terraform apply -auto-approve` against AWS/Azure with the DEPLOY credentials).

- [ ] **Step 1: Implement RunDrawer's stream consumption**

```tsx
useEffect(() => {
  const es = new EventSource(`/api/forge/plans/${planId}/runs/${runId}/stream`);
  es.addEventListener("log", (e) => setLog((prev) => prev + JSON.parse((e as MessageEvent).data)));
  es.addEventListener("end", (e) => {
    const status = JSON.parse((e as MessageEvent).data) as string;
    setFinal(status);
    onFinished(status);
    es.close();
  });
  es.onerror = () => { es.close(); setFinal((f) => f ?? "failed"); };
  return () => es.close();
}, [planId, runId, onFinished]);
```

- [ ] **Step 2:** Wire into Studio: generate success opens TfPreview; Plan/Deploy/Destroy open RunDrawer after run POST; after `onFinished` refresh plan status (GET plan) so the toolbar pill updates.

- [ ] **Step 3:** Manual: with no DEPLOY creds set, Plan returns 422 "DEPLOY_AWS_* credentials are not configured" — verify the toast; with a stub terraform on PATH in dev, verify streamed output renders.

- [ ] **Step 4: Commit** — `feat(forge): terraform preview, streamed run drawer and typed deploy confirmation`

---

### Task 16: Terraform in the image, docs, final verification

**Files:**
- Modify: `Dockerfile` (runner stage: install terraform)
- Modify: `README.md` (Forge section under pillars; DEPLOY_* env docs)
- Modify: `docs/CODEBASE.md` (Forge subsystem paragraph)

- [ ] **Step 1: Dockerfile** — in the **runner** stage, before switching to the non-root user:

```dockerfile
# Terraform CLI for Forge deploys (linux, arch-aware).
ARG TERRAFORM_VERSION=1.9.8
RUN apk add --no-cache curl unzip \
  && ARCH="$(apk --print-arch)" \
  && case "$ARCH" in x86_64) TF_ARCH=amd64 ;; aarch64) TF_ARCH=arm64 ;; *) echo "unsupported arch $ARCH" && exit 1 ;; esac \
  && curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_${TF_ARCH}.zip" -o /tmp/tf.zip \
  && unzip -q /tmp/tf.zip -d /usr/local/bin \
  && rm /tmp/tf.zip \
  && terraform version
```

Also create the workspace mount point and hand it to the runtime user: `RUN mkdir -p /app/var/forge && chown -R nextjs:nodejs /app/var` (match the actual user/group names used later in the Dockerfile).

- [ ] **Step 2: Docs** — README: add Forge to the pillars table + a "Forge (deploy)" subsection: what it does, the DEPLOY_* env contract, the read-only-estate guarantee, and that `var/forge/` holds workspaces/state (volume-mount it in production). CODEBASE.md: one paragraph + file map for `lib/forge/`, `components/forge/`, `app/(app)/forge/`, `app/api/forge/`.

- [ ] **Step 3: Full verification**

```bash
npm test                 # all forge suites green
npm run typecheck        # clean
npx eslint lib/forge components/forge app/\(app\)/forge app/api/forge
npm run build            # with DATABASE_URL exported (LAN IP locally)
docker build -t truesight:local --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 .
```

Manual e2e (dev server): create plan → build an AWS VPC/subnet/EC2 + an Azure RG/VNet/subnet/VM on one canvas → Save → Generate (preview shows both providers) → Plan without creds (clean error) → [if DEPLOY creds provided] Plan streams real output.

- [ ] **Step 4: Commit** — `feat(forge): terraform-enabled image and documentation`

---

## Self-Review Notes

- **Spec coverage:** flow (T13-15), palette+dropdown (T14), containers (T14), save (T12/T14), catalog 12+12 (T3-7), tf.json codegen + HCL preview + download (T8, T15), plan/apply/destroy + streamed logs + typed confirm (T11/T12/T15), DEPLOY_* isolation (T10/T11), RBAC (T10/T12), local state + Postgres snapshot (T9/T11), stale-run sweep (T9), terraform in image (T16), tests (every task).
- **Type consistency:** `ForgeService.toTf(node, ctx)` uniform; store row types exported from T9 and consumed by T12; `ForgeNodeData` defined once in flow.ts.
- **Known judgment calls for the implementer:** UI component prop names must be checked against `components/ui/*` at implementation time (noted in T13); Azure workload excerpts in T7 must be expanded to full definitions following the linuxVm exemplar — the required resources and attributes are enumerated there.

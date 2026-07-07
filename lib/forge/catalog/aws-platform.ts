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
            filename: "bootstrap.zip", // artifact uploaded out-of-band; surfaced in UI field help
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
    resource: {
      aws_ecs_cluster: {
        [ctx.tfName(node.id)]: { name: node.name.replace(/\s+/g, "-"), tags: forgeTags(node.name) },
      },
    },
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
  fields: [{
    key: "retentionDays",
    label: "Retention (days)",
    type: "select",
    options: [7, 30, 90, 365].map((v) => ({ value: String(v), label: `${v} days` })),
  }],
  toTf: (node, ctx) => ({
    resource: {
      aws_cloudwatch_log_group: {
        [ctx.tfName(node.id)]: {
          name: `/forge/${node.name.replace(/\s+/g, "-")}`,
          retention_in_days: node.config.retentionDays,
          tags: forgeTags(node.name),
        },
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

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

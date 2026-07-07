import { describe, expect, it } from "vitest";
import { generateTf, validateCanvas } from "@/lib/forge/terraform";
import { renderHclPreview } from "@/lib/forge/hcl-preview";
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
  it("includes both providers for a mixed-cloud canvas", () => {
    const mixed: ForgeCanvas = {
      nodes: [
        ...awsCanvas.nodes,
        { id: "rg", serviceId: "azure.resource_group", name: "prod", parentId: null, position: { x: 0, y: 0 }, config: {} },
      ],
      edges: [],
    };
    const { tf } = generateTf(mixed);
    const doc = tf as { terraform: { required_providers: Record<string, unknown> } };
    expect(Object.keys(doc.terraform.required_providers).sort()).toEqual(["aws", "azurerm"]);
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
  it("empty canvas is an issue, not a crash", () => {
    const { tf, issues } = generateTf({ nodes: [], edges: [] });
    expect(tf).toBeNull();
    expect(issues[0]!.message).toMatch(/empty/i);
  });
  it("renders an HCL preview", () => {
    const { tf } = generateTf(awsCanvas);
    const hcl = renderHclPreview(tf as Record<string, unknown>);
    expect(hcl).toContain('resource "aws_vpc" "main" {');
    expect(hcl).toContain('cidr_block = "10.0.0.0/16"');
  });
});

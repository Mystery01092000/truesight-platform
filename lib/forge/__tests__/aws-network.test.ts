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

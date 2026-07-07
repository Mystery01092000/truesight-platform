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
    const node: ForgeNode = {
      id: "r1", serviceId: "aws.iam_role", name: "lambda exec", parentId: null,
      position: { x: 0, y: 0 }, config: { assumeService: "lambda.amazonaws.com" },
    };
    const tf = role.toTf(node, { ...ctx, tfName: () => "lambda_exec" });
    const doc = JSON.parse(tf.resource!.aws_iam_role!.lambda_exec.assume_role_policy as string);
    expect(doc.Statement[0].Principal.Service).toBe("lambda.amazonaws.com");
  });
});

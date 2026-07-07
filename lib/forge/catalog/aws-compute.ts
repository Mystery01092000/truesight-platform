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
      key: "instanceType",
      label: "Instance type",
      type: "select",
      options: ["t3.micro", "t3.small", "t3.medium", "m7g.large", "c7g.large"].map((v) => ({ value: v, label: v })),
    },
  ],
  toTf: (node, ctx) => {
    const subnet = ctx.ancestorOfService(node.id, "aws.subnet");
    if (!subnet) throw new Error(`${node.name}: must be placed inside a subnet`);
    const sgs = ctx
      .edgesFrom(node.id)
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
    key: "assumeService",
    label: "Assumed by",
    type: "select",
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

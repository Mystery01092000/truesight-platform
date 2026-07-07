import { z } from "zod";
import type { ForgeService, TfContext } from "./types";
import type { ForgeNode } from "@/lib/forge/types";

const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
export const zCidr = z.string().regex(CIDR_RE, "Must be CIDR notation, e.g. 10.0.0.0/16");

/** Standard tags stamped on every Forge-managed resource. */
export function forgeTags(name: string): Record<string, string> {
  return { Name: name, ManagedBy: "truesight-forge" };
}

/** `${aws_vpc.<name>.id}` for the nearest VPC ancestor (validation guarantees presence). */
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
            from_port: node.config.ingressPort,
            to_port: node.config.ingressPort,
            protocol: "tcp",
            cidr_blocks: [node.config.ingressCidr],
            description: "",
            ipv6_cidr_blocks: [],
            prefix_list_ids: [],
            security_groups: [],
            self: false,
          }],
          egress: [{
            from_port: 0,
            to_port: 0,
            protocol: "-1",
            cidr_blocks: ["0.0.0.0/0"],
            description: "",
            ipv6_cidr_blocks: [],
            prefix_list_ids: [],
            security_groups: [],
            self: false,
          }],
          tags: forgeTags(node.name),
        },
      },
    },
  }),
};

export const AWS_NETWORK: ForgeService[] = [vpc, subnet, securityGroup];

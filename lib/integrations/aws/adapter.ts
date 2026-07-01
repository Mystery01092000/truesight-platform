import pLimit from "p-limit";

import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import {
  ResourceGroupsTaggingAPIClient,
  paginateGetResources,
} from "@aws-sdk/client-resource-groups-tagging-api";
import {
  ECSClient,
  DescribeClustersCommand,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  paginateListClusters,
  paginateListServices,
} from "@aws-sdk/client-ecs";
import { ECRClient, paginateDescribeRepositories } from "@aws-sdk/client-ecr";
import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketTaggingCommand,
} from "@aws-sdk/client-s3";
import {
  RDSClient,
  paginateDescribeDBInstances,
  paginateDescribeDBClusters,
} from "@aws-sdk/client-rds";
import {
  EC2Client,
  paginateDescribeVpcs,
  paginateDescribeSubnets,
  paginateDescribeSecurityGroups,
  paginateDescribeInstances,
} from "@aws-sdk/client-ec2";

import { mapAwsType } from "@/lib/taxonomy/aws";
import type { ResourceStatus } from "@/lib/taxonomy";
import type {
  AdapterError,
  AdapterHealth,
  CloudResource,
  DiscoveryResult,
  GraphEdge,
  IntegrationAdapter,
} from "@/lib/integrations/types";
import { makeUrn } from "@/lib/integrations/types";

import { createClientFactory, type AwsClientFactory } from "./client";

/* -------------------------------------------------------------------------- */
/* Public factory                                                             */
/* -------------------------------------------------------------------------- */

export interface AwsAdapterConfig {
  accountId: string;
  label: string;
}

/**
 * A read-only AWS integration adapter. `instanceId` is the account id (the natural
 * identity of an AWS integration); `accountId` / `label` are exposed so the sync
 * orchestrator can persist a friendly display name without re-deriving it.
 */
export interface AwsIntegrationAdapter extends IntegrationAdapter {
  readonly accountId: string;
  readonly label: string;
}

const TARGETED_SERVICES = new Set(["ecs", "ecr", "s3", "rds", "ec2"]);

export function createAwsAdapter(cfg: AwsAdapterConfig): AwsIntegrationAdapter {
  const { accountId, label } = cfg;

  return {
    provider: "aws",
    instanceId: accountId,
    accountId,
    label,

    async healthCheck(): Promise<AdapterHealth> {
      try {
        const sts = createClientFactory(accountId).get(STSClient);
        const id = await sts.send(new GetCallerIdentityCommand({}));
        return {
          provider: "aws",
          instanceId: accountId,
          ok: true,
          detail: `account=${id.Account ?? "?"} arn=${id.Arn ?? "?"}`,
        };
      } catch (err) {
        const e = toAdapterError("sts:GetCallerIdentity", err);
        return {
          provider: "aws",
          instanceId: accountId,
          ok: false,
          detail: `${e.code}: ${e.message}`,
        };
      }
    },

    async discover(): Promise<DiscoveryResult> {
      const factory = createClientFactory(accountId);
      const region = factory.region;
      const errors: AdapterError[] = [];

      // 1. Cheap ARN inventory via the tagging API (non-fatal). Builds an ARN→tags
      //    map used to enrich the targeted describes, plus captures "extra" tagged
      //    resources for services we do not deep-describe (lambda, dynamodb, sns…).
      let tagMap = new Map<string, Record<string, string>>();
      let extras: CloudResource[] = [];
      try {
        const inv = await discoverTagInventory(factory, region);
        tagMap = inv.tagMap;
        extras = inv.extras;
      } catch (err) {
        errors.push(toAdapterError(`tagging:${region}`, err));
      }

      // 2. Targeted describes, one scope per (service). Never let one failure abort
      //    the rest — collect AdapterErrors and mark the result partial.
      const scopes: Array<[string, () => Promise<ScopeResult>]> = [
        [`ecs:${region}`, () => discoverEcs(factory, region, tagMap)],
        [`ecr:${region}`, () => discoverEcr(factory, region, tagMap)],
        [`s3:global`, () => discoverS3(factory, region, tagMap)],
        [`rds:${region}`, () => discoverRds(factory, region, tagMap)],
        [`ec2:${region}`, () => discoverEc2Vpc(factory, region, tagMap)],
      ];

      const settled = await Promise.allSettled(scopes.map(([, fn]) => fn()));

      const resById = new Map<string, CloudResource>();
      const edgeMap = new Map<string, GraphEdge>();
      const addResource = (r: CloudResource) => {
        if (!resById.has(r.urn)) resById.set(r.urn, r);
      };
      const addEdge = (e: GraphEdge) => {
        const k = `${e.source}|${e.target}|${e.kind}`;
        if (!edgeMap.has(k)) edgeMap.set(k, { ...e, id: k });
      };

      extras.forEach(addResource);
      settled.forEach((res, i) => {
        const scope = scopes[i][0];
        if (res.status === "fulfilled") {
          res.value.resources.forEach(addResource);
          res.value.edges.forEach(addEdge);
        } else {
          errors.push(toAdapterError(scope, res.reason));
        }
      });

      return {
        resources: [...resById.values()],
        edges: [...edgeMap.values()],
        partial: errors.length > 0,
        errors,
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Discovery scopes                                                           */
/* -------------------------------------------------------------------------- */

interface ScopeResult {
  resources: CloudResource[];
  edges: GraphEdge[];
}

async function discoverTagInventory(
  factory: AwsClientFactory,
  region: string,
): Promise<{ tagMap: Map<string, Record<string, string>>; extras: CloudResource[] }> {
  const client = factory.get(ResourceGroupsTaggingAPIClient);
  const tagMap = new Map<string, Record<string, string>>();
  const extras: CloudResource[] = [];

  for await (const page of paginateGetResources({ client }, { ResourcesPerPage: 100 })) {
    for (const m of page.ResourceTagMappingList ?? []) {
      const arn = m.ResourceARN;
      if (!arn) continue;
      const tags = normalizeTags(m.Tags);
      tagMap.set(arn.toLowerCase(), tags);

      const parsed = parseArn(arn);
      if (!parsed) continue;
      // Services we deep-describe are authoritative; skip them here to avoid dupes.
      if (TARGETED_SERVICES.has(parsed.service)) continue;

      extras.push(
        buildResource({
          accountId: factory.accountId,
          region: parsed.region || region,
          serviceToken: parsed.service,
          nativeType: parsed.resourceType
            ? `aws:${parsed.service}:${parsed.resourceType}`
            : `aws:${parsed.service}`,
          nativeId: parsed.resourceId || parsed.name,
          name: parsed.name,
          arn,
          status: "unknown",
          tags,
          attributes: { resourceType: parsed.resourceType || null },
        }),
      );
    }
  }

  return { tagMap, extras };
}

async function discoverEcs(
  factory: AwsClientFactory,
  region: string,
  tagMap: Map<string, Record<string, string>>,
): Promise<ScopeResult> {
  const ecs = factory.get(ECSClient);
  const resources: CloudResource[] = [];
  const edges: GraphEdge[] = [];

  const clusterArns: string[] = [];
  for await (const page of paginateListClusters({ client: ecs }, {})) {
    clusterArns.push(...(page.clusterArns ?? []));
  }
  if (clusterArns.length === 0) return { resources, edges };

  // Cluster details.
  for (const batch of chunk(clusterArns, 100)) {
    const { clusters } = await ecs.send(
      new DescribeClustersCommand({ clusters: batch, include: ["TAGS"] }),
    );
    for (const c of clusters ?? []) {
      const name = c.clusterName ?? c.clusterArn ?? "unknown";
      const tags = {
        ...normalizeTags(c.tags),
        ...(tagMap.get(c.clusterArn?.toLowerCase() ?? "") ?? {}),
      };
      resources.push(
        buildResource({
          accountId: factory.accountId,
          region,
          serviceToken: "ecs",
          nativeType: "aws_ecs_cluster",
          nativeId: name,
          name,
          arn: c.clusterArn,
          status: mapStatus(c.status),
          tags,
          attributes: {
            activeServicesCount: c.activeServicesCount,
            runningTasksCount: c.runningTasksCount,
            registeredContainerInstancesCount: c.registeredContainerInstancesCount,
          },
        }),
      );
    }
  }

  // Services + task definitions per cluster (fan-out bounded to 5).
  const limit = pLimit(5);
  const describedTds = new Set<string>();
  const tdImages = new Map<string, string[]>();
  const taskDefResources = new Map<string, CloudResource>();

  await Promise.all(
    clusterArns.map((clusterArn) =>
      limit(async () => {
        const clusterName = clusterArn.split("/").pop() ?? clusterArn;
        const clusterUrn = makeUrn({
          provider: "aws",
          account: factory.accountId,
          region,
          service: "ecs",
          nativeId: clusterName,
        });

        const serviceArns: string[] = [];
        for await (const page of paginateListServices({ client: ecs }, { cluster: clusterArn })) {
          serviceArns.push(...(page.serviceArns ?? []));
        }

        for (const sbatch of chunk(serviceArns, 10)) {
          const { services } = await ecs.send(
            new DescribeServicesCommand({
              cluster: clusterArn,
              services: sbatch,
              include: ["TAGS"],
            }),
          );

          for (const svc of services ?? []) {
            const svcName = svc.serviceName ?? svc.serviceArn ?? "unknown";
            const svcTags = {
              ...normalizeTags(svc.tags),
              ...(tagMap.get(svc.serviceArn?.toLowerCase() ?? "") ?? {}),
            };
            const svcRes = buildResource({
              accountId: factory.accountId,
              region,
              serviceToken: "ecs",
              nativeType: "aws_ecs_service",
              nativeId: `${clusterName}/${svcName}`,
              name: svcName,
              arn: svc.serviceArn,
              status: mapStatus(svc.status),
              tags: svcTags,
              attributes: {
                cluster: clusterName,
                desiredCount: svc.desiredCount,
                runningCount: svc.runningCount,
                pendingCount: svc.pendingCount,
                launchType: svc.launchType,
                taskDefinition: svc.taskDefinition,
              },
            });
            resources.push(svcRes);

            // service → cluster (contains)
            edges.push(edge(svcRes.urn, clusterUrn, "contains"));

            const tdArn = svc.taskDefinition;
            if (tdArn) {
              if (!describedTds.has(tdArn)) {
                describedTds.add(tdArn);
                const { taskDefinition } = await ecs.send(
                  new DescribeTaskDefinitionCommand({ taskDefinition: tdArn }),
                );
                if (taskDefinition) {
                  const images = (taskDefinition.containerDefinitions ?? [])
                    .map((cd) => cd.image)
                    .filter((x): x is string => Boolean(x));
                  tdImages.set(tdArn, images);

                  const tdId = `${taskDefinition.family ?? "task"}:${taskDefinition.revision ?? 0}`;
                  taskDefResources.set(
                    tdId,
                    buildResource({
                      accountId: factory.accountId,
                      region,
                      serviceToken: "ecs",
                      nativeType: "aws_ecs_task_definition",
                      nativeId: tdId,
                      name: tdId,
                      arn: taskDefinition.taskDefinitionArn,
                      status: mapStatus(taskDefinition.status),
                      tags: {},
                      attributes: {
                        family: taskDefinition.family,
                        revision: taskDefinition.revision,
                        cpu: taskDefinition.cpu,
                        memory: taskDefinition.memory,
                        networkMode: taskDefinition.networkMode,
                        containers: (taskDefinition.containerDefinitions ?? []).map((cd) => ({
                          name: cd.name,
                          image: cd.image,
                        })),
                      },
                    }),
                  );
                }
              }

              const tdId = tdArn.split("task-definition/")[1] ?? tdArn.split("/").pop() ?? tdArn;
              const tdUrn = makeUrn({
                provider: "aws",
                account: factory.accountId,
                region,
                service: "ecs",
                nativeId: tdId,
              });
              // service → task definition (uses)
              edges.push(edge(svcRes.urn, tdUrn, "uses"));

              // service → ECR image (uses)
              for (const image of tdImages.get(tdArn) ?? []) {
                const ecr = parseEcrImage(image);
                if (ecr) {
                  edges.push(
                    edge(
                      svcRes.urn,
                      makeUrn({
                        provider: "aws",
                        account: ecr.account,
                        region: ecr.region,
                        service: "ecr",
                        nativeId: ecr.repo,
                      }),
                      "uses",
                    ),
                  );
                }
              }
            }
          }
        }
      }),
    ),
  );

  resources.push(...taskDefResources.values());
  return { resources, edges };
}

async function discoverEcr(
  factory: AwsClientFactory,
  region: string,
  tagMap: Map<string, Record<string, string>>,
): Promise<ScopeResult> {
  const ecr = factory.get(ECRClient);
  const resources: CloudResource[] = [];

  for await (const page of paginateDescribeRepositories({ client: ecr }, {})) {
    for (const repo of page.repositories ?? []) {
      const name = repo.repositoryName ?? repo.repositoryArn ?? "unknown";
      const tags = tagMap.get(repo.repositoryArn?.toLowerCase() ?? "") ?? {};
      resources.push(
        buildResource({
          accountId: factory.accountId,
          region,
          serviceToken: "ecr",
          nativeType: "aws_ecr_repository",
          nativeId: name,
          name,
          arn: repo.repositoryArn,
          status: "healthy",
          tags,
          attributes: {
            uri: repo.repositoryUri,
            imageTagMutability: repo.imageTagMutability,
            scanOnPush: repo.imageScanningConfiguration?.scanOnPush,
            encryptionType: repo.encryptionConfiguration?.encryptionType,
            createdAt: repo.createdAt?.toISOString(),
          },
        }),
      );
    }
  }

  return { resources, edges: [] };
}

async function discoverS3(
  factory: AwsClientFactory,
  _region: string,
  tagMap: Map<string, Record<string, string>>,
): Promise<ScopeResult> {
  const s3 = factory.get(S3Client);
  const resources: CloudResource[] = [];

  const { Buckets } = await s3.send(new ListBucketsCommand({}));
  const buckets = Buckets ?? [];
  const limit = pLimit(5);

  await Promise.all(
    buckets.map((b) =>
      limit(async () => {
        const name = b.Name;
        if (!name) return;

        let bregion: string | null = null;
        try {
          const loc = await s3.send(new GetBucketLocationCommand({ Bucket: name }));
          bregion = loc.LocationConstraint || "us-east-1";
        } catch {
          bregion = null;
        }

        let tags: Record<string, string> = { ...(tagMap.get(`arn:aws:s3:::${name}`) ?? {}) };
        try {
          const regionClient = bregion ? factory.get(S3Client, { region: bregion }) : s3;
          const tg = await regionClient.send(new GetBucketTaggingCommand({ Bucket: name }));
          const t = normalizeTags(tg.TagSet);
          if (Object.keys(t).length) tags = { ...tags, ...t };
        } catch {
          // NoSuchTagSet / access issues are expected; tags stay best-effort.
        }

        resources.push(
          buildResource({
            accountId: factory.accountId,
            region: bregion,
            serviceToken: "s3",
            nativeType: "aws_s3_bucket",
            nativeId: name,
            name,
            arn: `arn:aws:s3:::${name}`,
            status: "healthy",
            tags,
            attributes: { creationDate: b.CreationDate?.toISOString() },
          }),
        );
      }),
    ),
  );

  return { resources, edges: [] };
}

async function discoverRds(
  factory: AwsClientFactory,
  region: string,
  tagMap: Map<string, Record<string, string>>,
): Promise<ScopeResult> {
  const rds = factory.get(RDSClient);
  const resources: CloudResource[] = [];
  const edges: GraphEdge[] = [];

  const vpcUrn = (id: string) =>
    makeUrn({ provider: "aws", account: factory.accountId, region, service: "vpc", nativeId: id });
  const subnetUrn = (id: string) =>
    makeUrn({ provider: "aws", account: factory.accountId, region, service: "vpc", nativeId: id });

  for await (const page of paginateDescribeDBInstances({ client: rds }, {})) {
    for (const db of page.DBInstances ?? []) {
      const id = db.DBInstanceIdentifier ?? db.DbiResourceId ?? "unknown";
      const tags = {
        ...normalizeTags(db.TagList),
        ...(tagMap.get(db.DBInstanceArn?.toLowerCase() ?? "") ?? {}),
      };
      const r = buildResource({
        accountId: factory.accountId,
        region,
        serviceToken: "rds",
        nativeType: "aws_db_instance",
        nativeId: id,
        name: id,
        arn: db.DBInstanceArn,
        status: mapStatus(db.DBInstanceStatus),
        tags,
        attributes: {
          engine: db.Engine,
          engineVersion: db.EngineVersion,
          instanceClass: db.DBInstanceClass,
          multiAZ: db.MultiAZ,
          storageGb: db.AllocatedStorage,
          endpoint: db.Endpoint?.Address,
          port: db.Endpoint?.Port,
          publiclyAccessible: db.PubliclyAccessible,
          vpcId: db.DBSubnetGroup?.VpcId,
          clusterId: db.DBClusterIdentifier,
        },
      });
      resources.push(r);

      const vpcId = db.DBSubnetGroup?.VpcId;
      if (vpcId) edges.push(edge(r.urn, vpcUrn(vpcId), "depends-on"));
      for (const sn of db.DBSubnetGroup?.Subnets ?? []) {
        if (sn.SubnetIdentifier) edges.push(edge(r.urn, subnetUrn(sn.SubnetIdentifier), "depends-on"));
      }
    }
  }

  for await (const page of paginateDescribeDBClusters({ client: rds }, {})) {
    for (const c of page.DBClusters ?? []) {
      const id = c.DBClusterIdentifier ?? c.DbClusterResourceId ?? "unknown";
      const tags = {
        ...normalizeTags(c.TagList),
        ...(tagMap.get(c.DBClusterArn?.toLowerCase() ?? "") ?? {}),
      };
      resources.push(
        buildResource({
          accountId: factory.accountId,
          region,
          serviceToken: "rds",
          nativeType: "aws_rds_cluster",
          nativeId: id,
          name: id,
          arn: c.DBClusterArn,
          status: mapStatus(c.Status),
          tags,
          attributes: {
            engine: c.Engine,
            engineVersion: c.EngineVersion,
            endpoint: c.Endpoint,
            readerEndpoint: c.ReaderEndpoint,
            multiAZ: c.MultiAZ,
            members: (c.DBClusterMembers ?? []).map((m) => m.DBInstanceIdentifier),
          },
        }),
      );
    }
  }

  return { resources, edges };
}

async function discoverEc2Vpc(
  factory: AwsClientFactory,
  region: string,
  _tagMap: Map<string, Record<string, string>>,
): Promise<ScopeResult> {
  const ec2 = factory.get(EC2Client);
  const resources: CloudResource[] = [];
  const edges: GraphEdge[] = [];

  const vpcUrn = (id: string) =>
    makeUrn({ provider: "aws", account: factory.accountId, region, service: "vpc", nativeId: id });
  const subnetUrn = (id: string) =>
    makeUrn({ provider: "aws", account: factory.accountId, region, service: "vpc", nativeId: id });

  // VPCs
  for await (const page of paginateDescribeVpcs({ client: ec2 }, {})) {
    for (const v of page.Vpcs ?? []) {
      if (!v.VpcId) continue;
      const tags = normalizeTags(v.Tags);
      resources.push(
        buildResource({
          accountId: factory.accountId,
          region,
          serviceToken: "vpc",
          nativeType: "aws_vpc",
          nativeId: v.VpcId,
          name: tags.Name ?? v.VpcId,
          status: v.State === "available" ? "healthy" : "unknown",
          tags,
          attributes: { cidrBlock: v.CidrBlock, isDefault: v.IsDefault, state: v.State },
        }),
      );
    }
  }

  // Subnets
  for await (const page of paginateDescribeSubnets({ client: ec2 }, {})) {
    for (const s of page.Subnets ?? []) {
      if (!s.SubnetId) continue;
      const tags = normalizeTags(s.Tags);
      const sr = buildResource({
        accountId: factory.accountId,
        region,
        serviceToken: "vpc",
        nativeType: "aws_subnet",
        nativeId: s.SubnetId,
        name: tags.Name ?? s.SubnetId,
        status: s.State === "available" ? "healthy" : "unknown",
        tags,
        attributes: {
          cidrBlock: s.CidrBlock,
          availabilityZone: s.AvailabilityZone,
          vpcId: s.VpcId,
          availableIpAddressCount: s.AvailableIpAddressCount,
          mapPublicIpOnLaunch: s.MapPublicIpOnLaunch,
        },
      });
      resources.push(sr);
      if (s.VpcId) edges.push(edge(sr.urn, vpcUrn(s.VpcId), "contains"));
    }
  }

  // Security groups
  for await (const page of paginateDescribeSecurityGroups({ client: ec2 }, {})) {
    for (const g of page.SecurityGroups ?? []) {
      if (!g.GroupId) continue;
      const tags = normalizeTags(g.Tags);
      const gr = buildResource({
        accountId: factory.accountId,
        region,
        serviceToken: "vpc",
        nativeType: "aws_security_group",
        nativeId: g.GroupId,
        name: g.GroupName ?? g.GroupId,
        status: "healthy",
        tags,
        attributes: {
          description: g.Description,
          vpcId: g.VpcId,
          ingressRules: (g.IpPermissions ?? []).length,
          egressRules: (g.IpPermissionsEgress ?? []).length,
        },
      });
      resources.push(gr);
      if (g.VpcId) edges.push(edge(gr.urn, vpcUrn(g.VpcId), "contains"));
    }
  }

  // EC2 instances
  for await (const page of paginateDescribeInstances({ client: ec2 }, {})) {
    for (const reservation of page.Reservations ?? []) {
      for (const inst of reservation.Instances ?? []) {
        if (!inst.InstanceId) continue;
        const tags = normalizeTags(inst.Tags);
        const ir = buildResource({
          accountId: factory.accountId,
          region,
          serviceToken: "ec2",
          nativeType: "aws_instance",
          nativeId: inst.InstanceId,
          name: tags.Name ?? inst.InstanceId,
          status: mapStatus(inst.State?.Name),
          tags,
          attributes: {
            instanceType: inst.InstanceType,
            state: inst.State?.Name,
            privateIp: inst.PrivateIpAddress,
            publicIp: inst.PublicIpAddress,
            availabilityZone: inst.Placement?.AvailabilityZone,
            vpcId: inst.VpcId,
            subnetId: inst.SubnetId,
            imageId: inst.ImageId,
          },
        });
        resources.push(ir);
        if (inst.VpcId) edges.push(edge(ir.urn, vpcUrn(inst.VpcId), "depends-on"));
        if (inst.SubnetId) edges.push(edge(ir.urn, subnetUrn(inst.SubnetId), "depends-on"));
      }
    }
  }

  return { resources, edges };
}

/* -------------------------------------------------------------------------- */
/* Normalization helpers                                                      */
/* -------------------------------------------------------------------------- */

interface BuildResourceInput {
  accountId: string;
  region: string | null;
  serviceToken: string;
  nativeType: string;
  nativeId: string;
  name: string;
  arn?: string;
  status: ResourceStatus;
  tags: Record<string, string>;
  attributes: Record<string, unknown>;
}

function buildResource(p: BuildResourceInput): CloudResource {
  const { kind } = mapAwsType(p.serviceToken);
  const urn = makeUrn({
    provider: "aws",
    account: p.accountId,
    region: p.region,
    service: p.serviceToken,
    nativeId: p.nativeId,
  });
  return {
    urn,
    provider: "aws",
    account: p.accountId,
    region: p.region,
    service: p.serviceToken,
    kind,
    nativeType: p.nativeType,
    name: p.name,
    nativeId: p.nativeId,
    arn: p.arn,
    environment: envFromTags(p.tags),
    status: p.status,
    tags: p.tags,
    // Per DB contract there is no nativeType column on `resources`; stash it here.
    attributes: { ...p.attributes, nativeType: p.nativeType },
    relationships: [],
    source: "live",
    discoveredAt: new Date().toISOString(),
  };
}

function edge(source: string, target: string, kind: GraphEdge["kind"]): GraphEdge {
  return { id: `${source}|${target}|${kind}`, source, target, kind };
}

type TagLike = { Key?: string; Value?: string; key?: string; value?: string };

function normalizeTags(list?: TagLike[] | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!list) return out;
  for (const t of list) {
    const k = t.Key ?? t.key;
    const v = t.Value ?? t.value;
    if (typeof k === "string" && k.length > 0) out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

function envFromTags(tags: Record<string, string>): string | undefined {
  for (const k of ["Environment", "environment", "env", "Env", "Stage", "stage"]) {
    if (tags[k]) return tags[k];
  }
  return undefined;
}

function mapStatus(raw?: string | null): ResourceStatus {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (/(available|active|running|in-use|completed|succeeded|enabled|issued|complete)/.test(s)) {
    return "healthy";
  }
  if (/(stopped|stopping|terminated|inactive|disabled|deleted|deleting|draining)/.test(s)) {
    return "stopped";
  }
  if (/(impaired|degraded|failed|error|incompatible|maintenance|backing-up|modifying|rebooting|pending|creating|provisioning|resetting)/.test(s)) {
    return "degraded";
  }
  return "unknown";
}

interface ParsedArn {
  partition: string;
  service: string;
  region: string;
  account: string;
  resourceType: string;
  resourceId: string;
  name: string;
}

function parseArn(arn: string): ParsedArn | null {
  const parts = arn.split(":");
  if (parts.length < 6 || parts[0] !== "arn") return null;
  const [, partition, service, region, account] = parts;
  const remainder = parts.slice(5).join(":");

  let resourceType = "";
  let resourceId = remainder;
  const slash = remainder.indexOf("/");
  const colon = remainder.indexOf(":");
  if (slash >= 0) {
    resourceType = remainder.slice(0, slash);
    resourceId = remainder.slice(slash + 1);
  } else if (colon >= 0) {
    resourceType = remainder.slice(0, colon);
    resourceId = remainder.slice(colon + 1);
  }
  const name = resourceId.includes("/") ? (resourceId.split("/").pop() ?? resourceId) : resourceId;

  return {
    partition,
    service: service.toLowerCase(),
    region,
    account,
    resourceType,
    resourceId,
    name,
  };
}

function parseEcrImage(image: string): { account: string; region: string; repo: string } | null {
  const m = image.match(/^(\d{12})\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com\/([^:@\s]+)/);
  if (!m) return null;
  return { account: m[1], region: m[2], repo: m[3] };
}

function toAdapterError(scope: string, err: unknown): AdapterError {
  const e = err as { name?: string; Code?: string; message?: string; $retryable?: unknown };
  const code = e?.Code ?? e?.name ?? "UnknownError";
  const message = e?.message ?? String(err);
  const retryable = Boolean(e?.$retryable) || /throttl|timeout|rate exceeded|503|500/i.test(message);
  return { provider: "aws", scope, code, message, retryable };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

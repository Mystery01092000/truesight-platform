import type { ResourceKind, ServiceCategory } from './index';

/**
 * Maps an AWS "native type" onto Argus's canonical taxonomy.
 *
 * Accepts any of the shapes Argus ingests:
 *  - Terraform resource types  — `aws_ecs_service`, `aws_s3_bucket`
 *  - CloudFormation type names — `AWS::S3::Bucket`, `AWS::ECS::Service`
 *  - Bare service tokens       — `ecs`, `s3`, `rds` (e.g. the service field of an ARN)
 *  - Full ARNs                 — `arn:aws:ecs:us-east-1:123:service/foo`
 *
 * Resolution is by AWS *service* token, not by the specific sub-resource, which is
 * enough for the visual map's glyph + category bucketing. Unrecognised input falls
 * back to `{ kind: 'unknown', category: 'other' }`.
 */
export function mapAwsType(nativeType: string): { kind: ResourceKind; category: ServiceCategory } {
  const service = extractAwsService(nativeType);
  return AWS_SERVICE_MAP[service] ?? { kind: 'unknown', category: 'other' };
}

/** Canonical AWS service token → { kind, category }. Keys are lowercase service codes. */
const AWS_SERVICE_MAP: Record<string, { kind: ResourceKind; category: ServiceCategory }> = {
  // Compute
  ec2: { kind: 'compute', category: 'compute' },
  autoscaling: { kind: 'compute', category: 'compute' },
  ebs: { kind: 'storage', category: 'storage' },
  lightsail: { kind: 'compute', category: 'compute' },
  batch: { kind: 'compute', category: 'compute' },

  // Containers / registry
  ecs: { kind: 'container', category: 'containers' },
  eks: { kind: 'container', category: 'containers' },
  fargate: { kind: 'container', category: 'containers' },
  ecr: { kind: 'registry', category: 'containers' },

  // Serverless
  lambda: { kind: 'serverless', category: 'compute' },
  apigateway: { kind: 'network', category: 'networking' },
  apigatewayv2: { kind: 'network', category: 'networking' },
  states: { kind: 'serverless', category: 'integration' }, // Step Functions

  // Databases
  rds: { kind: 'database', category: 'database' },
  aurora: { kind: 'database', category: 'database' },
  dynamodb: { kind: 'database', category: 'database' },
  docdb: { kind: 'database', category: 'database' },
  documentdb: { kind: 'database', category: 'database' },
  redshift: { kind: 'database', category: 'database' },
  neptune: { kind: 'database', category: 'database' },
  elasticache: { kind: 'database', category: 'database' },
  memorydb: { kind: 'database', category: 'database' },
  timestream: { kind: 'database', category: 'database' },

  // Storage
  s3: { kind: 'storage', category: 'storage' },
  efs: { kind: 'storage', category: 'storage' },
  fsx: { kind: 'storage', category: 'storage' },
  glacier: { kind: 'storage', category: 'storage' },
  backup: { kind: 'storage', category: 'storage' },

  // Networking
  vpc: { kind: 'network', category: 'networking' },
  ec2networking: { kind: 'network', category: 'networking' },
  elb: { kind: 'network', category: 'networking' },
  elbv2: { kind: 'network', category: 'networking' },
  elasticloadbalancing: { kind: 'network', category: 'networking' },
  route53: { kind: 'network', category: 'networking' },
  globalaccelerator: { kind: 'network', category: 'networking' },
  directconnect: { kind: 'network', category: 'networking' },

  // CDN / edge
  cloudfront: { kind: 'cdn', category: 'networking' },

  // Identity & security
  iam: { kind: 'iam', category: 'security' },
  sts: { kind: 'iam', category: 'security' },
  sso: { kind: 'iam', category: 'security' },
  organizations: { kind: 'iam', category: 'management' },
  cognito: { kind: 'iam', category: 'security' },

  // Secrets / crypto
  kms: { kind: 'secret', category: 'security' },
  secretsmanager: { kind: 'secret', category: 'security' },
  ssm: { kind: 'secret', category: 'management' }, // Parameter Store / SSM
  acm: { kind: 'secret', category: 'security' },

  // AI / ML
  bedrock: { kind: 'ai', category: 'ai-ml' },
  sagemaker: { kind: 'ai', category: 'ai-ml' },
  comprehend: { kind: 'ai', category: 'ai-ml' },
  rekognition: { kind: 'ai', category: 'ai-ml' },
  textract: { kind: 'ai', category: 'ai-ml' },
  polly: { kind: 'ai', category: 'ai-ml' },
  transcribe: { kind: 'ai', category: 'ai-ml' },

  // Monitoring / observability
  cloudwatch: { kind: 'monitoring', category: 'observability' },
  logs: { kind: 'monitoring', category: 'observability' },
  xray: { kind: 'monitoring', category: 'observability' },
  cloudtrail: { kind: 'monitoring', category: 'observability' },
  config: { kind: 'monitoring', category: 'management' },

  // Messaging / queues / streaming
  sqs: { kind: 'queue', category: 'integration' },
  sns: { kind: 'queue', category: 'integration' },
  kinesis: { kind: 'queue', category: 'integration' },
  msk: { kind: 'queue', category: 'integration' },
  eventbridge: { kind: 'queue', category: 'integration' },
  events: { kind: 'queue', category: 'integration' },
};

/**
 * Normalises any accepted AWS type shape down to a bare lowercase service token.
 */
function extractAwsService(nativeType: string): string {
  const raw = nativeType.trim();
  if (!raw) return '';

  // Full ARN: arn:partition:service:region:account:resource
  if (raw.toLowerCase().startsWith('arn:')) {
    const parts = raw.split(':');
    return normaliseServiceToken(parts[2] ?? '');
  }

  // CloudFormation: AWS::ECS::Service  ->  ecs
  if (raw.includes('::')) {
    const parts = raw.split('::');
    // parts[0] = "AWS" (or a custom namespace), parts[1] = service
    return normaliseServiceToken(parts[1] ?? parts[0]);
  }

  // Terraform: aws_ecs_service / aws_s3_bucket -> ecs / s3
  if (raw.toLowerCase().startsWith('aws_')) {
    const rest = raw.slice(4); // strip "aws_"
    const head = rest.split('_')[0] ?? '';
    return normaliseServiceToken(head);
  }

  // Bare token: ecs, s3, rds, docdb...
  return normaliseServiceToken(raw);
}

/** Lowercase + collapse a handful of well-known service aliases. */
function normaliseServiceToken(token: string): string {
  const t = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, string> = {
    amazonec2: 'ec2',
    amazons3: 's3',
    amazonrds: 'rds',
    amazonecs: 'ecs',
    amazoneks: 'eks',
    amazonecr: 'ecr',
    amazondynamodb: 'dynamodb',
    amazoncloudfront: 'cloudfront',
    amazonroute53: 'route53',
    amazonsqs: 'sqs',
    amazonsns: 'sns',
    amazonvpc: 'vpc',
    amazonbedrock: 'bedrock',
    elasticloadbalancingv2: 'elbv2',
    dynamo: 'dynamodb',
    docdbelastic: 'docdb',
    cloudwatchlogs: 'logs',
  };
  return aliases[t] ?? t;
}

import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import type {
  AwsCredentialIdentity,
  AwsCredentialIdentityProvider,
} from "@aws-sdk/types";

/**
 * Per-account AWS credential resolution + a memoized v3 client factory.
 *
 * READ-ONLY by construction: this module only wires up credentials and clients.
 * The adapter that consumes it must call describe/list/get operations exclusively.
 *
 * Credential modes:
 *  - management account (matches `AWS_MGMT_ACCOUNT_ID` + direct env keys) → static keys
 *  - prod account (matches `AWS_PROD_ACCOUNT_ID` + `AWS_PROD_*` keys)     → static keys
 *  - any other account (e.g. dev)                                         → STS AssumeRole
 *    from the management base creds into `arn:aws:iam::<acct>:role/<AWS_READONLY_ROLE_NAME>`.
 *
 * The AssumeRole provider is *lazy* — STS is only hit when a client first makes a
 * call — so a missing role degrades gracefully into a per-scope discovery error
 * rather than throwing at construction time.
 */

type Credentials = AwsCredentialIdentity | AwsCredentialIdentityProvider;

export type CredentialMode = "direct-mgmt" | "direct-prod" | "assume-role";

export interface ResolvedAccount {
  accountId: string;
  region: string;
  credentials: Credentials;
  mode: CredentialMode;
  roleArn?: string;
}

/** Shared config applied to every constructed client. */
interface AwsClientConfig {
  region: string;
  credentials: Credentials;
  retryMode: "adaptive";
  maxAttempts: number;
}

type AwsClientCtor<T> = new (config: AwsClientConfig) => T;

export interface AwsClientFactory {
  readonly accountId: string;
  readonly region: string;
  readonly mode: CredentialMode;
  /** Memoized per (account, client type, region). */
  get<T>(Ctor: AwsClientCtor<T>, opts?: { region?: string }): T;
}

const DEFAULT_REGION = "ap-south-1";
const ROLE_SESSION = "argus-readonly-discovery";

function envRegion(): string {
  return process.env.AWS_REGION?.trim() || DEFAULT_REGION;
}

/** Resolve the credential strategy for a single AWS account from process.env. */
export function resolveAccountCredentials(accountId: string): ResolvedAccount {
  const region = envRegion();
  const mgmtId = process.env.AWS_MGMT_ACCOUNT_ID?.trim();
  const prodId = process.env.AWS_PROD_ACCOUNT_ID?.trim();
  const roleName = process.env.AWS_READONLY_ROLE_NAME?.trim() || "argus-readonly";

  const mgmtKey = process.env.AWS_ACCESS_KEY_ID;
  const mgmtSecret = process.env.AWS_SECRET_ACCESS_KEY;
  const prodKey = process.env.AWS_PROD_ACCESS_KEY_ID;
  const prodSecret = process.env.AWS_PROD_SECRET_ACCESS_KEY;

  if (accountId === mgmtId && mgmtKey && mgmtSecret) {
    return {
      accountId,
      region,
      mode: "direct-mgmt",
      credentials: { accessKeyId: mgmtKey, secretAccessKey: mgmtSecret },
    };
  }

  if (accountId === prodId && prodKey && prodSecret) {
    return {
      accountId,
      region,
      mode: "direct-prod",
      credentials: { accessKeyId: prodKey, secretAccessKey: prodSecret },
    };
  }

  // Fall back to AssumeRole from the management base credentials.
  if (!mgmtKey || !mgmtSecret) {
    throw new Error(
      `No credentials available for AWS account ${accountId}: management base keys ` +
        `(AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) are required to AssumeRole.`,
    );
  }

  const roleArn = `arn:aws:iam::${accountId}:role/${roleName}`;
  const credentials = fromTemporaryCredentials({
    params: {
      RoleArn: roleArn,
      RoleSessionName: ROLE_SESSION,
      DurationSeconds: 3600,
    },
    masterCredentials: { accessKeyId: mgmtKey, secretAccessKey: mgmtSecret },
    clientConfig: { region },
  });

  return { accountId, region, mode: "assume-role", credentials, roleArn };
}

/**
 * Process-wide client cache. v3 clients are cheap to keep and safe to reuse across
 * calls; keying by (account, ctor, region) lets us share the STS-backed provider's
 * cached temporary credentials across every service client for the same account.
 */
const clientCache = new Map<string, unknown>();

/** Build a memoized client factory bound to one account's resolved credentials. */
export function createClientFactory(accountId: string): AwsClientFactory {
  const resolved = resolveAccountCredentials(accountId);

  return {
    accountId,
    region: resolved.region,
    mode: resolved.mode,
    get<T>(Ctor: AwsClientCtor<T>, opts?: { region?: string }): T {
      const region = opts?.region ?? resolved.region;
      const key = `${accountId}:${Ctor.name}:${region}`;
      const existing = clientCache.get(key);
      if (existing) return existing as T;
      const client = new Ctor({
        region,
        credentials: resolved.credentials,
        retryMode: "adaptive",
        maxAttempts: 5,
      });
      clientCache.set(key, client);
      return client;
    },
  };
}

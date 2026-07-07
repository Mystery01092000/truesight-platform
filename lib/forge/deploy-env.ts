/**
 * Terraform subprocess environment — built EXCLUSIVELY from DEPLOY_* vars.
 * The platform's read-only estate credentials are never forwarded.
 */
const MAPPING: Record<string, string> = {
  DEPLOY_AWS_ACCESS_KEY_ID: "AWS_ACCESS_KEY_ID",
  DEPLOY_AWS_SECRET_ACCESS_KEY: "AWS_SECRET_ACCESS_KEY",
  DEPLOY_AWS_REGION: "AWS_REGION",
  DEPLOY_AZURE_CLIENT_ID: "ARM_CLIENT_ID",
  DEPLOY_AZURE_CLIENT_SECRET: "ARM_CLIENT_SECRET",
  DEPLOY_AZURE_TENANT_ID: "ARM_TENANT_ID",
  DEPLOY_AZURE_SUBSCRIPTION_ID: "ARM_SUBSCRIPTION_ID",
  DEPLOY_DB_PASSWORD: "TF_VAR_forge_db_password",
  DEPLOY_VM_PASSWORD: "TF_VAR_forge_vm_password",
};

export function resolveDeployEnv(source: Record<string, string | undefined> = process.env): {
  env: Record<string, string>;
  clouds: { aws: boolean; azure: boolean };
} {
  const env: Record<string, string> = {};
  for (const [from, to] of Object.entries(MAPPING)) {
    const v = source[from]?.trim();
    if (v) env[to] = v;
  }
  return {
    env,
    clouds: {
      aws: Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY),
      azure: Boolean(env.ARM_CLIENT_ID && env.ARM_CLIENT_SECRET && env.ARM_TENANT_ID && env.ARM_SUBSCRIPTION_ID),
    },
  };
}

import { describe, expect, it } from "vitest";
import { resolveDeployEnv } from "@/lib/forge/deploy-env";

describe("resolveDeployEnv", () => {
  it("maps DEPLOY_AWS_* to AWS_* and reports the cloud ready", () => {
    const { env, clouds } = resolveDeployEnv({
      DEPLOY_AWS_ACCESS_KEY_ID: "AKIAX",
      DEPLOY_AWS_SECRET_ACCESS_KEY: "s3cr3t",
      DEPLOY_AWS_REGION: "ap-south-1",
      AWS_ACCESS_KEY_ID: "ESTATE-KEY-MUST-NOT-LEAK",
    });
    expect(env.AWS_ACCESS_KEY_ID).toBe("AKIAX");
    expect(clouds).toEqual({ aws: true, azure: false });
  });
  it("never passes estate credentials through", () => {
    const { env } = resolveDeployEnv({ AWS_ACCESS_KEY_ID: "ESTATE", AZURE_CLIENT_SECRET: "ESTATE" });
    expect(env.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(env.ARM_CLIENT_SECRET).toBeUndefined();
  });
  it("maps azure + password vars", () => {
    const { env, clouds } = resolveDeployEnv({
      DEPLOY_AZURE_CLIENT_ID: "a",
      DEPLOY_AZURE_CLIENT_SECRET: "b",
      DEPLOY_AZURE_TENANT_ID: "c",
      DEPLOY_AZURE_SUBSCRIPTION_ID: "d",
      DEPLOY_DB_PASSWORD: "pw",
    });
    expect(env.ARM_SUBSCRIPTION_ID).toBe("d");
    expect(env.TF_VAR_forge_db_password).toBe("pw");
    expect(clouds.azure).toBe(true);
  });
});

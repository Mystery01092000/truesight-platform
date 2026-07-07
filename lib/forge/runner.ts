import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { resolveDeployEnv } from "./deploy-env";
import type { ForgeRunKind } from "./types";
import { getService } from "./catalog";
import {
  appendRunLog,
  createRun,
  finishRun,
  getActiveRun,
  getPlan,
  setPlanStatus,
  snapshotState,
} from "./store";

export function forgeVarDir(): string {
  return path.join(process.cwd(), "var", "forge");
}

export async function prepareWorkspace(planId: string, tf: Record<string, unknown>): Promise<string> {
  const dir = path.join(forgeVarDir(), planId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "main.tf.json"), JSON.stringify(tf, null, 2), "utf8");
  return dir;
}

export async function terraformAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("terraform", ["version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

export function buildCommand(kind: ForgeRunKind): string[] {
  const base = [kind, "-no-color", "-input=false"];
  return kind === "plan" ? base : [...base, "-auto-approve"];
}

/** Clouds a plan touches, from its canvas. */
function planClouds(canvas: { nodes: { serviceId: string }[] }): { aws: boolean; azure: boolean } {
  const providers = new Set(canvas.nodes.map((n) => getService(n.serviceId)?.provider));
  return { aws: providers.has("aws"), azure: providers.has("azure") };
}

const STATUS_AFTER: Record<ForgeRunKind, { ok: "planned" | "deployed" | "destroyed"; during?: "deploying" }> = {
  plan: { ok: "planned" },
  apply: { ok: "deployed", during: "deploying" },
  destroy: { ok: "destroyed", during: "deploying" },
};

export async function startRun(opts: {
  planId: string;
  kind: ForgeRunKind;
  triggeredBy: string;
}): Promise<{ runId: string } | { error: string }> {
  const plan = await getPlan(opts.planId);
  if (!plan) return { error: "Plan not found" };
  if (!plan.tfJson) return { error: "Generate Terraform before running" };
  if (await getActiveRun(opts.planId)) return { error: "A run is already in progress for this plan" };
  if (!(await terraformAvailable())) return { error: "terraform binary is not installed on the server" };

  const needed = planClouds(plan.canvasJson);
  const { env, clouds } = resolveDeployEnv();
  if (needed.aws && !clouds.aws) return { error: "DEPLOY_AWS_* credentials are not configured" };
  if (needed.azure && !clouds.azure) return { error: "DEPLOY_AZURE_* credentials are not configured" };

  const run = await createRun(opts.planId, opts.kind, opts.triggeredBy);
  void execute(opts.planId, run.id, opts.kind, plan.tfJson as Record<string, unknown>, env);
  return { runId: run.id };
}

async function execute(
  planId: string,
  runId: string,
  kind: ForgeRunKind,
  tf: Record<string, unknown>,
  deployEnv: Record<string, string>,
): Promise<void> {
  const dir = await prepareWorkspace(planId, tf);
  const during = STATUS_AFTER[kind].during;
  if (during) await setPlanStatus(planId, during);
  try {
    if (!existsSync(path.join(dir, ".terraform"))) {
      const init = await runTerraform(dir, ["init", "-no-color", "-input=false"], deployEnv, runId);
      if (init !== 0) throw new Error(`terraform init exited ${init}`);
    }
    const code = await runTerraform(dir, buildCommand(kind), deployEnv, runId);
    await finishRun(runId, code === 0 ? "succeeded" : "failed", code);
    await setPlanStatus(planId, code === 0 ? STATUS_AFTER[kind].ok : "failed");
  } catch (err) {
    await appendRunLog(runId, `\n[forge] ${err instanceof Error ? err.message : String(err)}\n`);
    await finishRun(runId, "failed", null);
    await setPlanStatus(planId, "failed");
  } finally {
    const statePath = path.join(dir, "terraform.tfstate");
    if (existsSync(statePath)) {
      await snapshotState(planId, await readFile(statePath, "utf8")).catch(() => undefined);
    }
  }
}

/** Spawn terraform with ONLY a sanitized base env + deploy creds; stream output to the run log. */
function runTerraform(
  cwd: string,
  args: string[],
  deployEnv: Record<string, string>,
  runId: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("terraform", args, {
      cwd,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "/tmp",
        TF_IN_AUTOMATION: "1",
        ...deployEnv,
      },
    });
    let buffer = "";
    let flushTimer: NodeJS.Timeout | null = null;
    const flush = () => {
      if (!buffer) return;
      const chunk = buffer;
      buffer = "";
      void appendRunLog(runId, chunk);
    };
    const onData = (d: Buffer) => {
      buffer += d.toString("utf8");
      if (!flushTimer) {
        flushTimer = setTimeout(() => {
          flushTimer = null;
          flush();
        }, 500);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("close", (code) => {
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      resolve(code ?? 1);
    });
  });
}

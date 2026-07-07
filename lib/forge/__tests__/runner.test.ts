import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// The runner module transitively imports the store (drizzle + `server-only`),
// which cannot load in a vitest process — stub it before importing the runner.
vi.mock("@/lib/forge/store", () => ({
  appendRunLog: vi.fn(),
  createRun: vi.fn(),
  finishRun: vi.fn(),
  getActiveRun: vi.fn(),
  getPlan: vi.fn(),
  setPlanStatus: vi.fn(),
  snapshotState: vi.fn(),
}));

import { prepareWorkspace, terraformAvailable, buildCommand } from "@/lib/forge/runner";

let stubDir: string;
beforeAll(() => {
  stubDir = mkdtempSync(path.join(tmpdir(), "tf-stub-"));
  writeFileSync(path.join(stubDir, "terraform"), `#!/bin/sh\necho "stub terraform $@"\nexit 0\n`);
  chmodSync(path.join(stubDir, "terraform"), 0o755);
  process.env.PATH = `${stubDir}:${process.env.PATH}`;
});

describe("runner", () => {
  it("prepares a workspace with main.tf.json", async () => {
    const dir = await prepareWorkspace("test-plan-id", { provider: {} });
    expect(existsSync(path.join(dir, "main.tf.json"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(dir, "main.tf.json"), "utf8"))).toEqual({ provider: {} });
  });
  it("detects the (stub) terraform binary", async () => {
    expect(await terraformAvailable()).toBe(true);
  });
  it("builds the right argv per kind", () => {
    expect(buildCommand("plan")).toEqual(["plan", "-no-color", "-input=false"]);
    expect(buildCommand("apply")).toEqual(["apply", "-no-color", "-input=false", "-auto-approve"]);
    expect(buildCommand("destroy")).toEqual(["destroy", "-no-color", "-input=false", "-auto-approve"]);
  });
});

import { describe, expect, it } from "vitest";
import { FORGE_SERVICES, getService } from "@/lib/forge/catalog";

describe("catalog registry", () => {
  it("has 24 services, 12 per cloud, unique ids", () => {
    expect(FORGE_SERVICES).toHaveLength(24);
    expect(FORGE_SERVICES.filter((s) => s.provider === "aws")).toHaveLength(12);
    expect(FORGE_SERVICES.filter((s) => s.provider === "azure")).toHaveLength(12);
    expect(new Set(FORGE_SERVICES.map((s) => s.id)).size).toBe(24);
  });
  it("every allowedParents entry is a real container service", () => {
    for (const s of FORGE_SERVICES) {
      for (const p of s.allowedParents) {
        const parent = getService(p);
        expect(parent, `${s.id} → ${p}`).toBeTruthy();
        expect(parent!.isContainer).toBe(true);
      }
    }
  });
  it("defaults satisfy each service's own schema", () => {
    for (const s of FORGE_SERVICES) {
      // Services with required user input (empty defaults) are exempt only where
      // the schema genuinely requires user input: check via safeParse and allow
      // failures only for keys whose default is "".
      const res = s.schema.safeParse(s.defaultConfig);
      if (!res.success) {
        const failingKeys = res.error.issues.map((i) => String(i.path[0]));
        for (const k of failingKeys) {
          expect((s.defaultConfig as Record<string, unknown>)[k], `${s.id}.${k} non-empty default must validate`).toBe("");
        }
      }
    }
  });
});

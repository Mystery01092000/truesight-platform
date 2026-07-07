import { describe, expect, it } from "vitest";

describe("vitest wiring", () => {
  it("resolves the @ alias", async () => {
    const mod = await import("@/lib/utils/cn");
    expect(typeof mod.cn).toBe("function");
  });
});

import { describe, expect, it } from "vitest";
import { tfSlug } from "@/lib/forge/slug";

describe("tfSlug", () => {
  it("lowercases and underscores", () => expect(tfSlug("Web Server 1")).toBe("web_server_1"));
  it("strips illegal chars", () => expect(tfSlug("api-güte!x")).toBe("api_g_te_x"));
  it("prefixes when starting with a digit", () => expect(tfSlug("3tier")).toBe("r_3tier"));
  it("collapses repeats and trims", () => expect(tfSlug("__a—__b__")).toBe("a_b"));
  it("falls back for empty input", () => expect(tfSlug("˚˚")).toBe("resource"));
});

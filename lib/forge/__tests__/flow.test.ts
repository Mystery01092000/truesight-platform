import { describe, expect, it } from "vitest";
import { toFlow, fromFlow, absolutePosition } from "@/components/forge/flow";
import type { ForgeCanvas } from "@/lib/forge/types";

const canvas: ForgeCanvas = {
  nodes: [
    // Child listed before parent on purpose — toFlow must reorder parents first.
    { id: "s", serviceId: "aws.subnet", name: "web", parentId: "v", position: { x: 40, y: 60 }, size: { width: 300, height: 200 }, config: { cidrBlock: "10.0.1.0/24" } },
    { id: "v", serviceId: "aws.vpc", name: "main", parentId: null, position: { x: 100, y: 100 }, size: { width: 500, height: 400 }, config: { cidrBlock: "10.0.0.0/16" } },
    { id: "e", serviceId: "aws.ec2_instance", name: "api", parentId: "s", position: { x: 10, y: 20 }, config: { ami: "ami-0abc", instanceType: "t3.micro" } },
  ],
  edges: [{ id: "ed1", source: "e", target: "v" }],
};

describe("flow converters", () => {
  it("orders parents before children", () => {
    const { nodes } = toFlow(canvas);
    const ids = nodes.map((n) => n.id);
    expect(ids.indexOf("v")).toBeLessThan(ids.indexOf("s"));
    expect(ids.indexOf("s")).toBeLessThan(ids.indexOf("e"));
  });
  it("round-trips nodes and edges", () => {
    const { nodes, edges } = toFlow(canvas);
    const back = fromFlow(nodes, edges);
    const byId = (c: ForgeCanvas, id: string) => c.nodes.find((n) => n.id === id)!;
    for (const id of ["v", "s", "e"]) {
      expect(byId(back, id)).toMatchObject({
        parentId: byId(canvas, id).parentId,
        position: byId(canvas, id).position,
        config: byId(canvas, id).config,
      });
    }
    expect(byId(back, "v").size).toEqual({ width: 500, height: 400 });
    expect(byId(back, "e").size).toBeUndefined();
    expect(back.edges).toEqual(canvas.edges);
  });
  it("computes absolute positions through the parent chain", () => {
    const { nodes } = toFlow(canvas);
    expect(absolutePosition(nodes, "e")).toEqual({ x: 150, y: 180 });
  });
  it("marks containers with type container and style size", () => {
    const { nodes } = toFlow(canvas);
    const v = nodes.find((n) => n.id === "v")!;
    expect(v.type).toBe("container");
    expect(v.style).toEqual({ width: 500, height: 400 });
    expect(nodes.find((n) => n.id === "e")!.type).toBe("service");
  });
});

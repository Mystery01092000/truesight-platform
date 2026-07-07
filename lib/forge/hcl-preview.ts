/** Best-effort human-readable HCL rendering of a tf.json document (display only). */
export function renderHclPreview(tf: Record<string, unknown>): string {
  const out: string[] = [];
  const resource = (tf.resource ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
  for (const [type, instances] of Object.entries(resource)) {
    for (const [name, body] of Object.entries(instances)) {
      out.push(`resource "${type}" "${name}" {`);
      out.push(renderBody(body, 1));
      out.push("}", "");
    }
  }
  return out.join("\n");
}

function renderBody(obj: Record<string, unknown>, depth: number): string {
  const pad = "  ".repeat(depth);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.every((x) => typeof x === "object" && x !== null)) {
      for (const item of v) {
        lines.push(`${pad}${k} {`, renderBody(item as Record<string, unknown>, depth + 1), `${pad}}`);
      }
    } else if (typeof v === "object" && !Array.isArray(v)) {
      lines.push(`${pad}${k} {`, renderBody(v as Record<string, unknown>, depth + 1), `${pad}}`);
    } else {
      lines.push(`${pad}${k} = ${JSON.stringify(v)}`);
    }
  }
  return lines.join("\n");
}

"use client";

import { Trash2 } from "lucide-react";
import { getService, type ForgeField } from "@/lib/forge/catalog";
import type { ForgeFlowNode } from "@/components/forge/flow";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

interface InspectorProps {
  node: ForgeFlowNode | null;
  disabled: boolean;
  onRename: (id: string, name: string) => void;
  onConfigChange: (id: string, key: string, value: unknown) => void;
  onDelete: (id: string) => void;
}

const inputCls =
  "h-8 w-full rounded-md border border-hairline bg-surface-card px-2.5 text-[12px] text-ink outline-none placeholder:text-ash focus:border-iris disabled:opacity-50";

/** Right rail: form for the selected node, driven by the catalog field spec. */
export function Inspector({ node, disabled, onRename, onConfigChange, onDelete }: InspectorProps) {
  if (!node) {
    return (
      <aside className="w-72 shrink-0 border-l border-hairline bg-surface-base p-4">
        <p className="mt-6 text-center text-[12px] leading-[1.6] text-ash">
          Select a resource on the canvas to edit its configuration.
        </p>
      </aside>
    );
  }
  const svc = getService(node.data.forge.serviceId);
  const errors = node.data.errors;

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-hairline bg-surface-base p-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.4px] text-ash">{node.data.serviceLabel}</div>
        <label className="mt-2 block text-[11px] text-mute" htmlFor="forge-name">
          Name
        </label>
        <input
          id="forge-name"
          className={cn(inputCls, "mt-1")}
          value={node.data.forge.name}
          disabled={disabled}
          onChange={(e) => onRename(node.id, e.target.value)}
        />
      </div>

      {svc?.fields.map((field) => (
        <Field
          key={field.key}
          field={field}
          value={node.data.forge.config[field.key]}
          disabled={disabled}
          onChange={(v) => onConfigChange(node.id, field.key, v)}
        />
      ))}

      {errors.length > 0 ? (
        <div className="rounded-md border border-negative/40 bg-negative/10 p-2.5">
          {errors.map((e, i) => (
            <p key={i} className="text-[11px] leading-[1.5] text-negative">
              {e}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-4">
        <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onDelete(node.id)} className="w-full">
          <Trash2 size={13} strokeWidth={1.5} />
          Delete resource
        </Button>
      </div>
    </aside>
  );
}

function Field({
  field,
  value,
  disabled,
  onChange,
}: {
  field: ForgeField;
  value: unknown;
  disabled: boolean;
  onChange: (v: unknown) => void;
}) {
  const id = `forge-field-${field.key}`;
  return (
    <div>
      <label className="block text-[11px] text-mute" htmlFor={id}>
        {field.label}
        {field.required ? <span className="text-negative"> *</span> : null}
      </label>
      {field.type === "text" ? (
        <input
          id={id}
          className={cn(inputCls, "mt-1")}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "number" ? (
        <input
          id={id}
          type="number"
          className={cn(inputCls, "mt-1")}
          value={value === undefined || value === null ? "" : Number(value)}
          min={field.min}
          max={field.max}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          className={cn(inputCls, "mt-1 appearance-none")}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => {
            // Numeric-looking select values (cpu/memory/retention) stay numbers.
            const raw = e.target.value;
            onChange(/^\d+$/.test(raw) && typeof value === "number" ? Number(raw) : raw);
          }}
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <label className="mt-1 flex cursor-pointer items-center gap-2 text-[12px] text-body">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="size-3.5 accent-[#7c8dff]"
          />
          Enabled
        </label>
      )}
      {field.help ? <p className="mt-1 text-[10px] leading-[1.5] text-ash">{field.help}</p> : null}
    </div>
  );
}

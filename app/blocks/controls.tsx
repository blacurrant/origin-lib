"use client";

import { useState, type ReactNode } from "react";
import { ACCENTS } from "@/app/core/types";
import { FOCUS, Icon } from "./kit";

/** The Framer property-control shape each component exposes on `Component.propertyControls`. */
export type PC = {
  type: string;
  title?: string;
  defaultValue?: unknown;
  options?: string[];
  optionTitles?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  displayTextArea?: boolean;
  maxCount?: number;
  control?: PC;
  controls?: Record<string, PC>;
};

export type Values = Record<string, unknown>;

/** Props the inspector drives itself, so they are not listed again. */
const OWNED = new Set(["theme"]);

export function readControls(Comp: unknown): [string, PC][] {
  const pc = (Comp as { propertyControls?: Record<string, PC> } | undefined)?.propertyControls;
  if (!pc) return [];
  return Object.entries(pc).filter(([key, c]) => !OWNED.has(key) && c.type !== "eventhandler");
}

export function defaultOf(c: PC): unknown {
  if (c.type === "object") return Object.fromEntries(Object.entries(c.controls ?? {}).map(([k, v]) => [k, defaultOf(v)]));
  if (c.defaultValue !== undefined) return c.defaultValue;
  if (c.type === "boolean") return false;
  if (c.type === "number") return c.min ?? 0;
  if (c.type === "array") return [];
  return "";
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Which section a control belongs to: what it says, how it behaves, how it looks. */
function section(key: string, c: PC): "Content" | "Behavior" | "Style" {
  if (c.type === "color" || c.type === "font" || key === "radius" || key === "cornerRadius") return "Style";
  if (c.type === "array" || c.type === "string" || c.type === "responsiveimage" || c.type === "image") return "Content";
  return "Behavior";
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

const FIELD = `h-9 w-full rounded-lg border border-[#2a2a2e] bg-[#161618] px-3 text-[13px] text-[#ededee] placeholder:text-[#84848a] transition-colors hover:border-[#3a3a40] focus:border-[#6a6a72] ${FOCUS}`;

function Slider({ c, value, onChange, id }: { c: PC; value: number; onChange: (v: number) => void; id: string }) {
  const min = c.min ?? 0;
  const max = c.max ?? 100;
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={c.step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`blocks-range h-5 min-w-0 flex-1 cursor-pointer ${FOCUS}`}
        style={{ ["--pct" as string]: `${pct}%` }}
      />
      <input
        type="number"
        aria-label={`${c.title ?? id} value`}
        min={min}
        max={max}
        step={c.step ?? 1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        className={`h-8 w-[64px] rounded-lg border border-[#2a2a2e] bg-[#161618] px-2 text-right text-[12px] tabular-nums text-[#ededee] ${FOCUS}`}
      />
    </div>
  );
}

function Segmented({ options, titles, value, onChange, label }: { options: string[]; titles?: string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-[#161618] p-0.5">
      {options.map((o, i) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            className={`h-8 min-w-0 flex-1 truncate rounded-md px-2 text-[12px] font-medium transition-colors ${FOCUS} ${on ? "bg-[#2c2c31] text-white shadow-sm" : "text-[#8b8b90] hover:text-white"}`}
          >
            {titles?.[i] ?? o}
          </button>
        );
      })}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${FOCUS} ${on ? "bg-white" : "bg-[#35353a]"}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full transition-all ${on ? "left-5 bg-black" : "left-1 bg-[#8b8b90]"}`} />
    </button>
  );
}

function ColorField({ value, onChange, label, presets }: { value: string; onChange: (v: string) => void; label: string; presets?: boolean }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className={`relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[#2a2a2e] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white`} style={{ background: value || "transparent" }}>
          <span className="sr-only">{label} picker</span>
          <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <input
          type="text"
          aria-label={`${label} hex value`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className={`${FIELD} font-mono text-[12px] uppercase`}
        />
      </div>
      {presets && (
        <div className="flex gap-2" role="group" aria-label={`${label} presets`}>
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              aria-label={a.name}
              aria-pressed={value.toLowerCase() === a.value.toLowerCase()}
              onClick={() => onChange(a.value)}
              className={`h-6 w-6 rounded-full ${FOCUS}`}
              style={{ background: a.value, boxShadow: value.toLowerCase() === a.value.toLowerCase() ? `0 0 0 2px #0e0e10, 0 0 0 4px ${a.value}` : undefined }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One control, recursively                                                   */
/* -------------------------------------------------------------------------- */

function Input({ id, k, c, value, onChange }: { id: string; k: string; c: PC; value: unknown; onChange: (v: unknown) => void }) {
  const label = c.title ?? k;
  switch (c.type) {
    case "number":
      return <Slider id={id} c={{ ...c, title: label }} value={Number(value)} onChange={onChange} />;
    case "boolean":
      return <Switch on={Boolean(value)} onChange={onChange} label={label} />;
    case "enum": {
      const opts = c.options ?? [];
      if (opts.length <= 4 && opts.join("").length <= 30) return <Segmented options={opts} titles={c.optionTitles} value={String(value)} onChange={onChange} label={label} />;
      return (
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className={FIELD}>
          {opts.map((o, i) => (
            <option key={o} value={o}>
              {c.optionTitles?.[i] ?? o}
            </option>
          ))}
        </select>
      );
    }
    case "font": {
      // No font picker here; edit the family, keep the rest of the font as it is.
      const font = (value && typeof value === "object" ? value : {}) as Values;
      return (
        <input
          id={id}
          type="text"
          value={String(font.fontFamily ?? "")}
          placeholder="Georgia, serif"
          onChange={(e) => onChange({ ...font, fontFamily: e.target.value || undefined })}
          className={FIELD}
        />
      );
    }
    case "color":
      return <ColorField value={String(value ?? "")} onChange={onChange} label={label} presets={k === "accent"} />;
    case "array":
      return <ArrayField id={id} k={k} c={c} value={Array.isArray(value) ? value : []} onChange={onChange} />;
    case "object":
      return <ObjectFields idPrefix={id} c={c} value={(value as Values) ?? {}} onChange={onChange} />;
    default: {
      // An image control's value is { src, alt }; edit its URL as text.
      const text = value && typeof value === "object" && "src" in value ? String((value as { src: unknown }).src ?? "") : String(value ?? "");
      if (c.displayTextArea || text.length > 60)
        return <textarea id={id} rows={3} value={text} placeholder={c.placeholder} onChange={(e) => onChange(e.target.value)} className={`${FIELD} h-auto resize-y py-2 leading-[1.5]`} />;
      return <input id={id} type="text" value={text} placeholder={c.placeholder} onChange={(e) => onChange(e.target.value)} className={FIELD} />;
    }
  }
}

function ObjectFields({ idPrefix, c, value, onChange }: { idPrefix: string; c: PC; value: Values; onChange: (v: Values) => void }) {
  return (
    <div className="space-y-3">
      {Object.entries(c.controls ?? {}).map(([key, child]) => {
        if (child.type === "eventhandler") return null;
        const id = `${idPrefix}-${key}`;
        const inline = child.type === "boolean";
        return (
          <div key={key} className={inline ? "flex items-center justify-between gap-3" : "space-y-1.5"}>
            <label htmlFor={id} className="block text-[12px] text-[#8b8b90]">
              {child.title ?? key}
            </label>
            <Input id={id} k={key} c={child} value={value[key] ?? defaultOf(child)} onChange={(v) => onChange({ ...value, [key]: v })} />
          </div>
        );
      })}
    </div>
  );
}

function summary(item: unknown, i: number): string {
  if (item && typeof item === "object") {
    for (const v of Object.values(item as Values)) if (typeof v === "string" && v.trim() && !v.startsWith("#")) return v.length > 28 ? `${v.slice(0, 26)}…` : v;
  }
  return `Item ${i + 1}`;
}

function ArrayField({ id, k, c, value, onChange }: { id: string; k: string; c: PC; value: unknown[]; onChange: (v: unknown[]) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const item = c.control ?? { type: "string" };
  const max = c.maxCount ?? 12;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(open === i ? j : open === j ? i : open);
  };
  const iconBtn = `grid h-7 w-7 place-items-center rounded-md text-[#8b8b90] transition-colors hover:bg-[#232327] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent ${FOCUS}`;

  return (
    <div className="space-y-1.5">
      <ul className="space-y-1.5">
        {value.map((it, i) => {
          const expanded = open === i;
          return (
            <li key={i} className="rounded-xl border border-[#26262a] bg-[#131315]">
              <div className="flex items-center gap-1 pr-1.5">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`${id}-item-${i}`}
                  onClick={() => setOpen(expanded ? null : i)}
                  className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 text-left text-[13px] text-[#ededee] ${FOCUS}`}
                >
                  <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
                    <Icon name="chevron" size={13} />
                  </span>
                  <span className="w-5 text-[11px] tabular-nums text-[#84848a]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate">{summary(it, i)}</span>
                </button>
                <button type="button" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className={iconBtn}>
                  <Icon name="up" size={13} />
                </button>
                <button type="button" aria-label={`Move item ${i + 1} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)} className={iconBtn}>
                  <Icon name="down" size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove item ${i + 1}`}
                  disabled={value.length <= 1}
                  onClick={() => {
                    onChange(value.filter((_, j) => j !== i));
                    setOpen(null);
                  }}
                  className={iconBtn}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
              {expanded && (
                <div id={`${id}-item-${i}`} className="border-t border-[#26262a] p-3">
                  {item.type === "object" ? (
                    <ObjectFields idPrefix={`${id}-${i}`} c={item} value={(it as Values) ?? {}} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
                  ) : (
                    <Input id={`${id}-${i}-v`} k={k} c={item} value={it} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={value.length >= max}
        onClick={() => {
          const base = value.length ? JSON.parse(JSON.stringify(value[value.length - 1])) : defaultOf(item);
          onChange([...value, base]);
          setOpen(value.length);
        }}
        className={`flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#34343a] text-[12px] text-[#8b8b90] transition-colors hover:border-[#55555c] hover:text-white disabled:opacity-40 ${FOCUS}`}
      >
        <Icon name="plus" size={13} />
        Add item{value.length >= max ? ` (max ${max})` : ""}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The panel                                                                  */
/* -------------------------------------------------------------------------- */

export function PropsPanel({
  controls,
  values,
  onChange,
  onReset,
  uid,
}: {
  controls: [string, PC][];
  values: Values;
  onChange: (key: string, v: unknown) => void;
  onReset: (key?: string) => void;
  uid: string;
}) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const groups: Record<string, [string, PC][]> = { Content: [], Behavior: [], Style: [] };
  for (const entry of controls) {
    if (needle && !`${entry[0]} ${entry[1].title ?? ""}`.toLowerCase().includes(needle)) continue;
    groups[section(entry[0], entry[1])].push(entry);
  }
  const shown = groups.Content.length + groups.Behavior.length + groups.Style.length;
  const changed = controls.filter(([k, c]) => k in values && !same(values[k], defaultOf(c))).length;
  // An Advanced group holds the fine tuning, so it starts closed.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const collapsible = (key: string, c: PC) => c.type === "object" && key === "advanced";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[12px] text-[#8b8b90]">{controls.length} properties{changed ? ` · ${changed} changed` : ""}</p>
        <button
          type="button"
          disabled={!changed}
          onClick={() => onReset()}
          className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-[#c9c9cc] transition-colors hover:bg-[#1c1c1f] hover:text-white disabled:opacity-35 disabled:hover:bg-transparent ${FOCUS}`}
        >
          <Icon name="reset" size={12} />
          Reset all
        </button>
      </div>

      {controls.length > 10 && (
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${controls.length} properties`}
          aria-label="Filter properties"
          className={`${FIELD} mb-2 mt-2`}
        />
      )}
      {needle && shown === 0 && <p className="py-6 text-center text-[13px] text-[#84848a]">No property matches “{filter.trim()}”.</p>}

      {(Object.keys(groups) as (keyof typeof groups)[]).map((name) =>
        groups[name].length === 0 ? null : (
          <fieldset key={name} className="border-t border-[#1f1f22] py-4 first-of-type:border-t-0">
            <legend className="mb-3 float-left w-full text-[11px] font-medium uppercase tracking-[0.1em] text-[#84848a]">{name}</legend>
            <div className="clear-both space-y-4">
              {groups[name].map(([key, c]) => {
                const def = defaultOf(c);
                const value = key in values ? values[key] : def;
                const dirty = key in values && !same(values[key], def);
                const id = `${uid}-${key}`;
                const inline = c.type === "boolean";
                const fold = collapsible(key, c);
                const open = !fold || openGroups.has(key);
                const header = (
                  <div className="flex items-center gap-2">
                    {fold ? (
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={id}
                        onClick={() =>
                          setOpenGroups((s) => {
                            const next = new Set(s);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                        className={`-ml-1 flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[12px] font-medium text-[#c9c9cc] transition-colors hover:text-white ${FOCUS}`}
                      >
                        <span className={`text-[#8b8b90] transition-transform ${open ? "rotate-90" : ""}`}>
                          <Icon name="chevron" size={12} />
                        </span>
                        {c.title ?? key}
                        <span className="text-[11px] font-normal text-[#84848a]">{Object.keys(c.controls ?? {}).length}</span>
                      </button>
                    ) : (
                      <label htmlFor={id} className="text-[12px] font-medium text-[#c9c9cc]">
                        {c.title ?? key}
                      </label>
                    )}
                    {dirty && (
                      <button
                        type="button"
                        aria-label={`Reset ${c.title ?? key}`}
                        title="Reset to default"
                        onClick={() => onReset(key)}
                        className={`flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[12px] text-[#a0a0a5] transition-colors hover:bg-[#1c1c1f] hover:text-white ${FOCUS}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok-accent)]" />
                        Reset
                      </button>
                    )}
                  </div>
                );
                return inline ? (
                  <div key={key} className="flex items-center justify-between gap-3">
                    {header}
                    <Input id={id} k={key} c={c} value={value} onChange={(v) => onChange(key, v)} />
                  </div>
                ) : (
                  <div key={key} className="space-y-2">
                    {header}
                    {open && (
                      <div id={fold ? id : undefined}>
                        <Input id={id} k={key} c={c} value={value} onChange={(v) => onChange(key, v)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ),
      )}
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

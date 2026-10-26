"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { components as library } from "@/lib/originkit-library";
import { META, STATES } from "./states";
import { FOCUS, MONO, Segmented, TabList } from "./ui";
import { DEFAULT_ACCENT, type Control, type CoreEntry, type Shared } from "./types";

const OPTION_LABELS: Record<string, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
  dark: "Dark",
  light: "Light",
  url: "URL",
};

function optionLabel(value: string) {
  return OPTION_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

/** Props the page drives for every demo, so they are not repeated in each panel. */
const SHARED_KEYS = new Set(["theme", "accent", "radius"]);
const EDITABLE = new Set(["enum", "boolean", "string", "number"]);

type Tab = "controls" | "usage" | "api";

/* -------------------------------------------------------------------------- */
/* Usage snippet                                                              */
/* -------------------------------------------------------------------------- */

function propAttr(key: string, value: unknown, fallback: unknown): string | null {
  if (value === fallback) return null;
  if (typeof value === "boolean") return value ? key : `${key}={false}`;
  if (typeof value === "number") return `${key}={${value}}`;
  return `${key}="${String(value).replace(/"/g, "&quot;")}"`;
}

function buildSnippet(entry: CoreEntry, values: Record<string, unknown>, defaults: Record<string, unknown>, shared: Shared) {
  const importMatch = /^import\s+(\w+)\s+from\s+"([^"]+)"/m.exec(entry.usage);
  const name = importMatch?.[1] ?? entry.displayName.replace(/\s+/g, "");
  const from = importMatch?.[2] ?? `./${entry.name}`;

  const attrs: string[] = [];
  for (const key of Object.keys(values)) {
    const attr = propAttr(key, values[key], defaults[key]);
    if (attr) attrs.push(attr);
  }
  if (shared.theme !== "dark") attrs.push(`theme="${shared.theme}"`);
  if (shared.accent !== DEFAULT_ACCENT) attrs.push(`accent="${shared.accent}"`);
  if (shared.radius !== undefined) attrs.push(`radius={${shared.radius}}`);

  const oneLine = attrs.length ? `<${name} ${attrs.join(" ")} />` : `<${name} />`;
  const jsx = oneLine.length <= 60 ? oneLine : `<${name}\n${attrs.map((a) => `  ${a}`).join("\n")}\n/>`;
  return `import ${name} from "${from}"\n\n${jsx}`;
}

const TOKEN = /("(?:[^"\\]|\\.)*")|(\bimport\b|\bfrom\b)|(<\/?[A-Z]\w*)|([A-Za-z]\w*)(?==)|(\{[^}]*\})|(\/?>)/g;

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of code.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(code.slice(last, at));
    const cls = m[1]
      ? "text-[#c3e88d]"
      : m[2]
        ? "text-[#c792ea]"
        : m[3]
          ? "text-[#82aaff]"
          : m[4]
            ? "text-[#ffcb6b]"
            : m[5]
              ? "text-[#f78c6c]"
              : "text-[#6f7173]";
    out.push(
      <span key={k++} className={cls}>
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: leave the label as is */
    }
  };
  return { copied, copy };
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

function renderControl(slug: string, c: Control, value: unknown, onChange: (v: unknown) => void): ReactNode {
  const id = `${slug}-${c.key}`;

  if (c.type === "enum" && c.options) {
    return (
      <Segmented
        label={c.label}
        value={String(value)}
        options={c.options.map((o) => ({ value: o, label: optionLabel(o) }))}
        onChange={onChange}
      />
    );
  }

  if (c.type === "boolean") {
    const on = Boolean(value);
    return (
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-5 w-9 rounded-lg transition-colors ${FOCUS} ${on ? "bg-[#fa7319]" : "bg-[#3e3f40]"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            on ? "translate-x-4" : "translate-x-0"
          }`}
        />
        <span className="sr-only">{c.label}</span>
      </button>
    );
  }

  if (c.type === "number") {
    const num = Number(value);
    return (
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={c.min ?? 0}
          max={c.max ?? 100}
          step={c.step ?? 1}
          value={num}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`h-1 w-full max-w-[220px] cursor-pointer accent-[#fa7319] ${FOCUS}`}
        />
        <span className={`${MONO} w-12 text-[12px] tabular-nums text-[#a5a7a9]`}>{num}</span>
      </div>
    );
  }

  const text = String(value ?? "");
  const field = `w-full rounded-md border border-[#2d2d2f] bg-[#101011] px-2.5 text-[13px] text-[#f7f7f7] placeholder:text-[#5c5e60] focus:border-[#fa7319] ${FOCUS}`;
  if (text.length > 48) {
    return (
      <textarea
        id={id}
        rows={3}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className={`${field} resize-y py-2 leading-[1.5]`}
      />
    );
  }
  return (
    <input id={id} type="text" value={text} onChange={(e) => onChange(e.target.value)} className={`${field} h-8`} />
  );
}

function typeLabel(c: Control): string {
  if (c.type === "enum" && c.options) return c.options.map((o) => `"${o}"`).join(" | ");
  if (c.type === "number" && c.min !== undefined && c.max !== undefined) return `number (${c.min}–${c.max})`;
  if (c.type === "array") return "array";
  return c.type;
}

function defaultLabel(c: Control): string {
  if (c.type === "array") return Array.isArray(c.default) ? `${c.default.length} items` : "—";
  if (c.default === undefined || c.default === "") return "—";
  const text = typeof c.default === "string" ? `"${c.default}"` : String(c.default);
  return text.length > 36 ? `${text.slice(0, 34)}…"` : text;
}

/* -------------------------------------------------------------------------- */
/* Entry                                                                      */
/* -------------------------------------------------------------------------- */

export function Entry({ entry, number, shared }: { entry: CoreEntry; number: string; shared: Shared }) {
  const uid = useId();
  const meta = META[entry.name] ?? {};
  const states = STATES[entry.name];
  const Comp = library[entry.name];

  const controls = useMemo(
    () => entry.tweakSchema.filter((c) => EDITABLE.has(c.type) && !SHARED_KEYS.has(c.key) && !(meta.exclude ?? []).includes(c.key)),
    [entry, meta.exclude],
  );

  const [defaults] = useState(() => Object.fromEntries(controls.map((c) => [c.key, c.default])));
  const [values, setValues] = useState<Record<string, unknown>>(defaults);
  const [width, setWidth] = useState(meta.width?.def ?? 460);
  const [tab, setTab] = useState<Tab>("controls");
  const [run, setRun] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const prompt = useCopy();
  const snippet = useCopy();

  const dirty = controls.some((c) => values[c.key] !== defaults[c.key]);
  const code = useMemo(() => buildSnippet(entry, values, defaults, shared), [entry, values, defaults, shared]);
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));
  const dark = shared.theme === "dark";

  const stageStyle = {
    backgroundImage: dark
      ? "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.055) 1px, transparent 0)"
      : "radial-gradient(circle at 1px 1px, rgba(20,20,19,0.08) 1px, transparent 0)",
    backgroundSize: "16px 16px",
  } as const;
  const surface = dark ? "border-[#2d2d2f] bg-[#141415]" : "border-[#e0ddd7] bg-[#f3f1ed]";

  let demo: ReactNode = null;
  if (Comp) {
    if (entry.name === "dialog") {
      const Trigger = library.button;
      demo = (
        <>
          <Trigger label="Open dialog" variant="primary" {...shared} onClick={() => setDialogOpen(true)} />
          <Comp {...values} {...shared} open={dialogOpen} onClose={() => setDialogOpen(false)} />
        </>
      );
    } else {
      demo = <Comp key={run} {...values} {...shared} />;
    }
  }

  return (
    <section
      id={entry.name}
      data-spy
      className="scroll-mt-6 border-t border-[#2d2d2f] py-14 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-x-12 2xl:grid-cols-[260px_minmax(0,1fr)_minmax(380px,440px)] 2xl:gap-x-10"
    >
      <div className="mb-6 lg:row-span-2 lg:mb-0 2xl:row-span-1">
        <div className={`${MONO} text-[11px] tracking-[0.08em] text-[#7a7c7f]`}>{number}</div>
        <h3 className="mt-3 text-[28px] font-medium leading-[1.05] tracking-[-0.03em] text-[#f7f7f7]">{entry.displayName}</h3>
        <p className="mt-3 max-w-[26rem] text-[14px] leading-[1.6] text-[#a5a7a9]">{entry.description}</p>
        <button
          type="button"
          onClick={() => prompt.copy(`Using originkit MCP, get me the ${entry.name} component.`)}
          className={`mt-5 inline-flex h-8 items-center rounded-md border border-[#3e3f40] px-3 text-[12px] font-medium text-[#f7f7f7] transition-colors hover:bg-[#1f2021] ${FOCUS}`}
        >
          {prompt.copied ? "Copied to clipboard" : "Copy MCP prompt"}
        </button>
        <span className="sr-only" aria-live="polite">
          {prompt.copied ? "Prompt copied" : ""}
        </span>
      </div>

      <div className="min-w-0">
        <div
          className={`flex justify-center rounded-xl border ${meta.block && (meta.width?.def ?? 0) >= 540 ? "p-4 sm:p-6" : "p-6 sm:p-10"} ${meta.top ? "items-start" : "items-center"} ${surface}`}
          style={{ ...stageStyle, minHeight: meta.minHeight ?? 220 }}
        >
          <div
            className={meta.block ? "w-full" : "flex flex-wrap items-center justify-center gap-3"}
            style={meta.block ? { maxWidth: width } : undefined}
          >
            {demo}
          </div>
        </div>

        {states && (
          <div className="mt-3">
            <h4 className={`${MONO} mb-2 text-[11px] uppercase tracking-[0.1em] text-[#7a7c7f]`}>States</h4>
            <div className={`overflow-hidden rounded-xl border ${dark ? "border-[#2d2d2f] bg-[#141415]" : "border-[#e0ddd7] bg-[#f3f1ed]"}`}>
              <ul
                className="-ml-px -mt-px grid"
                style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${states.min}px), 1fr))` }}
              >
                {states.cells.map((cell) => (
                  <li
                    key={cell.label}
                    className={`flex flex-col gap-4 border-l border-t p-5 ${dark ? "border-[#2d2d2f]" : "border-[#e0ddd7]"}`}
                  >
                    <span className={`${MONO} text-[11px] uppercase tracking-[0.08em] ${dark ? "text-[#7a7c7f]" : "text-[#76736d]"}`}>
                      {cell.label}
                    </span>
                    <div
                      className={`flex flex-1 ${states.top ? "items-start" : "items-center"} ${states.center ? "justify-center" : ""}`}
                      style={{ minHeight: states.minHeight }}
                    >
                      <div className={states.block ? "w-full" : ""} style={states.pad ? { padding: `${states.pad}px 0` } : undefined}>
                        {Comp ? <Comp {...cell.props} {...shared} /> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 min-w-0 lg:col-start-2 2xl:col-start-3 2xl:mt-0">
          <TabList
            label={`${entry.displayName} details`}
            idPrefix={uid}
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "controls", label: "Controls" },
              { value: "usage", label: "Usage" },
              { value: "api", label: "API" },
            ]}
            trailing={
              <>
                {meta.replay && tab === "controls" && (
                  <button
                    type="button"
                    onClick={() => setRun((n) => n + 1)}
                    className={`rounded text-[12px] font-medium text-[#f7f7f7] underline underline-offset-4 ${FOCUS}`}
                  >
                    {meta.replay}
                  </button>
                )}
                {dirty && tab === "controls" && (
                  <button
                    type="button"
                    onClick={() => setValues(defaults)}
                    className={`rounded text-[12px] font-medium text-[#a5a7a9] underline underline-offset-4 hover:text-[#f7f7f7] ${FOCUS}`}
                  >
                    Reset props
                  </button>
                )}
              </>
            }
          />

          <div
            role="tabpanel"
            id={`${uid}-panel-${tab}`}
            aria-labelledby={`${uid}-tab-${tab}`}
            tabIndex={0}
            className={`rounded-sm pt-1 ${FOCUS}`}
          >
            {tab === "controls" && (
              <dl className="divide-y divide-[#232526]">
                {meta.block && (
                  <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 py-2.5">
                    <dt>
                      <label htmlFor={`${entry.name}-stage-width`} className={`${MONO} text-[12px] text-[#a5a7a9]`}>
                        stage width
                      </label>
                    </dt>
                    <dd className="flex items-center gap-3">
                      <input
                        id={`${entry.name}-stage-width`}
                        type="range"
                        min={meta.width?.min ?? 280}
                        max={meta.width?.max ?? 560}
                        step={10}
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                        className={`h-1 w-full max-w-[220px] cursor-pointer accent-[#fa7319] ${FOCUS}`}
                      />
                      <span className={`${MONO} w-12 text-[12px] tabular-nums text-[#a5a7a9]`}>{width}</span>
                    </dd>
                  </div>
                )}
                {controls.map((c) => (
                  <div key={c.key} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 py-2.5">
                    <dt>
                      <label htmlFor={`${entry.name}-${c.key}`} className={`${MONO} text-[12px] text-[#a5a7a9]`}>
                        {c.key}
                      </label>
                    </dt>
                    <dd className="min-w-0">{renderControl(entry.name, c, values[c.key], (v) => set(c.key, v))}</dd>
                  </div>
                ))}
                {controls.length === 0 && !meta.block && (
                  <p className="py-4 text-[13px] text-[#8a8c8f]">This component has no editable props.</p>
                )}
              </dl>
            )}

            {tab === "usage" && (
              <div className="pt-3">
                <div className="relative rounded-lg border border-[#2d2d2f] bg-[#101011]">
                  <pre className={`${MONO} overflow-x-auto p-4 pr-24 text-[12.5px] leading-[1.7] text-[#d4d5d6]`}>
                    <code>{highlight(code)}</code>
                  </pre>
                  <button
                    type="button"
                    onClick={() => snippet.copy(code)}
                    className={`absolute right-3 top-3 h-7 rounded-md border border-[#3e3f40] bg-[#161718] px-2.5 text-[12px] font-medium text-[#f7f7f7] hover:bg-[#1f2021] ${FOCUS}`}
                  >
                    {snippet.copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-3 text-[13px] leading-[1.55] text-[#8a8c8f]">
                  The snippet follows the controls above. Ask your editor to “get me the {entry.name} component” through
                  the Originkit MCP, and it adds the file for you.
                </p>
              </div>
            )}

            {tab === "api" && (
              <div className="overflow-x-auto pt-2">
                <table className="w-full min-w-[460px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className={`${MONO} text-[11px] uppercase tracking-[0.08em] text-[#7a7c7f]`}>
                      <th className="py-2 pr-4 font-medium">Prop</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 font-medium">Default</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232526] border-t border-[#232526]">
                    {entry.tweakSchema.map((c) => (
                      <tr key={c.key} className="align-top">
                        <td className={`${MONO} py-2.5 pr-4 text-[12px] text-[#f7f7f7]`}>{c.key}</td>
                        <td className={`${MONO} py-2.5 pr-4 text-[12px] text-[#a5a7a9]`}>{typeLabel(c)}</td>
                        <td className={`${MONO} py-2.5 text-[12px] text-[#8a8c8f]`}>{defaultLabel(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </div>
    </section>
  );
}

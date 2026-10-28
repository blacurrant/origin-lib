"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultOf, type PC, type Values } from "./controls";
import { FOCUS, Icon, SITE, highlight, useCopy, usePersisted } from "./kit";

type Source = { framer: string; react: string };
const cache = new Map<string, Promise<Source>>();

function loadSource(slug: string): Promise<Source> {
  let p = cache.get(slug);
  if (!p) {
    p = fetch(`/api/source/${slug}`).then((r) => {
      if (!r.ok) throw new Error("Could not load the source.");
      return r.json() as Promise<Source>;
    });
    p.catch(() => cache.delete(slug));
    cache.set(slug, p);
  }
  return p;
}

export function useSource(slug: string) {
  const [src, setSrc] = useState<Source | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    setSrc(null);
    setError(false);
    loadSource(slug).then(
      (s) => live && setSrc(s),
      () => live && setError(true),
    );
    return () => {
      live = false;
    };
  }, [slug]);
  return { src, error };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The props the reader has changed from the defaults, as JSX attributes. */
export function changedProps(controls: [string, PC][], values: Values, theme: "dark" | "light") {
  const out: [string, unknown][] = [];
  for (const [key, c] of controls) if (key in values && !same(values[key], defaultOf(c))) out.push([key, values[key]]);
  if (theme === "light") out.push(["theme", "light"]);
  return out;
}

function attr(key: string, v: unknown, indent: string): string {
  if (typeof v === "string") return /["\n\\]/.test(v) ? `${key}={${JSON.stringify(v)}}` : `${key}="${v}"`;
  if (typeof v === "boolean") return v ? key : `${key}={false}`;
  if (typeof v === "number") return `${key}={${v}}`;
  const json = JSON.stringify(v, null, 2).replace(/\n/g, `\n${indent}`);
  return `${key}={${json}}`;
}

export function usageSnippet(importName: string, path: string, props: [string, unknown][]) {
  const head = `import ${importName} from "${path}"\n\n`;
  if (!props.length) return `${head}<${importName} />`;
  const oneLine = `<${importName} ${props.map(([k, v]) => attr(k, v, "")).join(" ")} />`;
  if (oneLine.length <= 72 && !oneLine.includes("\n")) return head + oneLine;
  return `${head}<${importName}\n${props.map(([k, v]) => `  ${attr(k, v, "  ")}`).join("\n")}\n/>`;
}

/* -------------------------------------------------------------------------- */

function CodeBlock({ code, filename, copyId, onCopy, copied, maxHeight = 360, loading }: { code: string; filename: string; copyId: string; onCopy: (t: string, id: string) => void; copied: string | null; maxHeight?: number; loading?: boolean }) {
  const lines = code ? code.split("\n").length : 0;
  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const btn = `inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-[#c9c9cc] transition-colors hover:bg-[#232327] hover:text-white ${FOCUS}`;
  const done = copied === copyId;
  return (
    <div className="overflow-hidden rounded-xl border border-[#26262a] bg-[#0c0c0e]">
      <div className="flex items-center justify-between border-b border-[#1f1f22] py-1 pl-3 pr-1.5">
        <span className="truncate font-mono text-[12px] text-[#8b8b90]">
          {filename}
          {lines ? <span className="ml-2 text-[#84848a]">{lines} lines</span> : null}
        </span>
        <div className="flex shrink-0 items-center">
          <button type="button" onClick={download} disabled={!code} className={`${btn} disabled:opacity-40`} aria-label={`Download ${filename}`}>
            <Icon name="download" size={13} />
          </button>
          <button type="button" onClick={() => onCopy(code, copyId)} disabled={!code} className={`${btn} disabled:opacity-40`}>
            <Icon name={done ? "check" : "copy"} size={13} />
            {done ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre tabIndex={0} className={`overflow-auto p-3.5 font-mono text-[12px] leading-[1.7] text-[#d4d4d8] ${FOCUS}`} style={{ maxHeight }}>
        <code>{loading ? <span className="text-[#84848a]">Loading source…</span> : highlight(code)}</code>
      </pre>
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-[13px] leading-[1.55] text-[#b4b4b9]">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#1c1c1f] text-[11px] font-medium tabular-nums text-[#c9c9cc]">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

const PMS = [
  { id: "npm", cmd: "npm install framer-motion" },
  { id: "pnpm", cmd: "pnpm add framer-motion" },
  { id: "yarn", cmd: "yarn add framer-motion" },
  { id: "bun", cmd: "bun add framer-motion" },
];

export type Method = "framer" | "react" | "ai";
export const isMethod = (v: unknown): v is Method => v === "framer" || v === "react" || v === "ai";

/** The Framer file, with the reader's changed properties set as the component's defaults when `bake` is on. */
export function framerCode(framer: string, importName: string, props: [string, unknown][], bake: boolean) {
  if (!bake || !props.length) return framer;
  const values = JSON.stringify(Object.fromEntries(props), null, 4);
  return `${framer.trimEnd()}\n\n// Defaults from your tweaks in the Originkit inspector.\n${importName}.defaultProps = {\n    ...${importName}.defaultProps,\n    ...${values},\n}\n`;
}

/** The two MCP prompts: plain, and with the reader's properties. */
export function aiPrompts(slug: string, props: [string, unknown][]) {
  const quick = `Using originkit MCP, get me the ${slug} component.`;
  const configured = props.length ? `Using originkit MCP, add the ${slug} component to this project and render it with these props:\n\n${JSON.stringify(Object.fromEntries(props), null, 2)}` : quick;
  return { quick, configured };
}

export function Integrate({
  slug,
  importName,
  props,
  method,
  onMethod,
  bake,
  onBake,
  onCopyEvent,
}: {
  slug: string;
  importName: string;
  props: [string, unknown][];
  method: Method;
  onMethod: (m: Method) => void;
  bake: boolean;
  onBake: (b: boolean) => void;
  onCopyEvent?: () => void;
}) {
  const [pm, setPm] = usePersisted("originkit.blocks.pm", "npm", (v): v is string => typeof v === "string" && PMS.some((p) => p.id === v));
  // Once someone has framer-motion installed, the install step is just noise on every other block.
  const [haveDep, setHaveDep] = usePersisted<boolean>("originkit.blocks.havedep", false, (v): v is boolean => typeof v === "boolean");
  const [view, setView] = useState<"usage" | "component">("usage");
  const { copied, copy } = useCopy();
  const { src, error } = useSource(slug);

  const usage = useMemo(() => usageSnippet(importName, `@/components/${slug}`, props), [importName, slug, props]);
  const framer = useMemo(() => (src ? framerCode(src.framer, importName, props, bake) : ""), [src, importName, props, bake]);
  const onCopy = (t: string, id: string) => {
    copy(t, id);
    onCopyEvent?.();
  };

  const { quick, configured } = aiPrompts(slug, props);

  const methods: { id: Method; title: string; sub: string }[] = [
    { id: "react", title: "React / Next.js", sub: "Copy the file" },
    { id: "framer", title: "Framer", sub: "Code component" },
    { id: "ai", title: "AI editor", sub: "MCP prompt" },
  ];

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Integration method" className="grid grid-cols-3 gap-2">
        {methods.map((m) => {
          const on = m.id === method;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onMethod(m.id)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${FOCUS} ${on ? "border-[#55555c] bg-[#1c1c1f]" : "border-[#26262a] hover:border-[#3a3a40]"}`}
            >
              <span className="block text-[13px] font-medium text-white">{m.title}</span>
              <span className="block text-[11px] text-[#8b8b90]">{m.sub}</span>
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="rounded-lg border border-[#4a2a2a] bg-[#1f1212] px-3 py-2 text-[12px] text-[#ffb4a8]">Couldn’t load the source file. Check your connection and reopen this panel.</p>}

      {method === "react" && (
        <div className="space-y-4">
          {haveDep ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#26262a] px-3.5 py-2.5 text-[13px] text-[#a0a0a5]">
              <span className="flex items-center gap-2">
                <Icon name="check" size={13} />
                framer-motion already installed
              </span>
              <button type="button" onClick={() => setHaveDep(false)} className={`rounded text-[#c9c9cc] underline underline-offset-4 hover:text-white ${FOCUS}`}>
                Show
              </button>
            </div>
          ) : (
            <>
              <Steps
                items={[
                  <>Install the one dependency.</>,
                  <>
                    Save the component as <code className="rounded bg-[#1c1c1f] px-1.5 py-0.5 font-mono text-[12px] text-white">components/{slug}.tsx</code>.
                  </>,
                  <>Import it and render it. The snippet below follows your property changes.</>,
                ]}
              />
              <div className="overflow-hidden rounded-xl border border-[#26262a] bg-[#0c0c0e]">
                <div className="flex items-center justify-between border-b border-[#1f1f22] pr-1.5">
                  <div role="tablist" aria-label="Package manager" className="flex">
                    {PMS.map((p) => (
                      <button key={p.id} type="button" role="tab" aria-selected={pm === p.id} onClick={() => setPm(p.id)} className={`h-9 px-3 font-mono text-[12px] transition-colors ${FOCUS} ${pm === p.id ? "text-white shadow-[inset_0_-2px_0_var(--ok-accent)]" : "text-[#84848a] hover:text-white"}`}>
                        {p.id}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => onCopy(PMS.find((p) => p.id === pm)!.cmd, "install")} className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-[#c9c9cc] hover:bg-[#232327] hover:text-white ${FOCUS}`}>
                    <Icon name={copied === "install" ? "check" : "copy"} size={13} />
                    {copied === "install" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="overflow-x-auto p-3.5 font-mono text-[12px] text-[#d4d4d8]">
                  <span className="text-[#84848a]">$ </span>
                  {PMS.find((p) => p.id === pm)!.cmd}
                </pre>
              </div>
              <button type="button" onClick={() => setHaveDep(true)} className={`rounded text-[12px] text-[#a0a0a5] underline underline-offset-4 hover:text-white ${FOCUS}`}>
                I already have framer-motion
              </button>
            </>
          )}

          <div role="tablist" aria-label="File" className="flex gap-1 rounded-lg bg-[#161618] p-0.5">
            {([["usage", "Usage"], ["component", "Component file"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`h-8 flex-1 rounded-md text-[12px] font-medium transition-colors ${FOCUS} ${view === id ? "bg-[#2c2c31] text-white" : "text-[#8b8b90] hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
          {view === "usage" ? (
            <CodeBlock code={usage} filename="page.tsx" copyId="usage" onCopy={onCopy} copied={copied} maxHeight={280} />
          ) : (
            <CodeBlock code={src?.react ?? ""} filename={`${slug}.tsx`} copyId="react" onCopy={onCopy} copied={copied} loading={!src && !error} />
          )}
          <p className="text-[12px] leading-[1.55] text-[#84848a]">Uses inline styles and framer-motion only, so there is no Tailwind or CSS to set up. Add it to a client component or keep the <code className="font-mono">"use client"</code> line at the top.</p>
        </div>
      )}

      {method === "framer" && (
        <div className="space-y-4">
          <Steps
            items={[
              <>Copy the code below.</>,
              <>In Framer, open <strong className="font-medium text-white">Assets → Code → New component</strong> and paste over the template.</>,
              <>Drag it onto the canvas. Every property you just tuned shows up in Framer’s properties panel.</>,
            ]}
          />
          {props.length > 0 && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#26262a] px-3.5 py-2.5 text-[13px] text-[#c9c9cc]">
              <span>
                Include my {props.length} change{props.length === 1 ? "" : "s"} as defaults
              </span>
              <input type="checkbox" checked={bake} onChange={(e) => onBake(e.target.checked)} className={`h-4 w-4 accent-white ${FOCUS}`} />
            </label>
          )}
          <CodeBlock code={framer} filename={`${slug}.tsx`} copyId="framer" onCopy={onCopy} copied={copied} loading={!src && !error} maxHeight={420} />
          <p className="text-[12px] leading-[1.55] text-[#84848a]">
            {props.length && bake ? "Your changes are added at the bottom as the component’s default properties, so it lands on the canvas looking like this preview." : "The file is copied as written, with the property controls Framer reads."}
          </p>
        </div>
      )}

      {method === "ai" && (
        <div className="space-y-4">
          <Steps
            items={[
              <>
                Connect Originkit to Claude Code, Cursor or any MCP editor. <a href={`${SITE}/connect`} target="_blank" rel="noreferrer" className={`rounded text-white underline underline-offset-4 ${FOCUS}`}>How to connect</a>.
              </>,
              <>Paste a prompt. Your editor fetches the file and puts it in the right place.</>,
            ]}
          />
          <PromptCard title="Quick" text={quick} id="quick" copied={copied} onCopy={onCopy} />
          <PromptCard title={props.length ? "With your props" : "With your props (none changed yet)"} text={configured} id="configured" copied={copied} onCopy={onCopy} />
        </div>
      )}
    </div>
  );
}

function PromptCard({ title, text, id, copied, onCopy }: { title: string; text: string; id: string; copied: string | null; onCopy: (t: string, id: string) => void }) {
  const done = copied === id;
  return (
    <div className="rounded-xl border border-[#26262a] bg-[#0c0c0e] p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#84848a]">{title}</span>
        <button type="button" onClick={() => onCopy(text, id)} className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-[#c9c9cc] hover:bg-[#232327] hover:text-white ${FOCUS}`}>
          <Icon name={done ? "check" : "copy"} size={13} />
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap font-mono text-[12px] leading-[1.65] text-[#d4d4d8]">{text}</pre>
    </div>
  );
}

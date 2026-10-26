"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { components } from "@/lib/originkit-library";
import registryJson from "@/lib/originkit-library/registry.json";
import { ACCENTS, DEFAULT_ACCENT } from "@/app/core/types";
import { BLOCKS, INTERACTIONS, TILE_HEIGHT, type Block, type Interaction } from "./manifest";

type Control = { key: string; label: string; type: string; default?: unknown; options?: string[]; min?: number; max?: number; step?: number };
type RegistryEntry = { name: string; tweakSchema?: Control[] };

const REGISTRY = new Map((registryJson as unknown as RegistryEntry[]).map((e) => [e.name, e]));
const SHARED = new Set(["theme", "accent", "radius"]);
const EDITABLE = new Set(["enum", "boolean", "number", "string"]);

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const SITE = (process.env.NEXT_PUBLIC_ORIGINKIT_SITE_URL ?? "https://www.originkit.dev").replace(/\/$/, "");

/** Mount the demo only while its tile is near the screen, so 25 live demos stay cheap. */
function useNear(margin = 400) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: `${margin}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return { ref, near };
}

/** Scale a demo down (never up) so it always sits inside the tile. */
function Fit({ children, pad = 36 }: { children: ReactNode; pad?: number }) {
  const box = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const w = Math.max(i.offsetWidth, i.scrollWidth);
    const h = Math.max(i.offsetHeight, i.scrollHeight);
    if (!w || !h) return;
    const next = Math.min(1, (b.clientWidth - pad * 2) / w, (b.clientHeight - pad * 2 - 56) / h);
    setScale((s) => (Math.abs(s - next) < 0.005 ? s : next));
  }, [pad]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div ref={box} className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit]">
      <div
        ref={inner}
        // A fixed design width, so fluid components (width: 100%) have something to fill.
        style={{ width: 480, display: "flex", justifyContent: "center", transform: `scale(${scale})`, transformOrigin: "center", marginBottom: 48 }}
      >
        {children}
      </div>
    </div>
  );
}

function ControlRow({ c, value, onChange }: { c: Control; value: unknown; onChange: (v: unknown) => void }) {
  const id = `ctl-${c.key}`;
  const label = <label htmlFor={id} className="truncate text-[12px] text-[#9a9a9d]">{c.label || c.key}</label>;
  let field: ReactNode;
  if (c.type === "enum" && c.options) {
    field = (
      <select
        id={id}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 w-full rounded-full border border-[#2c2c2e] bg-[#1c1c1e] px-3 text-[12px] text-[#f2f2f3] ${FOCUS}`}
      >
        {c.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (c.type === "boolean") {
    const on = Boolean(value);
    field = (
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${FOCUS} ${on ? "bg-white" : "bg-[#3a3a3c]"}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full transition-all ${on ? "left-5 bg-black" : "left-1 bg-[#9a9a9d]"}`} />
      </button>
    );
  } else if (c.type === "number") {
    field = (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={c.min ?? 0}
          max={c.max ?? 100}
          step={c.step ?? 1}
          value={Number(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`h-1 w-full cursor-pointer accent-white ${FOCUS}`}
        />
        <span className="w-9 text-right text-[12px] tabular-nums text-[#c9c9cb]">{Number(value)}</span>
      </div>
    );
  } else {
    field = (
      <input
        id={id}
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 w-full rounded-full border border-[#2c2c2e] bg-[#1c1c1e] px-3 text-[12px] text-[#f2f2f3] ${FOCUS}`}
      />
    );
  }
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 py-1.5">
      {label}
      {field}
    </div>
  );
}

function Tile({ block, accent }: { block: Block; accent: string }) {
  const Comp = components[block.slug];
  const schema = useMemo(
    () => (REGISTRY.get(block.slug)?.tweakSchema ?? []).filter((c) => EDITABLE.has(c.type) && !SHARED.has(c.key)),
    [block.slug],
  );
  const defaults = useMemo(() => Object.fromEntries(schema.map((c) => [c.key, c.default])), [schema]);
  const [values, setValues] = useState<Record<string, unknown>>(defaults);
  const [run, setRun] = useState(0);
  const [panel, setPanel] = useState(false);
  const { ref, near } = useNear();
  const dirty = schema.some((c) => values[c.key] !== defaults[c.key]);

  return (
    <li id={block.slug} className="mb-5 break-inside-avoid scroll-mt-40 sm:mb-6">
      <div
        ref={ref}
        className="relative overflow-hidden rounded-[36px] bg-[#141414] sm:rounded-[44px]"
        style={{ height: TILE_HEIGHT[block.size] }}
      >
        {Comp ? (
          near && (
            <Fit>
              <Comp key={run} {...values} accent={accent} theme="dark" />
            </Fit>
          )
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[14px] text-[#5d5d60]">Coming soon</div>
        )}

        {panel && schema.length > 0 && (
          <div
            role="dialog"
            aria-label={`${block.title} settings`}
            className="absolute inset-x-4 bottom-[76px] z-10 max-h-[62%] overflow-y-auto rounded-[28px] border border-[#2a2a2c] bg-[#1a1a1c]/95 p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#f2f2f3]">{block.title}</span>
              {dirty && (
                <button type="button" onClick={() => setValues(defaults)} className={`rounded-full px-2 text-[12px] text-[#9a9a9d] underline underline-offset-4 hover:text-white ${FOCUS}`}>
                  Reset
                </button>
              )}
            </div>
            {schema.map((c) => (
              <ControlRow key={c.key} c={c} value={values[c.key]} onChange={(v) => setValues((s) => ({ ...s, [c.key]: v }))} />
            ))}
          </div>
        )}

        <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3">
          <span className="truncate rounded-full bg-[#232323] px-4 py-2.5 text-[15px] text-[#e4e4e6]">{block.title}</span>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              aria-label={`Replay ${block.title}`}
              onClick={() => setRun((n) => n + 1)}
              className={`grid h-11 w-11 place-items-center rounded-full bg-[#232323] text-[#e4e4e6] transition-colors hover:bg-[#2c2c2e] ${FOCUS}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
                <path d="M4.5 2.8v10.4a.6.6 0 0 0 .92.5l8-5.2a.6.6 0 0 0 0-1l-8-5.2a.6.6 0 0 0-.92.5Z" />
              </svg>
            </button>
            {schema.length > 0 && (
              <button
                type="button"
                aria-label={`${block.title} settings`}
                aria-expanded={panel}
                onClick={() => setPanel((p) => !p)}
                className={`grid h-11 w-11 place-items-center rounded-full transition-colors ${FOCUS} ${panel ? "bg-white text-black" : "bg-[#232323] text-[#e4e4e6] hover:bg-[#2c2c2e]"}`}
              >
                <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2.5 5h6M12.5 5h3M2.5 13h2M8.5 13h7" />
                  <circle cx="10.5" cy="5" r="1.8" />
                  <circle cx="6.5" cy="13" r="1.8" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function Blocks() {
  const [type, setType] = useState<Interaction | "All">("All");
  const [query, setQuery] = useState("");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [swatches, setSwatches] = useState(false);
  const search = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    const match = INTERACTIONS.find((i) => i.toLowerCase() === t?.toLowerCase());
    if (match) setType(match);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (t: Interaction | "All") => {
    setType(t);
    const url = new URL(window.location.href);
    if (t === "All") url.searchParams.delete("type");
    else url.searchParams.set("type", t.toLowerCase());
    window.history.replaceState(null, "", url);
  };

  const q = query.trim().toLowerCase();
  const visible = BLOCKS.filter(
    (b) => (type === "All" || b.interaction === type) && (!q || `${b.title} ${b.keywords} ${b.interaction}`.toLowerCase().includes(q)),
  );
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of BLOCKS) m.set(b.interaction, (m.get(b.interaction) ?? 0) + 1);
    return m;
  }, []);

  const pill = (on: boolean) =>
    `shrink-0 rounded-full px-5 py-2.5 text-[16px] transition-colors ${FOCUS} ${on ? "bg-white text-black" : "bg-[#1a1a1a] text-[#c9c9cb] hover:bg-[#242424] hover:text-white"}`;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 bg-black px-4 pb-3 pt-4 sm:px-7">
        <div className="relative mx-auto flex max-w-[1760px] items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" aria-label="Originkit home" className={`grid h-9 w-9 place-items-center rounded-full ${FOCUS}`} style={{ background: accent }}>
              <span className="h-3 w-3 rounded-[3px] bg-black" />
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-1 text-[17px] md:flex">
              {[
                { label: "Blocks", href: "/blocks", current: true },
                { label: "Gallery", href: "/gallery" },
                { label: "Core", href: "/core" },
                { label: "Library", href: "/" },
              ].map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  aria-current={l.current ? "page" : undefined}
                  className={`rounded-full px-3.5 py-1.5 ${FOCUS} ${l.current ? "text-white" : "text-[#9a9a9d] hover:text-white"}`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <label className="absolute left-1/2 hidden w-[min(380px,32vw)] -translate-x-1/2 items-center gap-3 rounded-full bg-[#141414] px-5 py-3 text-[#8e8e91] focus-within:bg-[#1a1a1a] lg:flex">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="8" cy="8" r="5.2" />
              <path d="m12 12 3.4 3.4" />
            </svg>
            <span className="sr-only">Search blocks</span>
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-[#8e8e91]"
            />
            <kbd className="rounded-md text-[13px] text-[#5d5d60]">⌘K</kbd>
          </label>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              aria-label="Accent colour"
              aria-expanded={swatches}
              onClick={() => setSwatches((s) => !s)}
              className={`grid h-11 w-11 place-items-center rounded-full bg-[#141414] ${FOCUS}`}
            >
              <span className="h-4 w-4 rounded-full" style={{ background: accent }} />
            </button>
            {swatches && (
              <div role="radiogroup" aria-label="Accent colour" className="absolute right-0 top-14 flex gap-2.5 rounded-full bg-[#1a1a1a] p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                {ACCENTS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    role="radio"
                    aria-checked={accent === a.value}
                    aria-label={a.name}
                    onClick={() => {
                      setAccent(a.value);
                      setSwatches(false);
                    }}
                    className={`h-5 w-5 rounded-full ${FOCUS}`}
                    style={{ background: a.value, boxShadow: accent === a.value ? `0 0 0 2px #1a1a1a, 0 0 0 4px ${a.value}` : undefined }}
                  />
                ))}
              </div>
            )}
            <a
              href={`${SITE}/pricing`}
              className={`hidden h-11 items-center rounded-full bg-white px-5 text-[16px] font-medium text-black sm:inline-flex ${FOCUS}`}
            >
              Get Originkit
            </a>
          </div>
        </div>

        <div className="mx-auto mt-4 flex max-w-[1760px] gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Interaction type">
          <button type="button" role="tab" aria-selected={type === "All"} onClick={() => choose("All")} className={pill(type === "All")}>
            All
          </button>
          {INTERACTIONS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => choose(t)} className={pill(type === t)}>
              {t}
              <span className={`ml-2 text-[13px] ${type === t ? "text-black/50" : "text-[#5d5d60]"}`}>{counts.get(t) ?? 0}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1760px] px-4 pb-24 pt-3 sm:px-7">
        {visible.length === 0 ? (
          <p className="py-24 text-center text-[16px] text-[#8e8e91]">Nothing matches “{query}”.</p>
        ) : (
          <ul className="columns-1 gap-5 md:columns-2 sm:gap-6 xl:columns-3">
            {visible.map((b) => (
              <Tile key={b.slug} block={b} accent={accent} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { components } from "@/lib/originkit-library";
import { ACCENTS, DEFAULT_ACCENT } from "@/app/core/types";
import { Inspector, decodeProps } from "./Inspector";
import { FOCUS, Fit, Icon, SITE, useNear, useViewportWidth } from "./kit";
import { BLOCKS, INTERACTIONS, TILE_ASPECT, type Block, type Interaction } from "./manifest";
import type { Values } from "./controls";

type Layout = "masonry" | "even";
type Sort = "featured" | "az";
const PREF_KEY = "originkit.blocks.view";

/** Most columns that read well at this viewport width. */
function maxCols(w: number) {
  return w < 640 ? 2 : w < 1024 ? 3 : w < 1440 ? 4 : 5;
}
function defaultCols(w: number) {
  return w < 640 ? 1 : w < 1024 ? 2 : 3;
}

/* -------------------------------------------------------------------------- */

function Tile({ block, accent, cols, layout, onOpen }: { block: Block; accent: string; cols: number; layout: Layout; onOpen: (slug: string, el: HTMLElement) => void }) {
  const Comp = components[block.slug];
  const { ref, near } = useNear<HTMLDivElement>();
  const compact = cols >= 4;
  const aspect = layout === "even" ? 1.25 : TILE_ASPECT[block.size];

  return (
    <li className={layout === "masonry" ? "mb-[var(--gap)] break-inside-avoid" : ""}>
      {/* A div, not a button: the preview inside can contain real buttons, and buttons cannot nest. */}
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={(e) => onOpen(block.slug, e.currentTarget)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(block.slug, e.currentTarget);
          }
        }}
        aria-label={`Open ${block.title}, ${block.interaction.toLowerCase()} block`}
        className={`group relative block w-full cursor-pointer overflow-hidden bg-[#131314] text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16),0_24px_50px_-28px_rgba(0,0,0,0.9)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS} ${compact ? "rounded-[22px]" : "rounded-[32px]"}`}
        style={{ aspectRatio: String(aspect) }}
      >
        {/* The preview is for looking. It is inert so a click anywhere opens the inspector,
            where the block can be played with, edited and copied. */}
        <div aria-hidden ref={(el) => el?.setAttribute("inert", "")} className="pointer-events-none absolute inset-0">
          {Comp && near && (
            <Fit designWidth={480} padX={compact ? 16 : 28} padTop={compact ? 16 : 28} padBottom={compact ? 68 : 92}>
              <Comp accent={accent} theme="dark" />
            </Fit>
          )}
        </div>

        <span className={`absolute right-3 top-3 grid place-items-center rounded-full bg-white text-black opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
          <Icon name="open" size={compact ? 13 : 15} />
        </span>

        <span className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 ${compact ? "p-3" : "p-5"}`}>
          <span className={`truncate rounded-full bg-[#232325] text-[#ededee] ${compact ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-[15px]"}`}>{block.title}</span>
          <span className={`shrink-0 text-[#6c6c72] transition-colors group-hover:text-[#a8a8ad] ${compact ? "text-[11px]" : "text-[12.5px]"}`}>{block.interaction}</span>
        </span>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */

export function Blocks() {
  const vw = useViewportWidth();
  const [type, setType] = useState<Interaction | "All">("All");
  const [query, setQuery] = useState("");
  const [colsPref, setColsPref] = useState<number | null>(null);
  const [layout, setLayout] = useState<Layout>("masonry");
  const [sort, setSort] = useState<Sort>("featured");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [swatches, setSwatches] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<Values>({});
  const root = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const ready = useRef(false);

  /* --- URL and saved preferences ------------------------------------------ */
  const setParam = useCallback((k: string, v: string | null) => {
    const url = new URL(window.location.href);
    if (v === null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    let saved: { cols?: number; layout?: Layout; sort?: Sort } = {};
    try {
      saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
    } catch {
      /* ignore */
    }
    const t = INTERACTIONS.find((i) => i.toLowerCase() === sp.get("type")?.toLowerCase());
    if (t) setType(t);
    setQuery(sp.get("q") ?? "");
    const c = Number(sp.get("cols") ?? saved.cols);
    if (c >= 1 && c <= 5) setColsPref(c);
    const l = sp.get("layout") ?? saved.layout;
    if (l === "masonry" || l === "even") setLayout(l);
    const s = sp.get("sort") ?? saved.sort;
    if (s === "featured" || s === "az") setSort(s);
    const open = sp.get("c");
    if (open && BLOCKS.some((b) => b.slug === open)) {
      setInitialValues(decodeProps(sp.get("p")));
      setOpenSlug(open);
    }
    ready.current = true;
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ cols: colsPref ?? undefined, layout, sort }));
    } catch {
      /* private mode */
    }
  }, [colsPref, layout, sort]);

  useEffect(() => {
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      const c = sp.get("c");
      setInitialValues(decodeProps(sp.get("p")));
      setOpenSlug(c && BLOCKS.some((b) => b.slug === c) ? c : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* --- Shortcuts ---------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = !!t.closest("input, textarea, select, [contenteditable=true]");
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing && !openSlug)) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSlug]);

  // Everything behind the inspector is out of reach while it is open.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    (el as HTMLElement & { inert: boolean }).inert = !!openSlug;
  }, [openSlug]);

  /* --- Derived ------------------------------------------------------------ */
  const limit = maxCols(vw);
  const cols = Math.min(colsPref ?? defaultCols(vw), limit);
  const colOptions = vw < 640 ? [1, 2] : [2, 3, 4, 5].filter((n) => n <= limit);
  const gap = cols >= 4 ? 16 : 24;

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const list = BLOCKS.filter((b) => (type === "All" || b.interaction === type) && (!q || `${b.title} ${b.keywords} ${b.interaction}`.toLowerCase().includes(q)));
    return sort === "az" ? [...list].sort((a, b) => a.title.localeCompare(b.title)) : list;
  }, [type, q, sort]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of BLOCKS) m.set(b.interaction, (m.get(b.interaction) ?? 0) + 1);
    return m;
  }, []);

  const current = openSlug ? BLOCKS.find((b) => b.slug === openSlug) ?? null : null;
  const siblings = current && !visible.some((b) => b.slug === current.slug) ? BLOCKS : visible;

  /* --- Actions ------------------------------------------------------------ */
  const open = (slug: string, el: HTMLElement) => {
    trigger.current = el;
    setInitialValues({});
    setOpenSlug(slug);
    const url = new URL(window.location.href);
    url.searchParams.set("c", slug);
    url.searchParams.delete("p");
    window.history.pushState({ blocksOpen: true }, "", url);
  };
  const close = () => {
    if (window.history.state?.blocksOpen) window.history.back();
    else {
      setParam("c", null);
      setParam("p", null);
      setOpenSlug(null);
    }
  };
  const navigate = (slug: string) => {
    setInitialValues({});
    setOpenSlug(slug);
    setParam("c", slug);
    setParam("p", null);
  };

  const chooseType = (t: Interaction | "All") => {
    setType(t);
    setParam("type", t === "All" ? null : t.toLowerCase());
  };

  const pill = (on: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-[15px] transition-colors ${FOCUS} ${on ? "bg-white text-black" : "bg-[#1a1a1a] text-[#c9c9cb] hover:bg-[#242424] hover:text-white"}`;

  const searchBox = (cls: string) => (
    <label className={`items-center gap-3 rounded-full bg-[#141414] px-5 py-3 text-[#8e8e91] focus-within:bg-[#1a1a1a] ${cls}`}>
      <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8" cy="8" r="5.2" />
        <path d="m12 12 3.4 3.4" />
      </svg>
      <span className="sr-only">Search blocks</span>
      <input
        ref={cls.includes("lg:flex") ? search : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setParam("q", e.target.value.trim() || null);
        }}
        placeholder="Search blocks"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-[#8e8e91]"
      />
      <kbd className="hidden rounded-md text-[12px] text-[#5d5d60] lg:block">⌘K</kbd>
    </label>
  );

  return (
    <div ref={root} className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 bg-black px-4 pb-3 pt-4 sm:px-7">
        <div className="relative mx-auto flex max-w-[1880px] items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" aria-label="Originkit home" className={`grid h-9 w-9 place-items-center rounded-full ${FOCUS}`} style={{ background: accent }}>
              <span className="h-3 w-3 rounded-[3px] bg-black" />
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-1 text-[16px] md:flex">
              {[
                { label: "Blocks", href: "/blocks", current: true },
                { label: "Gallery", href: "/gallery" },
                { label: "Core", href: "/core" },
                { label: "Library", href: "/" },
              ].map((l) => (
                <Link key={l.label} href={l.href} aria-current={l.current ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 ${FOCUS} ${l.current ? "text-white" : "text-[#9a9a9d] hover:text-white"}`}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {searchBox("absolute left-1/2 hidden w-[min(400px,32vw)] -translate-x-1/2 lg:flex")}

          <div className="relative flex items-center gap-2">
            <button type="button" aria-label="Accent colour" aria-expanded={swatches} onClick={() => setSwatches((s) => !s)} className={`grid h-10 w-10 place-items-center rounded-full bg-[#141414] ${FOCUS}`}>
              <span className="h-4 w-4 rounded-full" style={{ background: accent }} />
            </button>
            {swatches && (
              <div role="radiogroup" aria-label="Accent colour" className="absolute right-0 top-13 z-40 flex gap-2.5 rounded-full bg-[#1a1a1a] p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]" style={{ top: 52 }}>
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
            <a href={`${SITE}/pricing`} className={`hidden h-10 items-center rounded-full bg-white px-5 text-[15px] font-medium text-black sm:inline-flex ${FOCUS}`}>
              Get Originkit
            </a>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-[1880px] space-y-3">
          {searchBox("flex lg:hidden")}
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Interaction type">
              <button type="button" role="tab" aria-selected={type === "All"} onClick={() => chooseType("All")} className={pill(type === "All")}>
                All <span className={`ml-1 text-[12.5px] ${type === "All" ? "text-black/50" : "text-[#5d5d60]"}`}>{BLOCKS.length}</span>
              </button>
              {INTERACTIONS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => chooseType(t)} className={pill(type === t)}>
                  {t} <span className={`ml-1 text-[12.5px] ${type === t ? "text-black/50" : "text-[#5d5d60]"}`}>{counts.get(t) ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="hidden shrink-0 items-center gap-2 md:flex" role="group" aria-label="View options">
              <div role="radiogroup" aria-label="Columns" className="flex rounded-full bg-[#141414] p-1">
                {colOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={cols === n}
                    aria-label={`${n} column${n > 1 ? "s" : ""}`}
                    title={`${n} columns`}
                    onClick={() => {
                      setColsPref(n);
                      setParam("cols", String(n));
                    }}
                    className={`grid h-8 w-10 place-items-center rounded-full transition-colors ${FOCUS} ${cols === n ? "bg-white text-black" : "text-[#8e8e91] hover:text-white"}`}
                  >
                    <Icon name={`grid${Math.max(n, 2)}` as "grid2"} size={18} />
                  </button>
                ))}
              </div>
              <div role="radiogroup" aria-label="Layout" className="flex rounded-full bg-[#141414] p-1">
                {([["masonry", "Masonry"], ["even", "Even grid"]] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={layout === id}
                    aria-label={label}
                    title={label}
                    onClick={() => {
                      setLayout(id);
                      setParam("layout", id === "masonry" ? null : id);
                    }}
                    className={`grid h-8 w-10 place-items-center rounded-full transition-colors ${FOCUS} ${layout === id ? "bg-white text-black" : "text-[#8e8e91] hover:text-white"}`}
                  >
                    <Icon name={id} size={17} />
                  </button>
                ))}
              </div>
              <label className="relative">
                <span className="sr-only">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as Sort);
                    setParam("sort", e.target.value === "featured" ? null : e.target.value);
                  }}
                  className={`h-10 appearance-none rounded-full bg-[#141414] pl-4 pr-9 text-[14px] text-[#c9c9cb] hover:text-white ${FOCUS}`}
                >
                  <option value="featured">Featured</option>
                  <option value="az">A to Z</option>
                </select>
                <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8e91]">
                  <Icon name="down" size={13} />
                </span>
              </label>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1880px] px-4 pb-24 pt-2 sm:px-7" style={{ ["--gap" as string]: `${gap}px` }}>
        <p className="sr-only" role="status" aria-live="polite">
          {visible.length} block{visible.length === 1 ? "" : "s"} shown
        </p>
        {visible.length === 0 ? (
          <div className="py-28 text-center">
            <p className="text-[18px] text-white">Nothing matches “{query}”.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setParam("q", null);
                chooseType("All");
              }}
              className={`mt-5 h-10 rounded-full bg-[#1a1a1a] px-5 text-[14px] text-white hover:bg-[#242424] ${FOCUS}`}
            >
              Clear filters
            </button>
          </div>
        ) : layout === "masonry" ? (
          <ul style={{ columnCount: cols, columnGap: gap }}>
            {visible.map((b) => (
              <Tile key={b.slug} block={b} accent={accent} cols={cols} layout={layout} onOpen={open} />
            ))}
          </ul>
        ) : (
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
            {visible.map((b) => (
              <Tile key={b.slug} block={b} accent={accent} cols={cols} layout={layout} onOpen={open} />
            ))}
          </ul>
        )}
      </main>

      <Inspector
        block={current}
        siblings={siblings}
        accent={accent}
        initialValues={initialValues}
        onClose={close}
        onNavigate={navigate}
        onExited={() => trigger.current?.isConnected && trigger.current.focus()}
      />
    </div>
  );
}

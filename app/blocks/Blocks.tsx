"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { components } from "@/lib/originkit-library";
import { ACCENTS, DEFAULT_ACCENT } from "@/app/core/types";
import { Inspector, decodeProps } from "./Inspector";
import { FOCUS, Fit, Icon, SITE, useCoarsePointer, useCopy, useNear, useSaved, useSoundPref, useViewportWidth } from "./kit";
import { BLOCKS, INTERACTIONS, tileAspect, type Block, type Interaction } from "./manifest";
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

/**
 * Masonry columns that read left to right: each block goes to the shortest column so far,
 * so the first row is 1, 2, 3 and the columns stay level. Tiles share a width, so a tile's
 * height is just 1 / aspect.
 */
function masonryColumns(blocks: Block[], cols: number): Block[][] {
  const out: Block[][] = Array.from({ length: cols }, () => []);
  const heights = new Array<number>(cols).fill(0);
  for (const b of blocks) {
    const c = heights.indexOf(Math.min(...heights));
    out[c].push(b);
    heights[c] += 1 / tileAspect(b);
  }
  return out;
}

/* -------------------------------------------------------------------------- */

const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]';

function BookmarkButton({ saved, title, onToggle, accent, size }: { saved: boolean; title: string; onToggle: () => void; accent: string; size: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      title={saved ? "Saved" : "Save for later"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`grid shrink-0 place-items-center rounded-lg bg-[#232325] transition-colors hover:bg-[#2e2e31] ${FOCUS} ${size === "sm" ? "h-8 w-8" : "h-10 w-10"}`}
      style={{ color: saved ? accent : "#c9c9cc" }}
    >
      <motion.span key={String(saved)} initial={saved ? { scale: 0.6 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 14 }} className="grid place-items-center">
        <Icon name={saved ? "bookmarkFilled" : "bookmark"} size={size === "sm" ? 15 : 17} />
      </motion.span>
    </button>
  );
}

function Tile({
  block,
  accent,
  cols,
  layout,
  coarse,
  saved,
  sound,
  onOpen,
  onToggleSaved,
}: {
  sound: boolean;
  block: Block;
  accent: string;
  cols: number;
  layout: Layout;
  coarse: boolean;
  saved: boolean;
  onOpen: (slug: string, el: HTMLElement) => void;
  onToggleSaved: (slug: string) => void;
}) {
  const Comp = components[block.slug];
  const { ref, near } = useNear<HTMLDivElement>();
  const preview = useRef<HTMLDivElement | null>(null);
  const compact = cols >= 4;
  const aspect = layout === "even" ? 1.25 : tileAspect(block);

  // On a pointer device the preview is live. Two guards keep that from fighting the page:
  // wheel gestures scroll the page (a demo that pans on wheel would trap the scroll), and the
  // demo's own controls are skipped by Tab so one tile is not dozens of tab stops. Keyboard
  // users play with a block in the inspector, which the title button opens.
  useEffect(() => {
    const el = preview.current;
    if (!el || coarse) return;
    const stopWheel = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stopWheel, { capture: true });
    const skipTab = () => {
      el.querySelectorAll<HTMLElement>(FOCUSABLE).forEach((n) => {
        if (n.getAttribute("tabindex") !== "-1") n.setAttribute("tabindex", "-1");
      });
    };
    skipTab();
    const mo = new MutationObserver(skipTab);
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["tabindex"] });
    return () => {
      el.removeEventListener("wheel", stopWheel, { capture: true });
      mo.disconnect();
    };
  }, [near, coarse]);

  return (
    <li className={layout === "masonry" ? "mb-[var(--gap)] break-inside-avoid" : ""}>
      <div
        ref={ref}
        role="group"
        aria-label={`${block.title}, ${block.interaction.toLowerCase()} block`}
        className={`group relative w-full overflow-hidden bg-[#131314] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] ${compact ? "rounded-[12px]" : "rounded-[18px]"}`}
        style={{ aspectRatio: String(aspect) }}
      >
        <div ref={preview} className={`absolute inset-0 ${coarse ? "pointer-events-none" : ""}`}>
          {Comp && near && (
            <Fit designWidth={480} padX={compact ? 16 : 28} padTop={compact ? 16 : 28} padBottom={compact ? 68 : 92}>
              <Comp accent={accent} theme="dark" sound={sound} {...block.props} />
            </Fit>
          )}
        </div>

        {/* Touch: a drag should scroll the page, so the preview is inert and a tap opens the inspector. */}
        {coarse && (
          <button type="button" onClick={(e) => onOpen(block.slug, e.currentTarget)} aria-label={`Open ${block.title}`} className={`absolute inset-0 z-[1] rounded-[inherit] ${FOCUS}`} />
        )}

        {!coarse && !compact && (
          <span className="pointer-events-none absolute inset-x-0 bottom-[68px] flex justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="rounded-lg bg-black/70 px-3 py-1 text-[12px] text-[#c9c9cc] backdrop-blur">Try it: {block.hint.charAt(0).toLowerCase() + block.hint.slice(1)}</span>
          </span>
        )}

        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-2 ${compact ? "p-3" : "p-5"}`}>
          <button
            type="button"
            onClick={(e) => onOpen(block.slug, e.currentTarget)}
            aria-label={`Open ${block.title} in the inspector`}
            className={`pointer-events-auto flex min-w-0 items-center gap-2 rounded-lg bg-[#232325] text-[#ededee] transition-colors hover:bg-[#2e2e31] ${FOCUS} ${compact ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-[15px]"}`}
          >
            <span className="truncate">{block.title}</span>
            <span className="shrink-0 text-[#8b8b90]">
              <Icon name="open" size={compact ? 12 : 14} />
            </span>
          </button>
          <div className="pointer-events-auto flex shrink-0 items-center gap-2">
            {!compact && <span className="text-[12.5px] text-[#6c6c72]">{block.interaction}</span>}
            <BookmarkButton saved={saved} title={block.title} onToggle={() => onToggleSaved(block.slug)} accent={accent} size={compact ? "sm" : "md"} />
          </div>
        </div>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */

export function Blocks() {
  const vw = useViewportWidth();
  const coarse = useCoarsePointer();
  const { soundOn, setSoundOn } = useSoundPref();
  const { saved, toggle: toggleSavedRaw, clear: clearSaved } = useSaved();
  const { copied, copy } = useCopy();
  const [announce, setAnnounce] = useState("");
  const [type, setType] = useState<Interaction | "All" | "Saved">("All");
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
    const rawType = sp.get("type")?.toLowerCase();
    const t = INTERACTIONS.find((i) => i.toLowerCase() === rawType);
    if (t) setType(t);
    else if (rawType === "saved") setType("Saved");
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
    const list = BLOCKS.filter((b) => (type === "All" || (type === "Saved" ? saved.includes(b.slug) : b.interaction === type)) && (!q || `${b.title} ${b.keywords} ${b.interaction}`.toLowerCase().includes(q)));
    return sort === "az" ? [...list].sort((a, b) => a.title.localeCompare(b.title)) : list;
  }, [type, q, sort, saved]);

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

  const toggleSaved = (slug: string) => {
    const b = BLOCKS.find((x) => x.slug === slug);
    setAnnounce(`${saved.includes(slug) ? "Removed" : "Saved"} ${b?.title ?? slug}`);
    toggleSavedRaw(slug);
  };
  const savedBlocks = BLOCKS.filter((b) => saved.includes(b.slug));
  const savedPrompt = `Using originkit MCP, get me these components: ${savedBlocks.map((b) => b.slug).join(", ")}.`;

  const chooseType = (t: Interaction | "All" | "Saved") => {
    setType(t);
    setParam("type", t === "All" ? null : t.toLowerCase());
  };

  const pill = (on: boolean) =>
    `shrink-0 rounded-lg px-4 py-2 text-[15px] transition-colors ${FOCUS} ${on ? "bg-white text-black" : "bg-[#1a1a1a] text-[#c9c9cb] hover:bg-[#242424] hover:text-white"}`;

  const searchBox = (cls: string) => (
    <label className={`items-center gap-3 rounded-lg bg-[#141414] px-5 py-3 text-[#8e8e91] focus-within:bg-[#1a1a1a] ${cls}`}>
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
            <Link href="/" aria-label="Originkit home" className={`grid h-9 w-9 place-items-center rounded-lg ${FOCUS}`} style={{ background: accent }}>
              <span className="h-3 w-3 rounded-[3px] bg-black" />
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-1 text-[16px] md:flex">
              {[
                { label: "Blocks", href: "/blocks", current: true },
                { label: "Gallery", href: "/gallery" },
                { label: "Core", href: "/core" },
                { label: "Library", href: "/" },
              ].map((l) => (
                <Link key={l.label} href={l.href} aria-current={l.current ? "page" : undefined} className={`rounded-lg px-3.5 py-1.5 ${FOCUS} ${l.current ? "text-white" : "text-[#9a9a9d] hover:text-white"}`}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {searchBox("absolute left-1/2 hidden w-[min(400px,32vw)] -translate-x-1/2 lg:flex")}

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              aria-pressed={soundOn}
              aria-label="Sound effects"
              title={soundOn ? "Sound effects on" : "Sound effects off"}
              onClick={() => {
                setSoundOn(!soundOn);
                setAnnounce(soundOn ? "Sound effects off" : "Sound effects on");
              }}
              className={`grid h-10 w-10 place-items-center rounded-lg transition-colors ${FOCUS} ${soundOn ? "bg-white text-black" : "bg-[#141414] text-[#8e8e91] hover:text-white"}`}
            >
              <Icon name={soundOn ? "soundOn" : "soundOff"} size={17} />
            </button>
            <button type="button" aria-label="Accent colour" aria-expanded={swatches} onClick={() => setSwatches((s) => !s)} className={`grid h-10 w-10 place-items-center rounded-lg bg-[#141414] ${FOCUS}`}>
              <span className="h-4 w-4 rounded-full" style={{ background: accent }} />
            </button>
            {swatches && (
              <div role="radiogroup" aria-label="Accent colour" className="absolute right-0 top-13 z-40 flex gap-2.5 rounded-lg bg-[#1a1a1a] p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]" style={{ top: 52 }}>
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
            <a href={`${SITE}/pricing`} className={`hidden h-10 items-center rounded-lg bg-white px-5 text-[15px] font-medium text-black sm:inline-flex ${FOCUS}`}>
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
              <button type="button" role="tab" aria-selected={type === "Saved"} onClick={() => chooseType("Saved")} className={`${pill(type === "Saved")} inline-flex items-center gap-1.5`}>
                <Icon name={saved.length ? "bookmarkFilled" : "bookmark"} size={14} />
                Saved <span className={`text-[12.5px] ${type === "Saved" ? "text-black/50" : "text-[#5d5d60]"}`}>{saved.length}</span>
              </button>
              {INTERACTIONS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => chooseType(t)} className={pill(type === t)}>
                  {t} <span className={`ml-1 text-[12.5px] ${type === t ? "text-black/50" : "text-[#5d5d60]"}`}>{counts.get(t) ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="hidden shrink-0 items-center gap-2 md:flex" role="group" aria-label="View options">
              <div role="radiogroup" aria-label="Columns" className="flex rounded-lg bg-[#141414] p-1">
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
                    className={`grid h-8 w-10 place-items-center rounded-lg transition-colors ${FOCUS} ${cols === n ? "bg-white text-black" : "text-[#8e8e91] hover:text-white"}`}
                  >
                    <Icon name={`grid${Math.max(n, 2)}` as "grid2"} size={18} />
                  </button>
                ))}
              </div>
              <div role="radiogroup" aria-label="Layout" className="flex rounded-lg bg-[#141414] p-1">
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
                    className={`grid h-8 w-10 place-items-center rounded-lg transition-colors ${FOCUS} ${layout === id ? "bg-white text-black" : "text-[#8e8e91] hover:text-white"}`}
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
                  className={`h-10 appearance-none rounded-lg bg-[#141414] pl-4 pr-9 text-[14px] text-[#c9c9cb] hover:text-white ${FOCUS}`}
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
          {announce || `${visible.length} block${visible.length === 1 ? "" : "s"} shown`}
        </p>
        {type === "Saved" && saved.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#101011] px-5 py-3.5">
            <p className="text-[14px] text-[#c9c9cb]">
              {saved.length} saved <span className="text-[#6c6c72]">· kept in this browser</span>
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => copy(savedPrompt, "saved")} className={`inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-[13.5px] font-medium text-black ${FOCUS}`}>
                <Icon name={copied === "saved" ? "check" : "copy"} size={14} />
                {copied === "saved" ? "Copied" : "Copy MCP prompt for all"}
              </button>
              <button type="button" onClick={clearSaved} className={`h-9 rounded-lg bg-[#1a1a1a] px-4 text-[13.5px] text-[#c9c9cb] hover:text-white ${FOCUS}`}>
                Clear all
              </button>
            </div>
          </div>
        )}
        {visible.length === 0 && type === "Saved" && !q ? (
          <div className="py-28 text-center">
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-[#1a1a1a] text-[#8e8e91]">
              <Icon name="bookmark" size={20} />
            </span>
            <p className="text-[18px] text-white">Nothing saved yet</p>
            <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-[1.6] text-[#8e8e91]">Press the bookmark on any block to keep it here, then copy them all into your editor in one go.</p>
            <button type="button" onClick={() => chooseType("All")} className={`mt-6 h-10 rounded-lg bg-white px-5 text-[14px] font-medium text-black ${FOCUS}`}>
              Browse blocks
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-28 text-center">
            <p className="text-[18px] text-white">Nothing matches “{query}”.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setParam("q", null);
                chooseType("All");
              }}
              className={`mt-5 h-10 rounded-lg bg-[#1a1a1a] px-5 text-[14px] text-white hover:bg-[#242424] ${FOCUS}`}
            >
              Clear filters
            </button>
          </div>
        ) : layout === "masonry" ? (
          <div className="flex items-start" style={{ gap }}>
            {masonryColumns(visible, cols).map((column, i) => (
              <ul key={i} className="min-w-0 flex-1">
                {column.map((b) => (
                  <Tile key={b.slug} block={b} accent={accent} cols={cols} layout={layout} coarse={coarse} sound={soundOn} saved={saved.includes(b.slug)} onOpen={open} onToggleSaved={toggleSaved} />
                ))}
              </ul>
            ))}
          </div>
        ) : (
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
            {visible.map((b) => (
              <Tile key={b.slug} block={b} accent={accent} cols={cols} layout={layout} coarse={coarse} sound={soundOn} saved={saved.includes(b.slug)} onOpen={open} onToggleSaved={toggleSaved} />
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
        sound={soundOn}
        saved={current ? saved.includes(current.slug) : false}
        onToggleSaved={toggleSaved}
        onExited={() => trigger.current?.isConnected && trigger.current.focus()}
      />
    </div>
  );
}

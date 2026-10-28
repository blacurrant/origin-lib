"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useComponent } from "@/lib/originkit-library/lazy";
import { ACCENTS, DEFAULT_ACCENT } from "@/app/core/types";
import { Inspector, decodeProps } from "./Inspector";
import { DemoBoundary, FOCUS, Fit, Icon, SITE, Toast, useCoarsePointer, useCopy, useDismiss, useLiveSlot, useNear, usePersisted, useSaved, useScrolled, useSoundPref, useViewportWidth } from "./kit";
import { BLOCKS, INTERACTIONS, NEW_SLUGS, tileAspect, type Block, type Interaction } from "./manifest";
import type { Values } from "./controls";

type Layout = "masonry" | "even";
type Sort = "featured" | "new" | "az";
type Previews = "auto" | "live" | "hover";
type Filter = Interaction | "All" | "Saved";
const PREF_KEY = "originkit.blocks.view";
const NAV = [
  { label: "Blocks", href: "/blocks", current: true },
  { label: "Gallery", href: "/gallery" },
  { label: "Core", href: "/core" },
  { label: "Library", href: "/" },
];

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
  hoverOnly,
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
  /** Previews start only while the tile is hovered or focused. Touch devices always run them. */
  hoverOnly: boolean;
  saved: boolean;
  onOpen: (slug: string, el: HTMLElement) => void;
  onToggleSaved: (slug: string) => void;
}) {
  // Touch devices keep fewer demos alive: they mount closer to the screen, and only the nearest few at a time.
  const { ref, near } = useNear<HTMLDivElement>(coarse ? 100 : 500, coarse ? 600 : 1800);
  const slot = useLiveSlot(ref, coarse && near);
  const preview = useRef<HTMLDivElement | null>(null);
  const [armed, setArmed] = useState(false);
  const compact = cols >= 4;
  const aspect = layout === "even" ? 1.25 : tileAspect(block);
  const gated = hoverOnly && !coarse;
  const wanted = near && (!coarse || slot) && (!gated || armed);
  const Comp = useComponent(wanted ? block.slug : undefined);
  const mounted = !!Comp && wanted;
  const isNew = NEW_SLUGS.has(block.slug);
  const hint = `Try it: ${block.hint.charAt(0).toLowerCase() + block.hint.slice(1)}`;

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
  }, [mounted, coarse]);

  return (
    <li className={layout === "masonry" ? "mb-[var(--gap)] break-inside-avoid" : ""}>
      <div
        ref={ref}
        role="group"
        aria-label={`${block.title}, ${block.interaction.toLowerCase()} block${isNew ? ", new" : ""}`}
        onPointerEnter={() => setArmed(true)}
        onPointerLeave={() => setArmed(false)}
        onFocusCapture={() => setArmed(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArmed(false);
        }}
        className={`group relative w-full overflow-hidden bg-[#131314] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] ${compact ? "rounded-[12px]" : "rounded-[18px]"}`}
        style={{ aspectRatio: String(aspect) }}
      >
        <div ref={preview} className={`absolute inset-0 ${coarse ? "pointer-events-none" : ""}`}>
          {mounted ? (
            <div className="blocks-fade-in absolute inset-0">
              <DemoBoundary label={block.title}>
                <Fit designWidth={480} padX={compact ? 16 : 28} padTop={compact ? 16 : 28} padBottom={compact ? 68 : 92}>
                  <Comp accent={accent} theme="dark" sound={sound} {...block.props} />
                </Fit>
              </DemoBoundary>
            </div>
          ) : gated && near ? (
            <div className="absolute inset-0 grid place-items-center pb-14 text-[#84848a]">
              <span className="grid justify-items-center gap-2 text-[13px]">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#1c1c1f]">
                  <Icon name="play" size={16} />
                </span>
                Hover to play
              </span>
            </div>
          ) : (
            <div aria-hidden className="blocks-skeleton absolute inset-0" />
          )}
        </div>

        {/* Touch: a drag should scroll the page, so the preview is inert and a tap opens the inspector. */}
        {coarse && <button type="button" onClick={(e) => onOpen(block.slug, e.currentTarget)} aria-label={`Open ${block.title}`} className={`absolute inset-0 z-[1] rounded-[inherit] ${FOCUS}`} />}

        {isNew && (
          <span className="pointer-events-none absolute left-3 top-3 z-[2] rounded-md px-2 py-0.5 text-[11px] font-medium text-black" style={{ background: accent }}>
            New
          </span>
        )}

        {/* The corner button is the second way in, so opening a block is not only the title chip. */}
        <span className="absolute right-3 top-3 z-[2]">
          {coarse ? (
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-[#c9c9cc] backdrop-blur">
              <Icon name="expand" size={14} />
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => onOpen(block.slug, e.currentTarget)}
              aria-label={`Expand ${block.title}`}
              title="Expand"
              className={`grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-[#c9c9cc] opacity-0 backdrop-blur transition-opacity hover:text-white focus-visible:opacity-100 group-hover:opacity-100 ${FOCUS}`}
            >
              <Icon name="expand" size={14} />
            </button>
          )}
        </span>

        {!coarse && (
          <span className={`pointer-events-none absolute inset-x-0 flex justify-center px-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${compact ? "bottom-[56px]" : "bottom-[68px]"}`}>
            <span className={`truncate rounded-lg bg-black/70 text-[#c9c9cc] backdrop-blur ${compact ? "max-w-full px-2.5 py-1 text-[11px]" : "px-3 py-1 text-[12px]"}`}>{hint}</span>
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
            {!compact && <span className="text-[12px] text-[#84848a]">{block.interaction}</span>}
            <BookmarkButton saved={saved} title={block.title} onToggle={() => onToggleSaved(block.slug)} accent={accent} size={compact ? "sm" : "md"} />
          </div>
        </div>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string; icon?: Parameters<typeof Icon>[0]["name"] }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-[#84848a]">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-[#101011] p-0.5">
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-[13px] transition-colors ${FOCUS} ${value === o.id ? "bg-white text-black" : "text-[#a0a0a5] hover:text-white"}`}
          >
            {o.icon && <Icon name={o.icon} size={15} />}
            <span className="truncate">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Blocks() {
  const vw = useViewportWidth();
  const coarse = useCoarsePointer();
  const reduce = useReducedMotion();
  const scrolled = useScrolled();
  const { soundOn, setSoundOn } = useSoundPref();
  const { saved, toggle: toggleSavedRaw, addAll, clear: clearSaved } = useSaved();
  const { copied, copy } = useCopy();
  const [announce, setAnnounce] = useState("");
  const [toast, setToast] = useState<{ id: number; message: string; action?: { label: string; run: () => void } } | null>(null);
  const [type, setType] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [colsPref, setColsPref] = useState<number | null>(null);
  const [layout, setLayout] = useState<Layout>("masonry");
  const [sort, setSort] = useState<Sort>("featured");
  const [previews, setPreviews] = usePersisted<Previews>("originkit.blocks.previews", "auto", (v): v is Previews => v === "auto" || v === "live" || v === "hover");
  const [accent, setAccent] = usePersisted<string>("originkit.blocks.accent", DEFAULT_ACCENT, (v): v is string => typeof v === "string" && ACCENTS.some((a) => a.value === v));
  const [shared, setShared] = useState<string[] | null>(null);
  const [swatches, setSwatches] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<Values>({});
  const root = useRef<HTMLDivElement | null>(null);
  const searchLg = useRef<HTMLInputElement | null>(null);
  const searchSm = useRef<HTMLInputElement | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const ready = useRef(false);
  const swatchBox = useRef<HTMLDivElement | null>(null);
  const viewBox = useRef<HTMLDivElement | null>(null);
  const menuBox = useRef<HTMLDivElement | null>(null);
  const pills = useRef<HTMLDivElement | null>(null);
  const [fade, setFade] = useState({ left: false, right: false });

  useDismiss(swatchBox, swatches, useCallback(() => setSwatches(false), []));
  useDismiss(viewBox, viewOpen, useCallback(() => setViewOpen(false), []));
  useDismiss(menuBox, menuOpen, useCallback(() => setMenuOpen(false), []));

  const hoverOnly = previews === "hover" || (previews === "auto" && !!reduce);

  /* --- URL and saved preferences ------------------------------------------ */
  const setParam = useCallback((k: string, v: string | null) => {
    const url = new URL(window.location.href);
    if (v === null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    let stored: { cols?: number; layout?: Layout; sort?: Sort } = {};
    try {
      stored = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
    } catch {
      /* ignore */
    }
    const rawType = sp.get("type")?.toLowerCase();
    const t = INTERACTIONS.find((i) => i.toLowerCase() === rawType);
    if (t) setType(t);
    else if (rawType === "saved") setType("Saved");
    setQuery(sp.get("q") ?? "");
    const c = Number(sp.get("cols") ?? stored.cols);
    if (c >= 1 && c <= 5) setColsPref(c);
    const l = sp.get("layout") ?? stored.layout;
    if (l === "masonry" || l === "even") setLayout(l);
    const s = sp.get("sort") ?? stored.sort;
    if (s === "featured" || s === "new" || s === "az") setSort(s);
    const list = sp.get("s");
    if (list) {
      const slugs = list.split(",").filter((x) => BLOCKS.some((b) => b.slug === x));
      if (slugs.length) {
        setShared(slugs);
        setType("Saved");
      }
    }
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
        // Two inputs exist (header on wide screens, a row on narrow ones); focus the one that is showing.
        const box = [searchLg.current, searchSm.current].find((el) => el && el.offsetParent !== null);
        box?.focus();
        box?.select();
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

  // The filter row scrolls sideways; fade whichever edge has more behind it.
  const measurePills = useCallback(() => {
    const el = pills.current;
    if (!el) return;
    setFade({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useLayoutEffect(() => {
    measurePills();
    const el = pills.current;
    if (!el) return;
    const ro = new ResizeObserver(measurePills);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measurePills, vw]);

  /* --- Derived ------------------------------------------------------------ */
  const limit = maxCols(vw);
  const cols = Math.min(colsPref ?? defaultCols(vw), limit);
  const colOptions = vw < 640 ? [1, 2] : [2, 3, 4, 5].filter((n) => n <= limit);
  const gap = cols >= 4 ? 16 : 24;

  const q = query.trim().toLowerCase();
  const matchesQ = useCallback((b: Block) => !q || `${b.title} ${b.keywords} ${b.interaction}`.toLowerCase().includes(q), [q]);
  const savedList = shared ?? saved;
  const visible = useMemo(() => {
    const list = BLOCKS.filter((b) => (type === "All" || (type === "Saved" ? savedList.includes(b.slug) : b.interaction === type)) && matchesQ(b));
    if (sort === "az") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "new") return [...list].sort((a, b) => Number(NEW_SLUGS.has(b.slug)) - Number(NEW_SLUGS.has(a.slug)));
    return list;
  }, [type, matchesQ, sort, savedList]);

  // Counts follow the search, so a pill never promises blocks the search has already ruled out.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    let all = 0;
    for (const b of BLOCKS) {
      if (!matchesQ(b)) continue;
      all++;
      m.set(b.interaction, (m.get(b.interaction) ?? 0) + 1);
    }
    m.set("All", all);
    return m;
  }, [matchesQ]);

  const current = openSlug ? BLOCKS.find((b) => b.slug === openSlug) ?? null : null;
  const siblings = current && !visible.some((b) => b.slug === current.slug) ? BLOCKS : visible;

  /* --- Actions ------------------------------------------------------------ */
  const toTop = () => {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
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

  const say = useCallback((message: string, action?: { label: string; run: () => void }) => setToast({ id: Date.now(), message, action }), []);
  const leaveShared = () => {
    setShared(null);
    setParam("s", null);
  };
  const chooseType = (t: Filter) => {
    setType(t);
    setParam("type", t === "All" ? null : t.toLowerCase());
    if (t !== "Saved" && shared) leaveShared();
    toTop();
  };

  const toggleSaved = (slug: string) => {
    const b = BLOCKS.find((x) => x.slug === slug);
    const title = b?.title ?? slug;
    const wasSaved = saved.includes(slug);
    toggleSavedRaw(slug);
    if (wasSaved) say(`Removed ${title}`, { label: "Undo", run: () => toggleSavedRaw(slug) });
    else say(`Saved ${title}`, type === "Saved" ? undefined : { label: "View saved", run: () => chooseType("Saved") });
  };
  const savedBlocks = BLOCKS.filter((b) => savedList.includes(b.slug));
  const savedPrompt = `Using originkit MCP, get me these components: ${savedBlocks.map((b) => b.slug).join(", ")}.`;
  const savedLink = () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("type", "saved");
    url.searchParams.set("s", savedBlocks.map((b) => b.slug).join(","));
    return url.toString();
  };

  const pill = (on: boolean) =>
    `shrink-0 rounded-lg px-4 py-2 text-[15px] transition-colors ${FOCUS} ${on ? "bg-white text-black" : "bg-[#1a1a1a] text-[#c9c9cb] hover:bg-[#242424] hover:text-white"}`;
  const count = (on: boolean) => `text-[12px] ${on ? "text-black/60" : "text-[#84848a]"}`;

  const searchBox = (cls: string, inputRef: React.RefObject<HTMLInputElement>) => (
    <label className={`items-center gap-3 rounded-lg bg-[#141414] px-5 py-3 text-[#8e8e91] focus-within:bg-[#1a1a1a] ${cls}`}>
      <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8" cy="8" r="5.2" />
        <path d="m12 12 3.4 3.4" />
      </svg>
      <span className="sr-only">Search blocks</span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setParam("q", e.target.value.trim() || null);
          toTop();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.stopPropagation();
            setQuery("");
            setParam("q", null);
          }
        }}
        placeholder="Search blocks"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-[#8e8e91]"
      />
      {query ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            setParam("q", null);
            inputRef.current?.focus();
          }}
          className={`-mr-2 grid h-7 w-7 place-items-center rounded-md text-[#8e8e91] hover:text-white ${FOCUS}`}
        >
          <Icon name="close" size={14} />
        </button>
      ) : (
        <span aria-hidden className="hidden items-center gap-1 text-[12px] text-[#84848a] lg:flex">
          <kbd className="rounded border border-white/10 px-1.5">/</kbd>
          <kbd className="rounded border border-white/10 px-1.5">⌘K</kbd>
        </span>
      )}
    </label>
  );

  const resultLabel = `${visible.length} block${visible.length === 1 ? "" : "s"}`;
  const filtersActive = type !== "All" || !!q;

  return (
    <div ref={root} className="min-h-screen bg-black text-white" style={{ ["--ok-accent" as string]: accent }}>
      <header className="sticky top-0 z-30 h-[68px] bg-black px-4 pt-4 sm:px-7">
        <div className="relative mx-auto flex max-w-[1880px] items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/" aria-label="Originkit home" className={`grid h-9 w-9 place-items-center rounded-lg ${FOCUS}`} style={{ background: accent }}>
              <span className="h-3 w-3 rounded-[3px] bg-black" />
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-1 text-[16px] md:flex">
              {NAV.map((l) => (
                <Link key={l.label} href={l.href} aria-current={l.current ? "page" : undefined} className={`rounded-lg px-3.5 py-1.5 ${FOCUS} ${l.current ? "text-white" : "text-[#9a9a9d] hover:text-white"}`}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {searchBox("absolute left-1/2 hidden w-[min(400px,32vw)] -translate-x-1/2 lg:flex", searchLg)}

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

            <div ref={swatchBox} className="relative">
              <button type="button" aria-label="Accent colour" title="Accent colour" aria-expanded={swatches} onClick={() => { setSwatches((s) => !s); setViewOpen(false); }} className={`grid h-10 w-10 place-items-center rounded-lg bg-[#141414] ${FOCUS}`}>
                <span className="h-4 w-4 rounded-full" style={{ background: accent }} />
              </button>
              {swatches && (
                <div role="radiogroup" aria-label="Accent colour" className="absolute right-0 top-[52px] z-40 flex gap-2.5 rounded-lg bg-[#1a1a1a] p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      role="radio"
                      aria-checked={accent === a.value}
                      aria-label={a.name}
                      title={a.name}
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
            </div>

            <div ref={viewBox} className="relative">
              <button
                type="button"
                aria-label="View options"
                aria-expanded={viewOpen}
                onClick={() => { setViewOpen((v) => !v); setSwatches(false); }}
                className={`flex h-10 items-center gap-2 rounded-lg px-3 text-[14px] transition-colors sm:px-4 ${FOCUS} ${viewOpen ? "bg-white text-black" : "bg-[#141414] text-[#c9c9cb] hover:text-white"}`}
              >
                <Icon name="view" size={16} />
                <span className="hidden sm:inline">View</span>
              </button>
              {viewOpen && (
                <div role="dialog" aria-label="View options" className="absolute right-0 top-[52px] z-40 w-[min(300px,calc(100vw-2rem))] space-y-4 rounded-xl bg-[#1a1a1a] p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                  <Seg
                    label="Columns"
                    value={cols}
                    options={colOptions.map((n) => ({ id: n, label: String(n), icon: `grid${Math.max(n, 2)}` as "grid2" }))}
                    onChange={(n) => {
                      setColsPref(n);
                      setParam("cols", String(n));
                    }}
                  />
                  <Seg
                    label="Layout"
                    value={layout}
                    options={[
                      { id: "masonry" as Layout, label: "Masonry", icon: "masonry" },
                      { id: "even" as Layout, label: "Even", icon: "even" },
                    ]}
                    onChange={(id) => {
                      setLayout(id);
                      setParam("layout", id === "masonry" ? null : id);
                    }}
                  />
                  <Seg
                    label="Sort"
                    value={sort}
                    options={[
                      { id: "featured" as Sort, label: "Featured" },
                      { id: "new" as Sort, label: "Newest" },
                      { id: "az" as Sort, label: "A–Z" },
                    ]}
                    onChange={(s) => {
                      setSort(s);
                      setParam("sort", s === "featured" ? null : s);
                    }}
                  />
                  <div>
                    <Seg
                      label="Previews"
                      value={hoverOnly ? "hover" : "live"}
                      options={[
                        { id: "live" as const, label: "Always live", icon: "play" },
                        { id: "hover" as const, label: "On hover", icon: "pause" },
                      ]}
                      onChange={(v) => setPreviews(v)}
                    />
                    <p className="mt-1.5 text-[12px] leading-[1.5] text-[#84848a]">
                      {hoverOnly ? "Blocks run only while you hover or focus them. Easier on batteries and motion." : "Every block on screen is running."}
                      {previews === "auto" && reduce ? " Set by your system’s reduced-motion setting." : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <a href={`${SITE}/pricing`} className={`hidden h-10 items-center rounded-lg bg-white px-5 text-[15px] font-medium text-black sm:inline-flex ${FOCUS}`}>
              Get Originkit
            </a>

            <div ref={menuBox} className="relative md:hidden">
              <button type="button" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((m) => !m)} className={`grid h-10 w-10 place-items-center rounded-lg ${menuOpen ? "bg-white text-black" : "bg-[#141414] text-[#c9c9cb]"} ${FOCUS}`}>
                <Icon name={menuOpen ? "close" : "menu"} size={17} />
              </button>
              {menuOpen && (
                <nav aria-label="Site" className="absolute right-0 top-[52px] z-40 w-56 rounded-xl bg-[#1a1a1a] p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                  {NAV.map((l) => (
                    <Link key={l.label} href={l.href} aria-current={l.current ? "page" : undefined} onClick={() => setMenuOpen(false)} className={`block rounded-lg px-4 py-3 text-[16px] ${FOCUS} ${l.current ? "bg-[#242424] text-white" : "text-[#c9c9cb] hover:bg-[#242424] hover:text-white"}`}>
                      {l.label}
                    </Link>
                  ))}
                  <a href={`${SITE}/pricing`} className={`mt-1 block rounded-lg bg-white px-4 py-3 text-center text-[15px] font-medium text-black ${FOCUS}`}>
                    Get Originkit
                  </a>
                </nav>
              )}
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="blocks-hero" className="px-4 pb-6 pt-8 sm:px-7 sm:pb-8 sm:pt-12">
        <div className="mx-auto max-w-[1880px]">
          <h1 id="blocks-hero" className="max-w-[22ch] text-[32px] font-medium leading-[1.08] tracking-[-0.03em] text-white sm:text-[44px]">
            Blocks you can <span style={{ color: accent }}>play with</span>
          </h1>
          <p className="mt-3 max-w-[56ch] text-[15px] leading-[1.6] text-[#a0a0a5] sm:text-[16px]">
            {BLOCKS.length} interactive components for Framer and React. Hover, drag and press them right here, tune the properties, then copy the code or have your editor fetch it.
          </p>
          {searchBox("mt-6 flex lg:hidden", searchSm)}
        </div>
      </section>

      <div className={`sticky top-[68px] z-20 bg-black px-4 pb-3 pt-3 transition-shadow sm:px-7 ${scrolled ? "shadow-[0_1px_0_rgba(255,255,255,0.08)]" : ""}`}>
        <div className="mx-auto max-w-[1880px]">
          <div className="flex items-center justify-between gap-4">
            <div className="relative min-w-0 flex-1">
              <div
                ref={pills}
                onScroll={measurePills}
                className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Interaction type"
              >
                <button type="button" aria-pressed={type === "All"} onClick={() => chooseType("All")} className={`${pill(type === "All")} inline-flex items-center gap-1.5`}>
                  All <span className={count(type === "All")}>{counts.get("All") ?? 0}</span>
                </button>
                <button type="button" aria-pressed={type === "Saved"} onClick={() => chooseType("Saved")} className={`${pill(type === "Saved")} inline-flex items-center gap-1.5`}>
                  <Icon name={saved.length ? "bookmarkFilled" : "bookmark"} size={14} />
                  Saved <span className={count(type === "Saved")}>{saved.length}</span>
                </button>
                {INTERACTIONS.map((t) => (
                  <button key={t} type="button" aria-pressed={type === t} onClick={() => chooseType(t)} className={`${pill(type === t)} inline-flex items-center gap-1.5`}>
                    {t} <span className={count(type === t)}>{counts.get(t) ?? 0}</span>
                  </button>
                ))}
              </div>
              {fade.left && (
                <button type="button" tabIndex={-1} aria-hidden onClick={() => pills.current?.scrollBy({ left: -260, behavior: "smooth" })} className="absolute inset-y-0 left-0 flex w-14 items-center justify-start bg-gradient-to-r from-black from-40% to-transparent text-[#c9c9cb] hover:text-white">
                  <Icon name="prev" size={16} />
                </button>
              )}
              {fade.right && (
                <button type="button" tabIndex={-1} aria-hidden onClick={() => pills.current?.scrollBy({ left: 260, behavior: "smooth" })} className="absolute inset-y-0 right-0 flex w-14 items-center justify-end bg-gradient-to-l from-black from-40% to-transparent text-[#c9c9cb] hover:text-white">
                  <Icon name="next" size={16} />
                </button>
              )}
            </div>
            <p className="hidden shrink-0 text-[14px] tabular-nums text-[#84848a] md:block" aria-hidden>
              {resultLabel}
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1880px] px-4 pb-24 pt-1 sm:px-7" style={{ ["--gap" as string]: `${gap}px` }}>
        <p className="sr-only" role="status" aria-live="polite">
          {announce || resultLabel}
        </p>

        {type === "Saved" && shared && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#101011] px-5 py-3.5">
            <p className="text-[14px] text-[#c9c9cb]">
              A shared list <span className="text-[#84848a]">· {shared.length} blocks</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  addAll(shared);
                  say(`Added ${shared.length} to your saved`);
                  leaveShared();
                }}
                className={`h-9 rounded-lg bg-white px-4 text-[14px] font-medium text-black ${FOCUS}`}
              >
                Add all to my saved
              </button>
              <button type="button" onClick={leaveShared} className={`h-9 rounded-lg bg-[#1a1a1a] px-4 text-[14px] text-[#c9c9cb] hover:text-white ${FOCUS}`}>
                Back to mine
              </button>
            </div>
          </div>
        )}

        {type === "Saved" && !shared && saved.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#101011] px-5 py-3.5">
            <p className="text-[14px] text-[#c9c9cb]">
              {saved.length} saved <span className="text-[#84848a]">· kept in this browser</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(savedPrompt, "saved")} className={`inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-[14px] font-medium text-black ${FOCUS}`}>
                <Icon name={copied === "saved" ? "check" : "copy"} size={14} />
                {copied === "saved" ? "Copied" : "Copy MCP prompt for all"}
              </button>
              <button type="button" onClick={() => copy(savedLink(), "savedlink")} className={`inline-flex h-9 items-center gap-2 rounded-lg bg-[#1a1a1a] px-4 text-[14px] text-[#c9c9cb] hover:text-white ${FOCUS}`}>
                <Icon name={copied === "savedlink" ? "check" : "link"} size={14} />
                {copied === "savedlink" ? "Link copied" : "Copy link to list"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const before = [...saved];
                  clearSaved();
                  say("Cleared your saved blocks", { label: "Undo", run: () => addAll(before) });
                }}
                className={`h-9 rounded-lg bg-[#1a1a1a] px-4 text-[14px] text-[#c9c9cb] hover:text-white ${FOCUS}`}
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {visible.length === 0 && type === "Saved" && !q && !shared ? (
          <div className="py-28 text-center">
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-[#1a1a1a] text-[#8e8e91]">
              <Icon name="bookmark" size={20} />
            </span>
            <p className="text-[18px] text-white">Nothing saved yet</p>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-[1.6] text-[#8e8e91]">Press the bookmark on any block to keep it here, then copy them all into your editor in one go.</p>
            <button type="button" onClick={() => chooseType("All")} className={`mt-6 h-10 rounded-lg bg-white px-5 text-[14px] font-medium text-black ${FOCUS}`}>
              Browse blocks
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-28 text-center">
            <p className="text-[18px] text-white">
              {q ? <>Nothing matches “{query.trim()}”{type !== "All" ? <> in {type}</> : null}.</> : <>No blocks here yet.</>}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setParam("q", null);
                chooseType("All");
              }}
              className={`mt-5 h-10 rounded-lg bg-[#1a1a1a] px-5 text-[14px] text-white hover:bg-[#242424] ${FOCUS}`}
            >
              {filtersActive ? "Clear filters" : "Show all blocks"}
            </button>
          </div>
        ) : layout === "masonry" ? (
          <div className="flex items-start" style={{ gap }}>
            {masonryColumns(visible, cols).map((column, i) => (
              <ul key={i} className="min-w-0 flex-1">
                {column.map((b) => (
                  <Tile key={b.slug} block={b} accent={accent} cols={cols} layout={layout} coarse={coarse} hoverOnly={hoverOnly} sound={soundOn} saved={saved.includes(b.slug)} onOpen={open} onToggleSaved={toggleSaved} />
                ))}
              </ul>
            ))}
          </div>
        ) : (
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
            {visible.map((b) => (
              <Tile key={b.slug} block={b} accent={accent} cols={cols} layout={layout} coarse={coarse} hoverOnly={hoverOnly} sound={soundOn} saved={saved.includes(b.slug)} onOpen={open} onToggleSaved={toggleSaved} />
            ))}
          </ul>
        )}

        {visible.length > 0 && (
          <section aria-label="Get Originkit" className="mt-16 flex flex-col items-start justify-between gap-5 rounded-2xl bg-[#101011] p-7 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-[20px] font-medium text-white">Want these in your project?</h2>
              <p className="mt-1.5 max-w-xl text-[14px] leading-[1.6] text-[#a0a0a5]">Originkit gives you every block, plus an MCP server so Claude Code, Cursor or any editor can pull them in for you.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a href={`${SITE}/pricing`} className={`inline-flex h-11 items-center rounded-lg bg-white px-6 text-[15px] font-medium text-black ${FOCUS}`}>
                Get Originkit
              </a>
              <a href={`${SITE}/connect`} target="_blank" rel="noreferrer" className={`inline-flex h-11 items-center rounded-lg bg-[#1a1a1a] px-6 text-[15px] text-[#c9c9cb] hover:text-white ${FOCUS}`}>
                Connect your editor
              </a>
            </div>
          </section>
        )}
      </main>

      <Toast toast={toast} onDone={() => setToast(null)} />

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
        onToast={say}
        onExited={() => trigger.current?.isConnected && trigger.current.focus()}
      />
    </div>
  );
}

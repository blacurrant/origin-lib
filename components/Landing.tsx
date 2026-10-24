"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MotionConfig, useReducedMotion } from "framer-motion";
import { components as library } from "@/lib/originkit-library";
import { FOCUS, MONO, Segmented } from "@/app/core/ui";

// This site has no accounts or upgrade prompt, so nothing is locked here. Pro
// items link to the public site, which applies the paywall.
const useOptionalAuth = (): { isPaidPlan: boolean | null } | null => null;
const useUpgradeGate = (): { openUpgrade: (item: { name: string; displayName: string; kind: string }) => void } | null => null;

// Catalogue pages (components, templates, pricing, docs) live on the public site.
const SITE = (process.env.NEXT_PUBLIC_ORIGINKIT_SITE_URL ?? "https://www.originkit.dev").replace(/\/$/, "");
const site = (path: string) => `${SITE}${path}`;

/* -------------------------------------------------------------------------- */
/* Types and constants                                                        */
/* -------------------------------------------------------------------------- */

export type LandingData = {
  pages: {
    templates: {
      total: number;
      paid: number;
      items: { slug: string; name: string; image: string; pages: number; tech: string[]; paid: boolean }[];
    };
    sections: { total: number; paid: number; categories: { id: string; label: string; count: number }[] };
  };
  foundation: {
    groups: {
      id: string;
      title: string;
      note: string;
      track: "basic" | "agentic";
      names: { name: string; displayName: string }[];
    }[];
    total: number;
    planned: number;
  };
  animation: {
    total: number;
    /** How many of the total need a paid plan. */
    paidTotal: number;
    /** Copies recorded across the whole catalogue. */
    copiesTotal: number;
    categories: { id: string; label: string; count: number }[];
    items: {
      name: string;
      displayName: string;
      categoryId: string;
      category: string;
      image: string;
      video?: string;
      views: number;
      copies: number;
      paid: boolean;
      trending: boolean;
    }[];
  };
};

type Kind = "foundation" | "animation";

type Item = {
  id: string;
  kind: Kind;
  name: string;
  title: string;
  tag: string;
  tagId: string;
  href: string;
  search: string;
  // foundation tiles
  tile?: Tile;
  // animation tiles
  image?: string;
  video?: string;
  views?: number;
  copies?: number;
  paid?: boolean;
  trending?: boolean;
};

type Tile = {
  /** Design size in px. The preview is scaled down to fit narrow columns, never up. */
  w: number;
  dh: number;
  /** Overlays that use position: fixed cannot live inside a scaled box. */
  noFit?: boolean;
  keywords?: string;
  node: () => ReactNode;
};

const ACCENT = "#fa7319";
const S = { theme: "dark", accent: ACCENT } as const;
const GAP = 16;
const MIN_COL = 330;
const CAPTION = 62;
const PAGE = 18;
const MORE = 12;
const L = library;
const X = {
  textInput: L["text-input"],
  segmented: L["segmented-control"],
  dropdown: L["dropdown-menu"],
  dataTable: L["data-table"],
  splitPane: L["split-pane"],
  scrollArea: L["scroll-area"],
  imageViewer: L["image-viewer"],
  signIn: L["sign-in-form"],
  pricing: L["pricing-table"],
  message: L["message-bubble"],
  chatThread: L["chat-thread"],
  streaming: L["streaming-text"],
  composer: L["prompt-composer"],
  reasoning: L["reasoning-trace"],
  toolCall: L["tool-call-card"],
  chips: L["suggestion-chips"],
  approval: L["approval-card"],
  plan: L["plan-list"],
  status: L["agent-status"],
  diff: L["diff-review"],
  terminal: L["terminal-output"],
};

const nf = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const EDITORS = "Claude Code, Cursor, Codex, Windsurf, Antigravity";

/* -------------------------------------------------------------------------- */
/* Foundation tiles: real components, scaled to fit                           */
/* -------------------------------------------------------------------------- */

function DialogTile() {
  const [open, setOpen] = useState(false);
  const Button = L.button;
  const Dialog = L.dialog;
  return (
    <>
      <Button {...S} label="Open dialog" variant="secondary" onClick={() => setOpen(true)} />
      <Dialog {...S} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const TILES: Record<string, Tile> = {
  button: {
    w: 300, dh: 120, keywords: "action cta submit",
    node: () => (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <L.button {...S} label="Continue" />
        <L.button {...S} label="Secondary" variant="secondary" />
        <L.button {...S} label="Ghost" variant="ghost" />
        <L.button {...S} label="Delete" variant="destructive" />
      </div>
    ),
  },
  badge: {
    w: 300, dh: 90, keywords: "tag status label chip",
    node: () => (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <L.badge {...S} label="Live" tone="success" dot />
        <L.badge {...S} label="New" tone="accent" />
        <L.badge {...S} label="Degraded" tone="warning" dot />
        <L.badge {...S} label="Failed" tone="danger" dot />
      </div>
    ),
  },
  "text-input": { w: 280, dh: 110, keywords: "field form email", node: () => <div className="w-full"><X.textInput {...S} /></div> },
  switch: { w: 300, dh: 90, keywords: "toggle setting", node: () => <L.switch {...S} checked /> },
  checkbox: { w: 300, dh: 90, keywords: "form check", node: () => <L.checkbox {...S} checked /> },
  "segmented-control": { w: 280, dh: 80, keywords: "toggle choice", node: () => <X.segmented {...S} /> },
  tabs: { w: 340, dh: 150, keywords: "navigation", node: () => <div className="w-full"><L.tabs {...S} /></div> },
  "dropdown-menu": { w: 300, dh: 280, keywords: "menu actions", node: () => <div className="self-start pt-2"><X.dropdown {...S} defaultOpen showResult={false} /></div> },
  dialog: { w: 300, dh: 110, noFit: true, keywords: "modal overlay", node: () => <DialogTile /> },
  tooltip: { w: 300, dh: 130, keywords: "hint overlay", node: () => <L.tooltip {...S} forceOpen /> },
  toast: { w: 340, dh: 90, keywords: "notification", node: () => <div className="w-full"><L.toast {...S} duration={0} /></div> },
  alert: { w: 380, dh: 150, keywords: "banner message", node: () => <div className="w-full"><L.alert {...S} dismissible={false} actionLabel="" /></div> },
  card: { w: 340, dh: 190, keywords: "container", node: () => <div className="w-full"><L.card {...S} /></div> },
  "data-table": {
    w: 460, dh: 260, keywords: "grid rows sort select",
    node: () => (
      <div className="w-full">
        <X.dataTable {...S} density="compact" rows={[
          { customer: "Acme Corp", plan: "Team", status: "Active", mrr: 1240 },
          { customer: "Northwind", plan: "Business", status: "Active", mrr: 4800 },
          { customer: "Globex", plan: "Team", status: "Trial", mrr: 0 },
          { customer: "Initech", plan: "Starter", status: "Churned", mrr: 0 },
        ]} />
      </div>
    ),
  },
  "split-pane": { w: 440, dh: 230, keywords: "resize panels layout", node: () => <div className="w-full"><X.splitPane {...S} height={220} /></div> },
  "scroll-area": { w: 340, dh: 230, keywords: "list overflow layout", node: () => <div className="w-full"><X.scrollArea {...S} height={220} /></div> },
  carousel: { w: 420, dh: 230, keywords: "slider slides media", node: () => <div className="w-full"><L.carousel {...S} height={220} /></div> },
  "image-viewer": { w: 420, dh: 110, noFit: true, keywords: "lightbox gallery zoom media", node: () => <div className="w-full"><X.imageViewer {...S} /></div> },
  "sign-in-form": { w: 360, dh: 410, keywords: "login auth signup form", node: () => <div className="w-full"><X.signIn {...S} showProvider={false} /></div> },
  "pricing-table": {
    w: 300, dh: 500, keywords: "plans billing subscription",
    node: () => (
      <div className="w-full">
        <X.pricing {...S} highlight={0} plans={[{ name: "Team", price: 24, description: "For small teams shipping every week.", features: "Unlimited projects; 1 TB bandwidth; Shared environment variables; Audit history", cta: "Start 14-day trial" }]} />
      </div>
    ),
  },
  "message-bubble": {
    w: 380, dh: 160, keywords: "chat ai assistant",
    node: () => (
      <div className="flex w-full flex-col gap-4">
        <X.message {...S} role="user" text="Summarize the Q3 report." timestamp="10:41" />
        <X.message {...S} text="Revenue grew 12% on the quarter, led by the enterprise tier." timestamp="10:42" showActions={false} />
      </div>
    ),
  },
  "chat-thread": { w: 380, dh: 260, keywords: "conversation chat ai", node: () => <div className="w-full"><X.chatThread {...S} height={250} /></div> },
  "streaming-text": { w: 360, dh: 120, keywords: "typing llm ai", node: () => <div className="w-full"><X.streaming {...S} /></div> },
  "prompt-composer": { w: 420, dh: 120, keywords: "input chat ai message", node: () => <div className="w-full"><X.composer {...S} /></div> },
  "reasoning-trace": { w: 380, dh: 170, keywords: "thinking ai steps", node: () => <div className="w-full"><X.reasoning {...S} /></div> },
  "tool-call-card": { w: 400, dh: 240, keywords: "agent function call ai", node: () => <div className="w-full"><X.toolCall {...S} /></div> },
  "suggestion-chips": { w: 400, dh: 90, keywords: "follow up prompts ai chat", node: () => <X.chips {...S} /> },
  "approval-card": { w: 420, dh: 230, keywords: "human in the loop agent ai confirm", node: () => <div className="w-full"><X.approval {...S} /></div> },
  "plan-list": { w: 380, dh: 230, keywords: "tasks steps progress agent ai", node: () => <div className="w-full"><X.plan {...S} /></div> },
  "agent-status": {
    w: 300, dh: 100, keywords: "state agent ai",
    node: () => (
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <X.status {...S} state="thinking" />
        <X.status {...S} state="waiting" />
        <X.status {...S} state="idle" />
        <X.status {...S} state="error" />
      </div>
    ),
  },
  "diff-review": {
    w: 460, dh: 350, keywords: "code changes accept reject agent ai",
    node: () => (
      <div className="w-full">
        <X.diff {...S} hunks={[
          { title: "Rename for clarity", before: "const n = failed.length", after: "const failedCount = failed.length" },
          { title: "Retry with backoff", before: "await charge(account)", after: "await retry(() => charge(account), { max: 3 })" },
        ]} />
      </div>
    ),
  },
  "terminal-output": { w: 460, dh: 250, keywords: "logs command console agent ai", node: () => <div className="w-full"><X.terminal {...S} height={240} /></div> },
};

/** Most legible and most useful first, so the top of the grid earns attention. */
const PRIORITY = [
  "data-table", "button", "approval-card", "sign-in-form", "diff-review", "tabs", "prompt-composer", "carousel",
  "alert", "message-bubble", "split-pane", "text-input", "tool-call-card", "dropdown-menu", "pricing-table",
];

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

/** How many masonry columns fit, and how wide each is. SSR assumes three. */
function useColumns(ref: { current: HTMLElement | null }) {
  const [state, setState] = useState({ cols: 3, width: 360 });
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const cols = Math.max(1, Math.min(5, Math.floor((w + GAP) / (MIN_COL + GAP))));
      const width = (w - GAP * (cols - 1)) / cols;
      setState((s) => (s.cols === cols && Math.abs(s.width - width) < 1 ? s : { cols, width }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return state;
}

function useNearViewport<T extends HTMLElement>(margin = "500px") {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen] as const;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: leave the label as is */
    }
  };
  return { copied, copy };
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function Icon({ name, className = "" }: { name: "arrow" | "search" | "copy" | "check" | "flame" | "lock"; className?: string }) {
  const paths = {
    arrow: <path d="M3.5 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
    search: (
      <>
        <circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m10.4 10.4 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
    copy: (
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
        <path d="M10.5 3.2H4.2a1 1 0 0 0-1 1v6.3" strokeLinecap="round" />
      </g>
    ),
    check: <path d="M3 8.4 6.4 11.6 13 4.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />,
    lock: (
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <rect x="3.2" y="7" width="9.6" height="6.6" rx="1.6" />
        <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" strokeLinecap="round" />
      </g>
    ),
    flame: <path d="M8 1.8c.3 2-1.6 3-1.6 4.9a1.9 1.9 0 0 0 3.8 0c0-.7-.2-1.2-.5-1.7 1.9 1 3 2.6 3 4.7a4.7 4.7 0 0 1-9.4 0C3.3 6.5 6 5.2 8 1.8Z" fill="currentColor" />,
  }[name];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={className}>
      {paths}
    </svg>
  );
}

function LibTag({ kind }: { kind: Kind }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#a5a7a9]">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${kind === "animation" ? "bg-[#fa7319]" : "bg-[#9aa0ff]"}`} />
      {kind === "animation" ? "Animation" : "Foundation"}
    </span>
  );
}

function CopyPrompt({ name, locked = false, onLocked, className = "" }: { name: string; locked?: boolean; onLocked?: () => void; className?: string }) {
  const { copied, copy } = useCopy();
  return (
    <>
      <button
        type="button"
        onClick={() => (locked ? onLocked?.() : copy(`Using originkit MCP, get me the ${name} component.`))}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-[#0f0f10]/85 px-3 text-[12px] font-medium text-[#f7f7f7] backdrop-blur-md transition-colors hover:bg-[#f7f7f7] hover:text-[#141413] ${FOCUS} ${className}`}
      >
        <Icon name={locked ? "lock" : copied ? "check" : "copy"} className="h-3.5 w-3.5" />
        {locked ? "Unlock with Pro" : copied ? "Copied" : "Copy prompt"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? `Prompt for ${name} copied` : ""}
      </span>
    </>
  );
}

/** Renders a component at its design size and scales it down to fit a narrow column. */
function Fit({ tile, children }: { tile: Tile; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [avail, setAvail] = useState(tile.w);
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setAvail(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (tile.noFit) {
    return (
      <div ref={ref} className="flex w-full items-center justify-center" style={{ height: tile.dh }}>
        {children}
      </div>
    );
  }
  const scale = Math.min(1, avail / tile.w);
  return (
    <div ref={ref} className="relative w-full" style={{ height: tile.dh * scale }}>
      <div
        className="absolute top-0 flex items-center justify-center"
        style={{
          width: tile.w,
          height: tile.dh,
          left: Math.max(0, (avail - tile.w * scale) / 2),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function estimateHeight(item: Item, colWidth: number) {
  if (item.kind === "animation") return colWidth * 0.75 + CAPTION;
  const t = item.tile as Tile;
  const inner = colWidth - 32;
  return (t.noFit ? t.dh : t.dh * Math.min(1, inner / t.w)) + 32 + CAPTION;
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                      */
/* -------------------------------------------------------------------------- */

function AnimationPreview({ item, onLocked }: { item: Item; onLocked?: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  const reduced = useReducedMotion();
  return (
    <Link
      href={item.href}
      aria-label={onLocked ? `${item.title}, Pro. Upgrade to open` : `Open ${item.title}`}
      onClick={onLocked}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className={`relative block aspect-[4/3] overflow-hidden bg-[#0b0b0c] ${FOCUS}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
      {hover && item.video && !reduced && (
        <video src={item.video} autoPlay muted loop playsInline preload="none" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      )}
    </Link>
  );
}

function Card({ item, colWidth }: { item: Item; colWidth: number }) {
  const [ref, seen] = useNearViewport<HTMLDivElement>();
  const tile = item.tile;
  const foundation = item.kind === "foundation";
  const auth = useOptionalAuth();
  const upgrade = useUpgradeGate();
  // Same rule the gallery uses: a Pro item is locked once we know the viewer is not on a paid plan.
  const locked = Boolean(item.paid) && auth?.isPaidPlan === false;
  const openLocked = (e?: { preventDefault: () => void; stopPropagation: () => void }) => {
    e?.preventDefault();
    e?.stopPropagation();
    upgrade?.openUpgrade({ name: item.name, displayName: item.title, kind: "component" });
  };

  return (
    <article className="group relative overflow-hidden rounded-xl border border-[#2d2d2f] bg-[#131415] transition-colors hover:border-[#4a4c4e]">
      <div ref={ref} className="relative">
        {foundation && tile ? (
          <div className="bg-[#101011] p-4">{seen ? <Fit tile={tile}>{tile.node()}</Fit> : <div style={{ height: tile.noFit ? tile.dh : tile.dh * Math.min(1, (colWidth - 32) / tile.w) }} />}</div>
        ) : (
          <AnimationPreview item={item} onLocked={locked ? openLocked : undefined} />
        )}

        {item.trending && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#fa7319] px-2.5 py-1 text-[11px] font-semibold text-[#141413]">
            <Icon name="flame" className="h-3 w-3" />
            Trending
          </span>
        )}
        <div className="absolute right-2.5 top-2.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <CopyPrompt name={item.name} locked={locked} onLocked={() => openLocked()} />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 px-3.5 pb-3.5 pt-3">
        <div className="min-w-0">
          <Link href={item.href} onClick={locked ? openLocked : undefined} className={`block truncate rounded text-[14px] font-medium tracking-[-0.01em] text-[#f7f7f7] hover:underline ${FOCUS}`}>
            {item.title}
          </Link>
          <div className="mt-1 flex items-center gap-2.5">
            <LibTag kind={item.kind} />
            <span className="truncate text-[12px] text-[#7a7c7f]">{item.tag}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-[11.5px] text-[#7a7c7f]">
          {item.paid && (
            <span className="inline-flex items-center gap-1 rounded border border-[#4a4c4e] px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-[#b7b7b8]">
              {locked && <Icon name="lock" className="h-2.5 w-2.5" />}Pro
            </span>
          )}
          {!item.paid && item.copies ? <span title="Copies">{compact.format(item.copies)} copies</span> : null}
          {!item.paid && !item.copies && item.views ? <span title="Views">{compact.format(item.views)} views</span> : null}
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

const SUGGESTIONS = ["Button", "Data table", "Chat", "Background", "Text", "Loader"];

function Header({
  query,
  setQuery,
  total,
  inputRef,
  proof,
}: {
  query: string;
  setQuery: (q: string) => void;
  total: number;
  inputRef: { current: HTMLInputElement | null };
  proof: string[];
}) {
  return (
    <header className="px-6 pb-7 pt-9 text-center sm:px-10 sm:pt-12 2xl:px-16">
      <div className="mx-auto max-w-[900px]">
        <h1 className="text-balance text-[clamp(30px,3.7vw,54px)] font-semibold leading-[1.05] tracking-[-0.035em] text-[#f7f7f7]">
          Every component your product needs.
        </h1>
        <p className="mx-auto mt-3 max-w-[40rem] text-[16px] leading-[1.5] text-[#a5a7a9]">
          Preview them live, then copy one into Framer or let your editor add it for you.
        </p>

        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="relative mx-auto mt-6 max-w-[640px]"
        >
          <label htmlFor="library-search" className="sr-only">
            Search components
          </label>
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#7a7c7f]" />
          <input
            ref={inputRef}
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder={`Search ${nf.format(total)} components`}
            autoComplete="off"
            className={`h-12 w-full rounded-full border border-[#2d2d2f] bg-[#131415] pl-12 pr-16 text-[16px] text-[#f7f7f7] placeholder:text-[#6f7173] focus:border-[#fa7319] ${FOCUS}`}
          />
          <kbd className={`${MONO} pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border border-[#2d2d2f] px-1.5 py-0.5 text-[11px] text-[#6f7173] sm:block`}>/</kbd>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[13px] text-[#7a7c7f]">Popular</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuery(s)}
              className={`h-8 rounded-full border border-[#2d2d2f] px-3.5 text-[13px] text-[#c9cacb] transition-colors hover:border-[#4a4c4e] hover:bg-[#1a1b1c] hover:text-white ${FOCUS}`}
            >
              {s}
            </button>
          ))}
        </div>

        {proof.length > 0 && <p className="mt-5 text-[13px] text-[#7a7c7f]">{proof.join("  ·  ")}</p>}
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Explorer: tabs, chips, masonry                                             */
/* -------------------------------------------------------------------------- */

function Explorer({
  data,
  query,
  setQuery,
}: {
  data: LandingData;
  query: string;
  setQuery: (q: string) => void;
}) {
  const { foundation, animation } = data;
  const [tab, setTab] = useState<"all" | Kind>("all");
  const [chip, setChip] = useState<string | null>(null);
  const [access, setAccess] = useState<"all" | "free" | "pro">("all");
  const [shown, setShown] = useState(PAGE);
  const grid = useRef<HTMLDivElement | null>(null);
  const { cols, width } = useColumns(grid);

  const items = useMemo(() => {
    const titleOf = new Map(foundation.groups.map((g) => [g.id, g.title]));
    const rank = (n: string) => {
      const i = PRIORITY.indexOf(n);
      return i === -1 ? 999 : i;
    };
    const f: Item[] = foundation.groups
      .flatMap((g) =>
        g.names.map((n) => {
          const tile = TILES[n.name];
          return {
            id: `f-${n.name}`,
            kind: "foundation" as const,
            name: n.name,
            title: n.displayName,
            tag: g.id === "foundations" ? "Basics" : (titleOf.get(g.id) ?? g.title),
            tagId: g.id,
            href: `/core#${n.name}`,
            search: `${n.displayName} ${g.title} foundation ${tile?.keywords ?? ""}`.toLowerCase(),
            tile,
          };
        }),
      )
      .filter((i) => i.tile)
      .sort((a, b) => rank(a.name) - rank(b.name));
    const a: Item[] = animation.items.map((e) => ({
      id: `a-${e.name}`,
      kind: "animation" as const,
      name: e.name,
      title: e.displayName,
      tag: e.category,
      tagId: e.categoryId,
      href: site(`/components/${e.name}`),
      search: `${e.displayName} ${e.category} animation animated`.toLowerCase(),
      image: e.image,
      video: e.video,
      views: e.views,
      copies: e.copies,
      paid: e.paid,
      trending: e.trending,
    }));
    return { f, a };
  }, [foundation.groups, animation.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keep = (i: Item) =>
      (!chip || i.tagId === chip) &&
      (!q || i.search.includes(q)) &&
      (access === "all" || (access === "pro") === Boolean(i.paid));
    const f = tab === "animation" ? [] : items.f.filter(keep);
    const a = tab === "foundation" ? [] : items.a.filter(keep);
    // Alternate the two libraries so both show from the first row.
    const mixed: Item[] = [];
    for (let i = 0; i < Math.max(f.length, a.length); i++) {
      if (a[i]) mixed.push(a[i]);
      if (f[i]) mixed.push(f[i]);
    }
    return mixed;
  }, [items, tab, chip, query, access]);

  useEffect(() => setShown(PAGE), [tab, chip, query, access]);
  useEffect(() => setChip(null), [tab]);

  const visible = filtered.slice(0, shown);
  const columns = useMemo(() => {
    const out: Item[][] = Array.from({ length: cols }, () => []);
    const heights = Array(cols).fill(0) as number[];
    for (const item of visible) {
      const c = heights.indexOf(Math.min(...heights));
      out[c].push(item);
      heights[c] += estimateHeight(item, width) + GAP;
    }
    return out;
  }, [visible, cols, width]);

  const chips =
    tab === "foundation"
      ? foundation.groups.map((g) => ({ id: g.id, label: g.title }))
      : tab === "animation"
        ? animation.categories.filter((c) => items.a.some((i) => i.tagId === c.id)).map((c) => ({ id: c.id, label: c.label }))
        : [];

  const searching = query.trim().length > 0;
  const remaining = filtered.length - visible.length;
  const showAllCard = tab !== "foundation" && !chip && !searching && animation.total > 0 && remaining === 0;

  return (
    <section aria-label="Browse components" className="px-6 pb-24 sm:px-10 2xl:px-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented
          label="Library"
          value={tab}
          options={[
            { value: "all", label: "All" },
            { value: "foundation", label: `Foundation ${foundation.total}` },
            { value: "animation", label: `Animation ${animation.total ? nf.format(animation.total) : ""}`.trim() },
          ]}
          onChange={setTab}
        />
        {animation.paidTotal > 0 && (
          <Segmented
            label="Access"
            value={access}
            options={[
              { value: "all", label: "Any access" },
              { value: "free", label: "Free" },
              { value: "pro", label: `Pro ${nf.format(animation.paidTotal)}` },
            ]}
            onChange={setAccess}
          />
        )}
        </div>
        <p className="text-[13px] text-[#7a7c7f]" aria-live="polite">
          {filtered.length === 0
            ? "No matches"
            : `Showing ${visible.length} of ${filtered.length}${tab !== "foundation" && !searching && animation.total ? ` · the most popular of ${nf.format(animation.total)} animation components` : ""}`}
        </p>
      </div>

      {chips.length > 0 && (
        <div className="-mx-6 mt-4 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" style={{ scrollbarWidth: "none" }}>
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={chip === c.id}
              onClick={() => setChip(chip === c.id ? null : c.id)}
              className={`h-8 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors ${FOCUS} ${
                chip === c.id
                  ? "border-[#f7f7f7] bg-[#f7f7f7] text-[#141413]"
                  : "border-[#2d2d2f] text-[#c9cacb] hover:border-[#4a4c4e] hover:bg-[#1a1b1c]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div ref={grid} className="mt-6 flex items-start gap-4">
        {columns.map((col, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
            {col.map((item) => (
              <Card key={item.id} item={item} colWidth={width} />
            ))}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mx-auto mt-6 max-w-[460px] rounded-2xl border border-[#2d2d2f] px-8 py-12 text-center">
          <p className="text-[17px] font-medium text-[#f7f7f7]">Nothing matches “{query}”</p>
          <p className="mt-2 text-[14px] leading-[1.55] text-[#8a8c8f]">
            Try a broader word, like “table” or “background”. This page shows the most popular animation components;
            the full gallery has all {animation.total ? nf.format(animation.total) : "of them"}.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={() => setQuery("")} className={`h-10 rounded-full border border-[#3e3f40] px-5 text-[14px] font-medium text-[#f7f7f7] hover:bg-[#1f2021] ${FOCUS}`}>
              Clear search
            </button>
            <Link href={site("/")} className={`inline-flex h-10 items-center rounded-full bg-[#f7f7f7] px-5 text-[14px] font-medium text-[#141413] ${FOCUS}`}>
              Browse the gallery
            </Link>
          </div>
        </div>
      )}

      {animation.paidTotal > 0 && filtered.length > 0 && (
        <aside className="mt-12 flex flex-col gap-5 rounded-2xl border border-[#2d2d2f] bg-[#101011] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-[44rem]">
            <p className="text-[17px] font-semibold tracking-[-0.02em] text-[#f7f7f7]">
              Start free. Go Pro when you want the rest.
            </p>
            <p className="mt-2 text-[14.5px] leading-[1.6] text-[#a5a7a9]">
              Pro unlocks the {nf.format(animation.paidTotal)} Pro components, plus premium sections and templates, with higher copy limits.
              Code you have already copied stays yours if you ever cancel.
            </p>
          </div>
          <Link href={site("/pricing")} className={`inline-flex h-11 shrink-0 items-center gap-2.5 self-start rounded-full bg-[#f7f7f7] px-5 text-[14.5px] font-medium text-[#141413] transition-colors hover:bg-white sm:self-center ${FOCUS}`}>
            See plans
            <Icon name="arrow" />
          </Link>
        </aside>
      )}

      <div className="mt-10 flex flex-col items-center gap-4">
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setShown((n) => n + MORE)}
            className={`h-11 rounded-full border border-[#3e3f40] px-6 text-[14px] font-medium text-[#f7f7f7] transition-colors hover:bg-[#1f2021] ${FOCUS}`}
          >
            Show {Math.min(MORE, remaining)} more
          </button>
        )}
        {showAllCard && (
          <Link
            href={site("/")}
            className={`group inline-flex items-center gap-3 rounded-full bg-[#fa7319] px-6 py-3 text-[15px] font-semibold text-[#141413] transition-colors hover:bg-[#ff8a3d] ${FOCUS}`}
          >
            Browse all {nf.format(animation.total)} animation components
            <Icon name="arrow" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Below the grid                                                             */
/* -------------------------------------------------------------------------- */

function Check() {
  return <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-[#3dd68c]" />;
}

function Libraries({ data }: { data: LandingData }) {
  const { foundation, animation } = data;
  const pct = Math.round((foundation.total / foundation.planned) * 100);
  const cardCls = "flex flex-col rounded-2xl border border-[#2d2d2f] bg-[#101011] p-7 sm:p-9";
  return (
    <section aria-labelledby="libraries-h" className="border-t border-[#232526] px-6 py-24 sm:px-10 2xl:px-16">
      <div className="mx-auto max-w-[1200px]">
        <h2 id="libraries-h" className="max-w-[26ch] text-[clamp(28px,3.2vw,44px)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#f7f7f7]">
          Two libraries, built to be used together.
        </h2>
        <p className="mt-4 max-w-[38rem] text-[16px] leading-[1.6] text-[#a5a7a9]">
          Start with Foundation for the structure of a product, then add Animation where a moment deserves attention.
        </p>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <article className={cardCls}>
            <LibTag kind="foundation" />
            <h3 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-[#f7f7f7]">Foundation</h3>
            <p className="mt-2 text-[15px] leading-[1.6] text-[#a5a7a9]">The everyday UI every product needs, plus the parts agent products need.</p>
            <ul className="mt-6 flex flex-col gap-3 text-[14.5px] leading-[1.5] text-[#c9cacb]">
              <li className="flex gap-3"><Check />{foundation.groups.length} types, from buttons and forms to tables and page patterns</li>
              <li className="flex gap-3"><Check />Chat, approval, and diff review for agent products</li>
              <li className="flex gap-3"><Check />Dark and light, one accent color, keyboard support, reduced motion</li>
            </ul>
            <div className="mt-8">
              <div className="flex items-baseline justify-between text-[13px] text-[#8a8c8f]">
                <span>{foundation.total} of {foundation.planned} planned components built</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div role="progressbar" aria-label="Foundation components built" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#232526]">
                <div className="h-full rounded-full bg-[#9aa0ff]" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Link href="/core" className={`mt-8 inline-flex h-11 items-center gap-2.5 self-start rounded-full bg-[#f7f7f7] px-5 text-[14.5px] font-medium text-[#141413] transition-colors hover:bg-white ${FOCUS}`}>
              Explore Foundation
              <Icon name="arrow" />
            </Link>
          </article>

          <article className={cardCls}>
            <LibTag kind="animation" />
            <h3 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-[#f7f7f7]">Animation</h3>
            <p className="mt-2 text-[15px] leading-[1.6] text-[#a5a7a9]">Effects, backgrounds, and details to put on top of a finished page.</p>
            <ul className="mt-6 flex flex-col gap-3 text-[14.5px] leading-[1.5] text-[#c9cacb]">
              <li className="flex gap-3"><Check />{animation.total ? `${nf.format(animation.total)} components in ${animation.categories.length} categories` : "Backgrounds, text effects, cursors, loaders"}</li>
              <li className="flex gap-3"><Check />Live previews, with a tweak panel on every component page</li>
              <li className="flex gap-3"><Check />Framer-safe by spec, so what you preview is what ships</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-2">
              {animation.categories.slice(0, 5).map((c) => (
                <Link key={c.id} href={site(`/category/${encodeURIComponent(c.id)}`)} className={`rounded-full border border-[#2d2d2f] px-3 py-1.5 text-[12.5px] text-[#c9cacb] transition-colors hover:border-[#4a4c4e] hover:bg-[#1a1b1c] ${FOCUS}`}>
                  {c.label} <span className="text-[#7a7c7f]">{nf.format(c.count)}</span>
                </Link>
              ))}
            </div>
            <Link href={site("/")} className={`mt-8 inline-flex h-11 items-center gap-2.5 self-start rounded-full bg-[#fa7319] px-5 text-[14.5px] font-semibold text-[#141413] transition-colors hover:bg-[#ff8a3d] ${FOCUS}`}>
              Browse Animation
              <Icon name="arrow" />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}


/* -------------------------------------------------------------------------- */
/* Whole pages: templates and sections                                        */
/* -------------------------------------------------------------------------- */

function TemplateCard({ t }: { t: LandingData["pages"]["templates"]["items"][number] }) {
  const auth = useOptionalAuth();
  const upgrade = useUpgradeGate();
  const locked = t.paid && auth?.isPaidPlan === false;
  return (
    <li className="w-[230px] shrink-0 snap-start sm:w-[260px]">
      <Link
        href={site(`/templates/${t.slug}`)}
        onClick={
          locked
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                upgrade?.openUpgrade({ name: t.slug, displayName: t.name, kind: "template" });
              }
            : undefined
        }
        className={`group block rounded-xl ${FOCUS}`}
        aria-label={locked ? `${t.name} template, Pro. Upgrade to open` : `Open ${t.name} template`}
      >
        <div className="relative aspect-[475/548] overflow-hidden rounded-xl border border-[#2d2d2f] bg-[#101011] transition-colors group-hover:border-[#4a4c4e]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.image} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
          {t.paid && (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#0f0f10]/85 px-2.5 py-1 text-[11px] font-semibold text-[#f7f7f7] backdrop-blur-md">
              <Icon name="lock" className="h-3 w-3" />
              Pro
            </span>
          )}
        </div>
        <div className="mt-3">
          <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-[#f7f7f7]">{t.name}</span>
          <span className="mt-0.5 block truncate text-[12px] text-[#7a7c7f]">
            {t.pages} {t.pages === 1 ? "page" : "pages"}
            {t.tech.length ? ` · ${t.tech.join(", ")}` : ""}
          </span>
        </div>
      </Link>
    </li>
  );
}

function WholePages({ data }: { data: LandingData["pages"] }) {
  const { templates, sections } = data;
  if (!templates.total && !sections.total) return null;
  const proCount = templates.paid + sections.paid;
  return (
    <section aria-labelledby="pages-h" className="border-t border-[#232526] px-6 py-24 sm:px-10 2xl:px-16">
      <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="max-w-[44rem]">
          <p className={`${MONO} text-[11px] uppercase tracking-[0.14em] text-[#7a7c7f]`}>Beyond components</p>
          <h2 id="pages-h" className="mt-3 text-balance text-[clamp(28px,3.4vw,48px)] font-semibold leading-[1.08] tracking-[-0.035em] text-[#f7f7f7]">
            Start with parts. Ship with whole pages.
          </h2>
          <p className="mt-4 text-[16px] leading-[1.6] text-[#a5a7a9]">
            {templates.total ? `${nf.format(templates.total)} complete templates` : ""}
            {templates.total && sections.total ? " and " : ""}
            {sections.total ? `${nf.format(sections.total)} page sections` : ""}, ready to drop into a project.
            {proCount > 0 ? " Pro includes them, with higher copy limits." : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {templates.total > 0 && (
            <Link href={site("/templates")} className={`inline-flex h-11 items-center gap-2.5 rounded-full bg-[#f7f7f7] px-5 text-[14.5px] font-medium text-[#141413] transition-colors hover:bg-white ${FOCUS}`}>
              Browse templates <Icon name="arrow" />
            </Link>
          )}
          {sections.total > 0 && (
            <Link href={site("/sections")} className={`inline-flex h-11 items-center rounded-full border border-[#3e3f40] px-5 text-[14.5px] font-medium text-[#f7f7f7] transition-colors hover:bg-[#1f2021] ${FOCUS}`}>
              Browse sections
            </Link>
          )}
        </div>
      </div>

      {templates.items.length > 0 && (
        <ul
          tabIndex={0}
          aria-label="Templates"
          className={`-mx-6 mt-10 flex snap-x scroll-px-6 gap-4 overflow-x-auto px-6 pb-4 sm:-mx-10 sm:scroll-px-10 sm:px-10 2xl:-mx-16 2xl:scroll-px-16 2xl:px-16 ${FOCUS}`}
          style={{ scrollbarWidth: "none" }}
        >
          {templates.items.map((t) => (
            <TemplateCard key={t.slug} t={t} />
          ))}
        </ul>
      )}

      {sections.categories.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] text-[#7a7c7f]">Sections by type</span>
          {sections.categories.map((c) => (
            <Link key={c.id} href={site(`/sections/category/${encodeURIComponent(c.id)}`)} className={`rounded-full border border-[#2d2d2f] px-3.5 py-1.5 text-[13px] text-[#c9cacb] transition-colors hover:border-[#4a4c4e] hover:bg-[#1a1b1c] ${FOCUS}`}>
              {c.label} <span className="text-[#7a7c7f]">{nf.format(c.count)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const STEPS = [
  { n: "1", title: "Preview it live", body: "Try any component in the browser. Change props, theme, and accent before you commit to it." },
  { n: "2", title: "Copy it", body: "Copy it into Framer, or copy a one-line prompt that names the component." },
  { n: "3", title: "Your editor does the rest", body: "Through the MCP, your editor adds the file, installs its dependencies, and wires the import." },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how-h" className="border-t border-[#232526] px-6 py-24 sm:px-10 2xl:px-16">
      <div className="mx-auto max-w-[1200px]">
        <h2 id="how-h" className="text-[clamp(28px,3.2vw,44px)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#f7f7f7]">
          From idea to your codebase in three steps.
        </h2>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl border border-[#2d2d2f] p-7">
              <span className={`${MONO} flex h-8 w-8 items-center justify-center rounded-full border border-[#3e3f40] text-[13px] text-[#f7f7f7]`}>{s.n}</span>
              <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.02em] text-[#f7f7f7]">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-[#a5a7a9]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "Do the components work in Framer?",
    a: "Yes. Every component follows Framer's custom code rules and exposes its props as property controls, and the same source renders on the website, in Framer, and through the MCP.",
  },
  {
    q: "Can I change colors and corners?",
    a: "Foundation components take theme, accent, and radius props. On the Foundation page you can change them live and copy the result.",
  },
  {
    q: "Which editors can add components for me?",
    a: `${EDITORS}, through the Originkit MCP. Chat apps like Claude and ChatGPT can connect with a custom connector.`,
  },
  {
    q: "What does the Pro tag mean?",
    a: "Components marked Pro need a paid plan to preview, open, or copy. The tag shows on the card before you click, so there are no surprises.",
  },
];

function Faq() {
  return (
    <section aria-labelledby="faq-h" className="border-t border-[#232526] px-6 py-24 sm:px-10 2xl:px-16">
      <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <h2 id="faq-h" className="text-[clamp(28px,3.2vw,44px)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#f7f7f7]">
          Questions, answered.
        </h2>
        <div className="divide-y divide-[#232526] border-y border-[#232526]">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className={`flex cursor-pointer list-none items-center justify-between gap-6 rounded text-[16px] font-medium text-[#f7f7f7] ${FOCUS}`}>
                {f.q}
                <span aria-hidden className="text-[20px] leading-none text-[#7a7c7f] transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[40rem] text-[14.5px] leading-[1.65] text-[#a5a7a9]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  const { copied, copy } = useCopy();
  const prompt = "Using originkit MCP, get me the data-table component.";
  return (
    <section aria-labelledby="cta-h" className="border-t border-[#232526] px-6 pb-32 pt-24 sm:px-10 2xl:px-16">
      <div className="mx-auto max-w-[760px] text-center">
        <h2 id="cta-h" className="text-[clamp(30px,3.8vw,54px)] font-semibold leading-[1.08] tracking-[-0.035em] text-[#f7f7f7]">
          Connect once. Then just ask for the component.
        </h2>
        <div className="mx-auto mt-8 flex max-w-[600px] items-center justify-between gap-4 rounded-xl border border-[#2d2d2f] bg-[#101011] py-3 pl-5 pr-3 text-left">
          <code className={`${MONO} min-w-0 overflow-x-auto whitespace-nowrap text-[13.5px] text-[#f7f7f7]`}>{prompt}</code>
          <button
            type="button"
            onClick={() => copy(prompt)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#3e3f40] px-3.5 text-[13px] font-medium text-[#f7f7f7] hover:bg-[#1f2021] ${FOCUS}`}
          >
            <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={site("/connect")} className={`inline-flex h-12 items-center gap-2.5 rounded-full bg-[#f7f7f7] px-6 text-[15px] font-medium text-[#141413] transition-colors hover:bg-white ${FOCUS}`}>
            Connect your editor
            <Icon name="arrow" />
          </Link>
          <Link href={site("/intro")} className={`inline-flex h-12 items-center rounded-full border border-[#3e3f40] px-6 text-[15px] font-medium text-[#f7f7f7] transition-colors hover:bg-[#1f2021] ${FOCUS}`}>
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function Landing({ data }: { data: LandingData }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement | null>(null);

  // "/" jumps to search, the way most galleries do.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? "");
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Only facts we can back: counts from the catalogue and the real copy total.
  const { total: animTotal, paidTotal, copiesTotal } = data.animation;
  const proof: string[] = [];
  if (animTotal) proof.push(`${nf.format(animTotal - paidTotal + data.foundation.total)} free to use`);
  if (paidTotal) proof.push(`${nf.format(paidTotal)} Pro`);
  if (data.pages.templates.paid) proof.push(`${nf.format(data.pages.templates.paid)} Pro templates`);
  if (copiesTotal >= 1000) proof.push(`copied ${compact.format(copiesTotal)} times`);

  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full">
        <Header query={query} setQuery={setQuery} total={data.foundation.total + data.animation.total} inputRef={input} proof={proof} />
        <Explorer data={data} query={query} setQuery={setQuery} />
        <WholePages data={data.pages} />
        <Libraries data={data} />
        <HowItWorks />
        <Faq />
        <Cta />
      </div>
    </MotionConfig>
  );
}

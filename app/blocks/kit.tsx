"use client";

import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * State kept in localStorage under `key`. Renders with `initial` first (so server and client
 * agree), then adopts the stored value. Storage that throws just means it lasts for this visit.
 */
export function usePersisted<T>(key: string, initial: T, valid?: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      const v = JSON.parse(raw);
      if (!valid || valid(v)) setValue(v as T);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* private mode */
        }
        return v;
      });
    },
    [key],
  );
  return [value, set] as const;
}

/** Close `onClose` when a press lands outside `ref`, or Escape is pressed. */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [ref, active, onClose]);
}

/** True once the page has scrolled, so the sticky header can show an edge. */
export function useScrolled(threshold = 4) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > threshold);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [threshold]);
  return s;
}

/** A demo that throws should lose its own tile, not the page. */
export class DemoBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="img" aria-label={`${this.props.label} could not be shown`} className="grid h-full w-full place-items-center px-6 text-center text-[13px] text-[#84848a]">
        This preview couldn’t load.
      </div>
    );
  }
}

/** A short message at the bottom of the screen, with an optional action. Lives on `body` so it shows over the inspector too. */
export function Toast({ toast, onDone }: { toast: { id: number; message: string; action?: { label: string; run: () => void } } | null; onDone: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onDone, toast.action ? 4200 : 2200);
    return () => window.clearTimeout(t);
  }, [toast, onDone]);
  if (!mounted || !toast) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div key={toast.id} role="status" className="pointer-events-auto flex items-center gap-3 rounded-lg bg-[#232325] py-2.5 pl-4 pr-2.5 text-[14px] text-[#ededee] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
        <span>{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.run();
              onDone();
            }}
            className={`h-8 rounded-md bg-white px-3 text-[13px] font-medium text-black ${FOCUS}`}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

export const SITE = (process.env.NEXT_PUBLIC_ORIGINKIT_SITE_URL ?? "https://www.originkit.dev").replace(/\/$/, "");

/** Copy to the clipboard and report it for a moment, so the button can confirm. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const copy = useCallback(async (text: string, id = "default") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked: leave the label alone */
    }
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { copied, copy };
}

/** True on touch-first devices, where a drag on a tile should scroll the page, not play the demo. */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const on = () => setCoarse(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return coarse;
}

const SOUND_KEY = "originkit.blocks.sound";

/** The global sound-effects switch. Off until someone turns it on, and remembered. */
export function useSoundPref() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(SOUND_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const set = useCallback((next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      /* private mode */
    }
    if (next) confirmCue();
  }, []);
  return { soundOn: on, setSoundOn: set };
}

/** A short two-note chime so turning sound on is itself audible. Runs inside the click that enabled it. */
function confirmCue() {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext; __okAudio?: AudioContext };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return;
    const ctx = (w.__okAudio = w.__okAudio ?? new AC());
    if (ctx.state === "suspended") void ctx.resume();
    const out = ctx.createGain();
    out.gain.value = 0.16;
    out.connect(ctx.destination);
    [[520, 0], [780, 0.08]].forEach(([f, d]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + d;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.16);
    });
  } catch {
    /* audio blocked: stay silent */
  }
}

const SAVED_KEY = "originkit.blocks.saved";

/** Bookmarks kept in this browser. Other tabs stay in sync through the storage event. */
export function useSaved() {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    const read = () => {
      try {
        const v = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
        setSaved(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
      } catch {
        setSaved([]);
      }
    };
    read();
    const on = (e: StorageEvent) => e.key === SAVED_KEY && read();
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
  // Callers may run later (an Undo on a toast), so work from the latest list, not the one they closed over.
  const latest = useRef<string[]>(saved);
  latest.current = saved;
  const write = useCallback((next: string[]) => {
    latest.current = next;
    setSaved(next);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* private mode: the bookmark lasts for this visit only */
    }
  }, []);
  const toggle = useCallback((slug: string) => write(latest.current.includes(slug) ? latest.current.filter((x) => x !== slug) : [...latest.current, slug]), [write]);
  const addAll = useCallback((slugs: string[]) => write([...latest.current, ...slugs.filter((x) => !latest.current.includes(x))]), [write]);
  const clear = useCallback(() => write([]), [write]);
  return { saved, toggle, addAll, clear };
}

export function useViewportWidth() {
  const [w, setW] = useState(1440);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/**
 * True once the element is within `margin` px of the viewport, and stays true until it is
 * `release` px away. The gap matters: demos can own WebGL contexts and timers, and tearing
 * them down the moment they scroll out of range made scrolling back rebuild them (and
 * exhaust the browser's context limit).
 */
export function useNear<T extends HTMLElement>(margin = 500, release = 1800) {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const enter = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: `${margin}px 0px` });
    const leave = new IntersectionObserver(([e]) => !e.isIntersecting && setNear(false), { rootMargin: `${release}px 0px` });
    enter.observe(el);
    leave.observe(el);
    return () => {
      enter.disconnect();
      leave.disconnect();
    };
  }, [margin, release]);
  return { ref, near };
}

/** Most demos a touch device runs at once. Each can own a WebGL context, a canvas and timers. */
export const TOUCH_LIVE_CAP = 4;

const liveHolders = new Map<HTMLElement, () => void>();
const liveWaiting = new Set<() => void>();

/** How far an element's centre is from the middle of the viewport. */
function centreGap(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
}

function claimLive(el: HTMLElement, onLose: () => void) {
  if (liveHolders.has(el)) return true;
  if (liveHolders.size >= TOUCH_LIVE_CAP) {
    // Full: take the slot of whichever holder is furthest from the middle, if it is further than us.
    let worst: HTMLElement | undefined;
    let worstGap = centreGap(el);
    for (const h of Array.from(liveHolders.keys())) {
      const g = centreGap(h);
      if (g > worstGap) {
        worst = h;
        worstGap = g;
      }
    }
    if (!worst) return false;
    const lose = liveHolders.get(worst);
    liveHolders.delete(worst);
    lose?.();
  }
  liveHolders.set(el, onLose);
  return true;
}

/**
 * Lets only the `TOUCH_LIVE_CAP` nearest wanting elements run at once. An element that wants
 * a slot and is full waits, and is retried when a slot frees or the page scrolls.
 */
export function useLiveSlot(ref: { current: HTMLElement | null }, want: boolean) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !want) return;
    let timer: number | undefined;
    const retry = () => {
      if (claimLive(el, lose)) {
        liveWaiting.delete(retry);
        setLive(true);
      }
    };
    const lose = () => {
      setLive(false);
      liveWaiting.add(retry);
    };
    const onScroll = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        if (!liveHolders.has(el)) retry();
      }, 120);
    };
    if (!claimLive(el, lose)) liveWaiting.add(retry);
    else setLive(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      liveWaiting.delete(retry);
      const had = liveHolders.delete(el);
      setLive(false);
      if (had) [...liveWaiting].forEach((f) => f());
    };
  }, [ref, want]);
  return want && live;
}

/**
 * Lay a demo out at a fixed design width and scale it down (never up) to fit its box.
 * Fluid components (width: 100%) need a width to fill, which is what `designWidth` gives them.
 */
export function Fit({
  children,
  designWidth = 480,
  padX = 28,
  padTop = 28,
  padBottom = 28,
  grow = 1,
}: {
  children: ReactNode;
  designWidth?: number;
  padX?: number;
  padTop?: number;
  padBottom?: number;
  /** Most it may scale up. 1 means never larger than its design size. */
  grow?: number;
}) {
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
    const next = Math.min(grow, b.clientWidth / w, b.clientHeight / h);
    setScale((s) => (Math.abs(s - next) < 0.005 ? s : Math.max(next, 0.2)));
  }, [grow]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      ref={box}
      className="absolute flex items-center justify-center"
      style={{ top: padTop, bottom: padBottom, left: padX, right: padX }}
    >
      <div
        ref={inner}
        style={{ width: designWidth, display: "flex", justifyContent: "center", transform: `scale(${scale})`, transformOrigin: "center" }}
      >
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* A small TSX highlighter: enough to make source and snippets scannable.     */
/* -------------------------------------------------------------------------- */

const KEYWORDS =
  "import|export|default|from|const|let|var|function|return|if|else|for|while|of|in|as|type|interface|extends|new|typeof|void|true|false|null|undefined|async|await|switch|case|break|continue|throw|try|catch|finally";

const TOKEN = new RegExp(
  [
    "(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)", // 1 comment
    "(\"(?:[^\"\\\\\\n]|\\\\.)*\"|'(?:[^'\\\\\\n]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)", // 2 string
    `\\b(${KEYWORDS})\\b`, // 3 keyword
    "\\b(\\d+(?:\\.\\d+)?)\\b", // 4 number
    "(<\\/?[A-Za-z][\\w.]*)", // 5 jsx tag
    "\\b([A-Z][A-Za-z0-9]*)\\b", // 6 type or component
  ].join("|"),
  "g",
);

const COLORS = ["", "#6c7078", "#a8d8a0", "#c4a7ff", "#ffb86b", "#7cb7ff", "#ffd479"];

export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of code.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(code.slice(last, at));
    const group = m.findIndex((v, i) => i > 0 && v !== undefined);
    out.push(
      <span key={k++} style={{ color: COLORS[group] }}>
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function Icon({ name, size = 16 }: { name: "close" | "copy" | "check" | "download" | "prev" | "next" | "replay" | "sun" | "moon" | "link" | "reset" | "plus" | "trash" | "up" | "down" | "chevron" | "open" | "soundOn" | "soundOff" | "bookmark" | "bookmarkFilled" | "menu" | "play" | "pause" | "view" | "expand" | "grid2" | "grid3" | "grid4" | "grid5" | "masonry" | "even"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "close":
      return <svg {...p}><path d="m3.5 3.5 9 9M12.5 3.5l-9 9" /></svg>;
    case "copy":
      return <svg {...p}><rect x="5.5" y="5.5" width="8" height="8" rx="1.8" /><path d="M10.5 3.5a1.5 1.5 0 0 0-1.5-1H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 3.5 10.5" /></svg>;
    case "check":
      return <svg {...p}><path d="m3 8.5 3.2 3.2L13 4.6" /></svg>;
    case "download":
      return <svg {...p}><path d="M8 2.5v7.5M4.8 7.2 8 10.4l3.2-3.2M3 13h10" /></svg>;
    case "prev":
      return <svg {...p}><path d="M9.8 3.5 5.3 8l4.5 4.5" /></svg>;
    case "next":
      return <svg {...p}><path d="M6.2 3.5 10.7 8l-4.5 4.5" /></svg>;
    case "replay":
      return <svg {...p}><path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.7M2.6 2.4v2.7h2.7" /></svg>;
    case "sun":
      return <svg {...p}><circle cx="8" cy="8" r="2.6" /><path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M12.4 3.6l-1 1M4.6 11.4l-1 1" /></svg>;
    case "moon":
      return <svg {...p}><path d="M13 9.4A5.4 5.4 0 0 1 6.6 3 5.4 5.4 0 1 0 13 9.4Z" /></svg>;
    case "link":
      return <svg {...p}><path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.7.7M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.7-.7" /></svg>;
    case "reset":
      return <svg {...p}><path d="M3 8a5 5 0 1 1 1.5 3.6M3 12.2v-3h3" /></svg>;
    case "plus":
      return <svg {...p}><path d="M8 3v10M3 8h10" /></svg>;
    case "trash":
      return <svg {...p}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.4 4.5l.6 8.5h6l.6-8.5" /></svg>;
    case "up":
      return <svg {...p}><path d="m4 9.8 4-4 4 4" /></svg>;
    case "down":
      return <svg {...p}><path d="m4 6.2 4 4 4-4" /></svg>;
    case "chevron":
      return <svg {...p}><path d="m6 3.8 4.2 4.2L6 12.2" /></svg>;
    case "open":
      return <svg {...p}><path d="M9.5 2.5h4v4M13.5 2.5 8 8M11.5 9v3.2a1.3 1.3 0 0 1-1.3 1.3H3.8a1.3 1.3 0 0 1-1.3-1.3V5.8a1.3 1.3 0 0 1 1.3-1.3H7" /></svg>;
    case "soundOn":
      return <svg {...p}><path d="M2.5 6.2v3.6h2.4L8.2 12.5v-9L4.9 6.2H2.5Z" /><path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.2 3.8a6 6 0 0 1 0 8.4" /></svg>;
    case "soundOff":
      return <svg {...p}><path d="M2.5 6.2v3.6h2.4L8.2 12.5v-9L4.9 6.2H2.5Z" /><path d="m10.6 6 3 4M13.6 6l-3 4" /></svg>;
    case "bookmark":
      return <svg {...p}><path d="M4.2 2.8h7.6a.7.7 0 0 1 .7.7v9.6a.4.4 0 0 1-.65.3L8 10.4l-3.85 3a.4.4 0 0 1-.65-.3V3.5a.7.7 0 0 1 .7-.7Z" /></svg>;
    case "bookmarkFilled":
      return <svg {...p} fill="currentColor"><path d="M4.2 2.8h7.6a.7.7 0 0 1 .7.7v9.6a.4.4 0 0 1-.65.3L8 10.4l-3.85 3a.4.4 0 0 1-.65-.3V3.5a.7.7 0 0 1 .7-.7Z" /></svg>;
    case "menu":
      return <svg {...p}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>;
    case "play":
      return <svg {...p} fill="currentColor"><path d="M5 3.4v9.2a.5.5 0 0 0 .76.42l7.4-4.6a.5.5 0 0 0 0-.85l-7.4-4.6A.5.5 0 0 0 5 3.4Z" /></svg>;
    case "pause":
      return <svg {...p} fill="currentColor"><rect x="4" y="3" width="2.8" height="10" rx="0.8" /><rect x="9.2" y="3" width="2.8" height="10" rx="0.8" /></svg>;
    case "view":
      return <svg {...p}><path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" /><circle cx="10" cy="4.5" r="1.5" /><circle cx="6" cy="11.5" r="1.5" /></svg>;
    case "expand":
      return <svg {...p}><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" /></svg>;
    case "masonry":
      return <svg {...p}><rect x="2" y="2" width="5" height="7" rx="1.2" /><rect x="9" y="2" width="5" height="4" rx="1.2" /><rect x="2" y="11" width="5" height="3" rx="1.2" /><rect x="9" y="8" width="5" height="6" rx="1.2" /></svg>;
    case "even":
      return <svg {...p}><rect x="2" y="2" width="5" height="5" rx="1.2" /><rect x="9" y="2" width="5" height="5" rx="1.2" /><rect x="2" y="9" width="5" height="5" rx="1.2" /><rect x="9" y="9" width="5" height="5" rx="1.2" /></svg>;
    default: {
      const n = Number(name.replace("grid", ""));
      const gap = 1.4;
      const w = (12 - gap * (n - 1)) / n;
      return (
        <svg {...p} strokeWidth={1.3}>
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={2 + i * (w + gap)} y="3" width={w} height="10" rx={Math.min(1.1, w / 2)} />
          ))}
        </svg>
      );
    }
  }
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** Corner radius the app asks demos for, so previews match the near-square UI around them. */
export const APP_RADIUS = 2;

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
  const write = useCallback((next: string[]) => {
    setSaved(next);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* private mode: the bookmark lasts for this visit only */
    }
  }, []);
  const toggle = useCallback((slug: string) => write(saved.includes(slug) ? saved.filter((x) => x !== slug) : [...saved, slug]), [saved, write]);
  const clear = useCallback(() => write([]), [write]);
  return { saved, toggle, clear };
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

/** True while the element is within `margin` px of the viewport. */
export function useNear<T extends HTMLElement>(margin = 500) {
  const ref = useRef<T | null>(null);
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
}: {
  children: ReactNode;
  designWidth?: number;
  padX?: number;
  padTop?: number;
  padBottom?: number;
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
    const next = Math.min(1, (b.clientWidth - padX * 2) / w, (b.clientHeight - padTop - padBottom) / h);
    setScale((s) => (Math.abs(s - next) < 0.005 ? s : Math.max(next, 0.2)));
  }, [padX, padTop, padBottom]);

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
      className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit]"
      style={{ paddingTop: padTop - padBottom }}
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

export function Icon({ name, size = 16 }: { name: "close" | "copy" | "check" | "download" | "prev" | "next" | "replay" | "sun" | "moon" | "link" | "reset" | "plus" | "trash" | "up" | "down" | "chevron" | "open" | "bookmark" | "bookmarkFilled" | "grid2" | "grid3" | "grid4" | "grid5" | "masonry" | "even"; size?: number }) {
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
    case "bookmark":
      return <svg {...p}><path d="M4.2 2.8h7.6a.7.7 0 0 1 .7.7v9.6a.4.4 0 0 1-.65.3L8 10.4l-3.85 3a.4.4 0 0 1-.65-.3V3.5a.7.7 0 0 1 .7-.7Z" /></svg>;
    case "bookmarkFilled":
      return <svg {...p} fill="currentColor"><path d="M4.2 2.8h7.6a.7.7 0 0 1 .7.7v9.6a.4.4 0 0 1-.65.3L8 10.4l-3.85 3a.4.4 0 0 1-.65-.3V3.5a.7.7 0 0 1 .7-.7Z" /></svg>;
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

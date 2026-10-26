"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { components } from "@/lib/originkit-library";
import registryJson from "@/lib/originkit-library/registry.json";
import { PropsPanel, defaultOf, readControls, type Values } from "./controls";
import { Integrate, changedProps, useSource } from "./Integrate";
import { APP_RADIUS, FOCUS, Fit, Icon, useCopy } from "./kit";
import type { Block } from "./manifest";

type RegistryEntry = { name: string; description?: string; usage?: string; tweakSchema?: unknown[] };
const REGISTRY = new Map((registryJson as unknown as RegistryEntry[]).map((e) => [e.name, e]));

type Tab = "props" | "code" | "about";
type Width = 320 | 480 | 720 | 960;
const WIDTHS: Width[] = [320, 480, 720, 960];
/** Props that need the component to start over when they change, rather than animate. */
const REMOUNT = new Set(["enum", "boolean", "string", "array", "object"]);

export function encodeProps(values: Values): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(values)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeProps(p: string | null): Values {
  if (!p) return {};
  try {
    const v = JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, "+").replace(/_/g, "/")))));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/* -------------------------------------------------------------------------- */

function Body({
  block,
  siblings,
  accent,
  initialValues,
  onNavigate,
  onClose,
  position,
  saved,
  onToggleSaved,
}: {
  saved: boolean;
  onToggleSaved: (slug: string) => void;
  block: Block;
  siblings: Block[];
  accent: string;
  initialValues: Values;
  onNavigate: (slug: string) => void;
  onClose: () => void;
  position: { index: number; total: number };
}) {
  const uid = useId();
  const Comp = components[block.slug];
  const controls = useMemo(() => readControls(Comp), [Comp]);
  const entry = REGISTRY.get(block.slug);
  const importName = /^import\s+(\w+)\s+from/m.exec(entry?.usage ?? "")?.[1] ?? "Component";
  const { src } = useSource(block.slug);
  const { copied, copy } = useCopy();

  const [values, setValues] = useState<Values>(() => {
    const base: Values = { ...initialValues };
    const acc = controls.find(([k]) => k === "accent");
    // Start from the app's near-square corners; "Reset" returns to the component's own default.
    if (controls.some(([k]) => k === "radius") && !("radius" in base)) base.radius = APP_RADIUS;
    if (acc && !("accent" in base) && accent.toLowerCase() !== String(defaultOf(acc[1])).toLowerCase()) base.accent = accent;
    return base;
  });
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [dots, setDots] = useState(true);
  const [width, setWidth] = useState<Width>(480);
  const [tab, setTab] = useState<Tab>("props");
  const [run, setRun] = useState(0);

  const change = useCallback(
    (key: string, v: unknown) => {
      setValues((s) => ({ ...s, [key]: v }));
      const c = controls.find(([k]) => k === key)?.[1];
      if (c && REMOUNT.has(c.type)) setRun((n) => n + 1);
    },
    [controls],
  );
  const reset = useCallback((key?: string) => {
    setValues((s) => {
      if (!key) return {};
      const { [key]: _drop, ...rest } = s;
      return rest;
    });
    setRun((n) => n + 1);
  }, []);

  const props = useMemo(() => changedProps(controls, values, theme), [controls, values, theme]);
  const dark = theme === "dark";

  const share = () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("c", block.slug);
    const only = Object.fromEntries(props.filter(([k]) => k !== "theme"));
    if (Object.keys(only).length) url.searchParams.set("p", encodeProps(only));
    copy(url.toString(), "link");
  };

  const related = siblings.filter((b) => b.interaction === block.interaction && b.slug !== block.slug).slice(0, 5);
  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      id={`${uid}-tab-${id}`}
      aria-selected={tab === id}
      aria-controls={`${uid}-panel`}
      tabIndex={tab === id ? 0 : -1}
      onClick={() => setTab(id)}
      className={`relative h-11 px-4 text-[13.5px] font-medium transition-colors ${FOCUS} ${tab === id ? "text-white" : "text-[#8b8b90] hover:text-white"}`}
    >
      {label}
      {tab === id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-white" />}
    </button>
  );
  const onTabKey = (e: React.KeyboardEvent) => {
    const order: Tab[] = ["props", "code", "about"];
    const i = order.indexOf(tab);
    const next = e.key === "ArrowRight" ? order[(i + 1) % 3] : e.key === "ArrowLeft" ? order[(i + 2) % 3] : e.key === "Home" ? order[0] : e.key === "End" ? order[2] : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  const chip = `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors ${FOCUS}`;
  const stageBg = dark ? "#0b0b0c" : "#f1efea";
  const dot = dark ? "rgba(255,255,255,0.07)" : "rgba(20,20,19,0.09)";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#1f1f22] pl-5 pr-3 sm:pl-6">
        <div className="min-w-0 flex-1">
          <h2 id={`${uid}-title`} className="truncate text-[17px] font-medium tracking-[-0.01em] text-white">
            {block.title}
          </h2>
          <p className="truncate text-[12.5px] text-[#8b8b90]">
            {block.interaction}
            <span aria-hidden> · </span>
            {block.hint}
          </p>
        </div>
        <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="Browse blocks">
          <button type="button" aria-label="Previous block" onClick={() => onNavigate(siblings[(position.index - 1 + position.total) % position.total].slug)} disabled={position.total < 2} className={`grid h-9 w-9 place-items-center rounded-full text-[#c9c9cc] hover:bg-[#1c1c1f] hover:text-white disabled:opacity-30 ${FOCUS}`}>
            <Icon name="prev" />
          </button>
          <span className="w-14 text-center text-[12.5px] tabular-nums text-[#8b8b90]">
            {position.index + 1} / {position.total}
          </span>
          <button type="button" aria-label="Next block" onClick={() => onNavigate(siblings[(position.index + 1) % position.total].slug)} disabled={position.total < 2} className={`grid h-9 w-9 place-items-center rounded-full text-[#c9c9cc] hover:bg-[#1c1c1f] hover:text-white disabled:opacity-30 ${FOCUS}`}>
            <Icon name="next" />
          </button>
        </div>
        <button type="button" onClick={share} className={`${chip} bg-[#1c1c1f] text-[#e4e4e6] hover:bg-[#26262a]`}>
          <Icon name={copied === "link" ? "check" : "link"} size={14} />
          <span className="hidden sm:inline">{copied === "link" ? "Link copied" : "Share"}</span>
        </button>
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? `Remove ${block.title} from saved` : `Save ${block.title}`}
          onClick={() => onToggleSaved(block.slug)}
          className={`${chip} ${saved ? "bg-white text-black" : "bg-[#1c1c1f] text-[#e4e4e6] hover:bg-[#26262a]"}`}
        >
          <Icon name={saved ? "bookmarkFilled" : "bookmark"} size={14} />
          <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
        </button>
        <button type="button" aria-label="Close" onClick={onClose} className={`grid h-9 w-9 place-items-center rounded-full bg-[#1c1c1f] text-[#e4e4e6] hover:bg-[#26262a] ${FOCUS}`}>
          <Icon name="close" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Stage */}
        <div className="relative h-[46vh] shrink-0 overflow-hidden lg:h-auto lg:min-w-0 lg:flex-1" style={{ background: stageBg }}>
          {dots && <div aria-hidden className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${dot} 1px, transparent 0)`, backgroundSize: "20px 20px" }} />}
          {Comp ? (
            <Fit designWidth={width} padX={40} padTop={72} padBottom={64}>
              <Comp key={`${block.slug}-${run}`} {...values} theme={theme} />
            </Fit>
          ) : null}

          <div role="toolbar" aria-label="Preview options" className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            <div className={`flex rounded-full p-0.5 ${dark ? "bg-[#18181a]/90" : "bg-white/80"} backdrop-blur`} role="radiogroup" aria-label="Preview theme">
              {(["dark", "light"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={theme === t} aria-label={`${t} preview`} onClick={() => { setTheme(t); setRun((n) => n + 1); }} className={`grid h-7 w-8 place-items-center rounded-full transition-colors ${FOCUS} ${theme === t ? (dark ? "bg-[#33333a] text-white" : "bg-[#141413] text-white") : dark ? "text-[#8b8b90] hover:text-white" : "text-[#6b6862] hover:text-black"}`}>
                  <Icon name={t === "dark" ? "moon" : "sun"} size={14} />
                </button>
              ))}
            </div>
            <div className={`flex rounded-full p-0.5 ${dark ? "bg-[#18181a]/90" : "bg-white/80"} backdrop-blur`} role="radiogroup" aria-label="Preview width">
              {WIDTHS.map((w) => (
                <button key={w} type="button" role="radio" aria-checked={width === w} onClick={() => setWidth(w)} className={`h-7 rounded-full px-2.5 text-[11.5px] font-medium tabular-nums transition-colors ${FOCUS} ${width === w ? (dark ? "bg-[#33333a] text-white" : "bg-[#141413] text-white") : dark ? "text-[#8b8b90] hover:text-white" : "text-[#6b6862] hover:text-black"}`}>
                  {w}
                </button>
              ))}
            </div>
            <button type="button" aria-pressed={dots} onClick={() => setDots((d) => !d)} className={`${chip} h-8 ${dark ? "bg-[#18181a]/90 text-[#c9c9cc] hover:text-white" : "bg-white/80 text-[#3a3935]"} backdrop-blur`}>
              Dot grid
            </button>
            <button type="button" onClick={() => setRun((n) => n + 1)} className={`${chip} ${dark ? "bg-[#18181a]/90 text-[#c9c9cc] hover:text-white" : "bg-white/80 text-[#3a3935]"} backdrop-blur`}>
              <Icon name="replay" size={14} />
              Replay
            </button>
          </div>

          <p className={`pointer-events-none absolute inset-x-0 bottom-4 text-center text-[12.5px] ${dark ? "text-[#6c6c72]" : "text-[#85827b]"}`}>Try it: {block.hint.charAt(0).toLowerCase() + block.hint.slice(1)}</p>
        </div>

        {/* Panel */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-[#1f1f22] bg-[#0e0e10] lg:w-[440px] lg:flex-none lg:border-l lg:border-t-0">
          <div role="tablist" aria-label="Inspector" onKeyDown={onTabKey} className="flex shrink-0 border-b border-[#1f1f22] px-2">
            {tabBtn("props", "Props")}
            {tabBtn("code", "Code")}
            {tabBtn("about", "About")}
          </div>
          <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} tabIndex={0} className={`min-h-0 flex-1 overflow-y-auto p-5 ${FOCUS}`}>
            {tab === "props" &&
              (controls.length ? (
                <PropsPanel controls={controls} values={values} onChange={change} onReset={reset} uid={uid} />
              ) : (
                <p className="text-[13px] text-[#8b8b90]">This block has no editable properties.</p>
              ))}
            {tab === "code" && <Integrate slug={block.slug} importName={importName} props={props} />}
            {tab === "about" && (
              <div className="space-y-6">
                <p className="text-[14px] leading-[1.65] text-[#c9c9cc]">{entry?.description}</p>
                <dl className="divide-y divide-[#1f1f22] rounded-xl border border-[#26262a] text-[13px]">
                  {[
                    ["Interaction", block.interaction],
                    ["Properties", String(controls.length)],
                    ["Dependency", "framer-motion"],
                    ["Works in", "Framer, React, Next.js"],
                    ["Source", src ? `${(src.react.length / 1024).toFixed(1)} KB, ${src.react.split("\n").length} lines` : "…"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <dt className="text-[#8b8b90]">{k}</dt>
                      <dd className="text-right text-[#ededee]">{v}</dd>
                    </div>
                  ))}
                </dl>
                {related.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#5f5f65]">More {block.interaction.toLowerCase()} blocks</h3>
                    <div className="flex flex-wrap gap-2">
                      {related.map((b) => (
                        <button key={b.slug} type="button" onClick={() => onNavigate(b.slug)} className={`h-9 rounded-full bg-[#1c1c1f] px-4 text-[13px] text-[#e4e4e6] transition-colors hover:bg-[#26262a] ${FOCUS}`}>
                          {b.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="hidden shrink-0 border-t border-[#1f1f22] px-5 py-2.5 text-[11.5px] text-[#5f5f65] lg:block">
            <kbd className="font-mono text-[#8b8b90]">Esc</kbd> close <span aria-hidden>·</span> <kbd className="font-mono text-[#8b8b90]">[</kbd> <kbd className="font-mono text-[#8b8b90]">]</kbd> previous / next
          </p>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

export function Inspector({
  block,
  siblings,
  accent,
  initialValues,
  onClose,
  onNavigate,
  onExited,
  saved,
  onToggleSaved,
}: {
  saved: boolean;
  onToggleSaved: (slug: string) => void;
  block: Block | null;
  siblings: Block[];
  accent: string;
  initialValues: Values;
  onClose: () => void;
  onNavigate: (slug: string) => void;
  onExited: () => void;
}) {
  const reduce = useReducedMotion();
  const dialog = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock page scroll while open.
  useEffect(() => {
    if (!block) return;
    const { overflow, paddingRight } = document.body.style;
    const bar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (bar > 0) document.body.style.paddingRight = `${bar}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [!!block]); // eslint-disable-line react-hooks/exhaustive-deps

  // Move focus in on open.
  useEffect(() => {
    if (block) dialog.current?.focus();
  }, [!!block]); // eslint-disable-line react-hooks/exhaustive-deps

  const index = block ? siblings.findIndex((b) => b.slug === block.slug) : -1;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab" && dialog.current) {
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if ((e.key === "[" || e.key === "]") && siblings.length > 1 && index >= 0) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      const n = siblings.length;
      onNavigate(siblings[(index + (e.key === "]" ? 1 : n - 1)) % n].slug);
    }
  };

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence onExitComplete={onExited}>
      {block && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center lg:items-center lg:p-6" key="blocks-inspector">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={`${block.title} inspector`}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.985, y: 4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="relative flex h-full w-full flex-col overflow-hidden bg-[#0e0e10] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] outline-none lg:h-[min(860px,100%)] lg:max-w-[1380px] lg:rounded-[2px] lg:border lg:border-[#232326]"
          >
            <Body
              key={block.slug}
              block={block}
              siblings={siblings}
              accent={accent}
              initialValues={initialValues}
              onNavigate={onNavigate}
              onClose={onClose}
              saved={saved}
              onToggleSaved={onToggleSaved}
              position={{ index: Math.max(index, 0), total: siblings.length }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

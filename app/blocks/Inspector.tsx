"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useComponent } from "@/lib/originkit-library/lazy";
import registryJson from "@/lib/originkit-library/registry.json";
import { PropsPanel, defaultOf, readControls, type Values } from "./controls";
import { Integrate, aiPrompts, changedProps, framerCode, isMethod, useSource, type Method } from "./Integrate";
import { DemoBoundary, FOCUS, Fit, Icon, useCopy, usePersisted } from "./kit";
import { NEW_SLUGS, type Block } from "./manifest";

type RegistryEntry = { name: string; description?: string; usage?: string; tweakSchema?: unknown[] };
const REGISTRY = new Map((registryJson as unknown as RegistryEntry[]).map((e) => [e.name, e]));

type Tab = "props" | "code" | "about";
const isTab = (v: unknown): v is Tab => v === "props" || v === "code" || v === "about";
const WIDTHS = [320, 480, 720, 960];
const MIN_WIDTH = 280;
const MAX_WIDTH = 1100;
/** Props that need the component to start over when they change, rather than animate. */
const REMOUNT = new Set(["enum", "boolean", "string", "array", "object"]);
/** Typing in a text field restarts the demo only once the typing pauses. */
const TYPING_PAUSE = 500;

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

/** How the reader likes to look at a block. Kept above the block so it survives moving to the next one, and across visits. */
type Prefs = {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  dots: boolean;
  setDots: (d: boolean) => void;
  width: number;
  setWidth: (w: number) => void;
  fill: boolean;
  setFill: (f: boolean) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  method: Method;
  setMethod: (m: Method) => void;
  bake: boolean;
  setBake: (b: boolean) => void;
};

/* -------------------------------------------------------------------------- */

function Body({
  Comp,
  block,
  siblings,
  accent,
  initialValues,
  onNavigate,
  onClose,
  position,
  saved,
  onToggleSaved,
  onToast,
  sound,
  prefs,
}: {
  Comp: ComponentType<any>;
  sound: boolean;
  saved: boolean;
  onToggleSaved: (slug: string) => void;
  onToast: (message: string) => void;
  block: Block;
  siblings: Block[];
  accent: string;
  initialValues: Values;
  onNavigate: (slug: string) => void;
  onClose: () => void;
  position: { index: number; total: number };
  prefs: Prefs;
}) {
  const uid = useId();
  const controls = useMemo(() => readControls(Comp), [Comp]);
  const entry = REGISTRY.get(block.slug);
  const importName = /^import\s+(\w+)\s+from/m.exec(entry?.usage ?? "")?.[1] ?? "Component";
  const { src } = useSource(block.slug);
  const { copied, copy } = useCopy();
  const { theme, setTheme, dots, setDots, width, setWidth, fill, setFill, tab, setTab, method, setMethod, bake, setBake } = prefs;

  const [values, setValues] = useState<Values>(() => {
    const base: Values = { ...initialValues };
    const acc = controls.find(([k]) => k === "accent");
    // Carry the page's sound setting in, if this block has sound.
    if (sound && controls.some(([k]) => k === "sound") && !("sound" in base)) base.sound = true;
    if (acc && !("accent" in base) && !(block.props && "accent" in block.props) && accent.toLowerCase() !== String(defaultOf(acc[1])).toLowerCase()) base.accent = accent;
    return base;
  });
  const [run, setRun] = useState(0);
  const typing = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(typing.current), []);

  const change = useCallback(
    (key: string, v: unknown) => {
      setValues((s) => ({ ...s, [key]: v }));
      const c = controls.find(([k]) => k === key)?.[1];
      if (!c || !REMOUNT.has(c.type)) return;
      // A remount on every keystroke would restart the demo under the reader's fingers.
      window.clearTimeout(typing.current);
      if (c.type === "string") typing.current = window.setTimeout(() => setRun((n) => n + 1), TYPING_PAUSE);
      else setRun((n) => n + 1);
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
  const hasSound = controls.some(([k]) => k === "sound");
  const soundOn = !!(values.sound ?? defaultOf(controls.find(([k]) => k === "sound")?.[1] ?? { type: "boolean" }));

  const share = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("c", block.slug);
    const only = Object.fromEntries(props.filter(([k]) => k !== "theme"));
    if (Object.keys(only).length) url.searchParams.set("p", encodeProps(only));
    // On a phone the share sheet is the natural place to send a link.
    if (window.matchMedia("(pointer: coarse)").matches && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: block.title, url: url.toString() });
        return;
      } catch {
        /* dismissed: fall through to copying */
      }
    }
    copy(url.toString(), "link");
  };

  // The one action most people came for, in the method they used last.
  const ai = aiPrompts(block.slug, props);
  const primary =
    method === "react"
      ? { label: "Copy component", text: src?.react ?? "", done: "Component copied" }
      : method === "framer"
        ? { label: "Copy for Framer", text: src ? framerCode(src.framer, importName, props, bake) : "", done: "Copied for Framer" }
        : { label: "Copy MCP prompt", text: props.length ? ai.configured : ai.quick, done: "Prompt copied" };

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
      className={`relative h-11 px-4 text-[13px] font-medium transition-colors ${FOCUS} ${tab === id ? "text-white" : "text-[#8b8b90] hover:text-white"}`}
    >
      {label}
      {tab === id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-lg bg-white" />}
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

  const chip = `inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-colors ${FOCUS}`;
  const stageChip = dark ? "bg-[#18181a]/90 text-[#c9c9cc] hover:text-white" : "bg-white/80 text-[#3a3935]";
  const stageBg = dark ? "#0b0b0c" : "#f1efea";
  const dot = dark ? "rgba(255,255,255,0.07)" : "rgba(20,20,19,0.09)";
  const segOn = dark ? "bg-[#33333a] text-white" : "bg-[#141413] text-white";
  const segOff = dark ? "text-[#8b8b90] hover:text-white" : "text-[#6b6862] hover:text-black";
  const prev = siblings[(position.index - 1 + position.total) % position.total];
  const next = siblings[(position.index + 1) % position.total];

  const details: [string, string][] = [
    ["Interaction", block.interaction],
    ["Properties", String(controls.length)],
    ["Sound", hasSound ? "Optional" : "None"],
    ["Accent colour", controls.some(([k]) => k === "accent") ? "Adjustable" : "Fixed"],
    ["Source", src ? `${(src.react.length / 1024).toFixed(1)} KB, ${src.react.split("\n").length} lines` : "…"],
  ];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-[#1f1f22] pl-5 pr-3 sm:gap-3 sm:pl-6">
        <div className="min-w-0 flex-1">
          <h2 id={`${uid}-title`} className="flex items-center gap-2 truncate text-[16px] font-medium tracking-[-0.01em] text-white sm:text-[17px]">
            <span className="truncate">{block.title}</span>
            {NEW_SLUGS.has(block.slug) && (
              <span className="hidden shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-black sm:inline" style={{ background: accent }}>
                New
              </span>
            )}
          </h2>
          <p className="truncate text-[12px] text-[#8b8b90]">
            {block.interaction}
            <span aria-hidden> · </span>
            {controls.length} propert{controls.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1" role="group" aria-label="Browse blocks">
          <button type="button" aria-label="Previous block" title={`Previous: ${prev?.title ?? ""}  ( [ )`} onClick={() => onNavigate(prev.slug)} disabled={position.total < 2} className={`grid h-9 w-9 place-items-center rounded-lg text-[#c9c9cc] hover:bg-[#1c1c1f] hover:text-white disabled:opacity-30 ${FOCUS}`}>
            <Icon name="prev" />
          </button>
          <span className="hidden w-14 text-center text-[12px] tabular-nums text-[#8b8b90] sm:block">
            {position.index + 1} / {position.total}
          </span>
          <button type="button" aria-label="Next block" title={`Next: ${next?.title ?? ""}  ( ] )`} onClick={() => onNavigate(next.slug)} disabled={position.total < 2} className={`grid h-9 w-9 place-items-center rounded-lg text-[#c9c9cc] hover:bg-[#1c1c1f] hover:text-white disabled:opacity-30 ${FOCUS}`}>
            <Icon name="next" />
          </button>
        </div>
        <button type="button" onClick={share} aria-label="Share link" className={`${chip} bg-[#1c1c1f] text-[#e4e4e6] hover:bg-[#26262a]`}>
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
        <button type="button" aria-label="Close" onClick={onClose} className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1c1c1f] text-[#e4e4e6] hover:bg-[#26262a] ${FOCUS}`}>
          <Icon name="close" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Stage */}
        <div className="relative h-[46vh] shrink-0 overflow-hidden lg:h-auto lg:min-w-0 lg:flex-1" style={{ background: stageBg }}>
          {dots && <div aria-hidden className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${dot} 1px, transparent 0)`, backgroundSize: "20px 20px" }} />}
          {Comp ? (
            <Fit designWidth={width} padX={40} padTop={72} padBottom={64} grow={fill ? 2 : 1}>
              <DemoBoundary label={block.title}>
                <Comp key={`${block.slug}-${run}`} {...block.props} {...values} theme={theme} />
              </DemoBoundary>
            </Fit>
          ) : null}

          <div role="toolbar" aria-label="Preview options" className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-1.5">
            <div className={`flex rounded-lg p-0.5 ${dark ? "bg-[#18181a]/90" : "bg-white/80"} backdrop-blur`} role="radiogroup" aria-label="Preview theme">
              {(["dark", "light"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={theme === t} aria-label={`${t} preview`} title={`${t[0].toUpperCase()}${t.slice(1)} preview`} onClick={() => { setTheme(t); setRun((n) => n + 1); }} className={`grid h-7 w-8 place-items-center rounded-lg transition-colors ${FOCUS} ${theme === t ? segOn : segOff}`}>
                  <Icon name={t === "dark" ? "moon" : "sun"} size={14} />
                </button>
              ))}
            </div>
            <div className={`hidden items-center rounded-lg p-0.5 sm:flex ${dark ? "bg-[#18181a]/90" : "bg-white/80"} backdrop-blur`} role="radiogroup" aria-label="Frame width">
              {WIDTHS.map((w) => (
                <button key={w} type="button" role="radio" aria-checked={width === w} title={`Lay the block out at ${w}px wide`} onClick={() => setWidth(w)} className={`h-7 rounded-lg px-2.5 text-[11px] font-medium tabular-nums transition-colors ${FOCUS} ${width === w ? segOn : segOff}`}>
                  {w}
                </button>
              ))}
              <input
                type="range"
                aria-label="Frame width in pixels"
                title={`Frame width: ${width}px. The block is laid out this wide, then scaled to fit.`}
                min={MIN_WIDTH}
                max={MAX_WIDTH}
                step={10}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className={`blocks-range mx-2 h-5 w-20 cursor-pointer ${FOCUS}`}
                style={{ ["--pct" as string]: `${((width - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)) * 100}%` }}
              />
              <span className={`w-10 pr-1.5 text-right text-[11px] tabular-nums ${dark ? "text-[#8b8b90]" : "text-[#6b6862]"}`}>{width}</span>
            </div>
            <button type="button" aria-pressed={fill} title="Scale small blocks up to fill the stage" onClick={() => setFill(!fill)} className={`${chip} h-8 ${fill ? (dark ? "bg-[#33333a] text-white" : "bg-[#141413] text-white") : stageChip} backdrop-blur`}>
              <Icon name="expand" size={13} />
              <span className="hidden sm:inline">Fill</span>
            </button>
            <button type="button" aria-pressed={dots} onClick={() => setDots(!dots)} className={`${chip} hidden sm:inline-flex ${stageChip} backdrop-blur`}>
              Dots
            </button>
            {hasSound && (
              <button type="button" aria-pressed={soundOn} aria-label="Sound effects" title={soundOn ? "Sound effects on" : "Sound effects off"} onClick={() => change("sound", !soundOn)} className={`${chip} ${soundOn ? (dark ? "bg-[#33333a] text-white" : "bg-[#141413] text-white") : stageChip} backdrop-blur`}>
                <Icon name={soundOn ? "soundOn" : "soundOff"} size={14} />
              </button>
            )}
            <button type="button" onClick={() => setRun((n) => n + 1)} className={`${chip} ${stageChip} backdrop-blur`}>
              <Icon name="replay" size={14} />
              Replay
            </button>
          </div>

          <p className={`pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-[12px] ${dark ? "text-[#84848a]" : "text-[#6b6862]"}`}>Try it: {block.hint.charAt(0).toLowerCase() + block.hint.slice(1)}</p>
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
            {tab === "code" && <Integrate slug={block.slug} importName={importName} props={props} method={method} onMethod={setMethod} bake={bake} onBake={setBake} />}
            {tab === "about" && (
              <div className="space-y-6">
                <p className="text-[14px] leading-[1.65] text-[#c9c9cc]">{entry?.description}</p>
                <div className="rounded-xl bg-[#131315] px-4 py-3 text-[13px] leading-[1.6] text-[#c9c9cc]">
                  <span className="text-[#8b8b90]">How to try it · </span>
                  {block.hint}
                </div>
                <dl className="divide-y divide-[#1f1f22] rounded-xl border border-[#26262a] text-[13px]">
                  {details.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <dt className="text-[#8b8b90]">{k}</dt>
                      <dd className="text-right text-[#ededee]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[12px] leading-[1.6] text-[#84848a]">Needs framer-motion. Works in Framer, React and Next.js.</p>
                {related.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#84848a]">More {block.interaction.toLowerCase()} blocks</h3>
                    <div className="flex flex-wrap gap-2">
                      {related.map((b) => (
                        <button key={b.slug} type="button" onClick={() => onNavigate(b.slug)} className={`h-9 rounded-lg bg-[#1c1c1f] px-4 text-[13px] text-[#e4e4e6] transition-colors hover:bg-[#26262a] ${FOCUS}`}>
                          {b.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#1f1f22] px-4 py-3 sm:px-5">
            <p className="hidden text-[11px] text-[#84848a] xl:block">
              <kbd className="font-mono text-[#8b8b90]">Esc</kbd> close <span aria-hidden>·</span> <kbd className="font-mono text-[#8b8b90]">[</kbd> <kbd className="font-mono text-[#8b8b90]">]</kbd> prev / next
            </p>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 xl:flex-none">
              {tab !== "code" && (
                <button type="button" onClick={() => setTab("code")} className={`h-10 shrink-0 rounded-lg px-3 text-[13px] text-[#a0a0a5] hover:text-white ${FOCUS}`}>
                  Other ways
                </button>
              )}
              <button
                type="button"
                disabled={!primary.text}
                onClick={async () => {
                  await copy(primary.text, "primary");
                  onToast(primary.done);
                }}
                className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-5 text-[14px] font-medium text-black transition-opacity disabled:opacity-40 sm:flex-none ${FOCUS}`}
              >
                <Icon name={copied === "primary" ? "check" : "copy"} size={14} />
                <span className="truncate">{copied === "primary" ? "Copied" : primary.label}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/** Waits for the block's chunk: the controls come from the component itself, so Body needs it loaded. */
function BodyLoader(props: Omit<Parameters<typeof Body>[0], "Comp">) {
  const Comp = useComponent(props.block.slug);
  if (!Comp) return <div className="grid min-h-0 flex-1 place-items-center text-[13px] text-[#84848a]">Loading…</div>;
  return <Body {...props} Comp={Comp} />;
}

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
  onToast,
  sound,
}: {
  sound: boolean;
  saved: boolean;
  onToggleSaved: (slug: string) => void;
  onToast: (message: string) => void;
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

  const [theme, setTheme] = usePersisted<"dark" | "light">("originkit.blocks.theme", "dark", (v): v is "dark" | "light" => v === "dark" || v === "light");
  const [dots, setDots] = usePersisted<boolean>("originkit.blocks.dots", true, (v): v is boolean => typeof v === "boolean");
  const [width, setWidth] = usePersisted<number>("originkit.blocks.width", 480, (v): v is number => typeof v === "number" && v >= MIN_WIDTH && v <= MAX_WIDTH);
  const [fill, setFill] = usePersisted<boolean>("originkit.blocks.fill", true, (v): v is boolean => typeof v === "boolean");
  const [tab, setTab] = usePersisted<Tab>("originkit.blocks.tab", "props", isTab);
  const [method, setMethod] = usePersisted<Method>("originkit.blocks.method", "react", isMethod);
  const [bake, setBake] = usePersisted<boolean>("originkit.blocks.bake", true, (v): v is boolean => typeof v === "boolean");
  const prefs: Prefs = { theme, setTheme, dots, setDots, width, setWidth, fill, setFill, tab, setTab, method, setMethod, bake, setBake };

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
        <div className="fixed inset-0 z-50 flex items-stretch justify-center lg:items-center lg:p-6" key="blocks-inspector" style={{ ["--ok-accent" as string]: accent }}>
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
            className="relative flex h-full w-full flex-col overflow-hidden bg-[#0e0e10] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] outline-none lg:h-[min(860px,100%)] lg:max-w-[1380px] lg:rounded-[20px] lg:border lg:border-[#232326]"
          >
            <BodyLoader
              key={block.slug}
              block={block}
              siblings={siblings}
              accent={accent}
              initialValues={initialValues}
              onNavigate={onNavigate}
              onClose={onClose}
              saved={saved}
              onToggleSaved={onToggleSaved}
              onToast={onToast}
              sound={sound}
              prefs={prefs}
              position={{ index: Math.max(index, 0), total: siblings.length }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

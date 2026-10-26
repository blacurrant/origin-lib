"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { components as library } from "@/lib/originkit-library";
import { META } from "@/app/core/states";
import { ACCENTS, DEFAULT_ACCENT, type CoreEntry, type CoreGroup, type Theme } from "@/app/core/types";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fa7319]";

const SITE = (process.env.NEXT_PUBLIC_ORIGINKIT_SITE_URL ?? "https://www.originkit.dev").replace(/\/$/, "");

/** Width a block component renders at before it is scaled to fit its tile. */
function renderWidth(name: string) {
  const meta = META[name] ?? {};
  return meta.block ? Math.min(meta.width?.def ?? 380, 560) : undefined;
}

/** Scale the demo down (never up) so the whole thing sits inside the tile. */
function Fit({ children, pad = 28 }: { children: ReactNode; pad?: number }) {
  const box = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const w = i.offsetWidth;
    const h = i.offsetHeight;
    if (!w || !h) return;
    const next = Math.min(1, (b.clientWidth - pad * 2) / w, (b.clientHeight - pad * 2) / h);
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
    <div ref={box} className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div ref={inner} style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
        {children}
      </div>
    </div>
  );
}

function firstSentence(text: string) {
  const m = /^.*?[.!?](?=\s|$)/.exec(text.trim());
  return m ? m[0] : text;
}

function Tile({ entry, group, theme, accent }: { entry: CoreEntry; group: CoreGroup; theme: Theme; accent: string }) {
  const Comp = library[entry.name];
  const meta = META[entry.name] ?? {};
  const [run, setRun] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dark = theme === "dark";
  const shared = { theme, accent, radius: 2 };
  const width = renderWidth(entry.name);
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(`Using originkit MCP, get me the ${entry.name} component.`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  let demo: ReactNode = null;
  if (Comp) {
    if (entry.name === "dialog") {
      const Trigger = library.button;
      demo = (
        <>
          <Trigger label="Open dialog" variant="primary" {...shared} onClick={() => setDialogOpen(true)} />
          <Comp {...shared} open={dialogOpen} onClose={() => setDialogOpen(false)} />
        </>
      );
    } else {
      demo = <Comp key={run} {...shared} />;
    }
  }

  const ghost = dark
    ? "border-[#2a2a2c] bg-[#0b0b0c]/80 text-[#d4d5d6] hover:bg-[#1a1a1b]"
    : "border-[#d9d5ce] bg-white/80 text-[#3a3935] hover:bg-white";

  return (
    <li id={entry.name} className="group scroll-mt-40">
      <div
        className={`relative aspect-[1.62/1] overflow-hidden rounded-[2px] border ${
          dark ? "border-[#1f1f21] bg-black" : "border-[#e0ddd7] bg-[#f6f4f0]"
        }`}
      >
        {entry.name === "dialog" ? (
          // A modal needs the whole page, so only its trigger lives in the tile.
          <div className="absolute inset-0 flex items-center justify-center">{demo}</div>
        ) : (
          <Fit>
            <div style={width ? { width } : undefined}>{demo}</div>
          </Fit>
        )}

        <div className="absolute right-3 top-3 flex gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {meta.replay && entry.name !== "dialog" && (
            <button
              type="button"
              onClick={() => setRun((n) => n + 1)}
              className={`h-8 rounded-full border px-3 text-[12px] font-medium ${ghost} ${FOCUS}`}
            >
              {meta.replay}
            </button>
          )}
          <button
            type="button"
            onClick={copyPrompt}
            className={`h-8 rounded-full border px-3 text-[12px] font-medium ${ghost} ${FOCUS}`}
          >
            {copied ? "Copied" : "Copy prompt"}
          </button>
          <Link
            href={`/core#${entry.name}`}
            className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium ${ghost} ${FOCUS}`}
          >
            Details
          </Link>
        </div>
        <span className="sr-only" aria-live="polite">
          {copied ? "Prompt copied" : ""}
        </span>
      </div>

      <div className="px-2 pt-4">
        <h3 className={`text-[20px] font-medium tracking-[-0.015em] ${dark ? "text-[#f7f7f7]" : "text-[#141413]"}`}>
          {entry.displayName}
        </h3>
        <p className={`mt-1 line-clamp-1 text-[15px] ${dark ? "text-[#8f9093]" : "text-[#6b6862]"}`} title={entry.description}>
          {group.track === "agentic" ? "Agentic · " : ""}
          {firstSentence(entry.description)}
        </p>
      </div>
    </li>
  );
}

const MONO = "font-['Geist_Mono',ui-monospace,monospace]";

/** One component from each type, so the prompt cycles across the whole library. */
function heroNames(groups: CoreGroup[]) {
  return groups.flatMap((g) => g.entries.slice(0, 1).map((e) => e.name));
}

function Hero({ groups, theme, accent }: { groups: CoreGroup[]; theme: Theme; accent: string }) {
  const dark = theme === "dark";
  const reduced = useReducedMotion();
  const names = useMemo(() => heroNames(groups), [groups]);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [copied, setCopied] = useState(false);
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  const agentic = groups.filter((g) => g.track === "agentic").reduce((n, g) => n + g.entries.length, 0);
  const name = names[i % names.length] ?? "button";
  const prompt = `Using originkit MCP, get me the ${name} component.`;

  // Cycle through names; hold still while the prompt is hovered, focused, or motion is reduced.
  useEffect(() => {
    if (held || reduced || names.length < 2) return;
    const t = window.setInterval(() => setI((n) => n + 1), 2400);
    return () => window.clearInterval(t);
  }, [held, reduced, names.length]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const ink = dark ? "text-[#f7f7f7]" : "text-[#141413]";
  const sub = dark ? "text-[#a5a7a9]" : "text-[#5f5c56]";
  const faint = dark ? "text-[#6f7173]" : "text-[#8a867f]";
  const line = dark ? "border-[#1f1f21]" : "border-[#dcd8d0]";
  const card = dark ? "border-[#1f1f21] bg-[#111112]" : "border-[#e0ddd7] bg-[#f6f4f0]";
  const stats = [
    { n: total, label: "live" },
    { n: groups.length, label: "types" },
    { n: agentic, label: "for agents" },
  ];

  return (
    <section aria-labelledby="gallery-title" className={`border-b pb-10 pt-8 sm:pb-12 sm:pt-12 ${line}`}>
      <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className={`${MONO} flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] ${faint}`}>
            <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: accent }} />
            Originkit / Gallery
          </p>
          <h1
            id="gallery-title"
            className={`mt-5 text-[clamp(42px,5.2vw,78px)] font-semibold leading-[0.95] tracking-[-0.05em] ${ink}`}
          >
            Ask for it
            <br />
            by name<span style={{ color: accent }}>.</span>
          </h1>
          <p className={`mt-5 max-w-[34rem] text-pretty text-[16px] leading-[1.55] sm:text-[17px] ${sub}`}>
            Every tile below is the real component, running. Find the one you need, then drop it into Framer or have your
            editor install it with one line.
          </p>
        </div>

        <div onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
          <div className={`overflow-hidden rounded-[2px] border ${card}`}>
            <div className={`flex items-center justify-between border-b px-5 py-3 ${line}`}>
              <span className={`${MONO} text-[11px] uppercase tracking-[0.14em] ${faint}`}>In your editor</span>
              <span className={`${MONO} text-[11px] tabular-nums ${faint}`}>
                {String((i % names.length) + 1).padStart(2, "0")} / {String(names.length).padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-start gap-3 px-5 pb-5 pt-4">
              <span aria-hidden className={`${MONO} pt-[3px] text-[14px]`} style={{ color: accent }}>
                &gt;
              </span>
              <p className={`${MONO} min-w-0 flex-1 text-[15px] leading-[1.6] sm:text-[16px] ${dark ? "text-[#d4d5d6]" : "text-[#3a3935]"}`}>
                Using originkit MCP, get me the{" "}
                <span className="relative inline-flex overflow-hidden align-bottom">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={name}
                      initial={{ y: "100%", opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: "-100%", opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                      className={`font-medium ${ink}`}
                      style={{ textDecoration: "underline", textDecorationColor: accent, textUnderlineOffset: 4, textDecorationThickness: 2 }}
                    >
                      {name}
                    </motion.span>
                  </AnimatePresence>
                </span>{" "}
                component.
              </p>
            </div>
            <div className={`flex items-center justify-between gap-3 border-t px-3 py-3 pl-5 ${line}`}>
              <Link href={`${SITE}/connect`} className={`rounded text-[14px] font-medium underline-offset-4 hover:underline ${sub} ${FOCUS}`}>
                Connect your editor
              </Link>
              <button
                type="button"
                onClick={copy}
                className={`h-9 rounded-full px-4 text-[13.5px] font-medium transition-colors ${FOCUS} ${
                  dark ? "bg-[#f7f7f7] text-[#141413] hover:bg-white" : "bg-[#141413] text-[#f7f7f7] hover:bg-black"
                }`}
              >
                {copied ? "Copied" : "Copy prompt"}
              </button>
              <span className="sr-only" aria-live="polite">
                {copied ? "Prompt copied" : ""}
              </span>
            </div>
          </div>

          <dl className={`${MONO} mt-4 flex flex-wrap gap-x-5 gap-y-1 px-1 text-[12px] uppercase tracking-[0.14em] ${faint}`}>
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <dd className={`tabular-nums ${ink}`}>{s.n}</dd>
                <dt>{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

export function Gallery({ groups }: { groups: CoreGroup[] }) {
  const [active, setActive] = useState("all");
  const [theme, setTheme] = useState<Theme>("dark");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [swatches, setSwatches] = useState(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const dark = theme === "dark";

  // Keep the selected type in the URL so a filtered view can be shared.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("type");
    if (id && groups.some((g) => g.id === id)) setActive(id);
  }, [groups]);

  const choose = (id: string) => {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === "all") url.searchParams.delete("type");
    else url.searchParams.set("type", id);
    window.history.replaceState(null, "", url);
  };

  const tabs = useMemo(
    () => [{ id: "all", title: "All", count: groups.reduce((n, g) => n + g.entries.length, 0) }, ...groups.map((g) => ({ id: g.id, title: g.title, count: g.entries.length }))],
    [groups],
  );

  const visible = groups.filter((g) => active === "all" || g.id === active);
  const current = groups.find((g) => g.id === active);

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    choose(tabs[next].id);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  const page = dark ? "bg-[#0a0a0b] text-[#f7f7f7]" : "bg-[#efede8] text-[#141413]";
  // Same solid colour as the page, so the bars read as part of it and tiles scroll cleanly beneath.
  const solid = dark ? "bg-[#0a0a0b]" : "bg-[#efede8]";
  const pill = dark ? "border-[#1f1f21] bg-[#0a0a0b]" : "border-[#dcd8d0] bg-[#efede8]";
  const muted = dark ? "text-[#8f9093] hover:text-[#f7f7f7]" : "text-[#6b6862] hover:text-[#141413]";
  const on = dark ? "bg-[#f7f7f7] text-[#0a0a0b]" : "bg-[#141413] text-[#f7f7f7]";

  return (
    <div className={`min-h-screen ${page}`}>
      <header className={`sticky top-0 z-30 px-4 pb-3 pt-4 sm:px-8 ${solid}`}>
        <div className="relative mx-auto flex max-w-[1760px] items-center justify-between gap-3">
          <Link href="/" className={`flex items-center gap-2.5 rounded-full ${FOCUS}`}>
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full" style={{ background: accent }}>
              <span className="h-2.5 w-2.5 rounded-sm bg-[#0a0a0b]" />
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.02em]">Originkit</span>
          </Link>

          <nav aria-label="Primary" className={`absolute left-1/2 hidden -translate-x-1/2 rounded-full border p-1 md:flex ${pill}`}>
            {[
              { label: "Components", href: "/gallery", current: true },
              { label: "Library", href: "/" },
              { label: "Core", href: "/core" },
              { label: "Pricing", href: `${SITE}/pricing` },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                aria-current={l.current ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-[15px] font-medium transition-colors ${FOCUS} ${l.current ? on : muted}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              aria-label="Accent colour"
              aria-expanded={swatches}
              onClick={() => setSwatches((s) => !s)}
              className={`grid h-10 w-10 place-items-center rounded-full border ${pill} ${FOCUS}`}
            >
              <span className="h-4 w-4 rounded-full" style={{ background: accent }} />
            </button>
            {swatches && (
              <div role="radiogroup" aria-label="Accent colour" className={`absolute right-12 top-0 flex gap-2 rounded-full border p-2.5 ${pill}`}>
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
                    style={{ background: a.value, boxShadow: accent === a.value ? `0 0 0 2px ${dark ? "#0a0a0b" : "#efede8"}, 0 0 0 4px ${a.value}` : undefined }}
                  />
                ))}
              </div>
            )}
            <button
              type="button"
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setTheme(dark ? "light" : "dark")}
              className={`grid h-10 w-10 place-items-center rounded-full border ${pill} ${FOCUS}`}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {dark ? (
                  <>
                    <circle cx="9" cy="9" r="3.2" />
                    <path d="M9 1.8v1.6M9 14.6v1.6M1.8 9h1.6M14.6 9h1.6M3.9 3.9l1.1 1.1M13 13l1.1 1.1M14.1 3.9 13 5M5 13l-1.1 1.1" />
                  </>
                ) : (
                  <path d="M14.8 10.6A6 6 0 0 1 7.4 3.2a6 6 0 1 0 7.4 7.4Z" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1760px] px-4 pb-24 pt-2 sm:px-8">
        <Hero groups={groups} theme={theme} accent={accent} />

        <div id="components" className={`sticky mt-6 scroll-mt-[68px] top-[68px] z-20 -mx-4 px-4 pb-3 pt-1 sm:-mx-8 sm:px-8 ${solid}`}>
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Component type"
            onKeyDown={onTabKey}
            className={`mx-auto flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${pill}`}
          >
            {tabs.map((t) => {
              const selected = t.id === active;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => choose(t.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[15px] font-medium transition-colors ${FOCUS} ${selected ? on : muted}`}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-[1760px]" role="tabpanel" aria-label={current?.title ?? "All components"}>
          {current && (
            <p className={`mb-6 text-center text-[15px] ${dark ? "text-[#8f9093]" : "text-[#6b6862]"}`}>{current.note}</p>
          )}
          <ul className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
            {visible.flatMap((g) => g.entries.map((e) => <Tile key={e.name} entry={e} group={g} theme={theme} accent={accent} />))}
          </ul>
        </div>
      </main>
    </div>
  );
}

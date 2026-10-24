"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AgentDemo } from "./AgentDemo";
import { Entry } from "./Entry";
import { JumpPalette, type JumpItem } from "./JumpPalette";
import { Roadmap } from "./Roadmap";
import { FOCUS, MONO, Segmented, SectionHead, jumpTo } from "./ui";
import {
  ACCENTS,
  CORNER_RADIUS,
  DEFAULT_ACCENT,
  type Corners,
  type CoreGroup,
  type Planned,
  type Shared,
  type Theme,
} from "./types";

export type { CoreEntry, CoreGroup, Planned } from "./types";

/* -------------------------------------------------------------------------- */
/* Scroll spy                                                                 */
/* -------------------------------------------------------------------------- */

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = els.find((el) => seen.get(el.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/**
 * The page scrolls inside a container below the site topbar, not the window, so
 * `100vh` overshoots and clips the bottom of a sticky rail. Measure the real
 * scroll container instead and keep measuring as it resizes.
 */
function useScrollerHeight(ref: { current: HTMLElement | null }) {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller) {
      const overflow = getComputedStyle(scroller).overflowY;
      if (overflow === "auto" || overflow === "scroll") break;
      scroller = scroller.parentElement;
    }
    const measure = () => setHeight(scroller ? scroller.clientHeight : window.innerHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroller ?? document.documentElement);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);
  return height;
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function Icon({ name }: { name: "search" | "sliders" | "sun" | "moon" | "close" }) {
  const d = {
    search: (
      <>
        <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9.4 9.4 12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
    sliders: (
      <path
        d="M2 4h6M11 4h1M2 10h1M6 10h6M8 2.5v3M4 8.5v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    ),
    sun: (
      <>
        <circle cx="7" cy="7" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M7 1.4v1.3M7 11.3v1.3M1.4 7h1.3M11.3 7h1.3M3 3l.9.9M10.1 10.1l.9.9M11 3l-.9.9M3.9 10.1 3 11"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </>
    ),
    moon: <path d="M11.4 8.6A4.8 4.8 0 0 1 5.4 2.6a5 5 0 1 0 6 6Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
    close: <path d="M3.2 3.2l7.6 7.6M10.8 3.2l-7.6 7.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
  }[name];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      {d}
    </svg>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={`${MONO} mb-2 text-[10px] uppercase tracking-[0.12em] text-[#6f7173]`}>{label}</p>
      {children}
    </div>
  );
}

type Settings = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: string;
  setAccent: (a: string) => void;
  corners: Corners;
  setCorners: (c: Corners) => void;
};

/** Theme, accent, and corners. Lives in the left rail on desktop and a sheet on mobile. */
function SettingsPanel({ s }: { s: Settings }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Theme">
        <Segmented
          label="Preview theme"
          value={s.theme}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
          onChange={s.setTheme}
        />
      </Field>
      <Field label="Accent">
        <div className="flex items-center gap-2.5" role="radiogroup" aria-label="Accent color">
          {ACCENTS.map((a) => {
            const on = a.value === s.accent;
            return (
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={a.name}
                title={a.name}
                onClick={() => s.setAccent(a.value)}
                className={`h-[18px] w-[18px] rounded-full ${FOCUS} ${
                  on ? "ring-2 ring-[#f7f7f7] ring-offset-2 ring-offset-[#0f0f10]" : "ring-1 ring-white/15"
                }`}
                style={{ backgroundColor: a.value }}
              />
            );
          })}
        </div>
      </Field>
      <Field label="Corners">
        <Segmented
          label="Corners"
          value={s.corners}
          dense
          options={[
            { value: "default", label: "Auto" },
            { value: "square", label: "Square" },
            { value: "soft", label: "Soft" },
            { value: "round", label: "Round" },
          ]}
          onChange={s.setCorners}
        />
      </Field>
    </div>
  );
}

/** Bottom sheet that holds the settings on small screens. */
function MobileSheet({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: Settings }) {
  const close = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 lg:hidden" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Preview settings"
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl border-t border-[#2d2d2f] bg-[#161718] px-5 pb-8 pt-4"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-[#f7f7f7]">Preview settings</h2>
          <button
            ref={close}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-md text-[#a5a7a9] hover:bg-[#1f2021] ${FOCUS}`}
          >
            <Icon name="close" />
          </button>
        </div>
        <SettingsPanel s={settings} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function CoreShowcase({ groups, planned }: { groups: CoreGroup[]; planned: Planned }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [corners, setCorners] = useState<Corners>("default");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);
  const rail = useRef<HTMLDivElement | null>(null);
  const railHeight = useScrollerHeight(rail);

  // Restore settings from the URL once, then keep the URL in sync so a
  // configuration can be shared as a link.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("theme");
    const a = q.get("accent");
    const c = q.get("corners");
    if (t === "light" || t === "dark") setTheme(t);
    if (a && ACCENTS.some((x) => x.value === a)) setAccent(a);
    if (c && c in CORNER_RADIUS) setCorners(c as Corners);
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    const q = new URLSearchParams();
    if (theme !== "dark") q.set("theme", theme);
    if (accent !== DEFAULT_ACCENT) q.set("accent", accent);
    if (corners !== "default") q.set("corners", corners);
    const qs = q.toString();
    history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [theme, accent, corners]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? "");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "/" && !typing && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  const radius = CORNER_RADIUS[corners];
  const shared: Shared = useMemo(
    () => ({ theme, accent, ...(radius !== undefined ? { radius } : {}) }),
    [theme, accent, radius],
  );
  const settings: Settings = { theme, setTheme, accent, setAccent, corners, setCorners };

  const basic = groups.filter((g) => g.track === "basic");
  const agentic = groups.filter((g) => g.track === "agentic");
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  const remaining = planned.items.length - total;

  const ids = useMemo(() => groups.flatMap((g) => g.entries.map((e) => e.name)).concat("roadmap"), [groups]);
  const groupOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) for (const e of g.entries) m.set(e.name, g.id);
    return m;
  }, [groups]);
  const active = useScrollSpy(ids);
  const activeGroup = groupOf.get(active);

  const jumpItems: JumpItem[] = useMemo(
    () => [
      ...groups.flatMap((g) => g.entries.map((e) => ({ id: e.name, label: e.displayName, group: g.title }))),
      { id: "roadmap", label: "Roadmap", group: "Plan" },
    ],
    [groups],
  );

  const railGroup = (g: CoreGroup) => {
    const open = activeGroup === g.id;
    return (
      <li key={g.id}>
        <a
          href={`#group-${g.id}`}
          onClick={(e) => {
            e.preventDefault();
            jumpTo(`group-${g.id}`);
          }}
          aria-current={open ? "location" : undefined}
          className={`flex items-center justify-between rounded py-[3px] pl-3 pr-1 text-[13px] ${FOCUS} ${
            open ? "text-[#f7f7f7]" : "text-[#8a8c8f] hover:text-[#f7f7f7]"
          }`}
        >
          <span>{g.title}</span>
          <span className={`${MONO} text-[10px] text-[#5c5e60]`}>{g.entries.length}</span>
        </a>
        {open && (
          <ul className="mb-1 ml-3 border-l border-[#2d2d2f]">
            {g.entries.map((e) => (
              <li key={e.name}>
                <a
                  href={`#${e.name}`}
                  onClick={(ev) => {
                    ev.preventDefault();
                    jumpTo(e.name);
                  }}
                  aria-current={active === e.name ? "location" : undefined}
                  className={`-ml-px block rounded-sm border-l py-[3px] pl-3 text-[12.5px] ${FOCUS} ${
                    active === e.name
                      ? "border-[#fa7319] text-[#f7f7f7]"
                      : "border-transparent text-[#8a8c8f] hover:text-[#f7f7f7]"
                  }`}
                >
                  {e.displayName}
                </a>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  const trackBlock = (
    groupsOfTrack: CoreGroup[],
    start: number,
    prefix: string,
    sectionNumber: string,
    title: string,
    intro: string,
  ) => {
    let n = start;
    return (
      <div className="mt-24 first:mt-0">
        <SectionHead number={sectionNumber} title={title}>
          {intro}
        </SectionHead>
        {groupsOfTrack.map((g) => (
          <div key={g.id} className="mt-16">
            <div id={`group-${g.id}`} className="scroll-mt-6">
              <div className="flex items-baseline gap-3">
                <h3 className="text-[22px] font-medium tracking-[-0.025em] text-[#f7f7f7]">{g.title}</h3>
                <span className={`${MONO} text-[11px] text-[#6f7173]`}>
                  {g.entries.length} {g.entries.length === 1 ? "component" : "components"}
                </span>
              </div>
              <p className="mt-1.5 max-w-[34rem] text-[13.5px] leading-[1.55] text-[#8a8c8f]">{g.note}</p>
            </div>
            <div className="mt-6">
              {g.entries.map((e) => {
                n += 1;
                const num = prefix === "" ? String(n).padStart(2, "0") : `${prefix}${n}`;
                return <Entry key={e.name} entry={e} number={num} shared={shared} />;
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="w-full px-6 pb-40 sm:px-8 lg:grid lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-10 lg:px-10 xl:grid-cols-[224px_minmax(0,1fr)] xl:gap-12 2xl:grid-cols-[248px_minmax(0,1fr)] 2xl:gap-16 2xl:px-14">
        <aside className="hidden lg:block">
          <div
            ref={rail}
            className="sticky top-0 -mx-2 overflow-y-auto px-2 pb-6 pt-6"
            style={{ maxHeight: railHeight ?? "calc(100vh - 8rem)" }}
          >
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className={`flex h-9 w-full items-center gap-2.5 rounded-md border border-[#2d2d2f] bg-[#131415] px-3 text-[13px] text-[#8a8c8f] hover:border-[#3e3f40] hover:text-[#f7f7f7] ${FOCUS}`}
            >
              <Icon name="search" />
              <span className="flex-1 text-left">Search</span>
              <kbd className={`${MONO} rounded border border-[#2d2d2f] px-1.5 text-[10px] text-[#6f7173]`}>⌘K</kbd>
            </button>

            <div className="mt-4 border-t border-[#232526] pt-4">
              <SettingsPanel s={settings} />
            </div>

            <nav aria-label="Component types" className="mt-4 border-t border-[#232526] pt-4">
              <p className={`${MONO} mb-1.5 text-[10px] uppercase tracking-[0.12em] text-[#6f7173]`}>Core UI</p>
              <ul>{basic.map(railGroup)}</ul>
              <p className={`${MONO} mb-1.5 mt-5 text-[10px] uppercase tracking-[0.12em] text-[#6f7173]`}>Agentic UI</p>
              <ul>{agentic.map(railGroup)}</ul>
              <ul className="mt-5">
                <li>
                  <a
                    href="#roadmap"
                    onClick={(e) => {
                      e.preventDefault();
                      jumpTo("roadmap");
                    }}
                    aria-current={active === "roadmap" ? "location" : undefined}
                    className={`flex items-center justify-between rounded py-[3px] pl-3 pr-1 text-[13px] ${FOCUS} ${
                      active === "roadmap" ? "text-[#f7f7f7]" : "text-[#8a8c8f] hover:text-[#f7f7f7]"
                    }`}
                  >
                    <span>Roadmap</span>
                    <span className={`${MONO} text-[10px] text-[#5c5e60]`}>{planned.items.length}</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="grid items-center gap-12 pb-20 pt-14 sm:pt-20 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,620px)] 2xl:gap-20">
            <div>
              <p className={`${MONO} text-[11px] uppercase tracking-[0.12em] text-[#7a7c7f]`}>Originkit · Core</p>
              <h1 className="mt-6 text-[clamp(64px,9vw,112px)] font-medium leading-[0.88] tracking-[-0.055em] text-[#f7f7f7]">
                Core
              </h1>
              <p className="mt-8 max-w-[28rem] text-[17px] leading-[1.55] text-[#b7b7b8]">
                The parts every interface needs, and the parts every agent product needs. Framer-safe,
                keyboard-accessible, and themeable.
                <span className="hidden lg:inline"> Change the theme, accent, or corners on the left and every component here follows.</span>
                <span className="lg:hidden"> Use Customize below to change the theme, accent, or corners.</span>
              </p>
              <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-4">
                {[
                  [String(total), "Components"],
                  [String(groups.length), "Types"],
                  [String(remaining), "On the roadmap"],
                ].map(([n, label]) => (
                  <div key={label}>
                    <dd className="text-[28px] font-medium leading-none tracking-[-0.03em] text-[#f7f7f7]">{n}</dd>
                    <dt className={`${MONO} mt-2 text-[11px] uppercase tracking-[0.1em] text-[#7a7c7f]`}>{label}</dt>
                  </div>
                ))}
              </dl>
            </div>
            <AgentDemo shared={shared} />
          </header>

          {trackBlock(
            basic,
            0,
            "",
            "01",
            "Core UI",
            "Buttons, fields, menus, tables, and the page patterns built from them. The pieces that appear on every screen, built to feel the same everywhere.",
          )}
          {trackBlock(
            agentic,
            0,
            "A",
            "02",
            "Agentic UI",
            "What a person needs to see when software acts on their behalf: what it is doing, what it wants to do next, what it changed, and a clear way to say yes or no.",
          )}

          <div className="mt-24">
            <Roadmap planned={planned} number="03" />
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center lg:hidden">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-[#2d2d2f] bg-[#131415]/90 p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-[#f7f7f7] hover:bg-[#1f2021] ${FOCUS}`}
          >
            <Icon name="search" />
            Search
          </button>
          <button
            type="button"
            aria-label={theme === "dark" ? "Switch preview to light" : "Switch preview to dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-[#f7f7f7] hover:bg-[#1f2021] ${FOCUS}`}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setSheetOpen(true)}
            className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-[#f7f7f7] hover:bg-[#1f2021] ${FOCUS}`}
          >
            <Icon name="sliders" />
            Customize
          </button>
        </div>
      </div>

      <MobileSheet open={sheetOpen} onClose={() => setSheetOpen(false)} settings={settings} />
      <JumpPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={jumpItems} />
    </div>
  );
}

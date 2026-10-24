"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export const MONO = "font-[family-name:var(--font-geist-mono,ui-monospace,SFMono-Regular,Menlo,monospace)]";
export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fa7319]";

/** Move a roving-tabindex group with the arrow keys, Home, and End. */
function useRoving(count: number, current: number, select: (i: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (next: number) => {
    const i = (next + count) % count;
    select(i);
    refs.current[i]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") move(current + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(current - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(count - 1);
    else return;
    e.preventDefault();
  };
  return { refs, onKeyDown };
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  dense = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** Tighter padding, for the narrow left rail. */
  dense?: boolean;
}) {
  const index = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  );
  const { refs, onKeyDown } = useRoving(options.length, index, (i) => onChange(options[i].value));

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={`inline-flex flex-wrap ${dense ? "gap-0.5" : "gap-1"}`}>
      {options.map((o, i) => {
        const on = i === index;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`h-7 rounded-md text-[12px] font-medium transition-colors ${dense ? "px-2" : "px-2.5"} ${FOCUS} ${
              on ? "bg-[#2d2f30] text-[#f7f7f7]" : "text-[#9a9c9e] hover:bg-[#1f2021] hover:text-[#f7f7f7]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabList<T extends string>({
  label,
  idPrefix,
  value,
  tabs,
  onChange,
  trailing,
}: {
  label: string;
  idPrefix: string;
  value: T;
  tabs: { value: T; label: string }[];
  onChange: (v: T) => void;
  trailing?: ReactNode;
}) {
  const index = Math.max(
    tabs.findIndex((t) => t.value === value),
    0,
  );
  const { refs, onKeyDown } = useRoving(tabs.length, index, (i) => onChange(tabs[i].value));

  return (
    <div className="flex items-end justify-between gap-4 border-b border-[#2d2d2f]">
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-5">
        {tabs.map((t, i) => {
          const on = i === index;
          return (
            <button
              key={t.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${idPrefix}-tab-${t.value}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${idPrefix}-panel-${t.value}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.value)}
              className={`-mb-px rounded-sm border-b-2 py-2.5 text-[13px] font-medium ${FOCUS} ${
                on
                  ? "border-[#fa7319] text-[#f7f7f7]"
                  : "border-transparent text-[#8a8c8f] hover:text-[#f7f7f7]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="flex items-center gap-4 pb-2">{trailing}</div> : null}
    </div>
  );
}

export function SectionHead({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className={`${MONO} text-[11px] tracking-[0.08em] text-[#7a7c7f]`}>{number}</p>
      <h2 className="mt-3 text-[44px] font-medium leading-[1] tracking-[-0.04em] text-[#f7f7f7]">{title}</h2>
      {children ? (
        <p className="mt-4 max-w-[34rem] text-[15px] leading-[1.6] text-[#a5a7a9]">{children}</p>
      ) : null}
    </div>
  );
}

export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Long smooth scrolls sweep past a dozen entries and feel slow. Glide only
  // for nearby targets, and jump straight to far ones.
  const near = Math.abs(el.getBoundingClientRect().top) < 1400;
  el.scrollIntoView({ behavior: reduce || !near ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `${window.location.search}#${id}`);
}

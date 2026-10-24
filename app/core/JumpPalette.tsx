"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MONO, jumpTo } from "./ui";

export type JumpItem = { id: string; label: string; group: string };

/** A small search-and-jump dialog. Arrow keys move, Enter jumps, Escape closes. */
export function JumpPalette({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: JumpItem[];
}) {
  const uid = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q) || i.id.includes(q)) : items;
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const returnTo = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => returnTo?.focus?.();
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const choose = (item: JumpItem | undefined) => {
    if (!item) return;
    onClose();
    window.setTimeout(() => jumpTo(item.id), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[14vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a component"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] overflow-hidden rounded-xl border border-[#2d2d2f] bg-[#161718] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
      >
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={`${uid}-list`}
          aria-activedescendant={results[index] ? `${uid}-${results[index].id}` : undefined}
          aria-label="Search components"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a component…"
          className="h-12 w-full border-b border-[#2d2d2f] bg-transparent px-4 text-[15px] text-[#f7f7f7] outline-none placeholder:text-[#6f7173]"
        />
        <ul id={`${uid}-list`} role="listbox" aria-label="Components" className="max-h-[320px] overflow-y-auto p-1.5">
          {results.map((item, i) => (
            <li
              key={item.id}
              id={`${uid}-${item.id}`}
              role="option"
              aria-selected={i === index}
              onMouseMove={() => setIndex(i)}
              onClick={() => choose(item)}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-[14px] ${
                i === index ? "bg-[#26282a] text-[#f7f7f7]" : "text-[#b7b7b8]"
              }`}
            >
              <span>{item.label}</span>
              <span className={`${MONO} text-[11px] uppercase tracking-[0.08em] text-[#6f7173]`}>{item.group}</span>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-[#8a8c8f]">No match.</li>}
        </ul>
        <div className={`${MONO} flex gap-4 border-t border-[#2d2d2f] px-4 py-2 text-[11px] text-[#6f7173]`}>
          <span>↑↓ move</span>
          <span>↵ jump</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}


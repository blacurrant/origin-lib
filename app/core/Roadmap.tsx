"use client";

import { useState } from "react";
import { FOCUS, MONO, Segmented, SectionHead, jumpTo } from "./ui";
import type { Planned, PlannedItem } from "./types";

const RELEASE: Record<PlannedItem["tier"], string> = { Core: "v1", Next: "v1.1", Later: "v2" };

/** Roadmap rows that are already built, mapped to their entry. */
const BUILT: Record<string, string> = {
  Button: "button",
  "Text input": "text-input",
  Switch: "switch",
  Checkbox: "checkbox",
  "Segmented control": "segmented-control",
  Tabs: "tabs",
  Dialog: "dialog",
  Toast: "toast",
  "Badge and tag": "badge",
  Card: "card",
  Message: "message-bubble",
  "Chat thread": "chat-thread",
  "Streaming text": "streaming-text",
  "Prompt composer": "prompt-composer",
  "Agent status": "agent-status",
  "Reasoning trace": "reasoning-trace",
  "Tool call card": "tool-call-card",
  "Tool approval": "approval-card",
  "Plan and task list": "plan-list",
  Suggestions: "suggestion-chips",
  "Dropdown menu": "dropdown-menu",
  Tooltip: "tooltip",
  "Alert banner": "alert",
  "Data table": "data-table",
  "Split pane": "split-pane",
  "Scroll area": "scroll-area",
  Carousel: "carousel",
  "Image viewer": "image-viewer",
  "Diff review": "diff-review",
  "Terminal output": "terminal-output",
  "Sign-in and sign-up": "sign-in-form",
  Pricing: "pricing-table",
};

export function Roadmap({ planned, number }: { planned: Planned; number: string }) {
  const [track, setTrack] = useState<"all" | "basic" | "agentic">("all");
  const [tier, setTier] = useState<"all" | "Core" | "Next" | "Later">("all");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const visible = planned.items.filter((i) => {
    const group = planned.groups.find((g) => g.id === i.group);
    if (track !== "all" && group?.track !== track) return false;
    if (tier !== "all" && i.tier !== tier) return false;
    if (onlyOpen && BUILT[i.name]) return false;
    return true;
  });
  const builtCount = planned.items.filter((i) => BUILT[i.name]).length;

  return (
    <section id="roadmap" data-spy className="scroll-mt-6 border-t border-[#2d2d2f] pt-14">
      <SectionHead number={number} title="Roadmap">
        The full set we are building toward: {planned.items.length} components, {builtCount} of them done. Filter by area,
        by release, or hide what is already built.
      </SectionHead>

      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Segmented
          label="Area"
          value={track}
          options={[
            { value: "all", label: "All areas" },
            { value: "basic", label: "Basic UI" },
            { value: "agentic", label: "Agentic UI" },
          ]}
          onChange={setTrack}
        />
        <Segmented
          label="Release"
          value={tier}
          options={[
            { value: "all", label: "Any release" },
            { value: "Core", label: "v1" },
            { value: "Next", label: "v1.1" },
            { value: "Later", label: "v2" },
          ]}
          onChange={setTier}
        />
        <label className={`flex cursor-pointer items-center gap-2 text-[12px] text-[#a5a7a9]`}>
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
            className={`h-3.5 w-3.5 accent-[#fa7319] ${FOCUS}`}
          />
          Hide built
        </label>
        <span className="text-[12px] text-[#7a7c7f]" aria-live="polite">
          {visible.length} of {planned.items.length}
        </span>
      </div>

      <div className="mt-8">
        {planned.groups.map((group) => {
          const rows = visible.filter((i) => i.group === group.id);
          if (!rows.length) return null;
          return (
            <div key={group.id} className="border-t border-[#2d2d2f] py-8 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
              <div className="mb-4 lg:mb-0">
                <h3 className="text-[17px] font-medium tracking-[-0.015em] text-[#f7f7f7]">{group.title}</h3>
                <p className={`${MONO} mt-1 text-[11px] uppercase tracking-[0.08em] text-[#7a7c7f]`}>
                  {group.track === "agentic" ? "Agentic" : "Basic"} · {rows.length}
                </p>
                <p className="mt-2 max-w-[22rem] text-[13px] leading-[1.55] text-[#8a8c8f]">{group.note}</p>
              </div>
              <ul className="divide-y divide-[#232526]">
                {rows.map((row) => {
                  const slug = BUILT[row.name];
                  return (
                    <li
                      key={row.name}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-3 sm:grid-cols-[200px_minmax(0,1fr)_72px]"
                    >
                      <span className="text-[14px] font-medium text-[#f7f7f7]">{row.name}</span>
                      <span className="order-3 col-span-2 text-[13px] leading-[1.5] text-[#8a8c8f] sm:order-none sm:col-span-1">
                        {row.purpose}
                      </span>
                      {slug ? (
                        <a
                          href={`#${slug}`}
                          onClick={(e) => {
                            e.preventDefault();
                            jumpTo(slug);
                          }}
                          className={`${MONO} justify-self-end rounded text-[11px] uppercase tracking-[0.08em] text-[#fa7319] underline underline-offset-4 ${FOCUS}`}
                        >
                          Built
                        </a>
                      ) : (
                        <span className={`${MONO} justify-self-end text-[11px] uppercase tracking-[0.08em] text-[#7a7c7f]`}>
                          {RELEASE[row.tier]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="border-t border-[#2d2d2f] py-10 text-[14px] text-[#8a8c8f]">Nothing matches these filters.</p>
        )}
      </div>
    </section>
  );
}

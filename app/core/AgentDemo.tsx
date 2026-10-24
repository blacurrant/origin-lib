"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { components as library } from "@/lib/originkit-library";
import { FOCUS, MONO } from "./ui";
import type { Shared } from "./types";

const STEPS = [
  { label: "Read the question and the billing schema", seconds: 0.7 },
  { label: "Searched failed payments since July 1", seconds: 1.4 },
  { label: "Matched retries to recovered accounts", seconds: 1.9 },
];

const ANSWER =
  "Posted to #finance. $48.2k was recovered across 247 accounts, and about 60% of it came from card retries rather than manual outreach.";

type Phase = "reasoning" | "tool" | "approval" | "writing" | "done" | "declined" | "stopped";

const WORKING: Phase[] = ["reasoning", "tool", "writing"];

/**
 * A scripted agent run built only from Core components. It exists to show how
 * the pieces fit together: reasoning, a tool call, an approval, then the answer.
 */
export function AgentDemo({ shared }: { shared: Shared }) {
  const reduced = useReducedMotion();
  const dark = shared.theme === "dark";
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>("reasoning");
  const [steps, setSteps] = useState(1);
  const [toolDone, setToolDone] = useState(false);
  const timers = useRef<number[]>([]);
  const scroller = useRef<HTMLDivElement | null>(null);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    clear();
    if (reduced) {
      setSteps(3);
      setToolDone(true);
      setPhase("approval");
      return clear;
    }
    setPhase("reasoning");
    setSteps(1);
    setToolDone(false);
    later(900, () => setSteps(2));
    later(1800, () => setSteps(3));
    later(2700, () => setPhase("tool"));
    later(4300, () => setToolDone(true));
    later(4900, () => setPhase("approval"));
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, reduced]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [phase, steps, toolDone, reduced]);

  const approve = () => {
    setPhase("writing");
    later(500, () => setPhase("done"));
  };
  const reject = () => setPhase("declined");
  const stop = () => {
    clear();
    setPhase("stopped");
  };

  const MessageBubble = library["message-bubble"];
  const ReasoningTrace = library["reasoning-trace"];
  const ToolCallCard = library["tool-call-card"];
  const ApprovalCard = library["approval-card"];
  const StreamingText = library["streaming-text"];
  const SuggestionChips = library["suggestion-chips"];
  const PromptComposer = library["prompt-composer"];
  const AgentStatus = library["agent-status"];

  const status =
    phase === "approval"
      ? { state: "waiting", label: "Needs your approval" }
      : phase === "reasoning"
        ? { state: "thinking", label: "Reasoning" }
        : phase === "tool"
          ? { state: "thinking", label: "Running a tool" }
          : phase === "writing"
            ? { state: "thinking", label: "Writing" }
            : phase === "stopped"
              ? { state: "idle", label: "Stopped" }
              : phase === "declined"
                ? { state: "idle", label: "Declined" }
                : { state: "idle", label: "Done" };

  const showTool = phase !== "reasoning";
  const showApproval = ["approval", "writing", "done", "declined"].includes(phase);
  const label = `text-[12px] font-semibold ${dark ? "text-[#8a8c8f]" : "text-[#76736d]"}`;

  return (
    <div
      className={`flex h-[560px] flex-col overflow-hidden rounded-2xl border 2xl:h-[640px] ${
        dark ? "border-[#2d2d2f] bg-[#101011]" : "border-[#e0ddd7] bg-[#faf9f7]"
      }`}
      role="region"
      aria-label="Live agent demo"
    >
      <div className={`flex items-center justify-between gap-3 border-b px-5 py-3 ${dark ? "border-[#232526]" : "border-[#e4e1db]"}`}>
        <div className="min-w-0">
          <div className={`text-[13px] font-semibold ${dark ? "text-[#f7f7f7]" : "text-[#141413]"}`}>Billing analyst</div>
          <div className={`${MONO} hidden text-[10px] uppercase tracking-[0.1em] sm:block ${dark ? "text-[#6f7173]" : "text-[#76736d]"}`}>
            Built from Core components
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AgentStatus {...shared} state={status.state} label={status.label} />
          <button
            type="button"
            onClick={() => setRun((n) => n + 1)}
            className={`rounded text-[12px] font-medium underline underline-offset-4 ${FOCUS} ${
              dark ? "text-[#a5a7a9] hover:text-[#f7f7f7]" : "text-[#5c5a55] hover:text-[#141413]"
            }`}
          >
            Replay
          </button>
        </div>
      </div>

      <div ref={scroller} className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <MessageBubble
          {...shared}
          role="user"
          text="How much revenue did we recover from failed payments in Q3?"
          timestamp="10:41"
        />
        <div className="flex flex-col gap-1.5">
          <span className={label}>Assistant</span>
          <ReasoningTrace {...shared} steps={STEPS.slice(0, steps)} running={phase === "reasoning"} defaultOpen />
        </div>
        {showTool && (
          <ToolCallCard
            {...shared}
            name="search_billing_events"
            input='{ "status": "failed", "since": "2026-07-01" }'
            output="412 events matched. 247 later retried successfully."
            status={toolDone ? "done" : "running"}
            seconds={1.6}
            defaultOpen={false}
          />
        )}
        {showApproval && (
          <ApprovalCard
            {...shared}
            risk="low"
            action="Post the summary to #finance"
            details="Message: Q3 failed-payment recovery. $48.2k recovered across 247 accounts. Posted as Billing analyst."
            onApprove={approve}
            onReject={reject}
          />
        )}
        {phase === "done" && (
          <div className="flex flex-col gap-3">
            <span className={label}>Assistant</span>
            <StreamingText key={run} {...shared} text={ANSWER} speed={28} />
            <SuggestionChips {...shared} items={["Show it by month", "Which accounts?", "Draft a note to finance"]} />
          </div>
        )}
        {phase === "declined" && (
          <MessageBubble
            {...shared}
            text="Okay, I won't post it. Want me to send the summary to you instead?"
            timestamp="10:42"
            showActions={false}
          />
        )}
        {phase === "stopped" && (
          <MessageBubble {...shared} text="Stopped. Nothing was posted." timestamp="10:42" showActions={false} />
        )}
      </div>

      <div className={`border-t p-4 ${dark ? "border-[#232526]" : "border-[#e4e1db]"}`}>
        <PromptComposer
          {...shared}
          placeholder="Ask a follow-up…"
          isRunning={WORKING.includes(phase)}
          onSend={() => setRun((n) => n + 1)}
          onStop={stop}
        />
      </div>
    </div>
  );
}

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * PlanList: the steps an agent plans to take, each done, running, or pending,
 * with a progress count. The running step is the only one in full contrast, so
 * the eye lands on what is happening now.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 380
 * @framerIntrinsicHeight 220
 */

type Theme = "dark" | "light"
type StepStatus = "done" | "running" | "pending"

interface Step {
    label: string
    status: StepStatus
}

interface PlanListProps {
    title: string
    steps: Step[]
    accent: string
    theme: Theme
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        track: dark ? "#2d2d2f" : "#e4e1db",
        line: dark ? "#2d2d2f" : "#e4e1db",
        pending: dark ? "#5a5c5e" : "#a39f96",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#8f9193" : "#76736d",
        success: dark ? "#3dd68c" : "#12794a",
    }
}

const SAMPLE: Step[] = [
    { label: "Pull Q3 revenue from Stripe", status: "done" },
    { label: "Join with customer churn data", status: "done" },
    { label: "Draft the summary", status: "running" },
    { label: "Post it to #finance", status: "pending" },
]

export default function PlanList({
    title = "Plan",
    steps = SAMPLE,
    accent = "#fa7319",
    theme = "dark",
}: Partial<PlanListProps>) {
    const p = palette(theme)
    const list = steps.length ? steps : SAMPLE
    const doneCount = list.filter((s) => s.status === "done").length
    const percent = Math.round((doneCount / list.length) * 100)

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    padding: 16,
                    borderRadius: 12,
                    background: p.surface,
                    border: `1px solid ${p.line}`,
                    color: p.text,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em" }}>{title}</span>
                    <span style={{ fontSize: 12, color: p.soft, fontVariantNumeric: "tabular-nums" }}>
                        {doneCount} of {list.length} done
                    </span>
                </div>
                <div
                    role="progressbar"
                    aria-label="Plan progress"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{ marginTop: 10, height: 3, borderRadius: 3, background: p.track, overflow: "hidden" }}
                >
                    <motion.div
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.35 }}
                        style={{ height: "100%", background: accent }}
                    />
                </div>
                <ol style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 11 }}>
                    {list.map((step, i) => (
                        <li
                            key={i}
                            aria-current={step.status === "running" ? "step" : undefined}
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                fontSize: 14,
                                lineHeight: 1.4,
                                fontWeight: step.status === "running" ? 500 : 400,
                                color: step.status === "running" ? p.text : p.soft,
                            }}
                        >
                            <Mark status={step.status} accent={accent} done={p.success} pending={p.pending} />
                            <span>
                                {step.label}
                                <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                                    {" "}
                                    ({step.status})
                                </span>
                            </span>
                        </li>
                    ))}
                </ol>
            </div>
        </MotionConfig>
    )
}

function Mark({ status, accent, done, pending }: { status: StepStatus; accent: string; done: string; pending: string }) {
    const box: React.CSSProperties = { width: 16, height: 16, marginTop: 2, flexShrink: 0, display: "inline-block" }
    if (status === "done") {
        return (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden style={{ ...box, color: done }}>
                <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 8.2 7.1 10.2 11 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    }
    if (status === "running") {
        return (
            <motion.span
                aria-hidden
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                style={{
                    ...box,
                    borderRadius: "50%",
                    borderWidth: 1.5,
                    borderStyle: "solid",
                    borderTopColor: `${accent}`,
                    borderLeftColor: `${accent}`,
                    borderBottomColor: `${accent}`,
                    borderRightColor: "transparent",
                    boxSizing: "border-box",
                }}
            />
        )
    }
    return (
        <span
            aria-hidden
            style={{ ...box, borderRadius: "50%", border: `1.5px solid ${pending}`, boxSizing: "border-box" }}
        />
    )
}

addPropertyControls(PlanList, {
    title: { type: ControlType.String, title: "Title", defaultValue: "Plan" },
    steps: {
        type: ControlType.Array,
        title: "Steps",
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, title: "Label", defaultValue: "" },
                status: {
                    type: ControlType.Enum,
                    title: "Status",
                    options: ["done", "running", "pending"],
                    optionTitles: ["Done", "Running", "Pending"],
                    defaultValue: "pending",
                },
            },
        },
        defaultValue: SAMPLE,
    },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
})

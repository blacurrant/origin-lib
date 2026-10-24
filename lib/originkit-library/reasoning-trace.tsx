import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * ReasoningTrace: the steps an agent took, folded away by default. The header
 * says how long it thought, and opens to a timeline of steps with durations.
 * While `running`, the header pulses and the last step is marked live.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 120
 */

type Theme = "dark" | "light"

interface Step {
    label: string
    seconds: number
}

interface ReasoningTraceProps {
    steps: Step[]
    running: boolean
    defaultOpen: boolean
    accent: string
    theme: Theme
}

function palette(theme: Theme) {
    return theme === "light"
        ? { line: "#d8d4cc", text: "#141413", soft: "#5c5a55", faint: "#76736d" }
        : { line: "#3e3f40", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f" }
}

const SAMPLE: Step[] = [
    { label: "Read the question and the attached report", seconds: 0.8 },
    { label: "Searched billing events for failed payments", seconds: 1.6 },
    { label: "Compared recovered accounts by cause", seconds: 2.1 },
]

export default function ReasoningTrace({
    steps = SAMPLE,
    running = false,
    defaultOpen = true,
    accent = "#fa7319",
    theme = "dark",
}: Partial<ReasoningTraceProps>) {
    const p = palette(theme)
    const uid = React.useId()
    const [open, setOpen] = React.useState(defaultOpen)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const total = steps.reduce((sum, s) => sum + s.seconds, 0)

    return (
        <MotionConfig reducedMotion="user">
            <div style={{ width: "100%", fontFamily: "inherit", color: p.text }}>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${uid}-steps`}
                    onClick={() => setOpen((v) => !v)}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 6px 4px 0",
                        background: "none",
                        border: "none",
                        borderRadius: 6,
                        color: p.soft,
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: 2,
                    }}
                >
                    <motion.svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        aria-hidden
                        animate={{ rotate: open ? 90 : 0 }}
                        transition={{ duration: 0.14 }}
                    >
                        <path d="M4.2 2.6 7.8 6l-3.6 3.4" fill="none" stroke={theme === "light" ? `color-mix(in srgb, ${accent} 62%, #141413)` : accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                    <motion.span
                        animate={running ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                        transition={running ? { duration: 1.3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}
                    >
                        {running ? "Thinking…" : `Thought for ${total.toFixed(1)}s`}
                    </motion.span>
                </button>
                <AnimatePresence initial={false}>
                    {open && (
                        <motion.ol
                            id={`${uid}-steps`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{
                                margin: "6px 0 0 5px",
                                padding: "2px 0 2px 16px",
                                listStyle: "none",
                                overflow: "hidden",
                                borderLeft: `1px solid ${p.line}`,
                            }}
                        >
                            {steps.map((step, i) => {
                                const live = running && i === steps.length - 1
                                return (
                                    <li
                                        key={i}
                                        style={{
                                            position: "relative",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 16,
                                            padding: "5px 0",
                                            fontSize: 13,
                                            lineHeight: 1.45,
                                            color: live ? p.text : p.soft,
                                        }}
                                    >
                                        <span aria-hidden style={{ position: "absolute", left: -19, top: 12, width: 5, height: 5, borderRadius: "50%", background: accent, opacity: live ? 1 : 0.75 }} />
                                        <span>{step.label}</span>
                                        <span style={{ fontVariantNumeric: "tabular-nums", color: p.faint, flexShrink: 0 }}>
                                            {live ? "…" : `${step.seconds.toFixed(1)}s`}
                                        </span>
                                    </li>
                                )
                            })}
                        </motion.ol>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(ReasoningTrace, {
    steps: {
        type: ControlType.Array,
        title: "Steps",
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, title: "Label", defaultValue: "" },
                seconds: { type: ControlType.Number, title: "Seconds", defaultValue: 1, min: 0, max: 120, step: 0.1 },
            },
        },
        defaultValue: SAMPLE,
    },
    running: { type: ControlType.Boolean, title: "Running", defaultValue: false },
    defaultOpen: { type: ControlType.Boolean, title: "Open by default", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
})

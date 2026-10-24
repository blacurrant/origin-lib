import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * ToolCallCard: one tool call an agent made. The header always shows the tool
 * name, its status, and how long it took. Input and result fold open below.
 * Running calls show a spinner and no result yet, failed calls say so in text.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 190
 */

type Theme = "dark" | "light"
type Status = "running" | "done" | "failed"

interface ToolCallCardProps {
    name: string
    input: string
    output: string
    status: Status
    seconds: number
    defaultOpen: boolean
    accent: string
    theme: Theme
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        code: dark ? "#141415" : "#f3f1ed",
        line: dark ? "#2d2d2f" : "#e4e1db",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#b7b7b8" : "#5c5a55",
        faint: dark ? "#8a8c8f" : "#76736d",
        success: dark ? "#3dd68c" : "#12794a",
        danger: dark ? "#ff7a70" : "#c42a1d",
    }
}

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, monospace'

export default function ToolCallCard({
    name = "search_billing_events",
    input = '{ "status": "failed", "since": "2026-07-01" }',
    output = "412 events matched. 247 later retried successfully.",
    status = "done",
    seconds = 1.6,
    defaultOpen = true,
    accent = "#fa7319",
    theme = "dark",
}: Partial<ToolCallCardProps>) {
    const p = palette(theme)
    const uid = React.useId()
    const [open, setOpen] = React.useState(defaultOpen)
    const [focusVisible, setFocusVisible] = React.useState(false)

    const label = { running: "Running", done: "Done", failed: "Failed" }[status] ?? "Done"
    const statusColor = status === "failed" ? p.danger : status === "done" ? p.success : accent

    const block: React.CSSProperties = {
        margin: 0,
        padding: "10px 12px",
        borderRadius: 8,
        background: p.code,
        color: p.text,
        fontFamily: MONO,
        fontSize: 12,
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    }
    const caption: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: p.faint,
        fontFamily: MONO,
        marginBottom: 6,
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    borderRadius: 12,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    color: p.text,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    overflow: "hidden",
                }}
            >
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${uid}-body`}
                    onClick={() => setOpen((v) => !v)}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "11px 14px",
                        background: "none",
                        border: "none",
                        color: p.text,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        textAlign: "left",
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: -2,
                    }}
                >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <motion.svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            aria-hidden
                            animate={{ rotate: open ? 90 : 0 }}
                            transition={{ duration: 0.14 }}
                            style={{ flexShrink: 0 }}
                        >
                            <path d="M4.2 2.6 7.8 6l-3.6 3.4" fill="none" stroke={p.faint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </motion.svg>
                        <code style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: theme === "light" ? `color-mix(in srgb, ${accent} 62%, #141413)` : accent }}>
                            {name}
                        </code>
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: statusColor, fontWeight: 500, flexShrink: 0 }}>
                        {status === "running" && (
                            <motion.span
                                aria-hidden
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                                style={{
                                    width: 11,
                                    height: 11,
                                    borderRadius: "50%",
                                    borderWidth: 1.5,
                                    borderStyle: "solid",
                                    borderTopColor: "currentColor",
                                    borderLeftColor: "currentColor",
                                    borderBottomColor: "currentColor",
                                    borderRightColor: "transparent",
                                    display: "inline-block",
                                }}
                            />
                        )}
                        {label}
                        {status !== "running" && seconds > 0 ? (
                            <span style={{ color: p.faint, fontVariantNumeric: "tabular-nums", fontWeight: 400 }}>{seconds.toFixed(1)}s</span>
                        ) : null}
                    </span>
                </button>
                <AnimatePresence initial={false}>
                    {open && (
                        <motion.div
                            id={`${uid}-body`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: "hidden" }}
                        >
                            <div style={{ padding: "2px 14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                                <div>
                                    <div style={caption}>Input</div>
                                    <pre style={block}>{input}</pre>
                                </div>
                                {status !== "running" && (
                                    <div>
                                        <div style={caption}>{status === "failed" ? "Error" : "Result"}</div>
                                        <pre style={{ ...block, color: status === "failed" ? p.danger : p.text }}>{output}</pre>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(ToolCallCard, {
    name: { type: ControlType.String, title: "Tool name", defaultValue: "search_billing_events" },
    input: {
        type: ControlType.String,
        title: "Input",
        defaultValue: '{ "status": "failed", "since": "2026-07-01" }',
        displayTextArea: true,
    },
    output: {
        type: ControlType.String,
        title: "Output",
        defaultValue: "412 events matched. 247 later retried successfully.",
        displayTextArea: true,
    },
    status: {
        type: ControlType.Enum,
        title: "Status",
        options: ["running", "done", "failed"],
        optionTitles: ["Running", "Done", "Failed"],
        defaultValue: "done",
    },
    seconds: { type: ControlType.Number, title: "Seconds", defaultValue: 1.6, min: 0, max: 120, step: 0.1 },
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

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useReducedMotion } from "framer-motion"

/**
 * TerminalOutput: the output of a command an agent ran. The header shows the
 * command and an exit status in words, the body streams lines in and follows
 * the newest one, and the whole output can be copied. Lines that start with a
 * check, a cross, or "warn" are colored, but the text itself always says so.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 520
 * @framerIntrinsicHeight 280
 */

type Theme = "dark" | "light"
type Status = "running" | "passed" | "failed"

interface TerminalOutputProps {
    command: string
    lines: string[]
    status: Status
    seconds: number
    stream: boolean
    speed: number
    height: number
    accent: string
    theme: Theme
    radius: number
}

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, monospace'

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#101011" : "#faf9f7",
        head: dark ? "#161718" : "#f1efeb",
        line: dark ? "#2d2d2f" : "#e4e1db",
        strong: dark ? "#3e3f40" : "#c9c5bc",
        text: dark ? "#e4e5e6" : "#1f1f1d",
        soft: dark ? "#9a9c9e" : "#5c5a55",
        faint: dark ? "#6f7173" : "#8a8780",
        success: dark ? "#3dd68c" : "#12794a",
        danger: dark ? "#ff7a70" : "#c42a1d",
        warn: dark ? "#f5b14a" : "#9a5b00",
    }
}

const LINES = [
    "RUN  v2.1.0 /app",
    "✓ billing/retry.test.ts (6 tests) 112ms",
    "✓ billing/charge.test.ts (9 tests) 204ms",
    "warn  slow test: webhooks/stripe.test.ts took 1.8s",
    "✓ webhooks/stripe.test.ts (4 tests) 1802ms",
    "✗ billing/refund.test.ts (3 tests | 1 failed) 98ms",
    "  AssertionError: expected 4200 to equal 4800",
    "Tests  1 failed | 22 passed (23)",
]

export default function TerminalOutput({
    command = "pnpm test",
    lines = LINES,
    status = "failed",
    seconds = 4.2,
    stream = false,
    speed = 220,
    height = 260,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
}: Partial<TerminalOutputProps>) {
    const p = palette(theme)
    const reduced = useReducedMotion()
    const body = React.useRef<HTMLDivElement | null>(null)
    const list = lines
    const live = stream && !reduced
    const [shown, setShown] = React.useState(live ? 0 : list.length)
    const [copied, setCopied] = React.useState(false)
    const [focused, setFocused] = React.useState<string | null>(null)

    React.useEffect(() => setShown(live ? 0 : list.length), [live, list.length, lines])

    React.useEffect(() => {
        if (typeof window === "undefined" || !live || shown >= list.length) return
        const t = window.setTimeout(() => setShown((n) => n + 1), Math.max(speed, 40))
        return () => window.clearTimeout(t)
    }, [live, shown, list.length, speed])

    React.useEffect(() => {
        body.current?.scrollTo({ top: body.current.scrollHeight })
    }, [shown])

    const streaming = live && shown < list.length
    const running = status === "running" || streaming
    const visible = list.slice(0, shown)

    const copy = async () => {
        try {
            await navigator.clipboard.writeText([`$ ${command}`, ...list].join("\n"))
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        } catch {
            /* clipboard blocked */
        }
    }

    const tone = (line: string) => {
        const t = line.trimStart().toLowerCase()
        if (line.startsWith("✓")) return p.success
        if (line.startsWith("✗") || t.startsWith("error") || t.startsWith("assertionerror")) return p.danger
        if (t.startsWith("warn")) return p.warn
        return p.text
    }

    const badge =
        status === "passed" && !streaming
            ? { text: `Passed · exit 0${seconds ? ` · ${seconds.toFixed(1)}s` : ""}`, color: p.success }
            : status === "failed" && !streaming
              ? { text: `Failed · exit 1${seconds ? ` · ${seconds.toFixed(1)}s` : ""}`, color: p.danger }
              : { text: "Running", color: accent }

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    borderRadius: radius,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 12px 9px 14px", background: p.head, borderBottom: `1px solid ${p.line}` }}>
                    <code style={{ fontFamily: MONO, fontSize: 12.5, color: p.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: accent }}>$ </span>
                        {command}
                    </code>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 500, color: badge.color }}>
                            {running && (
                                <motion.span
                                    aria-hidden
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                                    style={{ width: 10, height: 10, borderRadius: "50%", borderWidth: 1.5, borderStyle: "solid", borderTopColor: "currentColor", borderLeftColor: "currentColor", borderBottomColor: "currentColor", borderRightColor: "transparent", display: "inline-block" }}
                                />
                            )}
                            {badge.text}
                        </span>
                        <button
                            type="button"
                            onClick={copy}
                            onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible") ? "copy" : null)}
                            onBlur={() => setFocused(null)}
                            style={{
                                height: 26,
                                padding: "0 9px",
                                borderRadius: 6,
                                border: `1px solid ${p.strong}`,
                                background: "transparent",
                                color: p.soft,
                                fontSize: 12,
                                fontWeight: 500,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                outline: focused === "copy" ? `2px solid ${accent}` : "none",
                                outlineOffset: 2,
                            }}
                        >
                            {copied ? "Copied" : "Copy"}
                        </button>
                    </div>
                </div>
                <div
                    ref={body}
                    role="log"
                    aria-label={`Output of ${command}`}
                    tabIndex={0}
                    onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible") ? "body" : focused)}
                    onBlur={(e) => e.target === e.currentTarget && setFocused(null)}
                    style={{
                        height: Math.max(height - 45, 80),
                        overflow: "auto",
                        padding: "10px 0",
                        scrollbarWidth: "thin",
                        scrollbarColor: `${p.strong} transparent`,
                        outline: focused === "body" ? `2px solid ${accent}` : "none",
                        outlineOffset: -2,
                    }}
                >
                    {visible.map((line, i) => (
                        <div key={i} style={{ display: "flex", gap: 14, padding: "1px 14px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.65, color: tone(line) }}>
                            <span aria-hidden style={{ width: 22, textAlign: "right", color: p.faint, flexShrink: 0, userSelect: "none", fontVariantNumeric: "tabular-nums" }}>
                                {i + 1}
                            </span>
                            <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{line}</span>
                        </div>
                    ))}
                    {running && (
                        <div aria-hidden style={{ display: "flex", gap: 14, padding: "1px 14px", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.65 }}>
                            <span style={{ width: 22, flexShrink: 0 }} />
                            <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ color: p.soft }}>
                                ▍
                            </motion.span>
                        </div>
                    )}
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(TerminalOutput, {
    command: { type: ControlType.String, title: "Command", defaultValue: "pnpm test" },
    lines: {
        type: ControlType.Array,
        title: "Output lines",
        control: { type: ControlType.String },
        defaultValue: LINES,
    },
    status: {
        type: ControlType.Enum,
        title: "Status",
        options: ["running", "passed", "failed"],
        optionTitles: ["Running", "Passed", "Failed"],
        defaultValue: "failed",
    },
    seconds: { type: ControlType.Number, title: "Seconds", defaultValue: 4.2, min: 0, max: 600, step: 0.1 },
    stream: { type: ControlType.Boolean, title: "Stream lines", defaultValue: false },
    speed: { type: ControlType.Number, title: "Line delay (ms)", defaultValue: 220, min: 40, max: 1200, step: 20 },
    height: { type: ControlType.Number, title: "Height", defaultValue: 260, min: 140, max: 520 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 24 },
})

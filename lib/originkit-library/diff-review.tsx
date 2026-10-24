import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * DiffReview: lets a person accept or reject the changes an agent proposes,
 * one hunk at a time or all at once. Added and removed lines carry a "+" or
 * "−" marker as well as color, and every decision can be undone until the
 * agent applies the result.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 520
 * @framerIntrinsicHeight 360
 */

type Theme = "dark" | "light"
type Decision = "pending" | "accepted" | "rejected"

interface Hunk {
    title: string
    before: string
    after: string
}

interface DiffReviewProps {
    file: string
    hunks: Hunk[]
    accent: string
    theme: Theme
    radius: number
    onApply?: () => void
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        head: dark ? "#161718" : "#f6f4f0",
        code: dark ? "#141415" : "#faf9f7",
        raised: dark ? "#262829" : "#f1efeb",
        line: dark ? "#2d2d2f" : "#e4e1db",
        strong: dark ? "#3e3f40" : "#c9c5bc",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#b7b7b8" : "#5c5a55",
        faint: dark ? "#8a8c8f" : "#76736d",
        del: dark ? "rgba(255,92,80,0.13)" : "rgba(217,45,32,0.09)",
        add: dark ? "rgba(61,214,140,0.13)" : "rgba(18,121,74,0.1)",
        delInk: dark ? "#ff9c93" : "#a3201a",
        addInk: dark ? "#6fe2ac" : "#0e6a40",
        success: dark ? "#3dd68c" : "#12794a",
        danger: dark ? "#ff7a70" : "#c42a1d",
    }
}

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, monospace'

const HUNKS: Hunk[] = [
    { title: "Rename for clarity", before: "const n = failed.length", after: "const failedCount = failed.length" },
    { title: "Retry with backoff", before: "await charge(account)", after: "await retry(() => charge(account), { max: 3 })" },
    { title: "Log the outcome", before: "return result", after: "log.info(\"retry done\", result); return result" },
]

export default function DiffReview({
    file = "src/billing/retry.ts",
    hunks = HUNKS,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
    onApply,
}: Partial<DiffReviewProps>) {
    const p = palette(theme)
    const list = (hunks.length ? hunks : HUNKS).map((h) => ({ title: h.title ?? "", before: h.before ?? "", after: h.after ?? "" }))
    const [decisions, setDecisions] = React.useState<Decision[]>(() => list.map(() => "pending"))
    const [focused, setFocused] = React.useState<string | null>(null)
    React.useEffect(() => setDecisions(list.map(() => "pending")), [hunks])

    const set = (i: number, d: Decision) => setDecisions((cur) => cur.map((x, k) => (k === i ? d : x)))
    const all = (d: Decision) => setDecisions(list.map(() => d))
    const pending = decisions.filter((d) => d === "pending").length
    const accepted = decisions.filter((d) => d === "accepted").length
    const done = pending === 0

    const bind = (k: string) => ({
        onFocus: (e: React.FocusEvent<HTMLElement>) => setFocused(e.currentTarget.matches(":focus-visible") ? k : null),
        onBlur: () => setFocused(null),
    })
    const ring = (k: string): React.CSSProperties => (focused === k ? { outline: `2px solid ${accent}`, outlineOffset: 2 } : {})
    const btn = (primary: boolean): React.CSSProperties => ({
        height: 30,
        padding: "0 12px",
        borderRadius: 8,
        border: primary ? "1px solid transparent" : `1px solid ${p.strong}`,
        background: primary ? accent : p.raised,
        color: primary ? "#141413" : p.text,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
    })
    const row = (kind: "del" | "add", text: string) => (
        <div style={{ display: "flex", gap: 10, padding: "4px 12px", background: kind === "del" ? p.del : p.add, color: kind === "del" ? p.delInk : p.addInk, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.6 }}>
            <span aria-hidden style={{ width: 10, flexShrink: 0, userSelect: "none" }}>
                {kind === "del" ? "−" : "+"}
            </span>
            <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{kind === "del" ? "Removed: " : "Added: "}</span>
                {text}
            </span>
        </div>
    )

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    borderRadius: radius,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    color: p.text,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px", background: p.head, borderBottom: `1px solid ${p.line}` }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, overflowWrap: "anywhere" }}>{file}</div>
                        <div aria-live="polite" style={{ marginTop: 2, fontSize: 12, color: p.faint }}>
                            {done ? `${accepted} of ${list.length} changes accepted` : `${pending} of ${list.length} changes to review`}
                        </div>
                    </div>
                    {pending > 0 && (
                        <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => all("rejected")} {...bind("rejectAll")} style={{ ...btn(false), ...ring("rejectAll") }}>
                                Reject all
                            </button>
                            <button type="button" onClick={() => all("accepted")} {...bind("acceptAll")} style={{ ...btn(true), ...ring("acceptAll") }}>
                                Accept all
                            </button>
                        </div>
                    )}
                </div>

                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {list.map((h, i) => {
                        const d = decisions[i] ?? "pending"
                        return (
                            <li key={`${h.title}-${i}`} style={{ borderTop: i === 0 ? "none" : `1px solid ${p.line}`, padding: "12px 14px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 30 }}>
                                    <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.005em" }}>{h.title}</span>
                                    <AnimatePresence mode="wait" initial={false}>
                                        {d === "pending" ? (
                                            <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} style={{ display: "flex", gap: 6 }}>
                                                <button type="button" aria-label={`Reject: ${h.title}`} onClick={() => set(i, "rejected")} {...bind(`r${i}`)} style={{ ...btn(false), ...ring(`r${i}`) }}>
                                                    Reject
                                                </button>
                                                <button type="button" aria-label={`Accept: ${h.title}`} onClick={() => set(i, "accepted")} {...bind(`a${i}`)} style={{ ...btn(true), ...ring(`a${i}`) }}>
                                                    Accept
                                                </button>
                                            </motion.div>
                                        ) : (
                                            <motion.div key="done" initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: d === "accepted" ? p.success : p.danger }}>
                                                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                                                        <path d={d === "accepted" ? "M2.2 6.3 4.8 8.8 9.8 3.4" : "M3 3l6 6M9 3l-6 6"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    {d === "accepted" ? "Accepted" : "Rejected"}
                                                </span>
                                                <button
                                                    type="button"
                                                    aria-label={`Undo: ${h.title}`}
                                                    onClick={() => set(i, "pending")}
                                                    {...bind(`u${i}`)}
                                                    style={{ border: "none", background: "none", padding: "2px 4px", color: p.soft, fontSize: 12.5, fontWeight: 500, fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", ...ring(`u${i}`) }}
                                                >
                                                    Undo
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div style={{ marginTop: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${p.line}`, background: p.code, opacity: d === "rejected" ? 0.55 : 1 }}>
                                    {row("del", h.before)}
                                    {row("add", h.after)}
                                </div>
                            </li>
                        )
                    })}
                </ul>

                <AnimatePresence>
                    {done && accepted > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0, transition: { duration: 0.12 } }}
                            transition={{ duration: 0.18 }}
                            style={{ overflow: "hidden" }}
                        >
                            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 14px", borderTop: `1px solid ${p.line}`, background: p.head }}>
                                <button type="button" onClick={onApply} {...bind("apply")} style={{ ...btn(true), height: 32, ...ring("apply") }}>
                                    Apply {accepted} {accepted === 1 ? "change" : "changes"}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(DiffReview, {
    file: { type: ControlType.String, title: "File", defaultValue: "src/billing/retry.ts" },
    hunks: {
        type: ControlType.Array,
        title: "Changes",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Change" },
                before: { type: ControlType.String, title: "Before", defaultValue: "" },
                after: { type: ControlType.String, title: "After", defaultValue: "" },
            },
        },
        defaultValue: HUNKS,
    },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 24 },
    onApply: { type: ControlType.EventHandler, title: "On apply" },
})

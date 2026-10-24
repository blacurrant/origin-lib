import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * Alert: an inline message that stays on the page until it is dismissed. Use
 * it for status the user should read, such as a trial ending or a failed sync.
 * Errors are announced immediately, everything else politely. For short-lived
 * confirmations, use Toast instead.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 84
 */

type Theme = "dark" | "light"
type Severity = "info" | "success" | "warning" | "error"

interface AlertProps {
    title: string
    description: string
    severity: Severity
    dismissible: boolean
    actionLabel: string
    accent: string
    theme: Theme
    radius: number
    onAction?: () => void
    onDismiss?: () => void
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        raised: dark ? "#262829" : "#f1efeb",
        strong: dark ? "#3e3f40" : "#c9c5bc",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#b7b7b8" : "#5c5a55",
        tones: {
            info: dark ? "#6ea8ff" : "#1f5fd1",
            success: dark ? "#3dd68c" : "#12794a",
            warning: dark ? "#f5b14a" : "#9a5b00",
            error: dark ? "#ff7a70" : "#c42a1d",
        } as Record<Severity, string>,
    }
}

const ICONS: Record<Severity, string> = {
    info: "M8 7v4M8 4.6v.1",
    success: "M4.6 8.2 7 10.5l4.4-4.6",
    warning: "M8 4.5v4M8 11v.1",
    error: "M5.5 5.5l5 5M10.5 5.5l-5 5",
}

export default function Alert({
    title = "Your trial ends in 3 days",
    description = "Add a payment method to keep your projects and deploys running.",
    severity = "info",
    dismissible = true,
    actionLabel = "Add payment method",
    accent = "#fa7319",
    theme = "dark",
    radius = 10,
    onAction,
    onDismiss,
}: Partial<AlertProps>) {
    const p = palette(theme)
    const accentTone = theme === "light" ? `color-mix(in srgb, ${accent} 62%, #141413)` : accent
    const tone = severity === "info" ? accentTone : p.tones[severity] ?? accentTone
    const [visible, setVisible] = React.useState(true)
    const [focused, setFocused] = React.useState<string | null>(null)
    const ring = (k: string) => ({
        onFocus: (e: React.FocusEvent<HTMLElement>) => setFocused(e.currentTarget.matches(":focus-visible") ? k : null),
        onBlur: () => setFocused(null),
        style: focused === k ? ({ outline: `2px solid ${accent}`, outlineOffset: 2 } as React.CSSProperties) : ({} as React.CSSProperties),
    })
    React.useEffect(() => setVisible(true), [title, description, severity])

    const dismissRing = ring("dismiss")
    const actionRing = ring("action")

    return (
        <MotionConfig reducedMotion="user">
            <AnimatePresence initial={false}>
                {visible && (
                    <motion.div
                        role={severity === "error" ? "alert" : "status"}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
                        transition={{ duration: 0.18 }}
                        style={{ width: "100%", overflow: "hidden", fontFamily: "inherit" }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 12,
                                padding: "14px 12px 14px 14px",
                                borderRadius: radius,
                                background: `color-mix(in srgb, ${tone} 8%, ${p.surface})`,
                                border: `1px solid color-mix(in srgb, ${tone} 32%, ${p.strong})`,
                                color: p.text,
                                boxSizing: "border-box",
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden style={{ marginTop: 1, flexShrink: 0 }}>
                                <circle cx="8" cy="8" r="7" fill="none" stroke={tone} strokeWidth="1.4" />
                                <path d={ICONS[severity] ?? ICONS.info} fill="none" stroke={tone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.005em", lineHeight: 1.35 }}>{title}</div>
                                {description ? <div style={{ marginTop: 3, fontSize: 13.5, lineHeight: 1.5, color: p.soft }}>{description}</div> : null}
                                {actionLabel ? (
                                    <button
                                        type="button"
                                        onClick={onAction}
                                        {...actionRing}
                                        style={{
                                            marginTop: 10,
                                            height: 30,
                                            padding: "0 12px",
                                            borderRadius: 8,
                                            border: `1px solid ${p.strong}`,
                                            background: p.raised,
                                            color: p.text,
                                            fontSize: 13,
                                            fontWeight: 500,
                                            fontFamily: "inherit",
                                            cursor: "pointer",
                                            ...actionRing.style,
                                        }}
                                    >
                                        {actionLabel}
                                    </button>
                                ) : null}
                            </div>
                            {dismissible && (
                                <button
                                    type="button"
                                    aria-label="Dismiss"
                                    onClick={() => {
                                        setVisible(false)
                                        onDismiss?.()
                                    }}
                                    {...dismissRing}
                                    style={{
                                        width: 28,
                                        height: 28,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: "none",
                                        borderRadius: 6,
                                        background: "none",
                                        color: p.soft,
                                        cursor: "pointer",
                                        flexShrink: 0,
                                        ...dismissRing.style,
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                                        <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </MotionConfig>
    )
}

addPropertyControls(Alert, {
    title: { type: ControlType.String, title: "Title", defaultValue: "Your trial ends in 3 days" },
    description: {
        type: ControlType.String,
        title: "Description",
        defaultValue: "Add a payment method to keep your projects and deploys running.",
        displayTextArea: true,
    },
    severity: {
        type: ControlType.Enum,
        title: "Severity",
        options: ["info", "success", "warning", "error"],
        optionTitles: ["Info", "Success", "Warning", "Error"],
        defaultValue: "info",
    },
    dismissible: { type: ControlType.Boolean, title: "Dismissible", defaultValue: true },
    actionLabel: { type: ControlType.String, title: "Action", defaultValue: "Add payment method" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 10, min: 0, max: 24 },
    onAction: { type: ControlType.EventHandler, title: "On action" },
    onDismiss: { type: ControlType.EventHandler, title: "On dismiss" },
})

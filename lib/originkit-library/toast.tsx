import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * Toast: a short notification with a title and optional detail. It dismisses
 * itself after `duration` ms, pauses while hovered or focused, and errors are
 * announced immediately. Set duration to 0 to keep it until closed.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 64
 */

type Theme = "dark" | "light"
type Severity = "info" | "success" | "warning" | "error"

interface ToastProps {
    message: string
    description: string
    severity: Severity
    duration: number
    accent: string
    theme: Theme
    radius: number
    onDismiss?: () => void
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        line: dark ? "#2d2d2f" : "#e4e1db",
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

export default function Toast({
    message = "Update available",
    description = "Reload to get the latest changes.",
    severity = "info",
    duration = 5000,
    accent = "#fa7319",
    theme = "dark",
    radius = 10,
    onDismiss,
}: Partial<ToastProps>) {
    const p = palette(theme)
    const accentTone = theme === "light" ? `color-mix(in srgb, ${accent} 62%, #141413)` : accent
    const tone = severity === "info" ? accentTone : p.tones[severity] ?? accentTone
    const [visible, setVisible] = React.useState(true)
    const [paused, setPaused] = React.useState(false)

    const dismiss = React.useCallback(() => {
        setVisible(false)
        onDismiss?.()
    }, [onDismiss])

    React.useEffect(() => {
        setVisible(true)
    }, [message, description, severity])

    React.useEffect(() => {
        if (typeof window === "undefined" || duration <= 0 || paused || !visible) return
        const timer = window.setTimeout(dismiss, duration)
        return () => window.clearTimeout(timer)
    }, [duration, paused, visible, message, description, severity, dismiss])

    return (
        <MotionConfig reducedMotion="user">
            <AnimatePresence>
                {visible && (
                    <motion.div
                        role={severity === "error" ? "alert" : "status"}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
                        transition={{ type: "spring", stiffness: 520, damping: 38 }}
                        onMouseEnter={() => setPaused(true)}
                        onMouseLeave={() => setPaused(false)}
                        onFocus={() => setPaused(true)}
                        onBlur={() => setPaused(false)}
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12,
                            width: "100%",
                            padding: "12px 10px 12px 14px",
                            borderRadius: radius,
                            background: p.surface,
                            border: `1px solid ${p.line}`,
                            color: p.text,
                            fontFamily: "inherit",
                            boxShadow: "0 12px 28px -14px rgba(0,0,0,0.5)",
                            boxSizing: "border-box",
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden style={{ marginTop: 2, flexShrink: 0 }}>
                            <circle cx="8" cy="8" r="7" fill="none" stroke={tone} strokeWidth="1.4" />
                            <path d={ICONS[severity] ?? ICONS.info} fill="none" stroke={tone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em" }}>{message}</div>
                            {description ? (
                                <div style={{ marginTop: 2, fontSize: 13, lineHeight: 1.45, color: p.soft }}>{description}</div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            aria-label="Dismiss notification"
                            onClick={dismiss}
                            style={{
                                width: 28,
                                height: 28,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "none",
                                border: "none",
                                borderRadius: 6,
                                color: p.soft,
                                cursor: "pointer",
                                flexShrink: 0,
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </MotionConfig>
    )
}

addPropertyControls(Toast, {
    message: { type: ControlType.String, title: "Message", defaultValue: "Update available" },
    description: { type: ControlType.String, title: "Detail", defaultValue: "Reload to get the latest changes." },
    severity: {
        type: ControlType.Enum,
        title: "Severity",
        options: ["info", "success", "warning", "error"],
        optionTitles: ["Info", "Success", "Warning", "Error"],
        defaultValue: "info",
    },
    duration: {
        type: ControlType.Number,
        title: "Duration (ms)",
        defaultValue: 5000,
        min: 0,
        max: 20000,
        step: 500,
    },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 10, min: 0, max: 24 },
    onDismiss: { type: ControlType.EventHandler, title: "On dismiss" },
})

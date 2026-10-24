import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * Dialog: a modal with a title, body, and two actions. Focus moves into the
 * dialog and stays inside it, Escape and the backdrop close it, and focus
 * returns to whatever opened it. For destructive actions, focus starts on the
 * safe choice.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 420
 * @framerIntrinsicHeight 240
 */

type Theme = "dark" | "light"

interface DialogProps {
    open: boolean
    title: string
    body: string
    primaryLabel: string
    secondaryLabel: string
    destructive: boolean
    accent: string
    theme: Theme
    radius: number
    onConfirm?: () => void
    onClose?: () => void
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", raised: "#f1efeb", line: "#e4e1db", strong: "#c9c5bc", text: "#141413", soft: "#5c5a55", scrim: "rgba(20,20,19,0.4)" }
        : { surface: "#1b1c1d", raised: "#262829", line: "#2d2d2f", strong: "#3e3f40", text: "#f7f7f7", soft: "#b7b7b8", scrim: "rgba(0,0,0,0.6)" }
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Dialog({
    open = true,
    title = "Delete this project?",
    body = "The project, its deploys, and its environment variables are removed for everyone on the team. This can't be undone.",
    primaryLabel = "Delete project",
    secondaryLabel = "Keep project",
    destructive = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
    onConfirm,
    onClose,
}: Partial<DialogProps>) {
    const p = palette(theme)
    const uid = React.useId()
    const panelRef = React.useRef<HTMLDivElement | null>(null)
    const secondaryRef = React.useRef<HTMLButtonElement | null>(null)
    const primaryRef = React.useRef<HTMLButtonElement | null>(null)
    const [isOpen, setIsOpen] = React.useState(open)
    React.useEffect(() => setIsOpen(open), [open])

    const close = React.useCallback(() => {
        setIsOpen(false)
        onClose?.()
    }, [onClose])

    React.useEffect(() => {
        if (typeof window === "undefined" || !isOpen) return
        const returnTo = document.activeElement as HTMLElement | null
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        ;(destructive ? secondaryRef.current : primaryRef.current)?.focus()

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                close()
                return
            }
            if (e.key !== "Tab" || !panelRef.current) return
            const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
            if (!items.length) return
            const first = items[0]
            const last = items[items.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }
        window.addEventListener("keydown", onKey, true)
        return () => {
            window.removeEventListener("keydown", onKey, true)
            document.body.style.overflow = previousOverflow
            returnTo?.focus?.()
        }
    }, [isOpen, close, destructive])

    const buttonBase: React.CSSProperties = {
        height: 36,
        padding: "0 14px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
    }

    return (
        <MotionConfig reducedMotion="user">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="scrim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.14 }}
                        onClick={close}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 1000,
                            background: p.scrim,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 16,
                            fontFamily: "inherit",
                        }}
                    >
                        <motion.div
                            ref={panelRef}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={`${uid}-title`}
                            aria-describedby={`${uid}-body`}
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.99, transition: { duration: 0.12 } }}
                            transition={{ type: "spring", stiffness: 520, damping: 40 }}
                            style={{
                                width: "100%",
                                maxWidth: 420,
                                background: p.surface,
                                color: p.text,
                                borderRadius: radius,
                                border: `1px solid ${p.line}`,
                                boxShadow: "0 24px 48px -16px rgba(0,0,0,0.45)",
                                padding: 24,
                                boxSizing: "border-box",
                            }}
                        >
                            <h2 id={`${uid}-title`} style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em" }}>
                                {title}
                            </h2>
                            <p id={`${uid}-body`} style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: p.soft }}>
                                {body}
                            </p>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
                                <button
                                    ref={secondaryRef}
                                    type="button"
                                    onClick={close}
                                    style={{ ...buttonBase, background: p.raised, color: p.text, border: `1px solid ${p.strong}` }}
                                >
                                    {secondaryLabel}
                                </button>
                                <button
                                    ref={primaryRef}
                                    type="button"
                                    onClick={() => {
                                        onConfirm?.()
                                        close()
                                    }}
                                    style={{
                                        ...buttonBase,
                                        background: destructive ? "#d92d20" : accent,
                                        color: destructive ? "#ffffff" : "#141413",
                                        border: "1px solid transparent",
                                    }}
                                >
                                    {primaryLabel}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </MotionConfig>
    )
}

addPropertyControls(Dialog, {
    open: { type: ControlType.Boolean, title: "Open", defaultValue: true },
    title: { type: ControlType.String, title: "Title", defaultValue: "Delete this project?" },
    body: {
        type: ControlType.String,
        title: "Body",
        defaultValue:
            "The project, its deploys, and its environment variables are removed for everyone on the team. This can't be undone.",
        displayTextArea: true,
    },
    primaryLabel: { type: ControlType.String, title: "Primary", defaultValue: "Delete project" },
    secondaryLabel: { type: ControlType.String, title: "Secondary", defaultValue: "Keep project" },
    destructive: { type: ControlType.Boolean, title: "Destructive", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 24 },
    onConfirm: { type: ControlType.EventHandler, title: "On confirm" },
    onClose: { type: ControlType.EventHandler, title: "On close" },
})

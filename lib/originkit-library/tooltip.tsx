import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * Tooltip: a short label for a control. It opens after a short hover delay and
 * immediately on keyboard focus, closes on blur, mouse leave, or Escape, and is
 * linked to its trigger with `aria-describedby`. Tooltips hold text only; put
 * anything interactive in a popover instead.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 140
 * @framerIntrinsicHeight 36
 */

type Theme = "dark" | "light"
type Side = "top" | "bottom" | "left" | "right"

interface TooltipProps {
    label: string
    content: string
    shortcut: string
    side: Side
    delay: number
    forceOpen: boolean
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", strong: "#c9c5bc", text: "#141413", tipBg: "#141413", tipText: "#f7f7f7", tipFaint: "#a5a7a9" }
        : { surface: "#1b1c1d", strong: "#3e3f40", text: "#f7f7f7", tipBg: "#f7f7f7", tipText: "#141413", tipFaint: "#5c5a55" }
}

export default function Tooltip({
    label = "Hover or focus me",
    content = "Copy link",
    shortcut = "⌘C",
    side = "top",
    delay = 250,
    forceOpen = false,
    accent = "#fa7319",
    theme = "dark",
    radius = 8,
}: Partial<TooltipProps>) {
    const p = palette(theme)
    const id = React.useId()
    const [open, setOpen] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const timer = React.useRef<number | null>(null)
    const shown = open || forceOpen

    const clear = () => {
        if (timer.current !== null) window.clearTimeout(timer.current)
        timer.current = null
    }
    React.useEffect(() => clear, [])

    const placement: React.CSSProperties =
        side === "bottom"
            ? { top: "calc(100% + 8px)", left: "50%" }
            : side === "left"
              ? { right: "calc(100% + 8px)", top: "50%" }
              : side === "right"
                ? { left: "calc(100% + 8px)", top: "50%" }
                : { bottom: "calc(100% + 8px)", left: "50%" }
    const horizontal = side === "top" || side === "bottom"
    const offset = side === "top" ? 4 : side === "bottom" ? -4 : 0
    const offsetX = side === "left" ? 4 : side === "right" ? -4 : 0

    return (
        <MotionConfig reducedMotion="user">
            <span style={{ position: "relative", display: "inline-flex", fontFamily: "inherit" }}>
                <button
                    type="button"
                    aria-describedby={shown ? id : undefined}
                    onMouseEnter={() => {
                        clear()
                        timer.current = window.setTimeout(() => setOpen(true), delay)
                    }}
                    onMouseLeave={() => {
                        clear()
                        setOpen(false)
                    }}
                    onFocus={(e) => {
                        const visible = e.currentTarget.matches(":focus-visible")
                        setFocusVisible(visible)
                        if (visible) setOpen(true)
                    }}
                    onBlur={() => {
                        clear()
                        setFocusVisible(false)
                        setOpen(false)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Escape" && open) setOpen(false)
                    }}
                    style={{
                        height: 36,
                        padding: "0 14px",
                        borderRadius: radius,
                        border: `1px solid color-mix(in srgb, ${accent} 45%, ${p.strong})`,
                        background: p.surface,
                        color: p.text,
                        fontSize: 14,
                        fontWeight: 500,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: 2,
                    }}
                >
                    <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: accent, marginRight: 8, verticalAlign: "middle" }} />
                    {label}
                </button>
                <AnimatePresence>
                    {shown && (
                        <motion.span
                            id={id}
                            role="tooltip"
                            initial={{ opacity: 0, y: horizontal ? offset : 0, x: horizontal ? 0 : offsetX }}
                            animate={{ opacity: 1, y: 0, x: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.08 } }}
                            transition={{ duration: 0.12 }}
                            style={{
                                position: "absolute",
                                ...placement,
                                translateX: horizontal ? "-50%" : undefined,
                                translateY: horizontal ? undefined : "-50%",
                                zIndex: 30,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "6px 10px",
                                borderRadius: Math.max(radius - 2, 4),
                                background: p.tipBg,
                                color: p.tipText,
                                fontSize: 12.5,
                                fontWeight: 500,
                                lineHeight: 1.3,
                                whiteSpace: "nowrap",
                                pointerEvents: "none",
                            }}
                        >
                            {content}
                            {shortcut ? <span style={{ color: p.tipFaint, fontVariantNumeric: "tabular-nums" }}>{shortcut}</span> : null}
                        </motion.span>
                    )}
                </AnimatePresence>
            </span>
        </MotionConfig>
    )
}

addPropertyControls(Tooltip, {
    label: { type: ControlType.String, title: "Trigger", defaultValue: "Hover or focus me" },
    content: { type: ControlType.String, title: "Content", defaultValue: "Copy link" },
    shortcut: { type: ControlType.String, title: "Shortcut", defaultValue: "⌘C" },
    side: {
        type: ControlType.Enum,
        title: "Side",
        options: ["top", "bottom", "left", "right"],
        optionTitles: ["Top", "Bottom", "Left", "Right"],
        defaultValue: "top",
    },
    delay: { type: ControlType.Number, title: "Delay (ms)", defaultValue: 250, min: 0, max: 1200, step: 50 },
    forceOpen: { type: ControlType.Boolean, title: "Always open", defaultValue: false },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 8, min: 0, max: 20 },
})

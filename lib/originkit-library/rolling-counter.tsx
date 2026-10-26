import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useReducedMotion, useSpring, useTransform } from "framer-motion"
import type { MotionValue } from "framer-motion"

/**
 * RollingCounter: a number stepper in a rounded pill. Digits roll vertically
 * like an odometer, in the direction of the change, and only the digits that
 * changed move. Hold a button to repeat with acceleration. The number is
 * focusable: arrow keys step, PageUp and PageDown take bigger steps.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 196
 * @framerIntrinsicHeight 56
 */

type Theme = "dark" | "light"

interface RollingCounterProps {
    value: number
    min: number
    max: number
    step: number
    label: string
    holdToRepeat: boolean
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", well: "#f1eee8", line: "#d9d5cc", text: "#141413", soft: "#5c5a55", faint: "#76736d" }
        : { surface: "#171718", well: "#232425", line: "#303132", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f" }
}

const CELL_H = 40
const CELL_W = 20
const SPRING = { stiffness: 260, damping: 28, mass: 0.9 }

function clamp(v: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, v))
}

// One digit of the odometer wheel. `pos` is a continuous, unbounded number
// (the integer value of this decimal place), so 9 to 10 rolls forward.
function WheelDigit({ pos, index }: { pos: MotionValue<number>; index: number }) {
    const d = useTransform(pos, (v) => {
        const r = (((index - v + 5) % 10) + 10) % 10
        return r - 5
    })
    const y = useTransform(d, (x) => x * CELL_H)
    const opacity = useTransform(d, (x) => clamp(1 - Math.abs(x) * 0.95, 0, 1))
    const scale = useTransform(d, (x) => 1 - clamp(Math.abs(x), 0, 1) * 0.18)
    return (
        <motion.span
            aria-hidden
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: CELL_H,
                lineHeight: `${CELL_H}px`,
                textAlign: "center",
                y,
                opacity,
                scale,
                willChange: "transform",
            }}
        >
            {index}
        </motion.span>
    )
}

function Column({ target, instant }: { target: number; instant: boolean }) {
    // Start at 0 so a freshly mounted column rolls up to its digit.
    const pos = useSpring(0, SPRING)
    React.useEffect(() => {
        if (instant) pos.jump(target)
        else pos.set(target)
    }, [target, instant, pos])
    return (
        <span style={{ position: "relative", display: "block", width: CELL_W, height: CELL_H }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <WheelDigit key={i} pos={pos} index={i} />
            ))}
        </span>
    )
}

function StepButton({
    kind,
    disabled,
    label,
    accent,
    p,
    radius,
    onStart,
    onStop,
    onKeyboard,
}: {
    kind: "minus" | "plus"
    disabled: boolean
    label: string
    accent: string
    p: ReturnType<typeof palette>
    radius: number
    onStart: () => void
    onStop: () => void
    onKeyboard: () => void
}) {
    const [focusVisible, setFocusVisible] = React.useState(false)
    const [down, setDown] = React.useState(false)
    const [hover, setHover] = React.useState(false)
    return (
        <motion.button
            type="button"
            aria-label={label}
            aria-disabled={disabled}
            disabled={disabled}
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 600, damping: 28 }}
            onPointerDown={(e) => {
                // framer-motion fires synthetic pointer events on Enter (pointerType is empty); the click handler covers keyboard.
                if (e.button !== 0 || !e.pointerType) return
                setDown(true)
                onStart()
            }}
            onPointerUp={() => {
                setDown(false)
                onStop()
            }}
            onPointerLeave={() => {
                setDown(false)
                setHover(false)
                onStop()
            }}
            onPointerEnter={() => setHover(true)}
            onPointerCancel={() => {
                setDown(false)
                onStop()
            }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
                // detail === 0 means the click came from the keyboard; pointer presses are handled above.
                if (e.detail === 0) onKeyboard()
            }}
            onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
            onBlur={() => {
                setFocusVisible(false)
                onStop()
            }}
            style={{
                position: "relative",
                width: 40,
                height: 40,
                flexShrink: 0,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 0,
                borderStyle: "none",
                borderRadius: Math.min(radius, 20),
                background: down ? accent : hover ? p.line : p.well,
                color: down ? "#ffffff" : p.text,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.35 : 1,
                outline: focusVisible ? `2px solid ${accent}` : "none",
                outlineOffset: 2,
                touchAction: "manipulation",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTapHighlightColor: "transparent",
                transition: "background-color 140ms, color 140ms, opacity 140ms",
            }}
        >
            <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
                <path d={kind === "plus" ? "M3 8h10M8 3v10" : "M3 8h10"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" fill="none" />
            </svg>
        </motion.button>
    )
}

export default function RollingCounter({
    value = 95,
    min = 0,
    max = 120,
    step = 1,
    label = "Quantity",
    holdToRepeat = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 999,
}: Partial<RollingCounterProps>) {
    const p = palette(theme)
    const reduce = useReducedMotion()
    const lo = Math.min(min, max)
    const hi = Math.max(min, max)
    const inc = Math.max(1, Math.round(step))

    const [n, setN] = React.useState(() => clamp(Math.round(value), lo, hi))
    const [announce, setAnnounce] = React.useState("")
    const [mounted, setMounted] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const nRef = React.useRef(n)
    nRef.current = n
    const bounds = React.useRef({ lo, hi, inc })
    bounds.current = { lo, hi, inc }

    React.useEffect(() => {
        setN(clamp(Math.round(value), lo, hi))
    }, [value, lo, hi])
    React.useEffect(() => setMounted(true), [])

    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const stopHold = React.useCallback(() => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
    }, [])
    React.useEffect(() => stopHold, [stopHold])

    const apply = React.useCallback((delta: number) => {
        const b = bounds.current
        const next = clamp(nRef.current + delta, b.lo, b.hi)
        if (next === nRef.current) return false
        nRef.current = next
        setN(next)
        return true
    }, [])

    const startHold = (dir: 1 | -1) => {
        stopHold()
        apply(dir * bounds.current.inc)
        if (!holdToRepeat) return
        let repeats = 0
        const tick = () => {
            repeats += 1
            // Accelerate: faster ticks, and bigger jumps after a long hold.
            const mult = repeats > 28 ? 10 : repeats > 14 ? 5 : repeats > 7 ? 2 : 1
            if (!apply(dir * bounds.current.inc * mult)) {
                timer.current = null
                return
            }
            const delay = Math.max(45, 190 - repeats * 14)
            timer.current = setTimeout(tick, delay)
        }
        timer.current = setTimeout(tick, 420)
    }

    // Debounced live-region text so a fast hold does not flood screen readers.
    React.useEffect(() => {
        const t = setTimeout(() => setAnnounce(`${label} ${n}`), 250)
        return () => clearTimeout(t)
    }, [n, label])

    const onKeyDown = (e: React.KeyboardEvent) => {
        const b = bounds.current
        let handled = true
        if (e.key === "ArrowUp" || e.key === "ArrowRight") apply(b.inc)
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") apply(-b.inc)
        else if (e.key === "PageUp") apply(b.inc * 10)
        else if (e.key === "PageDown") apply(-b.inc * 10)
        else if (e.key === "Home") apply(b.lo - nRef.current)
        else if (e.key === "End") apply(b.hi - nRef.current)
        else handled = false
        if (handled) e.preventDefault()
    }

    const neg = n < 0
    const abs = Math.abs(n)
    const digits = String(abs).length
    const maxDigits = Math.max(String(Math.abs(lo)).length, String(Math.abs(hi)).length)
    const places = Array.from({ length: digits }, (_, i) => digits - 1 - i) // most significant first
    const signW = lo < 0 ? 14 : 0
    const displayW = maxDigits * CELL_W + signW + 8

    return (
        <MotionConfig reducedMotion="user">
            <div
                role="group"
                aria-label={label}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: 6,
                    borderRadius: radius,
                    background: p.surface,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: p.line,
                    fontFamily: "inherit",
                    color: p.text,
                }}
            >
                <StepButton
                    kind="minus"
                    label={`Decrease ${label}`}
                    disabled={n <= lo}
                    accent={accent}
                    p={p}
                    radius={radius}
                    onStart={() => startHold(-1)}
                    onStop={stopHold}
                    onKeyboard={() => apply(-bounds.current.inc)}
                />
                <div
                    role="spinbutton"
                    tabIndex={0}
                    aria-label={label}
                    aria-valuenow={n}
                    aria-valuemin={lo}
                    aria-valuemax={hi}
                    onKeyDown={onKeyDown}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: displayW,
                        height: CELL_H,
                        overflow: "hidden",
                        fontSize: 26,
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        fontVariantNumeric: "tabular-nums",
                        color: p.text,
                        borderRadius: 10,
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: -2,
                        cursor: "default",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        maskImage: "linear-gradient(to bottom, transparent 0, #000 22%, #000 78%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 22%, #000 78%, transparent 100%)",
                    }}
                >
                    {neg ? (
                        <span aria-hidden style={{ width: signW || 14, textAlign: "center", lineHeight: `${CELL_H}px`, color: accent }}>
                            -
                        </span>
                    ) : null}
                    {places.map((place) => {
                        const target = Math.floor(abs / Math.pow(10, place))
                        return <Column key={place} target={target} instant={!!reduce || !mounted} />
                    })}
                </div>
                <StepButton
                    kind="plus"
                    label={`Increase ${label}`}
                    disabled={n >= hi}
                    accent={accent}
                    p={p}
                    radius={radius}
                    onStart={() => startHold(1)}
                    onStop={stopHold}
                    onKeyboard={() => apply(bounds.current.inc)}
                />
                <span
                    aria-live="polite"
                    role="status"
                    style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        margin: -1,
                        overflow: "hidden",
                        clip: "rect(0 0 0 0)",
                        whiteSpace: "nowrap",
                    }}
                >
                    {announce}
                </span>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(RollingCounter, {
    value: { type: ControlType.Number, title: "Value", defaultValue: 95, min: -9999, max: 9999, step: 1 },
    min: { type: ControlType.Number, title: "Min", defaultValue: 0, min: -9999, max: 9999, step: 1 },
    max: { type: ControlType.Number, title: "Max", defaultValue: 120, min: -9999, max: 9999, step: 1 },
    step: { type: ControlType.Number, title: "Step", defaultValue: 1, min: 1, max: 100, step: 1 },
    label: { type: ControlType.String, title: "Label", defaultValue: "Quantity" },
    holdToRepeat: { type: ControlType.Boolean, title: "Hold repeat", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 999, min: 0, max: 999 },
})

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useMotionValue, useSpring, useTransform, useVelocity } from "framer-motion"
import type { MotionValue } from "framer-motion"

/**
 * WakeSlider: a tick slider. Ticks up to the value are lit, the rest are dim.
 * A soft wake of magnification follows the pointer (or the thumb) and trails
 * behind fast movement. Drag or click to set the value, or use the arrow keys,
 * Home, End, PageUp and PageDown.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 420
 * @framerIntrinsicHeight 96
 */

type Theme = "dark" | "light"

interface WakeSliderProps {
    value: number
    min: number
    max: number
    step: number
    ticks: number
    showValue: boolean
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", line: "#e4e1db", text: "#141413", soft: "#5c5a55", dim: "#bdb9b1", faint: "#76736d" }
        : { surface: "#141415", line: "#2d2d2f", text: "#f7f7f7", soft: "#b7b7b8", dim: "#4a4c4f", faint: "#8a8c8f" }
}

const BASE_H = 18
const PEAK_H = 50
const MAX_SCALE = PEAK_H / BASE_H

function decimals(step: number) {
    const s = String(step)
    const i = s.indexOf(".")
    return i === -1 ? 0 : Math.min(4, s.length - i - 1)
}

function clamp(n: number, a: number, b: number) {
    return Math.min(b, Math.max(a, n))
}

interface TickProps {
    index: number
    lit: boolean
    focus: MotionValue<number>
    energy: MotionValue<number>
    spread: MotionValue<number>
    accent: string
    dim: string
    radius: number
}

function Tick({ index, lit, focus, energy, spread, accent, dim, radius }: TickProps) {
    const scaleY = useTransform([focus, energy, spread] as MotionValue<number>[], (latest: number[]) => {
        const [f, e, s] = latest
        const d = (index - f) / s
        return 1 + (MAX_SCALE - 1) * e * Math.exp(-0.5 * d * d)
    })
    const opacity = useTransform(scaleY, [1, MAX_SCALE], lit ? [0.82, 1] : [0.55, 1])
    return (
        <motion.span
            aria-hidden
            initial={false}
            animate={{ backgroundColor: lit ? accent : dim }}
            transition={{ duration: 0.14 }}
            style={{
                display: "block",
                width: 2,
                height: BASE_H,
                borderRadius: radius,
                scaleY,
                opacity,
                flex: "none",
                willChange: "transform",
            }}
        />
    )
}

export default function WakeSlider({
    value = 50,
    min = 0,
    max = 100,
    step = 1,
    ticks = 40,
    showValue = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 2,
}: Partial<WakeSliderProps>) {
    const p = palette(theme)
    const N = Math.max(8, Math.round(ticks))
    const lo = Math.min(min, max)
    const hi = Math.max(min, max)
    const range = hi - lo || 1
    const st = step > 0 ? step : 1
    const dec = decimals(st)

    const snap = React.useCallback(
        (v: number) => {
            const snapped = Math.round((v - lo) / st) * st + lo
            return clamp(Number(snapped.toFixed(dec)), lo, hi)
        },
        [lo, hi, st, dec]
    )

    const [current, setCurrent] = React.useState(() => snap(value))
    React.useEffect(() => setCurrent(snap(value)), [value, snap])

    const [hover, setHover] = React.useState(false)
    const [dragging, setDragging] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const trackRef = React.useRef<HTMLDivElement | null>(null)

    const frac = (current - lo) / range
    const thumbIndex = frac * (N - 1)

    const focusTarget = useMotionValue(thumbIndex)
    const focus = useSpring(focusTarget, { stiffness: 230, damping: 24, mass: 0.7 })
    const velocity = useVelocity(focus)
    const spread = useTransform(velocity, (v) => 2.1 + Math.min(Math.abs(v) / 22, 3.4))
    const energyTarget = useMotionValue(0.5)
    const energy = useSpring(energyTarget, { stiffness: 220, damping: 26 })

    React.useEffect(() => {
        energyTarget.set(hover || dragging ? 1 : 0.5)
    }, [hover, dragging, energyTarget])

    React.useEffect(() => {
        if (!hover && !dragging) focusTarget.set(thumbIndex)
    }, [thumbIndex, hover, dragging, focusTarget])

    const fromPointer = (clientX: number) => {
        const el = trackRef.current
        if (!el) return null
        const r = el.getBoundingClientRect()
        const f = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1)
        return f
    }

    const apply = (f: number, setValue: boolean) => {
        focusTarget.set(f * (N - 1))
        if (setValue) setCurrent(snap(lo + f * range))
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === "mouse") return
        const f = fromPointer(e.clientX)
        if (f === null) return
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
        apply(f, true)
    }
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const f = fromPointer(e.clientX)
        if (f === null) return
        apply(f, dragging)
    }
    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
        setDragging(false)
        if (e.pointerType !== "mouse") setHover(false)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        let next: number | null = null
        const big = Math.max(st, Math.round(range / 10 / st) * st)
        switch (e.key) {
            case "ArrowRight":
            case "ArrowUp":
                next = current + st
                break
            case "ArrowLeft":
            case "ArrowDown":
                next = current - st
                break
            case "PageUp":
                next = current + big
                break
            case "PageDown":
                next = current - big
                break
            case "Home":
                next = lo
                break
            case "End":
                next = hi
                break
        }
        if (next !== null) {
            e.preventDefault()
            setCurrent(snap(next))
        }
    }

    const display = dec > 0 ? current.toFixed(dec) : String(Math.round(current))
    const widest = Math.max(String(Math.round(hi)).length, String(Math.round(lo)).length) + (dec > 0 ? dec + 1 : 0)

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    maxWidth: 440,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    padding: "18px 22px",
                    borderRadius: 16,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    fontFamily: "inherit",
                }}
            >
                <div
                    ref={trackRef}
                    role="slider"
                    tabIndex={0}
                    aria-label="Value"
                    aria-orientation="horizontal"
                    aria-valuemin={lo}
                    aria-valuemax={hi}
                    aria-valuenow={current}
                    onKeyDown={onKeyDown}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
                    onPointerLeave={() => setHover(false)}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        height: PEAK_H + 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: dragging ? "grabbing" : "pointer",
                        touchAction: "none",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: 6,
                        borderRadius: 6,
                    }}
                >
                    {Array.from({ length: N }, (_, i) => (
                        <Tick
                            key={i}
                            index={i}
                            lit={(i + 0.5) / N <= frac}
                            focus={focus}
                            energy={energy}
                            spread={spread}
                            accent={accent}
                            dim={p.dim}
                            radius={radius}
                        />
                    ))}
                </div>
                {showValue && (
                    <div
                        aria-hidden
                        style={{
                            minWidth: `${widest}ch`,
                            textAlign: "right",
                            fontSize: 22,
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                            fontVariantNumeric: "tabular-nums",
                            fontFamily: "inherit",
                            color: p.text,
                        }}
                    >
                        {display}
                    </div>
                )}
            </div>
        </MotionConfig>
    )
}

addPropertyControls(WakeSlider, {
    value: { type: ControlType.Number, title: "Value", defaultValue: 50, min: -1000, max: 1000, step: 1 },
    min: { type: ControlType.Number, title: "Min", defaultValue: 0, min: -1000, max: 1000, step: 1 },
    max: { type: ControlType.Number, title: "Max", defaultValue: 100, min: -1000, max: 1000, step: 1 },
    step: { type: ControlType.Number, title: "Step", defaultValue: 1, min: 0.01, max: 100, step: 0.01 },
    ticks: { type: ControlType.Number, title: "Ticks", defaultValue: 40, min: 8, max: 80, step: 1 },
    showValue: { type: ControlType.Boolean, title: "Show value", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 2, min: 0, max: 4, step: 1 },
})

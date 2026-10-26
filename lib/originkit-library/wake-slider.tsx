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
    sound: boolean
    soundVolume: number
}

/* ---- Sound ---------------------------------------------------------------
 * Tiny synthesized cues, no files and no network. Silent unless the `sound`
 * prop is on, and only ever played from a real user action (pointer or key),
 * never from autoplay, timers or demo cursors. One shared AudioContext lives
 * on window so many components do not each open their own. */
type Cue = "tick" | "click" | "pop" | "on" | "off" | "whoosh" | "drop" | "success" | "error" | "type"
const cueAt: Record<string, number> = {}

function playCue(cue: Cue, volume = 0.5, minGap = 45, pitch = 1) {
    if (typeof window === "undefined" || volume <= 0) return
    const stamp = Date.now()
    if (stamp - (cueAt[cue] || 0) < minGap) return
    cueAt[cue] = stamp
    try {
        const w = window as any
        const AC = w.AudioContext || w.webkitAudioContext
        if (!AC) return
        const ctx: AudioContext = (w.__okAudio = w.__okAudio || new AC())
        if (ctx.state === "suspended") ctx.resume()
        const t0 = ctx.currentTime
        const out = ctx.createGain()
        out.gain.value = Math.min(1, volume) * 0.4
        out.connect(ctx.destination)
        const tone = (type: OscillatorType, f0: number, f1: number, dur: number, gain = 1, delay = 0) => {
            const o = ctx.createOscillator()
            const g = ctx.createGain()
            const s = t0 + delay
            o.type = type
            o.frequency.setValueAtTime(f0 * pitch, s)
            o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), s + dur)
            g.gain.setValueAtTime(0.0001, s)
            g.gain.exponentialRampToValueAtTime(gain, s + 0.006)
            g.gain.exponentialRampToValueAtTime(0.0001, s + dur)
            o.connect(g)
            g.connect(out)
            o.start(s)
            o.stop(s + dur + 0.02)
        }
        const noise = (dur: number, f0: number, f1: number, gain = 1, delay = 0) => {
            const n = Math.max(1, Math.floor(ctx.sampleRate * dur))
            const buf = ctx.createBuffer(1, n, ctx.sampleRate)
            const d = buf.getChannelData(0)
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
            const src = ctx.createBufferSource()
            const f = ctx.createBiquadFilter()
            const g = ctx.createGain()
            const s = t0 + delay
            src.buffer = buf
            f.type = "bandpass"
            f.Q.value = 0.9
            f.frequency.setValueAtTime(f0 * pitch, s)
            f.frequency.exponentialRampToValueAtTime(Math.max(40, f1 * pitch), s + dur)
            g.gain.setValueAtTime(0.0001, s)
            g.gain.exponentialRampToValueAtTime(gain, s + 0.01)
            g.gain.exponentialRampToValueAtTime(0.0001, s + dur)
            src.connect(f)
            f.connect(g)
            g.connect(out)
            src.start(s)
        }
        if (cue === "tick") tone("triangle", 2300, 1900, 0.035, 0.55)
        else if (cue === "click") {
            noise(0.025, 3200, 2400, 0.7)
            tone("sine", 190, 120, 0.04, 0.5)
        } else if (cue === "pop") tone("sine", 540, 190, 0.12, 0.9)
        else if (cue === "on") {
            tone("sine", 520, 520, 0.09, 0.6)
            tone("sine", 780, 780, 0.12, 0.6, 0.07)
        } else if (cue === "off") {
            tone("sine", 650, 650, 0.09, 0.5)
            tone("sine", 420, 420, 0.12, 0.5, 0.07)
        } else if (cue === "whoosh") noise(0.24, 500, 2600, 0.8)
        else if (cue === "drop") {
            tone("sine", 170, 55, 0.16, 0.95)
            noise(0.05, 900, 400, 0.4)
        } else if (cue === "success") {
            tone("triangle", 523, 523, 0.11, 0.55)
            tone("triangle", 659, 659, 0.11, 0.55, 0.075)
            tone("triangle", 784, 784, 0.18, 0.6, 0.15)
        } else if (cue === "error") {
            tone("square", 160, 120, 0.13, 0.35)
            tone("square", 150, 110, 0.15, 0.35, 0.16)
        } else if (cue === "type") {
            noise(0.014, 3800, 3000, 0.55)
            tone("square", 1500 + Math.random() * 300, 1100, 0.02, 0.18)
        }
    } catch {
        /* audio blocked or unsupported: stay silent */
    }
}
/* ---- end Sound ---------------------------------------------------------- */

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
    sound = false,
    soundVolume = 0.5,
}: Partial<WakeSliderProps>) {
    const p = palette(theme)
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
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

    const currentRef = React.useRef(current)
    currentRef.current = current
    const commit = (v: number) => {
        const s = snap(v)
        if (s === currentRef.current) return
        currentRef.current = s
        setCurrent(s)
        cue("tick", 28, 0.8 + 0.8 * ((s - lo) / range))
    }

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
        if (setValue) commit(lo + f * range)
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
            commit(next)
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
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

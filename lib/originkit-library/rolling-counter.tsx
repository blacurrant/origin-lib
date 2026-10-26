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
    sound: boolean
    soundVolume: number
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
    sound = false,
    soundVolume = 0.5,
}: Partial<RollingCounterProps>) {
    const p = palette(theme)
    const reduce = useReducedMotion()
    const sfx = React.useRef({ sound, soundVolume })
    sfx.current = { sound, soundVolume }
    const cue = React.useCallback((c: Cue, gap?: number, pitch?: number) => {
        if (sfx.current.sound) playCue(c, sfx.current.soundVolume, gap, pitch)
    }, [])
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
        if (apply(dir * bounds.current.inc)) cue("click", 30)
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
            cue("tick", 60)
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
        const before = nRef.current
        let handled = true
        if (e.key === "ArrowUp" || e.key === "ArrowRight") apply(b.inc)
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") apply(-b.inc)
        else if (e.key === "PageUp") apply(b.inc * 10)
        else if (e.key === "PageDown") apply(-b.inc * 10)
        else if (e.key === "Home") apply(b.lo - nRef.current)
        else if (e.key === "End") apply(b.hi - nRef.current)
        else handled = false
        if (handled) e.preventDefault()
        if (handled && nRef.current !== before) cue("tick", 40)
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
                    onKeyboard={() => {
                        if (apply(-bounds.current.inc)) cue("click", 30)
                    }}
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
                    onKeyboard={() => {
                        if (apply(bounds.current.inc)) cue("click", 30)
                    }}
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
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

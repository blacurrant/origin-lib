import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion"

/**
 * Like: a like button with a springy press. The icon squashes and snaps, a
 * burst of particles radiates in the accent colour, and the count rolls to
 * the new number. The burst is generated from a seeded function so it renders
 * the same on the server and the client.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 150
 * @framerIntrinsicHeight 44
 */

type Theme = "dark" | "light"
type IconStyle = "heart" | "thumb"

interface LikeProps {
    count: number
    liked: boolean
    icon: IconStyle
    label: string
    accent: string
    theme: Theme
    radius: number
    sound: boolean
    soundVolume: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", line: "#d9d5cc", text: "#141413", soft: "#5c5a55", faint: "#76736d", hover: "#f4f2ee" }
        : { surface: "#1a1a1b", line: "#303132", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f", hover: "#222324" }
}

// Small deterministic PRNG so the particle layout never differs between server and client.
function mulberry32(seed: number) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

interface Particle {
    dx: number
    dy: number
    size: number
    angle: number
    kind: "dot" | "streak"
    tint: number
    delay: number
}

const PARTICLE_COUNT = 12
const PARTICLES: Particle[] = (() => {
    const rand = mulberry32(2025)
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.35
        const dist = 30 + rand() * 16
        return {
            dx: Math.cos(angle) * dist,
            dy: Math.sin(angle) * dist,
            size: 3.5 + rand() * 3.5,
            angle: (angle * 180) / Math.PI,
            kind: i % 2 === 0 ? "dot" : "streak",
            tint: rand(),
            delay: rand() * 0.04,
        } as Particle
    })
})()

const HEART = "M12 20.6c-.35 0-.7-.12-.97-.35C6.2 16.2 3 13.3 3 9.6 3 7 5 5 7.5 5c1.7 0 3.3.9 4.5 2.4C13.2 5.9 14.8 5 16.5 5 19 5 21 7 21 9.6c0 3.7-3.2 6.6-8.03 10.65-.27.23-.62.35-.97.35z"
const THUMB =
    "M7.5 10.5h-4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4zM7.5 10.5l3.4-6.9a1.5 1.5 0 0 1 1.35-.85c1.25 0 2.15 1.15 1.85 2.35L13 9.5h5.6c1.5 0 2.55 1.4 2.2 2.85l-1.4 6a2.6 2.6 0 0 1-2.55 2.15H7.5"

function Icon({ kind, on, accent, stroke }: { kind: IconStyle; on: boolean; accent: string; stroke: string }) {
    return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden style={{ display: "block", overflow: "visible" }}>
            <motion.path
                d={kind === "heart" ? HEART : THUMB}
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={false}
                animate={{ fill: on ? accent : "rgba(0,0,0,0)", stroke: on ? accent : stroke }}
                transition={{ duration: 0.16 }}
            />
        </svg>
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

export default function Like({
    count = 128,
    liked = false,
    icon = "heart",
    label = "Like",
    accent = "#fa7319",
    theme = "dark",
    radius = 999,
    sound = false,
    soundVolume = 0.5,
}: Partial<LikeProps>) {
    const p = palette(theme)
    const reduce = useReducedMotion()
    const [on, setOn] = React.useState(liked)
    const [n, setN] = React.useState(count)
    const [burst, setBurst] = React.useState(0)
    const [dir, setDir] = React.useState(1)
    const [hover, setHover] = React.useState(false)
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const [focusVisible, setFocusVisible] = React.useState(false)

    React.useEffect(() => setOn(liked), [liked])
    React.useEffect(() => setN(count), [count])

    const toggle = () => {
        const next = !on
        cue(next ? "pop" : "off")
        setOn(next)
        setDir(next ? 1 : -1)
        setN((v) => Math.max(0, v + (next ? 1 : -1)))
        if (next) setBurst((b) => b + 1)
    }

    const lighter = `color-mix(in srgb, ${accent} 55%, #ffffff)`

    return (
        <MotionConfig reducedMotion="user">
            <motion.button
                type="button"
                aria-pressed={on}
                aria-label={`${label}, ${n} ${n === 1 ? "like" : "likes"}`}
                onClick={toggle}
                onPointerEnter={() => setHover(true)}
                onPointerLeave={() => setHover(false)}
                onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                onBlur={() => setFocusVisible(false)}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 600, damping: 30 }}
                style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    height: 48,
                    padding: label ? "0 20px 0 16px" : "0 17px",
                    borderRadius: radius,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: on ? `color-mix(in srgb, ${accent} 55%, transparent)` : p.line,
                    background: on ? `color-mix(in srgb, ${accent} 12%, ${p.surface})` : hover ? p.hover : p.surface,
                    color: p.text,
                    fontFamily: "inherit",
                    fontSize: 15,
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: 3,
                    transition: "background-color 160ms, border-color 160ms",
                    WebkitTapHighlightColor: "transparent",
                }}
            >
                <span style={{ position: "relative", display: "inline-flex", width: 22, height: 22 }}>
                    {/* expanding ring */}
                    <AnimatePresence>
                        {burst > 0 && on && !reduce && (
                            <motion.span
                                key={`ring-${burst}`}
                                aria-hidden
                                initial={{ scale: 0.3, opacity: 0.55 }}
                                animate={{ scale: 2.4, opacity: 0 }}
                                exit={{ opacity: 0, transition: { duration: 0 } }}
                                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                                style={{
                                    position: "absolute",
                                    inset: -2,
                                    borderRadius: "50%",
                                    borderWidth: 2,
                                    borderStyle: "solid",
                                    borderColor: accent,
                                    pointerEvents: "none",
                                }}
                            />
                        )}
                    </AnimatePresence>
                    {/* particles */}
                    {burst > 0 && on && !reduce && (
                        <span aria-hidden style={{ position: "absolute", left: 11, top: 11, width: 0, height: 0, pointerEvents: "none" }}>
                            {PARTICLES.map((q, i) => (
                                <motion.span
                                    key={`${burst}-${i}`}
                                    initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                                    animate={{ x: q.dx, y: q.dy, scale: [0, 1.1, 0.2], opacity: [1, 1, 0] }}
                                    transition={{ duration: 0.62, delay: q.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.35, 1] }}
                                    style={{
                                        position: "absolute",
                                        left: -q.size / 2,
                                        top: q.kind === "dot" ? -q.size / 2 : -1,
                                        width: q.kind === "dot" ? q.size : q.size * 2.2,
                                        height: q.kind === "dot" ? q.size : 2,
                                        borderRadius: 99,
                                        background: q.tint > 0.6 ? lighter : accent,
                                        rotate: q.kind === "streak" ? q.angle : 0,
                                    }}
                                />
                            ))}
                        </span>
                    )}
                    <motion.span
                        initial={false}
                        animate={
                            on
                                ? { scale: [1, 0.62, 1.38, 0.94, 1], rotate: icon === "thumb" ? [0, 8, -22, 4, 0] : [0, -6, 6, -2, 0] }
                                : { scale: [1, 0.82, 1], rotate: 0 }
                        }
                        transition={{ duration: on ? 0.55 : 0.22, times: on ? [0, 0.18, 0.5, 0.78, 1] : [0, 0.4, 1], ease: "easeOut" }}
                        style={{ display: "inline-flex", transformOrigin: icon === "thumb" ? "30% 90%" : "50% 55%" }}
                    >
                        <Icon kind={icon} on={on} accent={accent} stroke={p.soft} />
                    </motion.span>
                </span>
                {label ? <span style={{ color: on ? p.text : p.soft, transition: "color 160ms" }}>{label}</span> : null}
                <span aria-hidden style={{ width: 1, height: 16, background: p.line }} />
                <span
                    aria-hidden
                    style={{
                        position: "relative",
                        display: "inline-block",
                        overflow: "hidden",
                        height: 22,
                        lineHeight: "22px",
                        fontVariantNumeric: "tabular-nums",
                        color: on ? accent : p.soft,
                        transition: "color 160ms",
                        textAlign: "left",
                    }}
                >
                    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                        <motion.span
                            key={n}
                            custom={dir}
                            variants={{
                                enter: (d: number) => ({ y: d > 0 ? 22 : -22, opacity: 0 }),
                                center: { y: 0, opacity: 1 },
                                exit: (d: number) => ({ y: d > 0 ? -22 : 22, opacity: 0 }),
                            }}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            style={{ display: "block" }}
                        >
                            {n}
                        </motion.span>
                    </AnimatePresence>
                </span>
            </motion.button>
        </MotionConfig>
    )
}

addPropertyControls(Like, {
    count: { type: ControlType.Number, title: "Count", defaultValue: 128, min: 0, max: 99999, step: 1 },
    liked: { type: ControlType.Boolean, title: "Liked", defaultValue: false },
    icon: {
        type: ControlType.Enum,
        title: "Icon",
        options: ["heart", "thumb"],
        optionTitles: ["Heart", "Thumb"],
        defaultValue: "heart",
    },
    label: { type: ControlType.String, title: "Label", defaultValue: "Like" },
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

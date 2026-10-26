import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useReducedMotion } from "framer-motion"
import type { Variants } from "framer-motion"

/**
 * LetterCascade: text whose letters cascade in with a stagger. They rise,
 * drop, un-blur or flip into place on a spring, flash the accent colour as
 * they land, hold for a beat, then cascade out and loop. Hover, click or
 * Enter replays it. Words never break across lines.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 240
 */

type Theme = "dark" | "light"
type Mode = "rise" | "drop" | "blur" | "flip"
type Phase = "hidden" | "in" | "out"

interface LetterCascadeProps {
    text: string
    mode: Mode
    stagger: number
    loop: boolean
    hold: number
    fontSize: number
    weight: number
    sound: boolean
    soundVolume: number
    accent: string
    theme: Theme
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#f4f2ee", line: "#e4e1db", text: "#141413", faint: "#76736d" }
        : { surface: "#0e0e0f", line: "#2d2d2f", text: "#f7f7f7", faint: "#8a8c8f" }
}

function hiddenPose(mode: Mode, fs: number) {
    switch (mode) {
        case "drop":
            return { opacity: 0, y: -fs * 0.9, rotate: -10, scale: 0.9, filter: "blur(10px)", rotateX: 0 }
        case "blur":
            return { opacity: 0, y: 0, rotate: 0, scale: 1.35, filter: "blur(18px)", rotateX: 0 }
        case "flip":
            return { opacity: 0, y: fs * 0.12, rotate: 0, scale: 0.96, filter: "blur(4px)", rotateX: -95 }
        default:
            return { opacity: 0, y: fs * 0.85, rotate: 9, scale: 0.92, filter: "blur(10px)", rotateX: 0 }
    }
}

function outPose(mode: Mode, fs: number) {
    switch (mode) {
        case "drop":
            return { opacity: 0, y: fs * 0.7, rotate: 8, scale: 0.92, filter: "blur(10px)", rotateX: 0 }
        case "blur":
            return { opacity: 0, y: 0, rotate: 0, scale: 0.7, filter: "blur(16px)", rotateX: 0 }
        case "flip":
            return { opacity: 0, y: -fs * 0.12, rotate: 0, scale: 0.96, filter: "blur(4px)", rotateX: 95 }
        default:
            return { opacity: 0, y: -fs * 0.6, rotate: -7, scale: 0.94, filter: "blur(10px)", rotateX: 0 }
    }
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

export default function LetterCascade({
    text = "Every letter lands",
    mode = "rise",
    stagger = 45,
    loop = true,
    hold = 1.6,
    fontSize = 64,
    weight = 700,
    sound = false,
    soundVolume = 0.5,
    accent = "#fa7319",
    theme = "dark",
}: Partial<LetterCascadeProps>) {
    const p = palette(theme)
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const reduce = useReducedMotion()
    const [phase, setPhase] = React.useState<Phase>("hidden")
    const [focusVisible, setFocusVisible] = React.useState(false)
    const timers = React.useRef<number[]>([])
    const startedAt = React.useRef(0)
    const [run, setRun] = React.useState(0)

    const words = text.split(/\s+/).filter(Boolean)
    const count = words.reduce((n, w) => n + Array.from(w).length, 0)
    const inMs = stagger * count + 750
    const outMs = stagger * 0.55 * count + 450

    const clear = () => {
        timers.current.forEach((t) => window.clearTimeout(t))
        timers.current = []
    }

    const later = (fn: () => void, ms: number) => {
        timers.current.push(window.setTimeout(fn, ms))
    }

    React.useEffect(() => {
        if (reduce) {
            setPhase("in")
            return
        }
        clear()
        let cancelled = false
        const cycle = () => {
            if (cancelled) return
            startedAt.current = performance.now()
            setPhase("in")
            if (!loop) return
            later(() => {
                if (cancelled) return
                setPhase("out")
                later(() => {
                    if (cancelled) return
                    setPhase("hidden")
                    later(cycle, 260)
                }, outMs)
            }, inMs + hold * 1000)
        }
        setPhase("hidden")
        later(cycle, run === 0 ? 120 : 40)
        return () => {
            cancelled = true
            clear()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [run, reduce, loop, hold, stagger, mode, text])

    const replay = () => {
        if (reduce) return
        if (performance.now() - startedAt.current < 500) return
        cue("whoosh", 300)
        setRun((r) => r + 1)
    }

    let idx = 0
    const letterVariants: Variants = {
        hidden: { ...hiddenPose(mode, fontSize), color: accent, transition: { duration: 0 } },
        in: (i: number) => ({
            opacity: 1,
            y: 0,
            rotate: 0,
            scale: 1,
            rotateX: 0,
            filter: "blur(0px)",
            color: p.text,
            transition: reduce ? { duration: 0 } : {
                delay: (i * stagger) / 1000,
                type: "spring",
                stiffness: 240,
                damping: 19,
                mass: 0.8,
                opacity: { duration: 0.28, delay: (i * stagger) / 1000 },
                filter: { duration: 0.4, delay: (i * stagger) / 1000 },
                color: { duration: 0.7, delay: (i * stagger) / 1000 + 0.12 },
            },
        }),
        out: (i: number) => ({
            ...outPose(mode, fontSize),
            color: accent,
            transition: {
                delay: (i * stagger * 0.55) / 1000,
                duration: 0.38,
                ease: [0.5, 0, 0.75, 0],
            },
        }),
    }

    const frame: React.CSSProperties = {
        position: "relative",
        width: "100%",
        maxWidth: 640,
        boxSizing: "border-box",
        padding: "40px 28px 44px",
        minHeight: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        background: p.surface,
        border: `1px solid ${p.line}`,
        fontFamily: "inherit",
        fontSize,
        fontWeight: weight,
        lineHeight: 1.1,
        letterSpacing: "-0.035em",
        color: p.text,
        textAlign: "center",
        overflow: "hidden",
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                role="button"
                tabIndex={0}
                aria-label={`${text}. Replay animation`}
                onPointerEnter={replay}
                onClick={replay}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        cue("whoosh", 300)
                        setRun((r) => r + 1)
                    }
                }}
                onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                onBlur={() => setFocusVisible(false)}
                style={{
                    ...frame,
                    cursor: "pointer",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: 2,
                }}
            >
                <div style={{ perspective: 600 }}>
                    {words.map((w, wi) => (
                        <React.Fragment key={wi}>
                            {wi > 0 && " "}
                            <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                                {Array.from(w).map((ch) => {
                                    const i = idx++
                                    return (
                                        <motion.span
                                            key={i}
                                            aria-hidden
                                            custom={i}
                                            variants={letterVariants}
                                            initial="hidden"
                                            animate={phase}
                                            style={{ display: "inline-block", willChange: "transform, opacity, filter", transformOrigin: "50% 80%" }}
                                        >
                                            {ch}
                                        </motion.span>
                                    )
                                })}
                            </span>
                        </React.Fragment>
                    ))}
                </div>
                <span
                    aria-hidden
                    style={{ position: "absolute", left: 0, right: 0, bottom: 14, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: p.faint, lineHeight: 1 }}
                >
                    {loop ? "Hover to replay" : "Hover or click to replay"}
                </span>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(LetterCascade, {
    text: { type: ControlType.String, title: "Text", defaultValue: "Every letter lands" },
    mode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["rise", "drop", "blur", "flip"],
        optionTitles: ["Rise", "Drop", "Blur", "Flip"],
        defaultValue: "rise",
    },
    stagger: { type: ControlType.Number, title: "Stagger", defaultValue: 45, min: 10, max: 150, unit: "ms" },
    loop: { type: ControlType.Boolean, title: "Loop", defaultValue: true },
    hold: { type: ControlType.Number, title: "Hold", defaultValue: 1.6, min: 0, max: 8, step: 0.1, unit: "s" },
    fontSize: { type: ControlType.Number, title: "Font size", defaultValue: 64, min: 20, max: 160 },
    weight: { type: ControlType.Number, title: "Weight", defaultValue: 700, min: 100, max: 900, step: 100 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
})

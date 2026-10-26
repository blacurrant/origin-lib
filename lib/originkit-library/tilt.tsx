import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion"

/**
 * Tilt: a card that leans in 3D toward the pointer on springs, with a moving
 * specular glare and layered depth. The title, subtitle and badge float at
 * different heights above generated gradient art. It eases flat on leave and
 * does not tilt for reduced motion.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 320
 */

type Theme = "dark" | "light"

interface TiltProps {
    strength: number
    glare: number
    title: string
    subtitle: string
    badge: string
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

function palette(theme: Theme, accent: string) {
    return theme === "light"
        ? {
              a: `color-mix(in srgb, ${accent} 78%, #ffffff)`,
              b: accent,
              c: `color-mix(in srgb, ${accent} 40%, #4a1a3a)`,
              ink: "#fffaf5",
              shadow: "rgba(70, 40, 10, 0.28)",
          }
        : {
              a: accent,
              b: `color-mix(in srgb, ${accent} 45%, #2a0f3a)`,
              c: "#12101a",
              ink: "#ffffff",
              shadow: "rgba(0, 0, 0, 0.6)",
          }
}

const SPRING = { stiffness: 220, damping: 20, mass: 0.7 }

export default function Tilt({
    strength = 14,
    glare = 0.45,
    title = "Aurora Pass",
    subtitle = "Move your pointer across the card",
    badge = "Limited",
    accent = "#fa7319",
    theme = "dark",
    radius = 22,
    sound = false,
    soundVolume = 0.5,
}: Partial<TiltProps>) {
    const p = palette(theme, accent)
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const reduce = useReducedMotion()

    // Pointer position inside the card, from -0.5 to 0.5 on each axis.
    const px = useMotionValue(0)
    const py = useMotionValue(0)
    const sx = useSpring(px, SPRING)
    const sy = useSpring(py, SPRING)
    const hover = useSpring(0, { stiffness: 260, damping: 28 })

    const rotateX = useTransform(sy, [-0.5, 0.5], [strength, -strength])
    const rotateY = useTransform(sx, [-0.5, 0.5], [-strength, strength])
    const scale = useTransform(hover, [0, 1], [1, 1.035])

    // Glare follows the pointer, art layers shift against it for parallax.
    const gx = useTransform(sx, [-0.5, 0.5], [0, 100])
    const gy = useTransform(sy, [-0.5, 0.5], [0, 100])
    const glareAlpha = useTransform(hover, (h) => h * Math.max(0, Math.min(1, glare)))
    const glareBg = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,${glareAlpha}) 0%, rgba(255,255,255,0) 52%)`
    const sheenOpacity = useTransform(hover, [0, 1], [0.0, 0.5])
    const sheenPos = useTransform(sx, [-0.5, 0.5], [-30, 130])
    const sheenBg = useMotionTemplate`linear-gradient(115deg, rgba(255,255,255,0) ${sheenPos}%, rgba(255,255,255,0.22) calc(${sheenPos}% + 10%), rgba(255,255,255,0) calc(${sheenPos}% + 24%))`
    const artX = useTransform(sx, [-0.5, 0.5], [10, -10])
    const artY = useTransform(sy, [-0.5, 0.5], [10, -10])
    const shadowX = useTransform(sx, [-0.5, 0.5], [strength * 1.6, -strength * 1.6])
    const shadowY = useTransform(sy, [-0.5, 0.5], [strength * 1.6 + 18, -strength * 1.6 + 18])
    const shadow = useMotionTemplate`${shadowX}px ${shadowY}px 46px -6px ${p.shadow}`

    const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (reduce) return
        const r = e.currentTarget.getBoundingClientRect()
        px.set((e.clientX - r.left) / Math.max(1, r.width) - 0.5)
        py.set((e.clientY - r.top) / Math.max(1, r.height) - 0.5)
        hover.set(1)
    }
    const onLeave = () => {
        px.set(0)
        py.set(0)
        hover.set(0)
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    maxWidth: 300,
                    height: 320,
                    boxSizing: "border-box",
                    padding: 10,
                    perspective: 900,
                    fontFamily: "inherit",
                }}
            >
                <div
                    onPointerMove={onMove}
                    onPointerEnter={(e) => {
                        onMove(e)
                        if (!reduce) cue("tick", 400, 0.7)
                    }}
                    onPointerLeave={onLeave}
                    onPointerCancel={onLeave}
                    style={{ width: "100%", height: "100%", touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none" }}
                >
                    <motion.div
                        style={{
                            position: "relative",
                            width: "100%",
                            height: "100%",
                            rotateX,
                            rotateY,
                            scale,
                            transformStyle: "preserve-3d",
                            willChange: "transform",
                        }}
                    >
                        {/* Art plane */}
                        <motion.div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: radius,
                                overflow: "hidden",
                                boxShadow: shadow,
                                background: `linear-gradient(155deg, ${p.a} 0%, ${p.b} 52%, ${p.c} 100%)`,
                            }}
                        >
                            <motion.svg
                                aria-hidden
                                viewBox="0 0 280 300"
                                preserveAspectRatio="xMidYMid slice"
                                style={{ position: "absolute", inset: -14, width: "calc(100% + 28px)", height: "calc(100% + 28px)", x: artX, y: artY }}
                            >
                                <defs>
                                    <radialGradient id="tilt-orb" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                                        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.18" />
                                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                    </radialGradient>
                                </defs>
                                <circle cx="190" cy="92" r="74" fill="url(#tilt-orb)" />
                                {[44, 74, 104, 134].map((r, i) => (
                                    <circle
                                        key={r}
                                        cx="190"
                                        cy="92"
                                        r={r}
                                        fill="none"
                                        stroke="#ffffff"
                                        strokeOpacity={0.28 - i * 0.05}
                                        strokeWidth="1"
                                    />
                                ))}
                                <path d="M-10 238 C 50 196, 96 252, 156 214 S 250 190, 300 224 L 300 320 L -10 320 Z" fill="#000000" fillOpacity="0.2" />
                                <path d="M-10 262 C 40 232, 100 276, 166 246 S 256 232, 300 256 L 300 320 L -10 320 Z" fill="#000000" fillOpacity="0.28" />
                            </motion.svg>
                            <div
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)",
                                }}
                            />
                            <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: sheenBg, opacity: sheenOpacity }} />
                            <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: glareBg, mixBlendMode: "soft-light" }} />
                            <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: glareBg, opacity: 0.55 }} />
                            <div
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: radius,
                                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
                                }}
                            />
                        </motion.div>

                        {/* Floating layers */}
                        <div
                            style={{
                                position: "absolute",
                                top: 18,
                                left: 18,
                                transform: "translateZ(70px)",
                                padding: "5px 11px",
                                borderRadius: 999,
                                background: "rgba(10,10,12,0.42)",
                                backdropFilter: "blur(8px)",
                                WebkitBackdropFilter: "blur(8px)",
                                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
                                color: p.ink,
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                pointerEvents: "none",
                            }}
                        >
                            {badge}
                        </div>
                        <div
                            style={{
                                position: "absolute",
                                left: 22,
                                right: 22,
                                bottom: 54,
                                transform: "translateZ(54px)",
                                color: p.ink,
                                fontSize: 28,
                                fontWeight: 700,
                                lineHeight: 1.08,
                                letterSpacing: "-0.02em",
                                textShadow: "0 2px 14px rgba(0,0,0,0.35)",
                                pointerEvents: "none",
                            }}
                        >
                            {title}
                        </div>
                        <div
                            style={{
                                position: "absolute",
                                left: 22,
                                right: 22,
                                bottom: 22,
                                transform: "translateZ(30px)",
                                color: p.ink,
                                opacity: 0.82,
                                fontSize: 13,
                                lineHeight: 1.4,
                                pointerEvents: "none",
                            }}
                        >
                            {subtitle}
                        </div>
                    </motion.div>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(Tilt, {
    strength: { type: ControlType.Number, title: "Strength", defaultValue: 14, min: 0, max: 30, step: 1 },
    glare: { type: ControlType.Number, title: "Glare", defaultValue: 0.45, min: 0, max: 1, step: 0.05 },
    title: { type: ControlType.String, title: "Title", defaultValue: "Aurora Pass" },
    subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "Move your pointer across the card" },
    badge: { type: ControlType.String, title: "Badge", defaultValue: "Limited" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 22, min: 0, max: 40, step: 1 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * LayeredStack: a deck of glass layers that sit compressed under a slight
 * perspective tilt. Hover (or focus) fans them out with a staggered spring so
 * every title can be read, and leaving collapses them again. Click a layer to
 * bring it to the front. Layers are generated gradients, nothing is fetched.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 310
 */

type Theme = "dark" | "light"

interface Layer {
    title: string
    subtitle: string
    color: string
}

interface LayeredStackProps {
    sound: boolean
    soundVolume: number
    items: Layer[]
    spread: number
    perspective: number
    accent: string
    theme: Theme
    radius: number
}

const SAMPLE: Layer[] = [
    { title: "Overview", subtitle: "Everything at a glance", color: "#fa7319" },
    { title: "Analytics", subtitle: "Trends and cohorts", color: "#7c5cff" },
    { title: "Automations", subtitle: "Rules that run themselves", color: "#12a5c8" },
    { title: "Audience", subtitle: "Who is showing up", color: "#d946a8" },
    { title: "Archive", subtitle: "Everything shipped so far", color: "#2f9e6e" },
]

const FALLBACK = ["#fa7319", "#7c5cff", "#12a5c8", "#d946a8", "#2f9e6e", "#d9a21b", "#e0524a", "#4a7bd9"]

function palette(theme: Theme) {
    return theme === "light"
        ? { text: "#141413", soft: "#5c5a55", shadow: "rgba(20,20,19,0.32)" }
        : { text: "#f7f7f7", soft: "#b7b7b8", shadow: "rgba(0,0,0,0.65)" }
}

const CARD_H = 140

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

export default function LayeredStack({
    items = SAMPLE,
    spread = 40,
    perspective = 900,
    accent = "#fa7319",
    theme = "dark",
    radius = 16,
    sound = false,
    soundVolume = 0.5,
}: Partial<LayeredStackProps>) {
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const p = palette(theme)
    const n = items.length
    const [order, setOrder] = React.useState<number[]>(() => items.map((_, i) => i))
    const [hover, setHover] = React.useState(false)
    const [focused, setFocused] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(-1)
    const open = hover || focused

    // Keep the order valid when the item list changes.
    const safeOrder = React.useMemo(() => {
        const kept = order.filter((i) => i < n)
        for (let i = 0; i < n; i++) if (!kept.includes(i)) kept.push(i)
        return kept
    }, [order, n])

    const bringToFront = (i: number) => {
        if (i !== safeOrder[0]) cue("drop", 120)
        setOrder([i, ...safeOrder.filter((x) => x !== i)])
    }

    const step = Math.max(8, Math.min(spread, 90))
    const closedStep = Math.min(11, step * 0.45)
    const frontTop = Math.max(0, n - 1) * step
    const height = CARD_H + frontTop

    return (
        <MotionConfig reducedMotion="user">
            <div
                role="group"
                aria-label="Layered stack. Hover to fan out the layers, click a layer to bring it to the front."
                onPointerEnter={() => {
                    if (!open) cue("whoosh", 250)
                    setHover(true)
                }}
                onPointerLeave={() => setHover(false)}
                onFocus={(e) => {
                    if ((e.target as HTMLElement).matches(":focus-visible")) {
                        if (!open) cue("whoosh", 250)
                        setFocused(true)
                    }
                }}
                onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
                    setFocusVisible(-1)
                }}
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 360,
                    height,
                    margin: "0 auto",
                    perspective,
                    perspectiveOrigin: "50% 40%",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                {items.map((item, i) => {
                    const pos = safeOrder.indexOf(i)
                    const isFront = pos === 0
                    const color = item.color || FALLBACK[i % FALLBACK.length]
                    const y = frontTop - pos * (open ? step : closedStep)
                    const scale = open ? 1 - pos * 0.018 : 1 - pos * 0.045
                    const dim = open ? Math.min(0.5, pos * 0.07) : Math.min(0.62, pos * 0.15)
                    const delay = open ? pos * 0.04 : (n - 1 - pos) * 0.022
                    return (
                        <motion.button
                            key={i}
                            type="button"
                            onClick={() => bringToFront(i)}
                            onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible") ? i : -1)}
                            aria-label={`${item.title}. ${item.subtitle}`}
                            aria-current={isFront ? "true" : undefined}
                            initial={false}
                            animate={{ y, scale, rotateX: open ? 8 : 12 }}
                            whileTap={{ scale: scale * 0.985 }}
                            transition={{ type: "spring", stiffness: 240, damping: 22, mass: 0.9, delay }}
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                display: "block",
                                width: "100%",
                                height: CARD_H,
                                zIndex: n - pos,
                                transformOrigin: "50% 0%",
                                padding: 0,
                                margin: 0,
                                textAlign: "left",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                color: "#ffffff",
                                borderRadius: radius,
                                borderWidth: 1,
                                borderStyle: "solid",
                                borderColor: isFront ? `color-mix(in srgb, ${accent} 70%, rgba(255,255,255,0.4))` : "rgba(255,255,255,0.2)",
                                background: `linear-gradient(150deg, color-mix(in srgb, ${color} 88%, #ffffff) 0%, ${color} 38%, color-mix(in srgb, ${color} 52%, #05050a) 100%)`,
                                boxShadow: `0 -10px 26px -14px ${p.shadow}, inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -24px 40px -28px rgba(0,0,0,0.5)`,
                                outline: focusVisible === i ? `2px solid ${accent}` : "none",
                                outlineOffset: 3,
                                overflow: "hidden",
                                boxSizing: "border-box",
                                WebkitTapHighlightColor: "transparent",
                            }}
                        >
                            {/* glass sheen */}
                            <span
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background:
                                        "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.32), rgba(255,255,255,0) 55%), linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 30%)",
                                    pointerEvents: "none",
                                }}
                            />
                            {/* title strip: always readable once fanned */}
                            <span
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    height: Math.max(30, Math.min(step, 40)),
                                    padding: "0 16px",
                                    boxSizing: "border-box",
                                }}
                            >
                                <span
                                    aria-hidden
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        letterSpacing: "0.04em",
                                        opacity: 0.7,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em", textShadow: "0 1px 8px rgba(0,0,0,0.25)" }}>
                                    {item.title}
                                </span>
                                <span
                                    style={{
                                        marginLeft: "auto",
                                        fontSize: 12,
                                        opacity: 0.78,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {item.subtitle}
                                </span>
                            </span>
                            {/* body art, only seen on the front layer */}
                            <span aria-hidden style={{ position: "absolute", left: 16, right: 16, top: 52, display: "grid", gap: 8 }}>
                                {[0.72, 0.5, 0.62].map((w, k) => (
                                    <span
                                        key={k}
                                        style={{ display: "block", height: 8, width: `${w * 100}%`, borderRadius: 4, background: "rgba(255,255,255,0.26)" }}
                                    />
                                ))}
                            </span>
                            <span
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    right: -26,
                                    bottom: -44,
                                    width: 130,
                                    height: 130,
                                    borderRadius: "50%",
                                    background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0.08) 62%, rgba(255,255,255,0) 72%)",
                                }}
                            />
                            {isFront && (
                                <span
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        left: 16,
                                        bottom: 14,
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: accent,
                                        boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 30%, transparent), 0 0 14px ${accent}`,
                                    }}
                                />
                            )}
                            {/* depth dimming */}
                            <motion.span
                                aria-hidden
                                initial={false}
                                animate={{ opacity: dim }}
                                transition={{ duration: 0.2, delay }}
                                style={{ position: "absolute", inset: 0, background: "#050509", pointerEvents: "none" }}
                            />
                        </motion.button>
                    )
                })}
            </div>
        </MotionConfig>
    )
}

addPropertyControls(LayeredStack, {
    items: {
        type: ControlType.Array,
        title: "Layers",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Layer" },
                subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "" },
                color: { type: ControlType.Color, title: "Color", defaultValue: "#fa7319" },
            },
        },
        defaultValue: SAMPLE,
    },
    spread: { type: ControlType.Number, title: "Spread", defaultValue: 40, min: 24, max: 80, step: 1, unit: "px" },
    perspective: { type: ControlType.Number, title: "Perspective", defaultValue: 900, min: 300, max: 2000, step: 10 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 16, min: 0, max: 32 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, animate, motion, useAnimationFrame, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion"
import type { MotionValue } from "framer-motion"

/**
 * OrbitCardStack: cards travelling around a tilted elliptical orbit. Front
 * cards are larger and brighter, back cards smaller and dimmer, with correct
 * z-order. It drifts slowly (pauses on hover, off for reduced motion), drag it
 * to spin with inertia, click a card to rotate it to the front. Positions are
 * computed from one angle motion value, never from React state per frame.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 320
 */

type Theme = "dark" | "light"

interface OrbitItem {
    title: string
    subtitle: string
    color: string
    image: string
}

interface OrbitCardStackProps {
    sound: boolean
    soundVolume: number
    items: OrbitItem[]
    speed: number
    radiusX: number
    radiusY: number
    autoplay: boolean
    accent: string
    theme: Theme
    radius: number
}

const SAMPLE: OrbitItem[] = [
    { title: "Aurora", subtitle: "Northern light study", color: "#fa7319", image: "" },
    { title: "Tide", subtitle: "Slow blue motion", color: "#2b7fe0", image: "" },
    { title: "Orchid", subtitle: "Soft violet bloom", color: "#9b5cf0", image: "" },
    { title: "Moss", subtitle: "Green after rain", color: "#2f9e6e", image: "" },
    { title: "Ember", subtitle: "Late summer glow", color: "#e0524a", image: "" },
    { title: "Dune", subtitle: "Warm sand and shade", color: "#d9a21b", image: "" },
]

function palette(theme: Theme) {
    return theme === "light"
        ? { shade: "#f3f1ed", shadeMax: 0.6, text: "#141413", soft: "#5c5a55", ring: "rgba(20,20,19,0.26)", floor: "rgba(20,20,19,0.16)", chip: "#ffffff", line: "#e4e1db" }
        : { shade: "#050509", shadeMax: 0.72, text: "#f7f7f7", soft: "#b7b7b8", ring: "rgba(255,255,255,0.22)", floor: "rgba(0,0,0,0.55)", chip: "#1d1e1f", line: "#2d2d2f" }
}

const FALLBACK = ["#fa7319", "#2b7fe0", "#9b5cf0", "#2f9e6e", "#e0524a", "#d9a21b"]
const CARD_W = 128
const CARD_H = 168
const DEG = Math.PI / 180
// Rounded so server and client markup match exactly.
const r2 = (v: number) => Math.round(v * 100) / 100

// Depth 1 at the front of the orbit, 0 at the back.
function depthOf(angle: number, phase: number) {
    return (Math.cos((angle + phase) * DEG) + 1) / 2
}

interface OrbitCardProps {
    item: OrbitItem
    index: number
    phase: number
    angle: MotionValue<number>
    rx: number
    ry: number
    accent: string
    radius: number
    shade: string
    shadeMax: number
    focusVisible: boolean
    onFocusVisible: (v: boolean) => void
    onSelect: (index: number) => void
}

function OrbitCard({ item, index, phase, angle, rx, ry, accent, radius, shade: shadeColor, shadeMax, focusVisible, onFocusVisible, onSelect }: OrbitCardProps) {
    const x = useTransform(angle, (a) => r2(Math.sin((a + phase) * DEG) * rx))
    const y = useTransform(angle, (a) => r2(Math.cos((a + phase) * DEG) * ry))
    const scale = useTransform(angle, (a) => r2(0.55 + 0.45 * depthOf(a, phase)))
    const rotateY = useTransform(angle, (a) => r2(-Math.sin((a + phase) * DEG) * 26))
    const zIndex = useTransform(angle, (a) => Math.round(depthOf(a, phase) * 100))
    const shade = useTransform(angle, (a) => r2(Math.pow(1 - depthOf(a, phase), 0.8) * shadeMax))
    const glow = useTransform(angle, (a) => r2(Math.pow(depthOf(a, phase), 6)))
    const color = item.color || FALLBACK[index % FALLBACK.length]

    return (
        <motion.button
            type="button"
            onClick={() => onSelect(index)}
            onFocus={(e) => onFocusVisible(e.currentTarget.matches(":focus-visible"))}
            onBlur={() => onFocusVisible(false)}
            aria-label={`${item.title}, ${item.subtitle}. Bring to front.`}
            style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: CARD_W,
                height: CARD_H,
                marginLeft: -CARD_W / 2,
                marginTop: -CARD_H / 2,
                x,
                y,
                scale,
                rotateY,
                zIndex,
                transformPerspective: 700,
                padding: 0,
                display: "block",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "#ffffff",
                borderRadius: radius,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "rgba(255,255,255,0.22)",
                background: item.image
                    ? `center / cover no-repeat url("${item.image}")`
                    : `radial-gradient(90% 70% at 20% 0%, rgba(255,255,255,0.4), rgba(255,255,255,0) 60%), linear-gradient(160deg, color-mix(in srgb, ${color} 85%, #ffffff), ${color} 45%, color-mix(in srgb, ${color} 40%, #04040a))`,
                boxShadow: "0 10px 16px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.35)",
                outline: focusVisible ? `2px solid ${accent}` : "none",
                outlineOffset: 3,
                overflow: "hidden",
                boxSizing: "border-box",
                WebkitTapHighlightColor: "transparent",
            }}
        >
            {!item.image && (
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        right: -34,
                        top: 26,
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0.06) 64%, rgba(255,255,255,0) 72%)",
                    }}
                />
            )}
            <span
                aria-hidden
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: "52%",
                    background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.55))",
                }}
            />
            <span style={{ position: "absolute", left: 12, right: 12, bottom: 11, textAlign: "left", display: "grid", gap: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 650, letterSpacing: "-0.01em", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>{item.title}</span>
                <span style={{ fontSize: 10.5, opacity: 0.78, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.subtitle}</span>
            </span>
            <motion.span
                aria-hidden
                style={{ position: "absolute", inset: 0, background: shadeColor, opacity: shade, pointerEvents: "none" }}
            />
            <motion.span
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: radius,
                    boxShadow: `inset 0 0 0 1.5px ${accent}`,
                    opacity: glow,
                    pointerEvents: "none",
                }}
            />
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

export default function OrbitCardStack({
    items = SAMPLE,
    speed = 12,
    radiusX = 170,
    radiusY = 44,
    autoplay = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 14,
    sound = false,
    soundVolume = 0.5,
}: Partial<OrbitCardStackProps>) {
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const p = palette(theme)
    const glowId = "orbit-glow-" + React.useId().replace(/:/g, "")
    const n = Math.max(1, items.length)
    const step = 360 / n
    const angle = useMotionValue(0)
    const velocity = React.useRef(0)
    const dragging = React.useRef(false)
    const tween = React.useRef<{ stop: () => void } | null>(null)
    const hovered = React.useRef(false)
    const reduced = React.useRef(false)
    const [paused, setPaused] = React.useState(false)
    const pausedRef = React.useRef(false)
    const [front, setFront] = React.useState(0)
    const [focusIndex, setFocusIndex] = React.useState(-1)
    const [stageFocus, setStageFocus] = React.useState(false)
    const [btnFocus, setBtnFocus] = React.useState(false)
    // What the user is doing right now: only user-driven spins make sound.
    const mode = React.useRef<"" | "drag" | "key" | "click">("")
    const dragState = React.useRef({ id: -1, x: 0, t: 0, startX: 0, moved: false })

    pausedRef.current = paused

    React.useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        const sync = () => {
            reduced.current = mq.matches
        }
        sync()
        mq.addEventListener("change", sync)
        return () => mq.removeEventListener("change", sync)
    }, [])

    React.useEffect(() => () => tween.current?.stop(), [])

    const lastFront = React.useRef(0)
    const frontOf = (a: number) => (((Math.round(-a / step) % n) + n) % n)
    useMotionValueEvent(angle, "change", (a) => {
        const f = frontOf(a)
        setFront((prev) => (prev === f ? prev : f))
        if (f !== lastFront.current) {
            lastFront.current = f
            if (mode.current === "drag" || mode.current === "key") cue("tick", 50)
        }
    })

    // One animation frame loop drives drift and inertia. The angle is a motion
    // value, so no React render happens per frame.
    useAnimationFrame((_, delta) => {
        if (dragging.current || tween.current) return
        const dt = Math.min(delta, 64) / 1000
        const drift = autoplay && !reduced.current && !pausedRef.current && !hovered.current ? speed : 0
        // Back to idle once a throw has settled into the drift.
        if (mode.current && Math.abs(velocity.current - drift) < 1) mode.current = ""
        const v = velocity.current
        if (Math.abs(v) < 0.02 && drift === 0) {
            velocity.current = 0
            return
        }
        // Spin decays with friction toward the drift speed.
        velocity.current = v + (drift - v) * (1 - Math.exp(-dt * 2.2))
        angle.set(angle.get() + velocity.current * dt)
    })

    const rotateToFront = (index: number) => {
        tween.current?.stop()
        velocity.current = 0
        const current = angle.get()
        const base = -index * step
        const k = Math.round((current - base) / 360)
        const target = base + k * 360
        const controls = animate(angle, target, {
            type: "spring",
            stiffness: 120,
            damping: 20,
            mass: 0.9,
            onComplete: () => {
                tween.current = null
                mode.current = ""
            },
        })
        tween.current = controls
    }

    const nudge = (dir: number) => {
        const f = frontOf(angle.get())
        mode.current = "key"
        rotateToFront(((f + dir) % n + n) % n)
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return
        tween.current?.stop()
        tween.current = null
        const d = dragState.current
        d.id = e.pointerId
        d.x = e.clientX
        d.startX = e.clientX
        d.t = performance.now()
        d.moved = false
        velocity.current = 0
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = dragState.current
        if (d.id !== e.pointerId) return
        if (!d.moved && Math.abs(e.clientX - d.startX) > 5) {
            d.moved = true
            dragging.current = true
            mode.current = "drag"
            try {
                e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
                /* not capturable */
            }
        }
        if (!dragging.current) return
        const now = performance.now()
        const dx = e.clientX - d.x
        const dtMs = Math.max(1, now - d.t)
        const deg = dx * 0.45
        angle.set(angle.get() + deg)
        const inst = (deg / dtMs) * 1000
        velocity.current = velocity.current * 0.6 + inst * 0.4
        d.x = e.clientX
        d.t = now
    }

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = dragState.current
        if (d.id !== e.pointerId) return
        d.id = -1
        if (dragging.current) {
            dragging.current = false
            // A stale last sample means the pointer rested before release.
            if (performance.now() - d.t > 90) velocity.current = 0
            velocity.current = Math.max(-900, Math.min(900, velocity.current))
        }
    }

    const onSelect = (index: number) => {
        // Ignore the click that ends a drag.
        if (dragState.current.moved) {
            dragState.current.moved = false
            return
        }
        if (index !== frontOf(angle.get())) cue("drop", 120)
        mode.current = "click"
        rotateToFront(index)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault()
            nudge(-1)
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault()
            nudge(1)
        } else if (e.key === " " && e.target === e.currentTarget) {
            e.preventDefault()
            setPaused((v) => !v)
        }
    }

    const w = radiusX * 2 + CARD_W
    const h = radiusY * 2 + CARD_H + 4

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 480,
                    margin: "0 auto",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    display: "grid",
                    justifyItems: "center",
                    gap: 6,
                }}
            >
                <div
                    role="group"
                    aria-roledescription="orbit carousel"
                    aria-label={`Orbit of ${n} cards. Drag to spin, arrow keys to step, space to pause.`}
                    tabIndex={0}
                    onKeyDown={onKeyDown}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerEnter={() => {
                        hovered.current = true
                    }}
                    onPointerLeave={() => {
                        hovered.current = false
                    }}
                    onFocus={(e) => {
                        if (e.target === e.currentTarget) setStageFocus(e.currentTarget.matches(":focus-visible"))
                    }}
                    onBlur={() => setStageFocus(false)}
                    style={{
                        position: "relative",
                        width: "100%",
                        height: h + 24,
                        overflow: "hidden",
                        touchAction: "pan-y",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        cursor: "grab",
                        borderRadius: 16,
                        outline: stageFocus ? `2px solid ${accent}` : "none",
                        outlineOffset: -2,
                    }}
                >
                    {/* orbit ring and floor glow */}
                    <svg
                        aria-hidden
                        width={w}
                        height={h}
                        viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
                        style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -w / 2, marginTop: -h / 2, overflow: "visible", pointerEvents: "none" }}
                    >
                        <defs>
                            <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
                                <stop offset="100%" stopColor={accent} stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        <ellipse cx="0" cy="0" rx={radiusX * 1.25} ry={radiusY * 1.9} fill={`url(#${glowId})`} />
                        <ellipse cx="0" cy="0" rx={radiusX} ry={radiusY} fill="none" stroke={p.ring} strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
                    </svg>
                    <div style={{ position: "absolute", inset: 0 }}>
                        {items.map((item, i) => (
                            <OrbitCard
                                key={i}
                                item={item}
                                index={i}
                                phase={i * step}
                                angle={angle}
                                rx={radiusX}
                                ry={radiusY}
                                accent={accent}
                                radius={radius}
                                shade={p.shade}
                                shadeMax={p.shadeMax}
                                focusVisible={focusIndex === i}
                                onFocusVisible={(v) => setFocusIndex(v ? i : -1)}
                                onSelect={onSelect}
                            />
                        ))}
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 24 }}>
                    <span aria-live="polite" style={{ fontSize: 13, fontWeight: 600, color: p.text, minWidth: 90, textAlign: "center" }}>
                        {items[front]?.title ?? ""}
                    </span>
                    {autoplay && (
                        <button
                            type="button"
                            onClick={() => setPaused((v) => !v)}
                            aria-label={paused ? "Resume rotation" : "Pause rotation"}
                            aria-pressed={paused}
                            onFocus={(e) => setBtnFocus(e.currentTarget.matches(":focus-visible"))}
                            onBlur={() => setBtnFocus(false)}
                            style={{
                                outline: btnFocus ? `2px solid ${accent}` : "none",
                                outlineOffset: 2,
                                width: 24,
                                height: 24,
                                padding: 0,
                                display: "grid",
                                placeItems: "center",
                                borderRadius: 999,
                                borderWidth: 1,
                                borderStyle: "solid",
                                borderColor: p.line,
                                background: p.chip,
                                color: paused ? accent : p.soft,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                                {paused ? <path d="M2.5 1.5v7l6-3.5z" fill="currentColor" /> : <path d="M2.5 1.5h2v7h-2zM5.5 1.5h2v7h-2z" fill="currentColor" />}
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(OrbitCardStack, {
    items: {
        type: ControlType.Array,
        title: "Cards",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Card" },
                subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "" },
                color: { type: ControlType.Color, title: "Color", defaultValue: "#fa7319" },
                image: { type: ControlType.String, title: "Image URL", defaultValue: "" },
            },
        },
        defaultValue: SAMPLE,
    },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 12, min: 0, max: 90, step: 1, unit: "deg/s" },
    radiusX: { type: ControlType.Number, title: "Radius X", defaultValue: 170, min: 80, max: 260, step: 1 },
    radiusY: { type: ControlType.Number, title: "Radius Y", defaultValue: 44, min: 10, max: 120, step: 1 },
    autoplay: { type: ControlType.Boolean, title: "Autoplay", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 14, min: 0, max: 28 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

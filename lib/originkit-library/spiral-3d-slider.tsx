import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion"
import type { MotionValue } from "framer-motion"

/**
 * Spiral3DSlider: items arranged along a 3D helix using CSS 3D transforms.
 * Drag, scroll the wheel or use the arrow keys to turn it. Items facing you
 * are sharp and bright, the rest fade; the nearest item snaps to the front
 * with a spring and its title appears below.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 340
 */

type Theme = "dark" | "light"

interface SpiralItem {
    title: string
    subtitle: string
    color: string
}

interface Spiral3DSliderProps {
    sound: boolean
    soundVolume: number
    items: SpiralItem[]
    turns: number
    radius: number
    itemWidth: number
    accent: string
    theme: Theme
    cornerRadius: number
}

const SAMPLE: SpiralItem[] = [
    { title: "Prism", subtitle: "Light bent into colour", color: "#fa7319" },
    { title: "Helix", subtitle: "A staircase of ideas", color: "#e0524a" },
    { title: "Lagoon", subtitle: "Calm, deep and teal", color: "#12a5c8" },
    { title: "Nebula", subtitle: "Soft violet dust", color: "#7c5cff" },
    { title: "Fern", subtitle: "Green, quiet and slow", color: "#2f9e6e" },
    { title: "Saffron", subtitle: "A warm yellow hum", color: "#d9a21b" },
    { title: "Orchid", subtitle: "Pink with a pulse", color: "#d946a8" },
    { title: "Cobalt", subtitle: "Night sky, nearly", color: "#4a7bd9" },
    { title: "Coral", subtitle: "Sun on shallow water", color: "#ef6f5e" },
]

const FALLBACK = ["#fa7319", "#e0524a", "#12a5c8", "#7c5cff", "#2f9e6e", "#d9a21b", "#d946a8", "#4a7bd9"]
const DEG = Math.PI / 180
const r3 = (v: number) => Math.round(v * 1000) / 1000
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function palette(theme: Theme) {
    return theme === "light"
        ? { text: "#141413", soft: "#5c5a55", faint: "#76736d", line: "#d9d6cf", chip: "#ffffff", back: "#e8e5de" }
        : { text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f", line: "#2d2d2f", chip: "#1d1e1f", back: "#17181a" }
}

interface HelixItemProps {
    item: SpiralItem
    index: number
    base: number
    height: number
    width: number
    radius: number
    cornerRadius: number
    rot: MotionValue<number>
    accent: string
    pitch: number
    back: string
    onPick: (index: number) => void
}

function HelixItem({ item, index, base, height, width, radius, cornerRadius, rot, accent, pitch, back, onPick }: HelixItemProps) {
    const color = item.color || FALLBACK[index % FALLBACK.length]
    // facing = 1 when the item is dead centre at the front, -1 at the back.
    const facing = useTransform(rot, (r) => Math.cos((base + r) * DEG))
    const faceOpacity = useTransform(facing, (f) => r3(0.12 + 0.88 * clamp((f + 0.15) / 1.15, 0, 1) ** 1.25))
    const dim = useTransform(facing, (f) => r3((1 - clamp((f - 0.45) / 0.5, 0, 1)) * 0.5))
    const ring = useTransform(facing, (f) => r3(clamp((f - 0.93) / 0.07, 0, 1)))
    const backOpacity = useTransform(facing, (f) => r3(0.08 + 0.16 * clamp((-f + 0.2) / 1.2, 0, 1)))

    const faceBase: React.CSSProperties = {
        position: "absolute",
        inset: 0,
        borderRadius: cornerRadius,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        overflow: "hidden",
        boxSizing: "border-box",
    }

    return (
        <div
            onClick={() => onPick(index)}
            aria-hidden
            style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width,
                height,
                marginLeft: -width / 2,
                marginTop: -height / 2,
                transformStyle: "preserve-3d",
                transform: `translateY(${r3(index * pitch)}px) rotateY(${r3(base)}deg) translateZ(${radius}px)`,
                cursor: "pointer",
            }}
        >
            {/* front face */}
            <motion.div
                style={{
                    ...faceBase,
                    opacity: faceOpacity,
                    background: `radial-gradient(90% 70% at 20% 0%, rgba(255,255,255,0.4), rgba(255,255,255,0) 60%), linear-gradient(160deg, color-mix(in srgb, ${color} 85%, #ffffff), ${color} 45%, color-mix(in srgb, ${color} 40%, #04040a))`,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "rgba(255,255,255,0.24)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
            >
                <span
                    style={{
                        position: "absolute",
                        right: -width * 0.3,
                        top: height * 0.16,
                        width: width * 1.0,
                        height: width * 1.0,
                        borderRadius: "50%",
                        background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0.06) 64%, rgba(255,255,255,0) 72%)",
                    }}
                />
                <span
                    style={{
                        position: "absolute",
                        left: 12,
                        top: 10,
                        fontSize: 11,
                        fontWeight: 650,
                        letterSpacing: "0.06em",
                        color: "#ffffff",
                        opacity: 0.8,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {String(index + 1).padStart(2, "0")}
                </span>
                <span
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: "45%",
                        background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.5))",
                    }}
                />
                <span
                    style={{
                        position: "absolute",
                        left: 12,
                        right: 10,
                        bottom: 10,
                        fontSize: 13,
                        fontWeight: 650,
                        color: "#ffffff",
                        letterSpacing: "-0.01em",
                        textShadow: "0 1px 6px rgba(0,0,0,0.35)",
                    }}
                >
                    {item.title}
                </span>
                <motion.span style={{ position: "absolute", inset: 0, background: "#050509", opacity: dim }} />
                <motion.span
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: cornerRadius,
                        boxShadow: `inset 0 0 0 1.5px ${accent}`,
                        opacity: ring,
                    }}
                />
            </motion.div>
            {/* back face: plain glass so the helix reads as solid panels */}
            <motion.div
                style={{
                    ...faceBase,
                    transform: "rotateY(180deg)",
                    opacity: backOpacity,
                    background: `linear-gradient(160deg, color-mix(in srgb, ${color} 60%, ${back}), color-mix(in srgb, ${color} 25%, ${back}))`,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "rgba(255,255,255,0.14)",
                }}
            />
        </div>
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

export default function Spiral3DSlider({
    items = SAMPLE,
    turns = 1,
    radius = 170,
    itemWidth = 108,
    accent = "#fa7319",
    theme = "dark",
    cornerRadius = 12,
    sound = false,
    soundVolume = 0.5,
}: Partial<Spiral3DSliderProps>) {
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const p = palette(theme)
    const n = Math.max(1, items.length)
    const itemHeight = Math.round(itemWidth * 1.3)
    const stepAngle = n > 1 ? (turns * 360) / n : 0
    const pitch = itemHeight * 0.48
    const minRot = -(n - 1) * stepAngle
    const rot = useMotionValue(0)
    const y = useTransform(rot, (r) => (stepAngle === 0 ? 0 : r3((r / stepAngle) * pitch)))
    const stageRef = React.useRef<HTMLDivElement | null>(null)
    const tween = React.useRef<{ stop: () => void } | null>(null)
    const wheelTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const drag = React.useRef({ id: -1, x: 0, t: 0, startX: 0, moved: false, active: false, v: 0 })
    const [active, setActive] = React.useState(0)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const activeRef = React.useRef(0)
    // What the user is doing right now: only user input makes sound.
    const mode = React.useRef<"" | "drag" | "wheel" | "key" | "click">("")
    const cueRef = React.useRef(cue)
    cueRef.current = cue
    const targetRef = React.useRef(0)

    const index = (r: number) => (stepAngle === 0 ? 0 : clamp(Math.round(-r / stepAngle), 0, n - 1))
    useMotionValueEvent(rot, "change", (r) => {
        const i = index(r)
        if (i !== activeRef.current) {
            activeRef.current = i
            setActive(i)
            const m = mode.current
            if (m === "drag" || m === "wheel" || m === "key") cue("tick", 50)
        }
    })

    React.useEffect(
        () => () => {
            tween.current?.stop()
            if (wheelTimer.current) clearTimeout(wheelTimer.current)
        },
        []
    )

    const snapTo = React.useCallback(
        (i: number, velocity = 0) => {
            tween.current?.stop()
            targetRef.current = clamp(i, 0, n - 1)
            const target = -clamp(i, 0, n - 1) * stepAngle
            tween.current = animate(rot, target, {
                type: "spring",
                stiffness: 150,
                damping: 22,
                mass: 0.9,
                velocity,
                onComplete: () => {
                    tween.current = null
                    const m = mode.current
                    mode.current = ""
                    if (m === "drag" || m === "wheel" || m === "click") cueRef.current("drop", 120)
                },
            })
        },
        [n, stepAngle, rot]
    )

    // Keep the current item valid and resting when props change.
    React.useEffect(() => {
        snapTo(clamp(activeRef.current, 0, n - 1))
    }, [n, stepAngle, snapTo])

    // Wheel: needs a non-passive listener so the page does not scroll too.
    React.useEffect(() => {
        const el = stageRef.current
        if (!el) return
        const onWheel = (e: WheelEvent) => {
            const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
            if (d === 0) return
            e.preventDefault()
            tween.current?.stop()
            tween.current = null
            mode.current = "wheel"
            const next = clamp(rot.get() - d * (stepAngle / 160), minRot, 0)
            rot.set(next)
            if (wheelTimer.current) clearTimeout(wheelTimer.current)
            wheelTimer.current = setTimeout(() => snapTo(index(rot.get())), 110)
        }
        el.addEventListener("wheel", onWheel, { passive: false })
        return () => el.removeEventListener("wheel", onWheel)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepAngle, minRot, snapTo])

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return
        tween.current?.stop()
        tween.current = null
        const d = drag.current
        d.id = e.pointerId
        d.x = e.clientX
        d.startX = e.clientX
        d.t = performance.now()
        d.moved = false
        d.active = false
        d.v = 0
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current
        if (d.id !== e.pointerId) return
        if (!d.active && Math.abs(e.clientX - d.startX) > 5) {
            d.active = true
            d.moved = true
            mode.current = "drag"
            try {
                e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
                /* not capturable */
            }
        }
        if (!d.active) return
        const now = performance.now()
        const dx = e.clientX - d.x
        const per = stepAngle / 80 // degrees of rotation per dragged pixel
        const cur = rot.get()
        let next = cur + dx * per
        // Rubber band past either end.
        if (next > 0) next = cur + dx * per * 0.35
        if (next < minRot) next = cur + dx * per * 0.35
        rot.set(next)
        const inst = (dx * per) / Math.max(1, now - d.t) * 1000
        d.v = d.v * 0.6 + inst * 0.4
        d.x = e.clientX
        d.t = now
    }

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current
        if (d.id !== e.pointerId) return
        d.id = -1
        if (!d.active) return
        d.active = false
        const v = performance.now() - d.t > 90 ? 0 : d.v
        // Project where the throw would come to rest, then snap there.
        const projected = rot.get() + v * 0.22
        const target = stepAngle === 0 ? 0 : clamp(Math.round(-projected / stepAngle), 0, n - 1)
        snapTo(target, v)
    }

    const pick = (i: number) => {
        if (drag.current.moved) {
            drag.current.moved = false
            return
        }
        mode.current = "click"
        snapTo(i)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const cur = targetRef.current
        let next = cur
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = cur + 1
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = cur - 1
        else if (e.key === "Home") next = 0
        else if (e.key === "End") next = n - 1
        else return
        e.preventDefault()
        mode.current = "key"
        snapTo(next)
    }

    const stageH = Math.round(itemHeight * 2.0)
    const current = items[active] ?? items[0]

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    maxWidth: 480,
                    margin: "0 auto",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    display: "grid",
                    gap: 6,
                    justifyItems: "center",
                }}
            >
                <div
                    ref={stageRef}
                    role="slider"
                    tabIndex={0}
                    aria-label="Spiral slider. Drag, scroll or use the arrow keys."
                    aria-valuemin={1}
                    aria-valuemax={n}
                    aria-valuenow={active + 1}
                    aria-valuetext={current?.title}
                    onKeyDown={onKeyDown}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    style={{
                        position: "relative",
                        width: "100%",
                        height: stageH,
                        overflow: "hidden",
                        touchAction: "pan-y",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        cursor: "grab",
                        borderRadius: 16,
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: -2,
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            perspective: 950,
                            perspectiveOrigin: "50% 45%",
                            WebkitMaskImage: "linear-gradient(180deg, transparent 0, #000 16%, #000 84%, transparent 100%)",
                            maskImage: "linear-gradient(180deg, transparent 0, #000 16%, #000 84%, transparent 100%)",
                        }}
                    >
                    <motion.div
                        style={{
                            position: "absolute",
                            inset: 0,
                            transformStyle: "preserve-3d",
                            y,
                            rotateX: 9,
                        }}
                    >
                        <motion.div
                            style={{
                                position: "absolute",
                                inset: 0,
                                transformStyle: "preserve-3d",
                                rotateY: rot,
                                z: -radius,
                            }}
                        >
                            {items.map((item, i) => (
                                <HelixItem
                                    key={i}
                                    item={item}
                                    index={i}
                                    base={i * stepAngle}
                                    height={itemHeight}
                                    width={itemWidth}
                                    radius={radius}
                                    cornerRadius={cornerRadius}
                                    rot={rot}
                                    accent={accent}
                                    pitch={pitch}
                                    back={p.back}
                                    onPick={pick}
                                />
                            ))}
                        </motion.div>
                    </motion.div>
                    </div>
                </div>
                <div style={{ height: 40, display: "grid", justifyItems: "center", alignContent: "start", position: "relative", width: "100%" }}>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={active}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.16 }}
                            aria-live="polite"
                            style={{ display: "grid", justifyItems: "center", gap: 1 }}
                        >
                            <span style={{ fontSize: 15, fontWeight: 650, color: p.text, letterSpacing: "-0.01em" }}>
                                <span style={{ color: accent, fontVariantNumeric: "tabular-nums", marginRight: 8, fontSize: 12 }}>
                                    {String(active + 1).padStart(2, "0")}
                                </span>
                                {current?.title}
                            </span>
                            <span style={{ fontSize: 12, color: p.faint }}>{current?.subtitle}</span>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(Spiral3DSlider, {
    items: {
        type: ControlType.Array,
        title: "Items",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Item" },
                subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "" },
                color: { type: ControlType.Color, title: "Color", defaultValue: "#fa7319" },
            },
        },
        defaultValue: SAMPLE,
    },
    turns: { type: ControlType.Number, title: "Turns", defaultValue: 1, min: 0.5, max: 3, step: 0.1 },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 170, min: 80, max: 300, step: 1 },
    itemWidth: { type: ControlType.Number, title: "Item width", defaultValue: 108, min: 60, max: 200, step: 1 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    cornerRadius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 28 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

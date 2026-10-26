import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from "framer-motion"
import type { AnimationPlaybackControls, MotionValue } from "framer-motion"

/**
 * InfiniteGrid: a drag-to-pan canvas of cards that tiles forever in every
 * direction. A finite set of generated cards wraps modularly and only the
 * visible cells are rendered. Drag with inertia, scroll or use arrow keys to
 * pan. Cards near the centre scale up and fade in, so the middle feels closer.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 320
 */

type Theme = "dark" | "light"

interface Card {
    title: string
    tag: string
}

interface InfiniteGridProps {
    items: Card[]
    cellSize: number
    gap: number
    falloff: number
    height: number
    accent: string
    theme: Theme
    radius: number
    sound: boolean
    soundVolume: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#f3f1ec", line: "#e4e1db", text: "#141413", soft: "#5c5a55", dot: "rgba(20,20,19,0.24)" }
        : { surface: "#101011", line: "#2d2d2f", text: "#f7f7f7", soft: "#b7b7b8", dot: "rgba(255,255,255,0.22)" }
}

const SAMPLE: Card[] = [
    { title: "Signal", tag: "Motion" },
    { title: "Harbour", tag: "Photo" },
    { title: "Ember", tag: "Type" },
    { title: "Fieldwork", tag: "Print" },
    { title: "Lumen", tag: "Light" },
    { title: "Paperwave", tag: "Motion" },
    { title: "Northbound", tag: "Brand" },
    { title: "Static Bloom", tag: "Photo" },
    { title: "Quarry", tag: "Type" },
    { title: "Afterglow", tag: "Light" },
    { title: "Tidemark", tag: "Print" },
    { title: "Overcast", tag: "Brand" },
]

function hash(n: number) {
    let x = (n + 1) * 2654435761
    x = ((x >>> 16) ^ x) * 45679
    return ((x >>> 0) % 10000) / 10000
}

function mod(n: number, m: number) {
    return ((n % m) + m) % m
}

function pad(n: number) {
    return n < 10 ? `0${n}` : `${n}`
}

function art(i: number, accent: string, dark: boolean) {
    const r1 = hash(i * 3 + 1)
    const r2 = hash(i * 7 + 2)
    const r3 = hash(i * 11 + 5)
    const base = i % 5 === 0 ? -1 : Math.round(r1 * 360)
    const a = base < 0 ? accent : `hsl(${base} 72% ${dark ? 56 : 60}%)`
    const b = `hsl(${((base < 0 ? 24 : base) + 60 + r2 * 80) % 360} 68% ${dark ? 30 : 46}%)`
    const c = `hsl(${((base < 0 ? 24 : base) + 190 + r3 * 70) % 360} 70% ${dark ? 46 : 56}%)`
    return `radial-gradient(circle at ${Math.round(r2 * 100)}% ${Math.round(r3 * 70)}%, ${a}, transparent 60%), radial-gradient(circle at ${Math.round(r3 * 100)}% 100%, ${c}, transparent 62%), linear-gradient(${Math.round(r1 * 360)}deg, ${b}, ${dark ? "#0d0d0f" : "#ddd8ce"})`
}

interface CellProps {
    col: number
    row: number
    pitch: number
    size: number
    card: Card
    index: number
    px: MotionValue<number>
    py: MotionValue<number>
    vw: number
    vh: number
    falloff: number
    accent: string
    dark: boolean
    radius: number
}

function Cell({ col, row, pitch, size, card, index, px, py, vw, vh, falloff, accent, dark, radius }: CellProps) {
    const cx = col * pitch + size / 2
    const cy = row * pitch + size / 2
    const reach = Math.max(120, Math.min(vw, vh) * 0.85)
    // 0 at the centre of the viewport, 1 at the reach distance and beyond.
    const dist = useTransform([px, py], ([x, y]: number[]) => {
        const dx = cx + x - vw / 2
        const dy = cy + y - vh / 2
        return Math.min(1, Math.hypot(dx, dy) / reach)
    })
    const scale = useTransform(dist, (d) => 1 - falloff * 0.34 * d * d)
    const opacity = useTransform(dist, (d) => 1 - falloff * 0.6 * d)
    const shiftX = useTransform([px, py], ([x]: number[]) => ((cx + x - vw / 2) / vw) * -14 * Math.max(0.2, falloff))
    const shiftY = useTransform([px, py], ([, y]: number[]) => ((cy + y - vh / 2) / vh) * -14 * Math.max(0.2, falloff))

    return (
        <motion.div
            style={{
                position: "absolute",
                left: col * pitch,
                top: row * pitch,
                width: size,
                height: size,
                scale,
                opacity,
                borderRadius: radius,
                overflow: "hidden",
                boxShadow: dark ? "0 12px 28px -14px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.08)" : "0 12px 28px -16px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.06)",
                willChange: "transform, opacity",
            }}
        >
            <motion.div
                aria-hidden
                style={{ position: "absolute", inset: -14, x: shiftX, y: shiftY, background: art(index, accent, dark) }}
            >
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
                    {index % 3 === 0 && [0, 1, 2].map((k) => <circle key={k} cx="50" cy="55" r={14 + k * 14} fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="0.6" />)}
                    {index % 3 === 1 && [0, 1, 2, 3, 4].map((k) => <line key={k} x1={k * 22 - 10} y1="105" x2={k * 22 + 28} y2="-5" stroke="rgba(255,255,255,0.26)" strokeWidth="0.6" />)}
                    {index % 3 === 2 && [0, 1, 2, 3].map((k) => <path key={k} d={`M-5 ${35 + k * 12} Q 25 ${20 + k * 12} 50 ${35 + k * 12} T 105 ${35 + k * 12}`} fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="0.6" />)}
                </svg>
            </motion.div>
            <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0) 55%)" }} />
            <span
                aria-hidden
                style={{
                    position: "absolute",
                    top: 8,
                    left: 9,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.72)",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    textTransform: "uppercase",
                }}
            >
                {pad(index + 1)} {card.tag}
            </span>
            <div style={{ position: "absolute", left: 9, right: 9, bottom: 8, fontSize: 12, fontWeight: 600, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {card.title}
            </div>
        </motion.div>
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

export default function InfiniteGrid({
    items = SAMPLE,
    cellSize = 112,
    gap = 14,
    falloff = 0.6,
    height = 320,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
    sound = false,
    soundVolume = 0.5,
}: Partial<InfiniteGridProps>) {
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const p = palette(theme)
    const dark = theme !== "light"
    const reduce = useReducedMotion()
    const list = items.length > 0 ? items : SAMPLE
    const n = list.length
    const size = Math.max(48, cellSize)
    const pitch = size + Math.max(0, gap)

    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const [view, setView] = React.useState({ w: 480, h: height })
    const [range, setRange] = React.useState({ c0: 0, c1: 0, r0: 0, r1: 0 })
    const [dragging, setDragging] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)

    const px = useMotionValue(0)
    const py = useMotionValue(0)
    const inertia = React.useRef<AnimationPlaybackControls[]>([])
    const drag = React.useRef<{ id: number; x: number; y: number; t: number; vx: number; vy: number } | null>(null)
    const centered = React.useRef(false)
    const settle = React.useRef<object | null>(null)
    const travel = React.useRef(0)
    const [measured, setMeasured] = React.useState(false)

    const stopMotion = () => {
        settle.current = null
        inertia.current.forEach((c) => c.stop())
        inertia.current = []
    }

    // Measure the viewport.
    React.useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const read = () => {
            if (el.clientWidth > 0 && el.clientHeight > 0) {
                setView({ w: el.clientWidth, h: el.clientHeight })
                setMeasured(true)
            }
        }
        read()
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(read)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Start with a card centred in the viewport.
    React.useEffect(() => {
        if (centered.current || !measured) return
        centered.current = true
        px.set(view.w / 2 - size / 2 - pitch)
        py.set(view.h / 2 - size / 2 - pitch)
    }, [measured, view.w, view.h, size, pitch, px, py])

    // Only render the cells that intersect the viewport.
    const updateRange = React.useCallback(() => {
        const x = px.get()
        const y = py.get()
        const next = {
            c0: Math.floor(-x / pitch) - 1,
            c1: Math.ceil((-x + view.w) / pitch),
            r0: Math.floor(-y / pitch) - 1,
            r1: Math.ceil((-y + view.h) / pitch),
        }
        setRange((prev) => (prev.c0 === next.c0 && prev.c1 === next.c1 && prev.r0 === next.r0 && prev.r1 === next.r1 ? prev : next))
    }, [px, py, pitch, view.w, view.h])

    React.useEffect(() => {
        updateRange()
        const a = px.on("change", updateRange)
        const b = py.on("change", updateRange)
        return () => {
            a()
            b()
        }
    }, [px, py, updateRange])

    // Wheel and trackpad panning (needs a non-passive listener).
    React.useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const onWheel = (e: WheelEvent) => {
            e.preventDefault()
            stopMotion()
            const k = e.deltaMode === 1 ? 16 : 1
            px.set(px.get() - e.deltaX * k)
            py.set(py.get() - e.deltaY * k)
        }
        el.addEventListener("wheel", onWheel, { passive: false })
        return () => {
            el.removeEventListener("wheel", onWheel)
            stopMotion()
        }
    }, [px, py])

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === "mouse") return
        stopMotion()
        travel.current = 0
        cue("click", 120)
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0 }
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        const now = performance.now()
        const dt = Math.max(1, now - d.t)
        const dx = e.clientX - d.x
        const dy = e.clientY - d.y
        px.set(px.get() + dx)
        py.set(py.get() + dy)
        travel.current += Math.abs(dx) + Math.abs(dy)
        // Smoothed velocity in px per second.
        d.vx = d.vx * 0.6 + ((dx / dt) * 1000) * 0.4
        d.vy = d.vy * 0.6 + ((dy / dt) * 1000) * 0.4
        d.x = e.clientX
        d.y = e.clientY
        d.t = now
    }

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        drag.current = null
        setDragging(false)
        const idle = performance.now() - d.t
        const vx = idle > 80 ? 0 : d.vx
        const vy = idle > 80 ? 0 : d.vy
        const moved = travel.current > 6
        if (reduce) {
            if (moved) cue("drop", 200)
            return
        }
        const token = {}
        settle.current = token
        const a = animate(px, px.get(), { type: "inertia", velocity: vx, power: 0.9, timeConstant: 420, restDelta: 0.5 })
        const b = animate(py, py.get(), { type: "inertia", velocity: vy, power: 0.9, timeConstant: 420, restDelta: 0.5 })
        inertia.current = [a, b]
        if (moved) {
            Promise.all([a, b]).then(() => {
                if (settle.current === token) cue("drop", 200)
            })
        }
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        const step = pitch
        let dx = 0
        let dy = 0
        if (e.key === "ArrowLeft") dx = step
        else if (e.key === "ArrowRight") dx = -step
        else if (e.key === "ArrowUp") dy = step
        else if (e.key === "ArrowDown") dy = -step
        else return
        e.preventDefault()
        stopMotion()
        const spring = { type: "spring" as const, stiffness: 220, damping: 28 }
        if (reduce) {
            px.set(px.get() + dx)
            py.set(py.get() + dy)
            return
        }
        inertia.current = [animate(px, px.get() + dx, spring), animate(py, py.get() + dy, spring)]
    }

    const bgPos = useMotionTemplate`${px}px ${py}px`
    const cells: React.ReactNode[] = []
    for (let r = range.r0; r <= range.r1; r++) {
        for (let c = range.c0; c <= range.c1; c++) {
            const idx = mod(c + r * 5, n)
            cells.push(
                <Cell
                    key={`${c}:${r}`}
                    col={c}
                    row={r}
                    pitch={pitch}
                    size={size}
                    card={list[idx]}
                    index={idx}
                    px={px}
                    py={py}
                    vw={view.w}
                    vh={view.h}
                    falloff={Math.min(1, Math.max(0, falloff))}
                    accent={accent}
                    dark={dark}
                    radius={radius}
                />
            )
        }
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                ref={rootRef}
                role="application"
                aria-roledescription="infinite canvas"
                aria-label="Infinite grid. Drag, scroll or use the arrow keys to pan."
                tabIndex={0}
                onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                onBlur={() => setFocusVisible(false)}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 480,
                    height,
                    boxSizing: "border-box",
                    borderRadius: radius + 2,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    cursor: dragging ? "grabbing" : "grab",
                    touchAction: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: -2,
                }}
            >
                <motion.div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: `radial-gradient(circle, ${p.dot} 1px, transparent 1.5px)`,
                        backgroundSize: `${pitch / 2}px ${pitch / 2}px`,
                        backgroundPosition: bgPos,
                    }}
                />
                <motion.div style={{ position: "absolute", left: 0, top: 0, x: px, y: py }}>{cells}</motion.div>
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background: `radial-gradient(ellipse at center, transparent 45%, ${dark ? "rgba(8,8,9,0.7)" : "rgba(243,241,236,0.75)"} 100%)`,
                    }}
                />
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        left: 12,
                        bottom: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: p.soft,
                        pointerEvents: "none",
                    }}
                >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
                    Drag to explore
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(InfiniteGrid, {
    items: {
        type: ControlType.Array,
        title: "Cards",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Untitled" },
                tag: { type: ControlType.String, title: "Tag", defaultValue: "" },
            },
        },
        defaultValue: SAMPLE,
    },
    cellSize: { type: ControlType.Number, title: "Cell size", defaultValue: 112, min: 64, max: 240, step: 2 },
    gap: { type: ControlType.Number, title: "Gap", defaultValue: 14, min: 0, max: 48, step: 1 },
    falloff: { type: ControlType.Number, title: "Falloff", defaultValue: 0.6, min: 0, max: 1, step: 0.05 },
    height: { type: ControlType.Number, title: "Height", defaultValue: 320, min: 160, max: 720, step: 10 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 28 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

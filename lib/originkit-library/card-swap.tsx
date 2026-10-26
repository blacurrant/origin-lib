import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useReducedMotion } from "framer-motion"

/**
 * CardSwap: a fanned deck of cards in 3D perspective, offset toward the upper
 * right. Click, swipe, press a button, or let autoplay run: the front card
 * slides out, drops to the back, and the rest advance on springs. Artwork is
 * generated from the item colours, or replaced by an optional image.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 420
 * @framerIntrinsicHeight 320
 */

type Theme = "dark" | "light"

interface DeckItem {
    title: string
    from: string
    to: string
    image: string
}

interface CardSwapProps {
    items: DeckItem[]
    autoplay: boolean
    interval: number
    accent: string
    theme: Theme
    radius: number
    sound: boolean
    soundVolume: number
}

const SAMPLE: DeckItem[] = [
    { title: "Mountain", from: "#ffb36b", to: "#7b2d5b", image: "" },
    { title: "Ocean", from: "#4cc9f0", to: "#1b2a6b", image: "" },
    { title: "Forest", from: "#7ddc9a", to: "#0e4d45", image: "" },
    { title: "Desert", from: "#ffd37a", to: "#c2410c", image: "" },
    { title: "Aurora", from: "#a99bff", to: "#1f2a5a", image: "" },
]

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
        ? { btn: "#ece9e3", btnText: "#141413", soft: "#5c5a55", shadow: "rgba(60,40,20,0.3)" }
        : { btn: "#262829", btnText: "#f7f7f7", soft: "#b7b7b8", shadow: "rgba(0,0,0,0.55)" }
}

const CARD_W = 232
const CARD_H = 142
const DX = 28
const DY = 21
const DEPTH = 5

function hash(s: string) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
}

function rng(seed: number) {
    let a = seed | 0
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function ridge(r: () => number, base: number, amp: number) {
    const n = 7
    const step = CARD_W / (n - 1)
    const ys = Array.from({ length: n }, () => base - r() * amp)
    let d = `M0 ${CARD_H} L0 ${ys[0].toFixed(1)}`
    for (let i = 1; i < n; i++) {
        const x0 = (i - 1) * step
        const x1 = i * step
        const mx = (x0 + x1) / 2
        d += ` C${mx.toFixed(1)} ${ys[i - 1].toFixed(1)}, ${mx.toFixed(1)} ${ys[i].toFixed(1)}, ${x1.toFixed(1)} ${ys[i].toFixed(1)}`
    }
    return d + ` L${CARD_W} ${CARD_H} Z`
}

function Art({ item, uid }: { item: DeckItem; uid: string }) {
    const art = React.useMemo(() => {
        const r = rng(hash(item.title + item.from + item.to))
        return {
            sunX: 40 + r() * (CARD_W - 80),
            sunY: 24 + r() * 34,
            sunR: 26 + r() * 16,
            ridges: [ridge(r, 100, 34), ridge(r, 118, 28), ridge(r, 134, 20)],
        }
    }, [item.title, item.from, item.to])
    const gid = `${uid}-sun`
    return (
        <svg
            aria-hidden
            viewBox={`0 0 ${CARD_W} ${CARD_H}`}
            preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        >
            <defs>
                <radialGradient id={gid} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="40%" stopColor="#ffffff" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
            </defs>
            <circle cx={art.sunX} cy={art.sunY} r={art.sunR * 2.2} fill={`url(#${gid})`} />
            <circle cx={art.sunX} cy={art.sunY} r={art.sunR * 0.55} fill="#ffffff" fillOpacity="0.68" />
            <path d={art.ridges[0]} fill="#000000" fillOpacity="0.16" />
            <path d={art.ridges[1]} fill="#000000" fillOpacity="0.26" />
            <path d={art.ridges[2]} fill="#000000" fillOpacity="0.4" />
        </svg>
    )
}

function Chevron({ dir }: { dir: "left" | "right" }) {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path
                d={dir === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

function poseFor(pos: number, count: number, leaving: boolean) {
    if (leaving) return { x: -62, y: 46, z: 40, rotate: -5, scale: 1, opacity: 1 }
    const shown = pos < Math.min(count, DEPTH)
    return {
        x: pos * DX,
        y: -pos * DY,
        z: -pos * 46,
        rotate: 0,
        scale: 1 - pos * 0.05,
        opacity: shown ? 1 : 0,
    }
}

export default function CardSwap({
    items = SAMPLE,
    autoplay = false,
    interval = 2800,
    accent = "#fa7319",
    theme = "dark",
    radius = 16,
    sound = false,
    soundVolume = 0.5,
}: Partial<CardSwapProps>) {
    const p = palette(theme)
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const reduce = useReducedMotion()
    const uid = React.useId().replace(/:/g, "")
    const list = items.length > 0 ? items : SAMPLE
    const count = list.length

    const [order, setOrder] = React.useState<number[]>(() => list.map((_, i) => i))
    const [leaving, setLeaving] = React.useState<{ id: number; dir: "next" | "prev" } | null>(null)
    const [playing, setPlaying] = React.useState(autoplay)
    const [mounted, setMounted] = React.useState(false)
    const [inside, setInside] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const [btnFocus, setBtnFocus] = React.useState<string | null>(null)

    const busy = React.useRef(false)
    const timer = React.useRef<number | null>(null)
    const swipe = React.useRef<{ x: number; moved: boolean } | null>(null)

    React.useEffect(() => {
        setOrder(list.map((_, i) => i))
        setLeaving(null)
        busy.current = false
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count])

    React.useEffect(() => {
        setPlaying(autoplay && !reduce)
    }, [autoplay, reduce])

    React.useEffect(() => {
        const t = window.setTimeout(() => setMounted(true), 1000)
        return () => {
            window.clearTimeout(t)
            if (timer.current !== null) window.clearTimeout(timer.current)
        }
    }, [])

    const go = React.useCallback(
        (dir: "next" | "prev", user = true) => {
            if (busy.current || count < 2) return
            busy.current = true
            if (user) cue("whoosh", 200)
            const id = dir === "next" ? order[0] : order[order.length - 1]
            setLeaving({ id, dir })
            timer.current = window.setTimeout(() => {
                setOrder((o) => (dir === "next" ? [...o.slice(1), o[0]] : [o[o.length - 1], ...o.slice(0, -1)]))
                setLeaving(null)
                timer.current = window.setTimeout(() => {
                    busy.current = false
                }, 420)
            }, 300)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [order, count, sound, soundVolume]
    )

    const goRef = React.useRef(go)
    goRef.current = go

    React.useEffect(() => {
        if (!playing || inside) return
        const id = window.setInterval(() => goRef.current("next", false), Math.max(900, interval))
        return () => window.clearInterval(id)
    }, [playing, inside, interval])

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            go("next")
        } else if (e.key === "ArrowLeft") {
            e.preventDefault()
            go("prev")
        }
    }

    const frontTitle = list[order[0]]?.title ?? ""
    const depth = Math.min(count, DEPTH)
    const stageW = CARD_W + (depth - 1) * DX
    const stageH = CARD_H + (depth - 1) * DY

    const button = (key: string, label: string, onClick: () => void, child: React.ReactNode, primary = false) => (
        <motion.button
            type="button"
            aria-label={label}
            aria-pressed={key === "play" ? playing : undefined}
            onClick={onClick}
            onFocus={(e) => setBtnFocus(e.currentTarget.matches(":focus-visible") ? key : null)}
            onBlur={() => setBtnFocus(null)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "none",
                padding: 0,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                background: primary ? accent : p.btn,
                color: primary ? "#141413" : p.btnText,
                outline: btnFocus === key ? `2px solid ${accent}` : "none",
                outlineOffset: 3,
                fontFamily: "inherit",
            }}
        >
            {child}
        </motion.button>
    )

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    maxWidth: 440,
                    boxSizing: "border-box",
                    padding: "6px 0 4px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    fontFamily: "inherit",
                }}
            >
                <div
                    role="group"
                    aria-roledescription="carousel"
                    aria-label="Card deck"
                    tabIndex={0}
                    onKeyDown={onKeyDown}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    onPointerEnter={() => setInside(true)}
                    onPointerLeave={() => setInside(false)}
                    onPointerDown={(e) => {
                        swipe.current = { x: e.clientX, moved: false }
                    }}
                    onPointerMove={(e) => {
                        const s = swipe.current
                        if (s && Math.abs(e.clientX - s.x) > 8) s.moved = true
                    }}
                    onPointerUp={(e) => {
                        const s = swipe.current
                        swipe.current = null
                        if (!s) return
                        const dx = e.clientX - s.x
                        if (Math.abs(dx) > 36) go(dx < 0 ? "next" : "prev")
                        else if (!s.moved) go("next")
                    }}
                    onPointerCancel={() => {
                        swipe.current = null
                    }}
                    style={{
                        position: "relative",
                        width: stageW + 96,
                        maxWidth: "100%",
                        height: stageH + 56,
                        perspective: 1100,
                        cursor: "pointer",
                        touchAction: "pan-y",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: 2,
                        borderRadius: 12,
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            left: 52,
                            top: 0,
                            width: stageW,
                            height: stageH,
                            transformStyle: "preserve-3d",
                            transform: "rotateX(7deg) rotateY(-13deg)",
                        }}
                    >
                        {list.map((item, id) => {
                            const pos = order.indexOf(id)
                            const isLeaving = leaving !== null && leaving.id === id
                            const pose = poseFor(pos, count, isLeaving)
                            const initial = {
                                ...poseFor(pos, count, false),
                                opacity: 0,
                                x: pos * DX + 36,
                                y: -pos * DY - 26,
                                z: -pos * 46 - 90,
                            }
                            return (
                                <motion.div
                                    key={id}
                                    aria-hidden={pos !== 0}
                                    initial={initial}
                                    animate={pose}
                                    transition={
                                        isLeaving
                                            ? { type: "spring", stiffness: 300, damping: 26 }
                                            : { type: "spring", stiffness: 150, damping: 19, mass: 0.9, delay: mounted ? 0 : pos * 0.07 }
                                    }
                                    style={{
                                        position: "absolute",
                                        left: 0,
                                        bottom: 0,
                                        width: CARD_W,
                                        height: CARD_H,
                                        borderRadius: radius,
                                        overflow: "hidden",
                                        zIndex: isLeaving ? 100 : count - pos,
                                        pointerEvents: "none",
                                        background: `linear-gradient(140deg, ${item.from}, ${item.to})`,
                                        boxShadow: `0 18px 36px -10px ${p.shadow}, inset 0 0 0 1px rgba(255,255,255,0.16)`,
                                        backfaceVisibility: "hidden",
                                    }}
                                >
                                    {item.image ? (
                                        <div
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                backgroundImage: `url(${item.image})`,
                                                backgroundSize: "cover",
                                                backgroundPosition: "center",
                                            }}
                                        />
                                    ) : (
                                        <Art item={item} uid={`${uid}-${id}`} />
                                    )}
                                    <div
                                        aria-hidden
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            background: "linear-gradient(to top, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0) 55%)",
                                        }}
                                    />
                                    <motion.div
                                        aria-hidden
                                        initial={false}
                                        animate={{ opacity: isLeaving ? 0 : Math.min(0.55, pos * 0.15) }}
                                        transition={{ duration: 0.3 }}
                                        style={{ position: "absolute", inset: 0, background: "#000000" }}
                                    />
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: 12,
                                            bottom: 12,
                                            padding: "5px 12px",
                                            borderRadius: 999,
                                            background: "rgba(12,12,14,0.42)",
                                            backdropFilter: "blur(10px)",
                                            WebkitBackdropFilter: "blur(10px)",
                                            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
                                            color: "#ffffff",
                                            fontSize: 13,
                                            fontWeight: 600,
                                            letterSpacing: "0.005em",
                                        }}
                                    >
                                        {item.title}
                                    </div>
                                    <div
                                        aria-hidden
                                        style={{
                                            position: "absolute",
                                            top: 12,
                                            right: 14,
                                            color: "#ffffff",
                                            opacity: 0.75,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            fontVariantNumeric: "tabular-nums",
                                            letterSpacing: "0.06em",
                                        }}
                                    >
                                        {String(id + 1).padStart(2, "0")}
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                    <span
                        aria-live="polite"
                        style={{
                            position: "absolute",
                            width: 1,
                            height: 1,
                            overflow: "hidden",
                            clip: "rect(0 0 0 0)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {frontTitle}
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                    {button("prev", "Previous card", () => go("prev"), <Chevron dir="left" />)}
                    {button(
                        "play",
                        playing ? "Pause autoplay" : "Start autoplay",
                        () => setPlaying((v) => !v),
                        playing ? (
                            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                                <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
                                <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                                <path d="M5 2.8v10.4a.6.6 0 0 0 .9.5l8-5.2a.6.6 0 0 0 0-1L5.9 2.3a.6.6 0 0 0-.9.5z" fill="currentColor" />
                            </svg>
                        ),
                        true
                    )}
                    {button("next", "Next card", () => go("next"), <Chevron dir="right" />)}
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(CardSwap, {
    items: {
        type: ControlType.Array,
        title: "Cards",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Mountain" },
                from: { type: ControlType.Color, title: "From", defaultValue: "#ffb36b" },
                to: { type: ControlType.Color, title: "To", defaultValue: "#7b2d5b" },
                image: { type: ControlType.String, title: "Image URL", defaultValue: "" },
            },
        },
        defaultValue: SAMPLE as any,
    },
    autoplay: { type: ControlType.Boolean, title: "Autoplay", defaultValue: false },
    interval: { type: ControlType.Number, title: "Interval (ms)", defaultValue: 2800, min: 900, max: 10000, step: 100 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 16, min: 0, max: 32, step: 1 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

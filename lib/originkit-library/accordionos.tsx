import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * AccordionOS: an OS-style accordion. A title bar carries a step counter and a
 * thin progress bar that follow the open section. Sections are numbered, open
 * with a smooth height animation and a content cross-fade, and can show a small
 * generated thumbnail strip. Arrow keys, Home and End move between headers.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 440
 * @framerIntrinsicHeight 330
 */

type Theme = "dark" | "light"

interface Item {
    title: string
    body: string
}

interface AccordionOSProps {
    title: string
    items: Item[]
    defaultOpen: number
    allowMultiple: boolean
    sound: boolean
    soundVolume: number
    showThumbnails: boolean
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", raised: "#f3f1ec", line: "#e4e1db", text: "#141413", soft: "#5c5a55", faint: "#76736d", bar: "#ece9e3" }
        : { surface: "#141415", raised: "#1c1d1e", line: "#2d2d2f", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f", bar: "#262829" }
}

const SAMPLE: Item[] = [
    { title: "Create a workspace", body: "Name your workspace and invite the people you build with. Everything else lives inside it." },
    { title: "Connect your sources", body: "Link a repository, a database or a folder. Connections are read-only until you say otherwise." },
    { title: "Shape the first view", body: "Pick the fields you care about and arrange them. Views save as you go, so there is nothing to submit." },
    { title: "Invite a reviewer", body: "Share a link and a teammate can comment in place. Changes wait for approval before they ship." },
    { title: "Ship and watch", body: "Publish when you are ready, then follow the activity feed to see how the change lands." },
]

function hash(n: number) {
    let x = (n + 1) * 2654435761
    x = ((x >>> 16) ^ x) * 45679
    return ((x >>> 0) % 10000) / 10000
}

function pad(n: number) {
    return n < 10 ? `0${n}` : `${n}`
}

function thumb(section: number, k: number, accent: string, dark: boolean) {
    const r1 = hash(section * 13 + k * 7)
    const r2 = hash(section * 5 + k * 31 + 3)
    const r3 = hash(section * 17 + k * 3 + 9)
    const hue = Math.round(r1 * 360)
    const a = `hsl(${hue} 70% ${dark ? 58 : 64}%)`
    const b = `hsl(${(hue + 40 + r2 * 60) % 360} 75% ${dark ? 38 : 52}%)`
    const ang = Math.round(r3 * 360)
    const mix = k === 0 ? `color-mix(in srgb, ${accent} 70%, ${b})` : a
    return `radial-gradient(circle at ${Math.round(r2 * 100)}% ${Math.round(r3 * 100)}%, ${mix}, transparent 62%), linear-gradient(${ang}deg, ${b}, ${a})`
}

const SPRING = { type: "spring" as const, stiffness: 320, damping: 36, mass: 0.9 }

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

export default function AccordionOS({
    title = "Getting started",
    items = SAMPLE,
    defaultOpen = 0,
    allowMultiple = false,
    showThumbnails = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
    sound = false,
    soundVolume = 0.5,
}: Partial<AccordionOSProps>) {
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const p = palette(theme)
    const dark = theme !== "light"
    const uid = React.useId()
    const list = items.length > 0 ? items : SAMPLE
    const total = list.length
    const start = Math.min(Math.max(0, Math.round(defaultOpen)), total - 1)
    const [open, setOpen] = React.useState<number[]>([start])
    const [current, setCurrent] = React.useState(start)
    const [focusIdx, setFocusIdx] = React.useState(-1)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const heads = React.useRef<Array<HTMLButtonElement | null>>([])

    React.useEffect(() => {
        setOpen([start])
        setCurrent(start)
    }, [start, allowMultiple])

    const toggle = (i: number) => {
        const wasOpen = open.includes(i)
        if (!wasOpen) cue("click")
        else if (allowMultiple) cue("off")
        setCurrent(i)
        setOpen((prev) => {
            const isOpen = prev.includes(i)
            if (allowMultiple) return isOpen ? prev.filter((n) => n !== i) : [...prev, i]
            return isOpen ? prev : [i]
        })
    }

    const move = (e: React.KeyboardEvent, i: number) => {
        let next = -1
        if (e.key === "ArrowDown") next = (i + 1) % total
        else if (e.key === "ArrowUp") next = (i - 1 + total) % total
        else if (e.key === "Home") next = 0
        else if (e.key === "End") next = total - 1
        if (next < 0) return
        e.preventDefault()
        heads.current[next]?.focus()
    }

    const step = Math.min(current, total - 1) + 1
    const counter = `${pad(step)}/${pad(total)}`

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    maxWidth: 480,
                    boxSizing: "border-box",
                    border: `1px solid ${p.line}`,
                    borderRadius: radius,
                    background: p.surface,
                    color: p.text,
                    fontFamily: "inherit",
                    overflow: "hidden",
                }}
            >
                <div style={{ position: "relative", background: p.bar, borderBottom: `1px solid ${p.line}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 42, padding: "0 14px" }}>
                        <span aria-hidden style={{ display: "flex", gap: 5 }}>
                            {[0, 1, 2].map((d) => (
                                <span
                                    key={d}
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: d === 0 ? accent : p.line,
                                        boxShadow: d === 0 ? `0 0 8px ${accent}` : "none",
                                    }}
                                />
                            ))}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: "0.01em" }}>{title}</span>
                        <span
                            aria-live="polite"
                            aria-label={`Step ${step} of ${total}`}
                            style={{
                                display: "inline-flex",
                                overflow: "hidden",
                                height: 20,
                                alignItems: "center",
                                fontSize: 12,
                                fontWeight: 600,
                                color: p.soft,
                                fontVariantNumeric: "tabular-nums",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            }}
                        >
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.span
                                    key={counter}
                                    initial={{ y: 12, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -12, opacity: 0 }}
                                    transition={{ ...SPRING, opacity: { duration: 0.15 } }}
                                    style={{ display: "block" }}
                                >
                                    <span style={{ color: accent }}>{counter.slice(0, 2)}</span>
                                    {counter.slice(2)}
                                </motion.span>
                            </AnimatePresence>
                        </span>
                    </div>
                    <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, background: "transparent" }}>
                        <motion.div
                            initial={false}
                            animate={{ scaleX: step / total }}
                            transition={{ type: "spring", stiffness: 180, damping: 26 }}
                            style={{ height: "100%", background: accent, transformOrigin: "0% 50%", boxShadow: `0 0 10px ${accent}` }}
                        />
                    </div>
                </div>

                <div role="presentation">
                    {list.map((item, i) => {
                        const isOpen = open.includes(i)
                        const hid = `${uid}-h-${i}`
                        const pid = `${uid}-p-${i}`
                        const showFocus = focusVisible && focusIdx === i
                        return (
                            <div key={i} style={{ borderTop: i === 0 ? "none" : `1px solid ${p.line}`, background: isOpen ? p.raised : "transparent", transition: "background 180ms" }}>
                                <h3 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit" }}>
                                    <button
                                        ref={(el) => {
                                            heads.current[i] = el
                                        }}
                                        id={hid}
                                        type="button"
                                        aria-expanded={isOpen}
                                        aria-controls={pid}
                                        onClick={() => toggle(i)}
                                        onKeyDown={(e) => move(e, i)}
                                        onFocus={(e) => {
                                            setFocusIdx(i)
                                            setFocusVisible(e.currentTarget.matches(":focus-visible"))
                                        }}
                                        onBlur={() => setFocusVisible(false)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            width: "100%",
                                            height: 36,
                                            padding: "0 14px",
                                            border: "none",
                                            background: "transparent",
                                            color: isOpen ? p.text : p.soft,
                                            fontFamily: "inherit",
                                            fontSize: 13,
                                            fontWeight: 500,
                                            textAlign: "left",
                                            cursor: "pointer",
                                            outline: showFocus ? `2px solid ${accent}` : "none",
                                            outlineOffset: -2,
                                            transition: "color 160ms",
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 20,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                color: isOpen ? accent : p.faint,
                                                transition: "color 160ms",
                                            }}
                                        >
                                            {pad(i + 1)}
                                        </span>
                                        <span style={{ flex: 1 }}>{item.title}</span>
                                        <motion.svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 12 12"
                                            aria-hidden
                                            initial={false}
                                            animate={{ rotate: isOpen ? 45 : 0 }}
                                            transition={SPRING}
                                            stroke={isOpen ? accent : p.faint}
                                        >
                                            <path d="M6 1.5v9M1.5 6h9" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                                        </motion.svg>
                                    </button>
                                </h3>
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            id={pid}
                                            role="region"
                                            aria-labelledby={hid}
                                            key="panel"
                                            initial={{ height: 0 }}
                                            animate={{ height: "auto" }}
                                            exit={{ height: 0 }}
                                            transition={{ height: SPRING }}
                                            style={{ overflow: "hidden" }}
                                        >
                                            <motion.div
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0, transition: { delay: 0.1, duration: 0.28 } }}
                                                exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                                                style={{ padding: "2px 14px 14px 46px" }}
                                            >
                                                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: p.soft }}>{item.body}</p>
                                                {showThumbnails && (
                                                    <div aria-hidden style={{ display: "flex", gap: 6, marginTop: 10 }}>
                                                        {[0, 1, 2, 3].map((k) => (
                                                            <motion.span
                                                                key={k}
                                                                initial={{ opacity: 0, scale: 0.85 }}
                                                                animate={{ opacity: 1, scale: 1, transition: { delay: 0.14 + k * 0.05, ...SPRING } }}
                                                                style={{
                                                                    width: 44,
                                                                    height: 28,
                                                                    borderRadius: Math.max(3, radius / 3),
                                                                    background: thumb(i, k, accent, dark),
                                                                    boxShadow: `inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </motion.div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(AccordionOS, {
    title: { type: ControlType.String, title: "Title", defaultValue: "Getting started" },
    items: {
        type: ControlType.Array,
        title: "Items",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Step" },
                body: { type: ControlType.String, title: "Body", defaultValue: "", displayTextArea: true },
            },
        },
        defaultValue: SAMPLE,
    },
    defaultOpen: { type: ControlType.Number, title: "Default open", defaultValue: 0, min: 0, max: 20, step: 1 },
    allowMultiple: { type: ControlType.Boolean, title: "Allow multiple", defaultValue: false },
    showThumbnails: { type: ControlType.Boolean, title: "Thumbnails", defaultValue: true },
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

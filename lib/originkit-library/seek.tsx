import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import {
    AnimatePresence,
    MotionConfig,
    animate,
    motion,
    useMotionValue,
    useReducedMotion,
    useTransform,
} from "framer-motion"

/**
 * Seek: a media scrubber with a buffered segment, an accent progress fill, a
 * thumb that grows on hover and drag, and a floating time preview. A play and
 * pause button advances a simulated playhead, so nothing real is loaded.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 420
 * @framerIntrinsicHeight 96
 */

type Theme = "dark" | "light"

interface SeekProps {
    duration: number
    playing: boolean
    showBuffered: boolean
    startTime: number
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

function palette(theme: Theme) {
    return theme === "light"
        ? {
              surface: "#ffffff",
              line: "#e4e1db",
              track: "#e4e1db",
              buffer: "#c9c5bc",
              text: "#141413",
              soft: "#5c5a55",
              tip: "#141413",
              tipText: "#f7f7f7",
              thumb: "#ffffff",
          }
        : {
              surface: "#141415",
              line: "#2d2d2f",
              track: "#2d2d2f",
              buffer: "#4c4e52",
              text: "#f7f7f7",
              soft: "#b7b7b8",
              tip: "#f7f7f7",
              tipText: "#141413",
              thumb: "#ffffff",
          }
}

function clamp(n: number, a: number, b: number) {
    return Math.min(b, Math.max(a, n))
}

function fmt(sec: number) {
    const s = Math.max(0, Math.floor(sec))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const r = s % 60
    const pad = (n: number) => (n < 10 ? "0" + n : String(n))
    return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}

const TRACK_H = 4

export default function Seek({
    duration = 204,
    playing = true,
    showBuffered = true,
    startTime = 42,
    accent = "#fa7319",
    theme = "dark",
    radius = 999,
    sound = false,
    soundVolume = 0.5,
}: Partial<SeekProps>) {
    const p = palette(theme)
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const total = Math.max(1, duration)
    const reduce = useReducedMotion()

    const t = useMotionValue(clamp(startTime, 0, total))
    const [sec, setSec] = React.useState(() => Math.floor(clamp(startTime, 0, total)))
    const [isPlaying, setIsPlaying] = React.useState(playing)
    const [hover, setHover] = React.useState(false)
    const [dragging, setDragging] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const [btnFocus, setBtnFocus] = React.useState(false)
    const [tipShown, setTipShown] = React.useState(false)

    const trackRef = React.useRef<HTMLDivElement | null>(null)
    const tipText = React.useRef<HTMLSpanElement | null>(null)
    const tipX = useMotionValue(0)
    const lastScrub = React.useRef(-1)
    const seekAnim = React.useRef<{ stop: () => void } | null>(null)

    // The prop sets the starting state. Reduced motion starts paused.
    React.useEffect(() => {
        setIsPlaying(playing && !reduce)
    }, [playing, reduce])

    React.useEffect(() => {
        t.set(clamp(startTime, 0, total))
    }, [startTime, total, t])

    // Keep the label state in sync with the playhead, once per whole second.
    React.useEffect(() => {
        const unsub = t.on("change", (v) => setSec(Math.floor(v)))
        return () => unsub()
    }, [t])

    // Simulated playhead.
    React.useEffect(() => {
        if (!isPlaying || dragging) return
        if (t.get() >= total - 0.01) t.set(0)
        let raf = 0
        let last: number | null = null
        const tick = (now: number) => {
            if (last === null) last = now
            const dt = (now - last) / 1000
            last = now
            const next = t.get() + dt
            if (next >= total) {
                t.set(total)
                setIsPlaying(false)
                return
            }
            t.set(next)
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [isPlaying, dragging, total, t])

    React.useEffect(() => () => seekAnim.current?.stop(), [])

    const progress = useTransform(t, (v) => clamp(v / total, 0, 1))
    const thumbLeft = useTransform(progress, (v) => `${v * 100}%`)
    const bufferedScale = useTransform(t, (v) => clamp(Math.max(0.36, (v + 52) / total), 0, 1))

    const timeAt = (clientX: number) => {
        const el = trackRef.current
        if (!el) return { time: 0, x: 0 }
        const r = el.getBoundingClientRect()
        const f = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1)
        return { time: f * total, x: f * r.width }
    }

    const showTip = (clientX: number) => {
        const { time, x } = timeAt(clientX)
        const el = trackRef.current
        const w = el ? el.getBoundingClientRect().width : 0
        // Keep the tooltip inside the track edges.
        tipX.set(clamp(x, 22, Math.max(22, w - 22)))
        if (tipText.current) tipText.current.textContent = fmt(time)
    }

    const scrubTo = (clientX: number, smooth: boolean) => {
        const { time } = timeAt(clientX)
        seekAnim.current?.stop()
        if (smooth && !reduce) {
            seekAnim.current = animate(t, time, { type: "spring", stiffness: 420, damping: 40 })
        } else {
            t.set(time)
        }
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === "mouse") return
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
        setTipShown(true)
        showTip(e.clientX)
        scrubTo(e.clientX, true)
        lastScrub.current = Math.floor(timeAt(e.clientX).time)
        cue("tick", 40)
    }
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        showTip(e.clientX)
        if (dragging) {
            scrubTo(e.clientX, false)
            const whole = Math.floor(timeAt(e.clientX).time)
            if (whole !== lastScrub.current) {
                lastScrub.current = whole
                cue("tick", 40)
            }
        }
    }
    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
        if (dragging) cue("pop", 80)
        setDragging(false)
        if (e.pointerType !== "mouse") setTipShown(false)
    }

    const nudge = (delta: number) => {
        seekAnim.current?.stop()
        t.set(clamp(t.get() + delta, 0, total))
        cue("tick", 40)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        let handled = true
        switch (e.key) {
            case "ArrowRight":
            case "ArrowUp":
                nudge(5)
                break
            case "ArrowLeft":
            case "ArrowDown":
                nudge(-5)
                break
            case "PageUp":
                nudge(30)
                break
            case "PageDown":
                nudge(-30)
                break
            case "Home":
                nudge(-total)
                break
            case "End":
                nudge(total)
                break
            default:
                handled = false
        }
        if (handled) e.preventDefault()
    }

    const active = hover || dragging
    const tipVisible = (tipShown && hover) || dragging

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    maxWidth: 440,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "26px 20px 16px",
                    borderRadius: 16,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    fontFamily: "inherit",
                    color: p.text,
                }}
            >
                <motion.button
                    type="button"
                    aria-label={isPlaying ? "Pause" : "Play"}
                    aria-pressed={isPlaying}
                    onClick={() => {
                        cue("click")
                        setIsPlaying((v) => !v)
                    }}
                    onFocus={(e) => setBtnFocus(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setBtnFocus(false)}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    style={{
                        flex: "none",
                        alignSelf: "flex-start",
                        marginTop: -2,
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        border: "none",
                        background: accent,
                        color: "#141413",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        padding: 0,
                        outline: btnFocus ? `2px solid ${accent}` : "none",
                        outlineOffset: 3,
                        fontFamily: "inherit",
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                        <AnimatePresence mode="wait" initial={false}>
                            {isPlaying ? (
                                <motion.g
                                    key="pause"
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.6 }}
                                    transition={{ duration: 0.12 }}
                                    style={{ transformOrigin: "8px 8px" }}
                                >
                                    <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="#141413" />
                                    <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="#141413" />
                                </motion.g>
                            ) : (
                                <motion.path
                                    key="play"
                                    d="M5 2.8v10.4a.6.6 0 0 0 .9.5l8-5.2a.6.6 0 0 0 0-1L5.9 2.3a.6.6 0 0 0-.9.5z"
                                    fill="#141413"
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.6 }}
                                    transition={{ duration: 0.12 }}
                                    style={{ transformOrigin: "8px 8px" }}
                                />
                            )}
                        </AnimatePresence>
                    </svg>
                </motion.button>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        ref={trackRef}
                        role="slider"
                        tabIndex={0}
                        aria-label="Seek"
                        aria-orientation="horizontal"
                        aria-valuemin={0}
                        aria-valuemax={Math.round(total)}
                        aria-valuenow={sec}
                        aria-valuetext={`${fmt(sec)} of ${fmt(total)}`}
                        onKeyDown={onKeyDown}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onPointerEnter={(e) => {
                            if (e.pointerType === "mouse") {
                                setHover(true)
                                setTipShown(true)
                                showTip(e.clientX)
                            }
                        }}
                        onPointerLeave={() => {
                            setHover(false)
                            setTipShown(false)
                        }}
                        onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                        onBlur={() => setFocusVisible(false)}
                        style={{
                            position: "relative",
                            height: 24,
                            display: "flex",
                            alignItems: "center",
                            cursor: dragging ? "grabbing" : "pointer",
                            touchAction: "none",
                            userSelect: "none",
                            WebkitUserSelect: "none",
                            outline: focusVisible ? `2px solid ${accent}` : "none",
                            outlineOffset: 4,
                            borderRadius: 6,
                        }}
                    >
                        <motion.div
                            aria-hidden
                            animate={{ scaleY: active ? 1.7 : 1 }}
                            transition={{ type: "spring", stiffness: 520, damping: 34 }}
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                top: (24 - TRACK_H) / 2,
                                height: TRACK_H,
                                borderRadius: radius,
                                background: p.track,
                                overflow: "hidden",
                            }}
                        >
                            {showBuffered && (
                                <motion.div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background: p.buffer,
                                        transformOrigin: "0% 50%",
                                        scaleX: bufferedScale,
                                    }}
                                />
                            )}
                            <motion.div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: accent,
                                    transformOrigin: "0% 50%",
                                    scaleX: progress,
                                }}
                            />
                        </motion.div>

                        <motion.div
                            aria-hidden
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: thumbLeft,
                                width: 0,
                                height: 0,
                            }}
                        >
                            <motion.div
                                animate={{ scale: dragging ? 1.5 : hover ? 1.25 : 0.7 }}
                                transition={{ type: "spring", stiffness: 520, damping: 26 }}
                                style={{
                                    position: "absolute",
                                    left: -7,
                                    top: -7,
                                    width: 14,
                                    height: 14,
                                    borderRadius: "50%",
                                    background: p.thumb,
                                    boxShadow: dragging
                                        ? `0 0 0 5px color-mix(in srgb, ${accent} 30%, transparent), 0 2px 6px rgba(0,0,0,0.4)`
                                        : "0 1px 4px rgba(0,0,0,0.45)",
                                }}
                            />
                        </motion.div>

                        <motion.div
                            aria-hidden
                            style={{
                                position: "absolute",
                                left: 0,
                                top: -8,
                                width: 0,
                                height: 0,
                                x: tipX,
                                pointerEvents: "none",
                            }}
                        >
                            <motion.div
                                initial={false}
                                animate={{ opacity: tipVisible ? 1 : 0, y: tipVisible ? 0 : 6, scale: tipVisible ? 1 : 0.9 }}
                                transition={{ type: "spring", stiffness: 520, damping: 32 }}
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    x: "-50%",
                                    padding: "4px 8px",
                                    borderRadius: 8,
                                    background: p.tip,
                                    color: p.tipText,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    fontVariantNumeric: "tabular-nums",
                                    whiteSpace: "nowrap",
                                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                                }}
                            >
                                <span ref={tipText}>0:00</span>
                            </motion.div>
                        </motion.div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            fontVariantNumeric: "tabular-nums",
                            color: p.soft,
                        }}
                    >
                        <span style={{ color: p.text }}>{fmt(sec)}</span>
                        <span>{fmt(total)}</span>
                    </div>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(Seek, {
    duration: { type: ControlType.Number, title: "Duration (s)", defaultValue: 204, min: 5, max: 7200, step: 1 },
    playing: { type: ControlType.Boolean, title: "Playing", defaultValue: true },
    showBuffered: { type: ControlType.Boolean, title: "Buffered", defaultValue: true },
    startTime: { type: ControlType.Number, title: "Start (s)", defaultValue: 42, min: 0, max: 7200, step: 1 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 999, min: 0, max: 999, step: 1 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

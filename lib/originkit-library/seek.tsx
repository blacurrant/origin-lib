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
}

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
}: Partial<SeekProps>) {
    const p = palette(theme)
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
    }
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        showTip(e.clientX)
        if (dragging) scrubTo(e.clientX, false)
    }
    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
        setDragging(false)
        if (e.pointerType !== "mouse") setTipShown(false)
    }

    const nudge = (delta: number) => {
        seekAnim.current?.stop()
        t.set(clamp(t.get() + delta, 0, total))
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
                    onClick={() => setIsPlaying((v) => !v)}
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
})

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import {
    AnimatePresence,
    MotionConfig,
    animate,
    motion,
    useDragControls,
    useMotionValue,
    useReducedMotion,
    useTransform,
} from "framer-motion"
import type { AnimationPlaybackControls } from "framer-motion"

/**
 * CornerVideo: a floating mini video player that lives in a relative stage and
 * snaps to the four corners. Drag it anywhere and on release it springs to the
 * nearest corner with a little throw from your velocity. Controls appear on
 * hover: play or pause, expand, close. Close hides it and a small chip brings
 * it back. With no src it plays a generated, looping gradient "video".
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 300
 */

type Theme = "dark" | "light"
type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

interface CornerVideoProps {
    src: string
    corner: Corner
    size: number
    autoplay: boolean
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", raised: "#ece9e3", line: "#e4e1db", text: "#141413", soft: "#5c5a55", faint: "#76736d", block: "#e9e6df" }
        : { surface: "#141415", raised: "#262829", line: "#2d2d2f", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f", block: "#1f2021" }
}

const STAGE_W = 480
const STAGE_H = 300
const MARGIN = 14
const DURATION = 12
const SPRING = { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.9 }
const ASPECT = 0.625

function corners(w: number, h: number, bw: number, bh: number): Record<Corner, { x: number; y: number }> {
    const r = Math.max(0, w - bw - MARGIN)
    const b = Math.max(0, h - bh - MARGIN)
    return {
        "top-left": { x: MARGIN, y: MARGIN },
        "top-right": { x: r, y: MARGIN },
        "bottom-left": { x: MARGIN, y: b },
        "bottom-right": { x: r, y: b },
    }
}

function fmt(t: number) {
    const s = Math.floor(t * DURATION)
    return `0:${s < 10 ? "0" : ""}${s}`
}

function Icon({ name }: { name: "play" | "pause" | "expand" | "shrink" | "close" | "video" }) {
    const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            {name === "play" && <path d="M4.5 3v8l6.5-4z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />}
            {name === "pause" && <path d="M5 3.5v7M9 3.5v7" {...common} strokeWidth="2" />}
            {name === "expand" && <path d="M8.5 2.5h3v3M11.5 2.5 8 6M5.5 11.5h-3v-3M2.5 11.5 6 8" {...common} />}
            {name === "shrink" && <path d="M11 5.5H8.5v-3M8.5 5.5 12 2M3 8.5h2.5v3M5.5 8.5 2 12" {...common} />}
            {name === "close" && <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" {...common} />}
            {name === "video" && <path d="M2 4.5h6.5v5H2zM8.5 6.5 12 4.5v5L8.5 7.5" {...common} />}
        </svg>
    )
}

export default function CornerVideo({
    src = "",
    corner = "bottom-right",
    size = 150,
    autoplay = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
}: Partial<CornerVideoProps>) {
    const p = palette(theme)
    const reduce = useReducedMotion()
    const stageRef = React.useRef<HTMLDivElement | null>(null)
    const videoRef = React.useRef<HTMLVideoElement | null>(null)
    const loopRef = React.useRef<AnimationPlaybackControls | null>(null)
    const dragControls = useDragControls()

    const [stage, setStage] = React.useState({ w: STAGE_W, h: STAGE_H })
    const [current, setCurrent] = React.useState<Corner>(corner)
    const [expanded, setExpanded] = React.useState(false)
    const [closed, setClosed] = React.useState(false)
    const [playing, setPlaying] = React.useState(false)
    const [hover, setHover] = React.useState(false)
    const [dragging, setDragging] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)

    const miniW = Math.max(100, Math.min(size, stage.w - MARGIN * 2))
    const bigW = Math.max(miniW, Math.min(Math.round(miniW * 1.9), stage.w - MARGIN * 2))
    const boxW = expanded ? bigW : miniW
    const boxH = Math.round(boxW * ASPECT)

    const x = useMotionValue(corners(STAGE_W, STAGE_H, miniW, Math.round(miniW * ASPECT))[corner].x)
    const y = useMotionValue(corners(STAGE_W, STAGE_H, miniW, Math.round(miniW * ASPECT))[corner].y)
    const w = useMotionValue(miniW)
    const h = useMotionValue(Math.round(miniW * ASPECT))
    const t = useMotionValue(0)

    const latest = React.useRef({ current, boxW, boxH, stage })
    latest.current = { current, boxW, boxH, stage }

    // Follow the corner prop.
    React.useEffect(() => {
        setCurrent(corner)
    }, [corner])

    // Measure the stage.
    React.useEffect(() => {
        const el = stageRef.current
        if (!el) return
        const read = () => {
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.height > 0) setStage({ w: el.clientWidth, h: el.clientHeight })
        }
        read()
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(read)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Spring to the current corner whenever corner, size or stage changes.
    const first = React.useRef(true)
    React.useEffect(() => {
        const target = corners(stage.w, stage.h, boxW, boxH)[current]
        if (first.current || reduce) {
            first.current = false
            x.set(target.x)
            y.set(target.y)
            w.set(boxW)
            h.set(boxH)
            return
        }
        const a = [animate(x, target.x, SPRING), animate(y, target.y, SPRING), animate(w, boxW, SPRING), animate(h, boxH, SPRING)]
        return () => a.forEach((c) => c.stop())
    }, [current, boxW, boxH, stage.w, stage.h, reduce, x, y, w, h])

    // Playback.
    const startLoop = React.useCallback(() => {
        loopRef.current?.stop()
        const from = t.get() % 1
        const c = animate(t, [from, 1], { duration: DURATION * (1 - from), ease: "linear" })
        loopRef.current = c
        c.then(() => {
            if (loopRef.current !== c) return
            t.set(0)
            const loop = animate(t, [0, 1], { duration: DURATION, ease: "linear", repeat: Infinity })
            loopRef.current = loop
        })
    }, [t])

    const play = React.useCallback(() => {
        if (src) videoRef.current?.play().catch(() => undefined)
        else startLoop()
        setPlaying(true)
    }, [src, startLoop])

    const pause = React.useCallback(() => {
        if (src) videoRef.current?.pause()
        else loopRef.current?.stop()
        setPlaying(false)
    }, [src])

    React.useEffect(() => {
        if (autoplay && !reduce) play()
        return () => loopRef.current?.stop()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoplay, reduce, src])

    const onTime = () => {
        const v = videoRef.current
        if (v && v.duration > 0) t.set(v.currentTime / v.duration)
    }

    const onDragEnd = (_: unknown, info: { velocity: { x: number; y: number } }) => {
        setDragging(false)
        const { boxW: bw, boxH: bh, stage: s } = latest.current
        const throwX = x.get() + info.velocity.x * 0.16
        const throwY = y.get() + info.velocity.y * 0.16
        const cx = throwX + bw / 2
        const cy = throwY + bh / 2
        const next: Corner = `${cy < s.h / 2 ? "top" : "bottom"}-${cx < s.w / 2 ? "left" : "right"}` as Corner
        const target = corners(s.w, s.h, bw, bh)[next]
        setCurrent(next)
        animate(x, target.x, { ...SPRING, velocity: info.velocity.x })
        animate(y, target.y, { ...SPRING, velocity: info.velocity.y })
    }

    // Generated "video": orbiting light blobs on a slow hue drift.
    const scene = useTransform(t, (v) => {
        const a = v * Math.PI * 2
        const px = (k: number, r: number, ph: number) => Math.round(50 + r * Math.cos(a * k + ph))
        const py = (k: number, r: number, ph: number) => Math.round(50 + r * Math.sin(a * k + ph))
        return [
            `radial-gradient(circle at ${px(1, 34, 0)}% ${py(1, 30, 0)}%, ${accent} 0%, transparent 46%)`,
            `radial-gradient(circle at ${px(2, 38, 2)}% ${py(1, 34, 2)}%, #7c5cff 0%, transparent 50%)`,
            `radial-gradient(circle at ${px(1, 40, 4)}% ${py(2, 30, 1)}%, #19c3b1 0%, transparent 48%)`,
            "linear-gradient(135deg, #14121f, #1d1530)",
        ].join(", ")
    })
    const sweepX = useTransform(t, (v) => `${(v * 260 - 80).toFixed(1)}%`)
    const clock = useTransform(t, (v) => fmt(v))
    const iconSwitch = playing ? "pause" : "play"

    const showCtl = hover || dragging || focusVisible || !playing
    const ctlBtn = (label: string, onClick: () => void, icon: "play" | "pause" | "expand" | "shrink" | "close") => (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
            onBlur={() => setFocusVisible(false)}
            style={{
                width: 24,
                height: 24,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: 999,
                background: "rgba(10,10,12,0.55)",
                color: "#fff",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                outline: focusVisible ? `2px solid ${accent}` : "none",
                outlineOffset: 1,
                pointerEvents: showCtl ? "auto" : "none",
            }}
        >
            <Icon name={icon} />
        </button>
    )

    const chipPos: React.CSSProperties = {
        [current.startsWith("top") ? "top" : "bottom"]: MARGIN,
        [current.endsWith("left") ? "left" : "right"]: MARGIN,
    }
    const lineW = (bar: number) => Math.max(10, Math.round(bar))
    const lines = [lineW(stage.w * 0.5), lineW(stage.w * 0.42), lineW(stage.w * 0.34)]

    return (
        <MotionConfig reducedMotion="user">
            <div
                ref={stageRef}
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: STAGE_W,
                    aspectRatio: `${STAGE_W} / ${STAGE_H}`,
                    boxSizing: "border-box",
                    borderRadius: radius,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    color: p.text,
                    userSelect: "none",
                }}
            >
                {/* Faux page content */}
                <div aria-hidden style={{ position: "absolute", inset: 0, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 16, height: 16, borderRadius: 5, background: accent }} />
                        <span style={{ fontSize: 12, fontWeight: 700 }}>Northfield</span>
                        <span style={{ flex: 1 }} />
                        {["Docs", "Pricing", "Blog"].map((n) => (
                            <span key={n} style={{ fontSize: 11, color: p.faint }}>
                                {n}
                            </span>
                        ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 6 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Plan the quarter in one place</span>
                        {lines.map((l, i) => (
                            <span key={i} style={{ height: 6, width: l, maxWidth: "90%", borderRadius: 3, background: p.block }} />
                        ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: "auto" }}>
                        {[0, 1, 2].map((i) => (
                            <div key={i} style={{ height: 62, borderRadius: 8, background: p.block, border: `1px solid ${p.line}`, padding: 8, boxSizing: "border-box" }}>
                                <span style={{ display: "block", height: 5, width: "55%", borderRadius: 3, background: p.line }} />
                                <span style={{ display: "block", height: 5, width: "80%", borderRadius: 3, background: p.line, marginTop: 6 }} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Corner guides */}
                <AnimatePresence>
                    {dragging &&
                        (["top-left", "top-right", "bottom-left", "bottom-right"] as Corner[]).map((c) => (
                            <motion.span
                                key={c}
                                aria-hidden
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                                style={{
                                    position: "absolute",
                                    [c.startsWith("top") ? "top" : "bottom"]: 6,
                                    [c.endsWith("left") ? "left" : "right"]: 6,
                                    width: 14,
                                    height: 14,
                                    borderColor: accent,
                                    borderStyle: "solid",
                                    borderWidth: 0,
                                    [c.startsWith("top") ? "borderTopWidth" : "borderBottomWidth"]: 2,
                                    [c.endsWith("left") ? "borderLeftWidth" : "borderRightWidth"]: 2,
                                    borderRadius: 4,
                                    pointerEvents: "none",
                                }}
                            />
                        ))}
                </AnimatePresence>

                <AnimatePresence>
                    {closed && (
                        <motion.button
                            key="chip"
                            type="button"
                            onClick={() => setClosed(false)}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}
                            transition={SPRING}
                            style={{
                                position: "absolute",
                                ...chipPos,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                height: 28,
                                padding: "0 11px 0 9px",
                                borderRadius: 999,
                                border: `1px solid ${p.line}`,
                                background: p.raised,
                                color: p.text,
                                fontFamily: "inherit",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                boxShadow: "0 8px 20px -10px rgba(0,0,0,0.5)",
                            }}
                        >
                            <span style={{ color: accent, display: "inline-flex" }}>
                                <Icon name="video" />
                            </span>
                            Show video
                        </motion.button>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {!closed && (
                        <motion.div
                            key="player"
                            role="group"
                            aria-label="Mini video player"
                            drag
                            dragControls={dragControls}
                            dragListener={false}
                            dragMomentum={false}
                            dragElastic={0.12}
                            dragConstraints={stageRef}
                            onDragStart={() => setDragging(true)}
                            onDragEnd={onDragEnd}
                            onPointerEnter={() => setHover(true)}
                            onPointerLeave={() => setHover(false)}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: dragging ? 1.03 : 1 }}
                            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.14 } }}
                            transition={{ opacity: { duration: 0.18 }, scale: SPRING }}
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                x,
                                y,
                                width: w,
                                height: h,
                                borderRadius: Math.max(6, radius - 2),
                                overflow: "hidden",
                                background: "#0e0d14",
                                boxShadow: dragging
                                    ? "0 24px 48px -12px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.12)"
                                    : "0 14px 30px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)",
                                touchAction: "none",
                                cursor: dragging ? "grabbing" : "grab",
                                zIndex: 5,
                            }}
                        >
                            <div
                                onPointerDown={(e) => dragControls.start(e)}
                                style={{ position: "absolute", inset: 0, touchAction: "none" }}
                            >
                                {src ? (
                                    <video
                                        ref={videoRef}
                                        src={src}
                                        muted
                                        loop
                                        playsInline
                                        autoPlay={autoplay && !reduce}
                                        onTimeUpdate={onTime}
                                        onPlay={() => setPlaying(true)}
                                        onPause={() => setPlaying(false)}
                                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                                    />
                                ) : (
                                    <>
                                        <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: scene }} />
                                        <motion.div
                                            aria-hidden
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                bottom: 0,
                                                width: "32%",
                                                left: sweepX,
                                                background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.1), transparent)",
                                                transform: "skewX(-14deg)",
                                            }}
                                        />
                                        <span
                                            aria-hidden
                                            style={{
                                                position: "absolute",
                                                left: 9,
                                                top: 8,
                                                fontSize: 9,
                                                fontWeight: 700,
                                                letterSpacing: "0.12em",
                                                color: "rgba(255,255,255,0.78)",
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            Product tour
                                        </span>
                                    </>
                                )}
                                <div
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent 45%)",
                                        pointerEvents: "none",
                                    }}
                                />
                            </div>

                            <motion.div
                                initial={false}
                                animate={{ opacity: showCtl ? 1 : 0, y: showCtl ? 0 : 4 }}
                                transition={{ duration: 0.14 }}
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    bottom: 8,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "0 8px",
                                    pointerEvents: "none",
                                }}
                            >
                                <span style={{ display: "flex", gap: 4 }}>{ctlBtn(playing ? "Pause video" : "Play video", () => (playing ? pause() : play()), iconSwitch)}</span>
                                <span style={{ display: "flex", gap: 4 }}>
                                    {ctlBtn(expanded ? "Shrink player" : "Expand player", () => setExpanded((v) => !v), expanded ? "shrink" : "expand")}
                                    {ctlBtn("Close player", () => setClosed(true), "close")}
                                </span>
                            </motion.div>

                            <motion.span
                                aria-hidden
                                initial={false}
                                animate={{ opacity: showCtl ? 0 : 1 }}
                                transition={{ duration: 0.14 }}
                                style={{
                                    position: "absolute",
                                    right: 8,
                                    bottom: 8,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    color: "rgba(255,255,255,0.8)",
                                    fontVariantNumeric: "tabular-nums",
                                    pointerEvents: "none",
                                }}
                            >
                                {clock}
                            </motion.span>

                            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(255,255,255,0.16)", pointerEvents: "none" }}>
                                <motion.div style={{ height: "100%", background: accent, scaleX: t, transformOrigin: "0% 50%" }} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(CornerVideo, {
    src: { type: ControlType.String, title: "Video URL", defaultValue: "" },
    corner: {
        type: ControlType.Enum,
        title: "Corner",
        options: ["top-left", "top-right", "bottom-left", "bottom-right"],
        optionTitles: ["Top left", "Top right", "Bottom left", "Bottom right"],
        defaultValue: "bottom-right",
    },
    size: { type: ControlType.Number, title: "Size", defaultValue: 150, min: 100, max: 240, step: 2 },
    autoplay: { type: ControlType.Boolean, title: "Autoplay", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 28 },
})

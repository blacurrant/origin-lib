import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useReducedMotion } from "framer-motion"

/**
 * Carousel: slides you can drag, step through with the arrows, or jump to with
 * the dots. Left and right arrow keys work when it has focus. Autoplay is off
 * by default, pauses on hover and focus, never runs with reduced motion, and
 * always comes with a pause button.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 280
 */

type Theme = "dark" | "light"

interface Slide {
    title: string
    caption: string
    hue: number
}

interface CarouselProps {
    slides: Slide[]
    loop: boolean
    autoplay: boolean
    interval: number
    height: number
    accent: string
    theme: Theme
    radius: number
}

const SLIDES: Slide[] = [
    { title: "Ship faster", caption: "Preview every change on its own URL.", hue: 24 },
    { title: "Review together", caption: "Comment right on the page, in context.", hue: 262 },
    { title: "Roll back safely", caption: "Restore any past deploy in one click.", hue: 152 },
    { title: "Watch it run", caption: "Logs and metrics next to the code.", hue: 205 },
]

export default function Carousel({
    slides = SLIDES,
    loop = true,
    autoplay = false,
    interval = 5000,
    height = 280,
    accent = "#fa7319",
    theme = "dark",
    radius = 14,
}: Partial<CarouselProps>) {
    const reduced = useReducedMotion()
    const dark = theme !== "light"
    const line = dark ? "#2d2d2f" : "#e4e1db"
    const list = slides.length ? slides : SLIDES
    const count = list.length
    const [index, setIndex] = React.useState(0)
    const [paused, setPaused] = React.useState(false)
    const [userPaused, setUserPaused] = React.useState(false)
    const [focused, setFocused] = React.useState<string | null>(null)
    const width = React.useRef(0)
    const box = React.useRef<HTMLDivElement | null>(null)
    const playing = autoplay && !reduced && !paused && !userPaused

    const go = React.useCallback(
        (n: number) => setIndex(loop ? (n + count) % count : Math.min(Math.max(n, 0), count - 1)),
        [count, loop],
    )

    React.useEffect(() => {
        if (index > count - 1) setIndex(0)
    }, [count, index])

    React.useEffect(() => {
        if (typeof window === "undefined" || !playing) return
        const t = window.setInterval(() => setIndex((i) => (loop ? (i + 1) % count : Math.min(i + 1, count - 1))), Math.max(interval, 1500))
        return () => window.clearInterval(t)
    }, [playing, interval, count, loop])

    const ring = (k: string): React.CSSProperties => (focused === k ? { outline: `2px solid ${accent}`, outlineOffset: 2 } : {})
    const bind = (k: string) => ({
        onFocus: (e: React.FocusEvent<HTMLElement>) => setFocused(e.currentTarget.matches(":focus-visible") ? k : null),
        onBlur: () => setFocused(null),
    })

    const arrow: React.CSSProperties = {
        width: 34,
        height: 34,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.28)",
        background: "rgba(10,10,12,0.45)",
        color: "#ffffff",
        cursor: "pointer",
        backdropFilter: "blur(6px)",
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                ref={box}
                role="region"
                aria-roledescription="carousel"
                aria-label="Highlights"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "ArrowRight") go(index + 1)
                    else if (e.key === "ArrowLeft") go(index - 1)
                    else return
                    e.preventDefault()
                }}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onFocus={(e) => {
                    setPaused(true)
                    setFocused(e.target === e.currentTarget && e.currentTarget.matches(":focus-visible") ? "box" : focused)
                }}
                onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false)
                    if (e.target === e.currentTarget) setFocused(null)
                }}
                style={{
                    position: "relative",
                    width: "100%",
                    height,
                    borderRadius: radius,
                    border: `1px solid ${line}`,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    outline: focused === "box" ? `2px solid ${accent}` : "none",
                    outlineOffset: 2,
                }}
            >
                <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.18}
                    onDragStart={() => {
                        width.current = box.current?.clientWidth ?? 0
                    }}
                    onDragEnd={(_, info) => {
                        const far = Math.abs(info.offset.x) > Math.max(width.current * 0.18, 48)
                        if (far || Math.abs(info.velocity.x) > 450) go(info.offset.x < 0 ? index + 1 : index - 1)
                    }}
                    animate={{ x: `-${index * 100}%` }}
                    transition={{ type: "spring", stiffness: 320, damping: 36 }}
                    style={{ display: "flex", height: "100%", cursor: "grab", touchAction: "pan-y" }}
                >
                    {list.map((s, i) => (
                        <div
                            key={`${s.title}-${i}`}
                            role="group"
                            aria-roledescription="slide"
                            aria-label={`${i + 1} of ${count}`}
                            aria-hidden={i !== index}
                            style={{
                                flex: "0 0 100%",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "flex-end",
                                padding: "22px 24px 46px",
                                boxSizing: "border-box",
                                color: "#ffffff",
                                background: `linear-gradient(145deg, hsl(${s.hue ?? 24} 72% 46%), hsl(${((s.hue ?? 24) + 42) % 360} 70% 22%))`,
                                userSelect: "none",
                            }}
                        >
                            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{s.title}</div>
                            {s.caption ? <div style={{ marginTop: 8, maxWidth: 320, fontSize: 14.5, lineHeight: 1.5, opacity: 0.9 }}>{s.caption}</div> : null}
                        </div>
                    ))}
                </motion.div>

                <div style={{ position: "absolute", left: 18, bottom: 14, display: "flex", gap: 6 }} role="tablist" aria-label="Choose slide">
                    {list.map((s, i) => (
                        <button
                            key={`${s.title}-dot-${i}`}
                            type="button"
                            role="tab"
                            aria-selected={i === index}
                            aria-label={`Slide ${i + 1}`}
                            onClick={() => go(i)}
                            {...bind(`dot-${i}`)}
                            style={{
                                width: i === index ? 22 : 8,
                                height: 8,
                                padding: 0,
                                borderRadius: 999,
                                border: "none",
                                background: i === index ? accent : "rgba(255,255,255,0.45)",
                                boxShadow: i === index ? "0 0 0 1.5px #ffffff" : "none",
                                cursor: "pointer",
                                ...ring(`dot-${i}`),
                            }}
                        />
                    ))}
                </div>

                <div style={{ position: "absolute", right: 14, bottom: 10, display: "flex", gap: 8 }}>
                    {autoplay && !reduced && (
                        <button
                            type="button"
                            aria-label={userPaused ? "Resume autoplay" : "Pause autoplay"}
                            onClick={() => setUserPaused((v) => !v)}
                            {...bind("pause")}
                            style={{ ...arrow, ...ring("pause") }}
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                                {userPaused ? <path d="M3.5 2.5v7l6-3.5z" fill="currentColor" /> : <path d="M3.5 2.5h2v7h-2zM6.5 2.5h2v7h-2z" fill="currentColor" />}
                            </svg>
                        </button>
                    )}
                    <button
                        type="button"
                        aria-label="Previous slide"
                        disabled={!loop && index === 0}
                        onClick={() => go(index - 1)}
                        {...bind("prev")}
                        style={{ ...arrow, opacity: !loop && index === 0 ? 0.4 : 1, ...ring("prev") }}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                            <path d="M8.6 3 4.6 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        aria-label="Next slide"
                        disabled={!loop && index === count - 1}
                        onClick={() => go(index + 1)}
                        {...bind("next")}
                        style={{ ...arrow, opacity: !loop && index === count - 1 ? 0.4 : 1, ...ring("next") }}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                            <path d="M5.4 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
                <span aria-live={playing ? "off" : "polite"} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                    {`Slide ${index + 1} of ${count}: ${list[index]?.title ?? ""}`}
                </span>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(Carousel, {
    slides: {
        type: ControlType.Array,
        title: "Slides",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Slide" },
                caption: { type: ControlType.String, title: "Caption", defaultValue: "" },
                hue: { type: ControlType.Number, title: "Hue", defaultValue: 24, min: 0, max: 359 },
            },
        },
        defaultValue: SLIDES,
    },
    loop: { type: ControlType.Boolean, title: "Loop", defaultValue: true },
    autoplay: { type: ControlType.Boolean, title: "Autoplay", defaultValue: false },
    interval: { type: ControlType.Number, title: "Interval (ms)", defaultValue: 5000, min: 1500, max: 12000, step: 500 },
    height: { type: ControlType.Number, title: "Height", defaultValue: 280, min: 160, max: 520 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 14, min: 0, max: 28 },
})

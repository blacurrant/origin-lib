import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion"
import type { MotionValue } from "framer-motion"

/**
 * SnapCarousel: a swipeable carousel. Drag with momentum and the track settles
 * on the nearest slide with a spring. The active slide is full size, its
 * neighbours shrink and dim. Arrow keys and the prev/next buttons work too, a
 * pill under the dots stretches toward the slide you move to, and `loop` makes
 * the row endless. Slides are generated gradient art, or your own image.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 300
 */

type Theme = "dark" | "light"

interface Slide {
    title: string
    image: string
}

interface SnapCarouselProps {
    slides: Slide[]
    loop: boolean
    showArrows: boolean
    slideWidth: number
    height: number
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#f4f2ee", line: "#e4e1db", text: "#141413", soft: "#5c5a55", faint: "#76736d", dot: "#cfcbc3", btn: "#ffffff", shadow: "0 14px 24px -14px rgba(20,20,19,0.4)" }
        : { surface: "#0e0e0f", line: "#2d2d2f", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f", dot: "#3a3b3d", btn: "#1b1c1d", shadow: "0 16px 28px -14px rgba(0,0,0,0.8)" }
}

const SAMPLE: Slide[] = [
    { title: "Ember Fields", image: "" },
    { title: "Glass Tide", image: "" },
    { title: "Velvet Static", image: "" },
    { title: "Northern Bloom", image: "" },
    { title: "Paper Orbit", image: "" },
    { title: "Late Signal", image: "" },
]

const ART: Array<[string, string, string]> = [
    ["#fa7319", "#7c3aed", "#1a0f2e"],
    ["#22d3ee", "#2563eb", "#0b1630"],
    ["#fb7185", "#f59e0b", "#2a0f16"],
    ["#34d399", "#0ea5e9", "#08221f"],
    ["#c084fc", "#ec4899", "#240c2b"],
    ["#facc15", "#f97316", "#2b1b08"],
]

function artBackground(i: number): string {
    const [a, b, base] = ART[((i % ART.length) + ART.length) % ART.length]
    return [
        `radial-gradient(120% 90% at ${18 + (i % 3) * 14}% 0%, ${a} 0%, transparent 62%)`,
        `radial-gradient(100% 100% at 100% 100%, ${b} 0%, transparent 58%)`,
        `linear-gradient(160deg, ${base}, #050507)`,
    ].join(", ")
}

const mod = (n: number, m: number) => ((n % m) + m) % m
const GAP = 6 // percent of slide width

interface SlideViewProps {
    slide: Slide
    index: number
    count: number
    pos: MotionValue<number>
    loop: boolean
    active: boolean
    width: number
    radius: number
    accent: string
    shadow: string
}

function SlideView({ slide, index, count, pos, loop, active, width, radius, accent, shadow }: SlideViewProps) {
    const offset = (v: number) => {
        const d = index - v
        return loop ? d - count * Math.round(d / count) : d
    }
    const x = useTransform(pos, (v) => `${offset(v) * (100 + GAP)}%`)
    const scale = useTransform(pos, (v) => 1 - Math.min(Math.abs(offset(v)), 1) * 0.13)
    const opacity = useTransform(pos, (v) => {
        const a = Math.abs(offset(v))
        return a <= 1 ? 1 - a * 0.55 : Math.max(0, 0.45 - (a - 1) * 0.75)
    })
    return (
        <motion.div
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}: ${slide.title}`}
            style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${(100 - width) / 2}%`,
                width: `${width}%`,
                x,
                scale,
                opacity,
                borderRadius: radius,
                overflow: "hidden",
                boxShadow: shadow,
                cursor: active ? "grab" : "pointer",
                background: artBackground(index),
                willChange: "transform",
            }}
        >
            {slide.image ? (
                <img
                    src={slide.image}
                    alt=""
                    draggable={false}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                />
            ) : (
                <svg aria-hidden viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                    <circle cx={150 - (index % 3) * 22} cy={62 + (index % 2) * 18} r="58" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.2" />
                    <circle cx={150 - (index % 3) * 22} cy={62 + (index % 2) * 18} r="34" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.2" />
                    <circle cx={150 - (index % 3) * 22} cy={62 + (index % 2) * 18} r="8" fill="#ffffff" fillOpacity="0.5" />
                </svg>
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(5,5,7,0.78) 0%, rgba(5,5,7,0) 58%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none" }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#ffffff", opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
                    {String(index + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: "#ffffff", lineHeight: 1.15 }}>{slide.title}</span>
            </div>
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: radius,
                    boxShadow: active ? `inset 0 0 0 1.5px ${accent}` : "inset 0 0 0 1px rgba(255,255,255,0.1)",
                    pointerEvents: "none",
                }}
            />
        </motion.div>
    )
}

export default function SnapCarousel({
    slides = SAMPLE,
    loop = true,
    showArrows = true,
    slideWidth = 64,
    height = 210,
    accent = "#fa7319",
    theme = "dark",
    radius = 16,
}: Partial<SnapCarouselProps>) {
    const p = palette(theme)
    const items = slides.length > 0 ? slides : SAMPLE
    const n = items.length
    const reduce = useReducedMotion()
    const pos = useMotionValue(0)
    const target = React.useRef(0)
    const [active, setActive] = React.useState(0)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const [btnFocus, setBtnFocus] = React.useState<string>("")
    const stage = React.useRef<HTMLDivElement | null>(null)
    const drag = React.useRef({ on: false, id: -1, startX: 0, startPos: 0, moved: false, samples: [] as Array<[number, number]> })
    const controls = React.useRef<{ stop: () => void } | null>(null)

    // pill: leading edge springs fast, trailing edge lags, so it stretches
    const pillL = useMotionValue(0)
    const pillR = useMotionValue(8)
    const pillW = useTransform([pillL, pillR], (v) => Math.max(8, (v[1] as number) - (v[0] as number)))

    React.useEffect(() => {
        const unsub = pos.on("change", (v) => {
            const idx = mod(Math.round(v), n)
            setActive((a) => (a === idx ? a : idx))
        })
        return unsub
    }, [pos, n])

    React.useEffect(() => {
        const l = active * 18
        const r = l + 8
        if (reduce) {
            pillL.set(l)
            pillR.set(r)
            return
        }
        const forward = r > pillR.get()
        animate(pillL, l, { type: "spring", stiffness: forward ? 240 : 520, damping: forward ? 26 : 34 })
        animate(pillR, r, { type: "spring", stiffness: forward ? 520 : 240, damping: forward ? 34 : 26 })
    }, [active, reduce, pillL, pillR])

    React.useEffect(() => () => controls.current?.stop(), [])

    const settle = (k: number, velocity = 0) => {
        controls.current?.stop()
        const to = loop ? k : Math.max(0, Math.min(n - 1, k))
        target.current = to
        if (reduce) {
            pos.set(to)
            return
        }
        controls.current = animate(pos, to, { type: "spring", stiffness: 230, damping: 27, mass: 1, velocity })
    }

    const step = (dir: number) => settle(Math.round(target.current) + dir)

    const goTo = (i: number) => {
        // shortest way around when looping
        const cur = Math.round(target.current)
        let d = i - mod(cur, n)
        if (loop) d = d - n * Math.round(d / n)
        settle(cur + d)
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowRight") {
            e.preventDefault()
            step(1)
        } else if (e.key === "ArrowLeft") {
            e.preventDefault()
            step(-1)
        } else if (e.key === "Home") {
            e.preventDefault()
            goTo(0)
        } else if (e.key === "End") {
            e.preventDefault()
            goTo(n - 1)
        }
    }

    const stepPx = () => {
        const w = (stage.current?.offsetWidth ?? 400) * (slideWidth / 100)
        return Math.max(1, w * (1 + GAP / 100))
    }

    const rubber = (raw: number) => {
        if (loop) return raw
        if (raw < 0) return raw * 0.35
        if (raw > n - 1) return n - 1 + (raw - (n - 1)) * 0.35
        return raw
    }

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        controls.current?.stop()
        const d = drag.current
        d.on = true
        d.id = e.pointerId
        d.startX = e.clientX
        d.startPos = pos.get()
        d.moved = false
        d.samples = [[performance.now(), e.clientX]]
        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch (_) {}
    }

    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d.on || e.pointerId !== d.id) return
        const dx = e.clientX - d.startX
        if (!d.moved && Math.abs(dx) > 5) d.moved = true
        if (!d.moved) return
        pos.set(rubber(d.startPos - dx / stepPx()))
        const now = performance.now()
        d.samples.push([now, e.clientX])
        while (d.samples.length > 2 && now - d.samples[0][0] > 90) d.samples.shift()
    }

    const endDrag = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d.on || e.pointerId !== d.id) return
        d.on = false
        try {
            e.currentTarget.releasePointerCapture(e.pointerId)
        } catch (_) {}
        if (!d.moved) {
            // tap: pointer capture retargets the click, so resolve the slide here
            const rect = e.currentTarget.getBoundingClientRect()
            const dx = e.clientX - (rect.left + rect.width / 2)
            if (Math.abs(dx) > (rect.width * slideWidth) / 200) step(Math.round(dx / stepPx()) || Math.sign(dx))
            return
        }
        const s = d.samples
        let vPx = 0
        if (s.length > 1) {
            const dt = s[s.length - 1][0] - s[0][0]
            if (dt > 0) vPx = ((s[s.length - 1][1] - s[0][1]) / dt) * 1000
        }
        const vIdx = -vPx / stepPx()
        const cur = pos.get()
        const start = Math.round(d.startPos)
        let k = Math.round(cur + vIdx * 0.16)
        k = Math.max(start - 3, Math.min(start + 3, k))
        settle(k, vIdx)
    }

    const btnStyle = (id: string, disabled: boolean): React.CSSProperties => ({
        width: 30,
        height: 30,
        borderRadius: 15,
        background: p.btn,
        border: "none",
        boxShadow: `inset 0 0 0 1px ${p.line}`,
        color: p.text,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        outline: btnFocus === id ? `2px solid ${accent}` : "none",
        outlineOffset: 2,
        fontFamily: "inherit",
    })

    const Arrow = ({ dir }: { dir: -1 | 1 }) => {
        const id = dir < 0 ? "prev" : "next"
        const disabled = !loop && (dir < 0 ? active === 0 : active === n - 1)
        return (
            <motion.button
                type="button"
                aria-label={dir < 0 ? "Previous slide" : "Next slide"}
                disabled={disabled}
                onClick={() => step(dir)}
                onFocus={(e) => setBtnFocus(e.currentTarget.matches(":focus-visible") ? id : "")}
                onBlur={() => setBtnFocus("")}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
                style={btnStyle(id, disabled)}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d={dir < 0 ? "M9 2.5L4.5 7L9 11.5" : "M5 2.5L9.5 7L5 11.5"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </motion.button>
        )
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                role="region"
                aria-roledescription="carousel"
                aria-label="Slides"
                tabIndex={0}
                onKeyDown={onKeyDown}
                onFocus={(e) => setFocusVisible(e.currentTarget === e.target && e.currentTarget.matches(":focus-visible"))}
                onBlur={() => setFocusVisible(false)}
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 480,
                    boxSizing: "border-box",
                    padding: "18px 0 14px",
                    borderRadius: radius + 4,
                    background: p.surface,
                    fontFamily: "inherit",
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: 2,
                    overflow: "hidden",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                }}
            >
                <div
                    ref={stage}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    aria-live="off"
                    style={{ position: "relative", height, touchAction: "pan-y", cursor: "grab", overflowX: "clip", overflowY: "visible" }}
                >
                    {items.map((s, i) => (
                        <SlideView
                                key={i}
                                slide={s}
                                index={i}
                                count={n}
                                pos={pos}
                                loop={loop}
                                active={i === active}
                                width={slideWidth}
                                radius={radius}
                                accent={accent}
                                shadow={p.shadow}
                            />
                    ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
                    {showArrows && <Arrow dir={-1} />}
                    <div
                        role="tablist"
                        aria-label="Choose slide"
                        style={{ position: "relative", display: "flex", gap: 10, height: 8, width: n * 18 - 10 }}
                    >
                        {items.map((s, i) => (
                            <button
                                key={i}
                                type="button"
                                role="tab"
                                aria-selected={i === active}
                                aria-label={`Slide ${i + 1}: ${s.title}`}
                                onClick={() => goTo(i)}
                                onFocus={(e) => setBtnFocus(e.currentTarget.matches(":focus-visible") ? `d${i}` : "")}
                                onBlur={() => setBtnFocus("")}
                                style={{
                                    width: 8,
                                    height: 8,
                                    flex: "none",
                                    padding: 0,
                                    border: "none",
                                    borderRadius: 4,
                                    background: p.dot,
                                    cursor: "pointer",
                                    outline: btnFocus === `d${i}` ? `2px solid ${accent}` : "none",
                                    outlineOffset: 2,
                                }}
                            />
                        ))}
                        <motion.span
                            aria-hidden
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                x: pillL,
                                width: pillW,
                                height: 8,
                                borderRadius: 4,
                                background: accent,
                                pointerEvents: "none",
                                boxShadow: `0 0 12px ${accent}66`,
                            }}
                        />
                    </div>
                    {showArrows && <Arrow dir={1} />}
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(SnapCarousel, {
    slides: {
        type: ControlType.Array,
        title: "Slides",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Slide" },
                image: { type: ControlType.String, title: "Image URL", defaultValue: "" },
            },
        },
        defaultValue: SAMPLE,
    },
    loop: { type: ControlType.Boolean, title: "Loop", defaultValue: true },
    showArrows: { type: ControlType.Boolean, title: "Arrows", defaultValue: true },
    slideWidth: { type: ControlType.Number, title: "Slide width", defaultValue: 64, min: 40, max: 90, unit: "%" },
    height: { type: ControlType.Number, title: "Height", defaultValue: 210, min: 140, max: 420 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 16, min: 0, max: 32 },
})

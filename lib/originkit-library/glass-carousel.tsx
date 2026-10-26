import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion"
import type { MotionValue } from "framer-motion"

/**
 * GlassCarousel: an endless row of panels with a frosted glass lens fixed at
 * the centre. Drag with inertia and the row snaps to the nearest panel. Panels
 * passing under the lens are magnified and shifted a little, as if refracted,
 * and the lens has a chromatic rim and a soft highlight. Click the centred
 * panel to open a focus view, click again to return. Pure CSS and SVG.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 300
 */

type Theme = "dark" | "light"

interface Item {
    title: string
    subtitle: string
    image: string
}

interface GlassCarouselProps {
    items: Item[]
    panelHeight: number
    gap: number
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#f1efea", text: "#141413", soft: "#5c5a55", faint: "#76736d", veil: "rgba(255,255,255,0.34)", shadow: "0 8px 16px -10px rgba(20,20,19,0.5)" }
        : { surface: "#0d0d0e", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f", veil: "rgba(255,255,255,0.07)", shadow: "0 8px 16px -10px rgba(0,0,0,0.85)" }
}

const SAMPLE: Item[] = [
    { title: "Solar Drift", subtitle: "Warm light through dust", image: "" },
    { title: "Tidal Glass", subtitle: "Blue hour, long exposure", image: "" },
    { title: "Rose Quartz", subtitle: "Soft pressure, hard edge", image: "" },
    { title: "Mint Static", subtitle: "Signal between stations", image: "" },
    { title: "Violet Hour", subtitle: "The sky gives up its colour", image: "" },
    { title: "Amber Grid", subtitle: "City lights, counted", image: "" },
    { title: "Deep Field", subtitle: "Far away and sharp", image: "" },
]

const ART: Array<[string, string, string]> = [
    ["#fa7319", "#c026d3", "#1d0f26"],
    ["#38bdf8", "#4f46e5", "#0a1230"],
    ["#fb7185", "#fbbf24", "#2b1017"],
    ["#34d399", "#22d3ee", "#07211f"],
    ["#a78bfa", "#f472b6", "#1f0d2c"],
    ["#fbbf24", "#ef4444", "#2a1607"],
    ["#60a5fa", "#14b8a6", "#071a24"],
]

const mod = (n: number, m: number) => ((n % m) + m) % m

function artBackground(i: number): string {
    const [a, b, base] = ART[mod(i, ART.length)]
    return [
        `radial-gradient(130% 80% at ${20 + (i % 3) * 25}% 0%, ${a} 0%, transparent 62%)`,
        `radial-gradient(110% 90% at 90% 100%, ${b} 0%, transparent 60%)`,
        `linear-gradient(165deg, ${base}, #060608)`,
    ].join(", ")
}

function Pattern({ index }: { index: number }) {
    const k = index % 4
    const common = { fill: "none", stroke: "#ffffff", strokeOpacity: 0.2, strokeWidth: 0.7 }
    return (
        <svg aria-hidden viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {k === 0 && [14, 26, 38, 50].map((r) => <circle key={r} cx="66" cy="42" r={r} {...common} />)}
            {k === 1 && Array.from({ length: 12 }, (_, j) => <line key={j} x1={-20 + j * 14} y1="150" x2={20 + j * 14} y2="-10" {...common} />)}
            {k === 2 && Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, c) => <circle key={`${r}${c}`} cx={14 + c * 18} cy={14 + r * 12} r="1.4" fill="#ffffff" fillOpacity="0.38" />))}
            {k === 3 && [20, 34, 48, 62].map((r) => <path key={r} d={`M ${50 - r} 74 A ${r} ${r} 0 0 1 ${50 + r} 74`} {...common} />)}
        </svg>
    )
}

interface PanelProps {
    item: Item
    index: number
    n: number
    pos: MotionValue<number>
    step: number
    w: number
    h: number
    r: number
    lens: boolean
}

function Panel({ item, index, n, pos, step, w, h, r, lens }: PanelProps) {
    const total = n * step
    const rel = (v: number) => {
        const d = index * step - v
        return d - total * Math.round(d / total)
    }
    const x = useTransform(pos, (v) => (lens ? rel(v) * 0.94 : rel(v)))
    const art = useTransform(pos, (v) => rel(v) * (lens ? -0.2 : -0.07))
    const scale = useTransform(pos, (v) => (lens ? 1 : 1 - Math.min(Math.abs(rel(v)) / step, 1) * 0.08))
    const opacity = useTransform(pos, (v) => (lens ? 1 : 1 - Math.min(Math.abs(rel(v)) / (step * 2), 1) * 0.6))
    return (
        <motion.div
            aria-hidden
            style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: w,
                height: h,
                marginLeft: -w / 2,
                marginTop: -h / 2,
                x,
                scale,
                opacity,
                borderRadius: r,
                overflow: "hidden",
                background: "#060608",
                willChange: "transform",
            }}
        >
            <motion.div style={{ position: "absolute", inset: "0 -20px", x: art, background: item.image ? "none" : artBackground(index) }}>
                {item.image ? (
                    <img src={item.image} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                ) : (
                    <Pattern index={index} />
                )}
            </motion.div>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(5,5,7,0.72), rgba(5,5,7,0) 55%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 11, display: "flex", flexDirection: "column", gap: 2, pointerEvents: "none" }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", color: "#ffffff", opacity: 0.65, fontVariantNumeric: "tabular-nums" }}>{String(index + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "#ffffff", lineHeight: 1.15 }}>{item.title}</span>
            </div>
        </motion.div>
    )
}

export default function GlassCarousel({
    items = SAMPLE,
    panelHeight = 190,
    gap = 16,
    accent = "#fa7319",
    theme = "dark",
    radius = 18,
}: Partial<GlassCarouselProps>) {
    const p = palette(theme)
    const list = items.length > 0 ? items : SAMPLE
    const n = list.length
    const reduce = useReducedMotion()
    const hintId = React.useId()
    const h = panelHeight
    const w = Math.round(h * 0.74)
    const step = w + gap
    const lensW = w + 36
    const lensH = h + 36
    const stageH = h + 64
    const pos = useMotionValue(0)
    const target = React.useRef(0)
    const [active, setActive] = React.useState(0)
    const [open, setOpen] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const [sw, setSw] = React.useState(480)
    const stage = React.useRef<HTMLDivElement | null>(null)
    const anim = React.useRef<{ stop: () => void } | null>(null)
    const drag = React.useRef({ on: false, id: -1, startX: 0, startPos: 0, moved: false, samples: [] as Array<[number, number]> })

    React.useEffect(() => {
        const el = stage.current
        if (!el) return
        setSw(el.offsetWidth || 480)
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(() => setSw(el.offsetWidth || 480))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    React.useEffect(() => {
        return pos.on("change", (v) => {
            const idx = mod(Math.round(v / step), n)
            setActive((a) => (a === idx ? a : idx))
        })
    }, [pos, step, n])

    React.useEffect(() => () => anim.current?.stop(), [])

    const settle = (k: number, velocity = 0) => {
        anim.current?.stop()
        target.current = k
        const to = k * step
        if (reduce) {
            pos.set(to)
            return
        }
        anim.current = animate(pos, to, { type: "spring", stiffness: 190, damping: 25, velocity })
    }

    const step1 = (dir: number) => settle(Math.round(target.current) + dir)

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowRight" && !open) {
            e.preventDefault()
            step1(1)
        } else if (e.key === "ArrowLeft" && !open) {
            e.preventDefault()
            step1(-1)
        } else if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault()
            setOpen((o) => !o)
        } else if (e.key === "Escape" && open) {
            e.preventDefault()
            setOpen(false)
        }
    }

    const onPointerDown = (e: React.PointerEvent) => {
        if (open || (e.pointerType === "mouse" && e.button !== 0)) return
        anim.current?.stop()
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
        pos.set(d.startPos - dx)
        const now = performance.now()
        d.samples.push([now, e.clientX])
        while (d.samples.length > 2 && now - d.samples[0][0] > 90) d.samples.shift()
    }

    const onPointerUp = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d.on || e.pointerId !== d.id) return
        d.on = false
        try {
            e.currentTarget.releasePointerCapture(e.pointerId)
        } catch (_) {}
        if (!d.moved) {
            const rect = e.currentTarget.getBoundingClientRect()
            const dx = e.clientX - (rect.left + rect.width / 2)
            if (Math.abs(dx) <= lensW / 2) setOpen(true)
            else settle(Math.round(pos.get() / step) + Math.round(dx / step))
            return
        }
        const s = d.samples
        let v = 0
        if (s.length > 1) {
            const dt = s[s.length - 1][0] - s[0][0]
            if (dt > 0) v = -((s[s.length - 1][1] - s[0][1]) / dt) * 1000
        }
        const cur = pos.get()
        const start = Math.round(d.startPos / step)
        const k = Math.max(start - 4, Math.min(start + 4, Math.round((cur + v * 0.22) / step)))
        settle(k, v)
    }

    const cur = list[active]
    const ringMask: React.CSSProperties = {
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
    }
    const lensR = radius + 10
    const bezel = 11

    return (
        <MotionConfig reducedMotion="user">
            <div
                role="region"
                aria-roledescription="carousel"
                aria-label="Glass carousel"
                aria-describedby={hintId}
                tabIndex={0}
                onKeyDown={onKeyDown}
                onFocus={(e) => setFocusVisible(e.currentTarget === e.target && e.currentTarget.matches(":focus-visible"))}
                onBlur={() => setFocusVisible(false)}
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 480,
                    boxSizing: "border-box",
                    borderRadius: radius + 8,
                    background: p.surface,
                    fontFamily: "inherit",
                    overflow: "hidden",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: 2,
                }}
            >
                <div
                    ref={stage}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    style={{
                        position: "relative",
                        height: stageH,
                        touchAction: "pan-y",
                        cursor: open ? "zoom-out" : "grab",
                        overflow: "hidden",
                        background: `radial-gradient(60% 70% at 50% 50%, color-mix(in srgb, ${accent} 16%, transparent), transparent 70%)`,
                    }}
                >
                    {/* base row */}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 14%, #000 86%, transparent 100%)",
                            maskImage: "linear-gradient(to right, transparent 0, #000 14%, #000 86%, transparent 100%)",
                        }}
                    >
                        {list.map((it, i) => (
                            <Panel key={i} item={it} index={i} n={n} pos={pos} step={step} w={w} h={h} r={radius} lens={false} />
                        ))}
                    </div>

                    {/* lens */}
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: lensW,
                            height: lensH,
                            marginLeft: -lensW / 2,
                            marginTop: -lensH / 2,
                            borderRadius: lensR,
                            pointerEvents: "none",
                            boxShadow: `${p.shadow}, 0 0 34px -6px color-mix(in srgb, ${accent} 38%, transparent)`,
                        }}
                    >
                        <div style={{ position: "absolute", inset: 0, borderRadius: lensR, overflow: "hidden", background: "#060608" }}>
                            <div style={{ position: "absolute", inset: 0, transform: "scale(1.14)", filter: "saturate(1.25) contrast(1.04)" }}>
                                {list.map((it, i) => (
                                    <Panel key={i} item={it} index={i} n={n} pos={pos} step={step} w={w} h={h} r={radius} lens />
                                ))}
                            </div>
                            {/* frosted bezel: blur and saturation on a ring */}
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: lensR,
                                    padding: bezel,
                                    boxSizing: "border-box",
                                    background: p.veil,
                                    backdropFilter: "blur(7px) saturate(1.9)",
                                    WebkitBackdropFilter: "blur(7px) saturate(1.9)",
                                    ...ringMask,
                                }}
                            />
                            {/* soft highlight */}
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: lensR,
                                    background:
                                        "radial-gradient(70% 38% at 28% 6%, rgba(255,255,255,0.42), rgba(255,255,255,0) 70%), linear-gradient(115deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.12) 48%, rgba(255,255,255,0) 58%)",
                                    mixBlendMode: "screen",
                                }}
                            />
                        </div>
                        {/* chromatic rim */}
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: lensR,
                                boxShadow:
                                    "inset 1.5px 0 0 0 rgba(255,70,110,0.55), inset -1.5px 0 0 0 rgba(70,150,255,0.6), inset 0 1.5px 0 0 rgba(255,255,255,0.6), inset 0 -1.5px 0 0 rgba(110,255,210,0.35)",
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: lensR,
                                padding: 1.5,
                                boxSizing: "border-box",
                                background: `conic-gradient(from 210deg, #ff5a7a, #ffb36b, rgba(255,255,255,0.9), #6bd1ff, #8a7bff, ${accent}, #ff5a7a)`,
                                opacity: 0.9,
                                ...ringMask,
                            }}
                        />
                    </div>

                    {/* focus view */}
                    <AnimatePresence>
                        {open && (
                            <motion.div
                                key="focus"
                                role="button"
                                aria-label={`${cur.title}. Click to return`}
                                onClick={() => setOpen(false)}
                                initial={{ clipPath: `inset(${(stageH - lensH) / 2}px ${(sw - lensW) / 2}px ${(stageH - lensH) / 2}px ${(sw - lensW) / 2}px round ${lensR}px)` }}
                                animate={{ clipPath: `inset(0px 0px 0px 0px round ${radius + 8}px)` }}
                                exit={{ clipPath: `inset(${(stageH - lensH) / 2}px ${(sw - lensW) / 2}px ${(stageH - lensH) / 2}px ${(sw - lensW) / 2}px round ${lensR}px)` }}
                                transition={{ type: "spring", stiffness: 210, damping: 26 }}
                                style={{ position: "absolute", inset: 0, cursor: "zoom-out", background: "#060608" }}
                            >
                                <div style={{ position: "absolute", inset: 0, background: cur.image ? "none" : artBackground(active) }}>
                                    {cur.image ? (
                                        <img src={cur.image} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                        <FocusArt index={active} />
                                    )}
                                </div>
                                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(5,5,7,0.82), rgba(5,5,7,0) 62%)" }} />
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0, transition: { delay: 0.12, type: "spring", stiffness: 260, damping: 26 } }}
                                    exit={{ opacity: 0, y: 6, transition: { duration: 0.1 } }}
                                    style={{ position: "absolute", left: 22, right: 22, bottom: 20, display: "flex", flexDirection: "column", gap: 6 }}
                                >
                                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: accent, fontVariantNumeric: "tabular-nums" }}>
                                        {String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
                                    </span>
                                    <span style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-0.02em", color: "#ffffff", lineHeight: 1.05 }}>{cur.title}</span>
                                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.78)" }}>{cur.subtitle}</span>
                                </motion.div>
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1, transition: { delay: 0.2 } }}
                                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                                    style={{ position: "absolute", top: 14, right: 16, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.8)", padding: "4px 9px", borderRadius: 999, background: "rgba(255,255,255,0.14)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                                >
                                    Click to return
                                </motion.span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 20px", height: 46 }}>
                    <div aria-live="polite" style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: p.text, whiteSpace: "nowrap" }}>{cur.title}</span>
                        <span style={{ fontSize: 12, color: p.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur.subtitle}</span>
                    </div>
                    <span id={hintId} style={{ fontSize: 11, color: p.faint, whiteSpace: "nowrap" }}>
                        {open ? "Esc to return" : "Drag, click centre"}
                    </span>
                </div>
            </div>
        </MotionConfig>
    )
}

function FocusArt({ index }: { index: number }) {
    return (
        <svg aria-hidden viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            {[40, 80, 120, 160, 200].map((r) => (
                <circle key={r} cx={290 - (index % 3) * 30} cy="90" r={r} fill="none" stroke="#ffffff" strokeOpacity={0.2 - r / 1500} strokeWidth="1" />
            ))}
            <circle cx={290 - (index % 3) * 30} cy="90" r="9" fill="#ffffff" fillOpacity="0.6" />
        </svg>
    )
}

addPropertyControls(GlassCarousel, {
    items: {
        type: ControlType.Array,
        title: "Items",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Panel" },
                subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "Subtitle" },
                image: { type: ControlType.String, title: "Image URL", defaultValue: "" },
            },
        },
        defaultValue: SAMPLE,
    },
    panelHeight: { type: ControlType.Number, title: "Panel height", defaultValue: 190, min: 120, max: 320 },
    gap: { type: ControlType.Number, title: "Gap", defaultValue: 16, min: 0, max: 64 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 18, min: 0, max: 32 },
})

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * DistributionChart: glowing area curves on a shared grid, with a soft
 * reflection under the baseline. Each series is a bell or plateau curve you
 * describe with a center, spread, peak and shape, so two panels side by side
 * show how concentrated one result is against how spread out another is. All
 * panels share one vertical scale, so a taller curve is genuinely taller.
 * Hover, touch, or use the arrow keys to read the same position on every curve.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 640
 * @framerIntrinsicHeight 420
 */

type Theme = "dark" | "light"
type Layout = "split" | "overlay"

interface Series {
    label: string
    /** Where the curve is centered along the axis, 0 to 100. */
    center: number
    /** How wide it is, as a percent of the axis. Smaller is more concentrated. */
    spread: number
    /** Height at the center, 0 to 100 on the shared scale. */
    peak: number
    /** 2 is a bell. Higher values flatten the top into a plateau. */
    shape: number
}

interface DistributionChartProps {
    series: Series[]
    layout: Layout
    reflection: boolean
    grid: boolean
    animate: boolean
    height: number
    accent: string
    secondary: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", line: "#d9d5ce", grid: "rgba(20,20,19,0.07)", gridStrong: "rgba(20,20,19,0.14)", text: "#141413", soft: "#5c5a55", faint: "#76736d" }
        : { surface: "#0d0e10", line: "#2a2c30", grid: "rgba(255,255,255,0.055)", gridStrong: "rgba(255,255,255,0.11)", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f" }
}

const SAMPLE: Series[] = [
    { label: "Concentrated", center: 50, spread: 9, peak: 62, shape: 2 },
    { label: "Spread out", center: 50, spread: 31, peak: 14, shape: 5 },
]

const STEPS = 120
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function density(s: Series, x: number) {
    const sigma = Math.max(s.spread, 1) / 100
    return s.peak * Math.exp(-0.5 * Math.pow(Math.abs(x - s.center / 100) / sigma, s.shape))
}

function paths(s: Series) {
    const pts: string[] = []
    for (let i = 0; i <= STEPS; i++) {
        const x = i / STEPS
        pts.push(`${(x * 100).toFixed(2)} ${(100 - density(s, x)).toFixed(2)}`)
    }
    const line = `M${pts.join(" L")}`
    return { line, area: `${line} L100 100 L0 100 Z` }
}

function clean(series: Series[] | undefined): Series[] {
    const list = (series && series.length ? series : SAMPLE).slice(0, 4)
    return list.map((s, i) => ({
        label: s.label || `Series ${i + 1}`,
        center: clamp(Number(s.center ?? 50), 0, 100),
        spread: clamp(Number(s.spread ?? 20), 2, 60),
        peak: clamp(Number(s.peak ?? 50), 0, 100),
        shape: clamp(Number(s.shape ?? 2), 2, 10),
    }))
}

export default function DistributionChart({
    series = SAMPLE,
    layout = "split",
    reflection = true,
    grid = true,
    animate = true,
    height = 300,
    accent = "#fa7319",
    secondary = "#4fa8dc",
    theme = "dark",
    radius = 6,
}: Partial<DistributionChartProps>) {
    const p = palette(theme)
    const uid = React.useId().replace(/:/g, "")
    const data = React.useMemo(() => clean(series), [series])
    const colors = [accent, secondary, "#3dd68c", "#f5b14a"]
    const [pos, setPos] = React.useState<number | null>(null)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const refHeight = reflection ? Math.round(height * 0.42) : 0

    const label = (s: Series, i: number) => {
        const c = colors[i % colors.length]
        return theme === "light" ? `color-mix(in srgb, ${c} 62%, #141413)` : c
    }

    const panels = layout === "overlay" ? [data.map((_, i) => i)] : data.map((_, i) => [i])

    const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect()
        if (r.width > 0) setPos(clamp((e.clientX - r.left) / r.width, 0, 1))
    }

    const onKey = (e: React.KeyboardEvent) => {
        const step = e.shiftKey ? 0.1 : 0.02
        if (e.key === "ArrowRight") setPos((v) => clamp((v ?? 0.5) + step, 0, 1))
        else if (e.key === "ArrowLeft") setPos((v) => clamp((v ?? 0.5) - step, 0, 1))
        else if (e.key === "Home") setPos(0)
        else if (e.key === "End") setPos(1)
        else if (e.key === "Escape") setPos(null)
        else return
        e.preventDefault()
    }

    return (
        <MotionConfig reducedMotion="user">
          <div style={{ position: "relative", width: "100%" }}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${panels.length}, minmax(0, 1fr))`,
                    gap: 16,
                    width: "100%",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                {panels.map((idx) => {
                    const first = idx[0]
                    const name = idx.map((i) => data[i].label).join(" vs ")
                    const valueText =
                        pos === null
                            ? "Use arrow keys to read values"
                            : idx.map((i) => `${data[i].label} ${Math.round(density(data[i], pos))} at ${Math.round(pos * 100)} percent`).join(", ")
                    return (
                        <div key={first} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <div
                                role="slider"
                                tabIndex={0}
                                aria-label={`${name} distribution`}
                                aria-orientation="horizontal"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={pos === null ? undefined : Math.round(pos * 100)}
                                aria-valuetext={valueText}
                                onPointerMove={onMove}
                                onPointerDown={onMove}
                                onPointerLeave={() => setPos(null)}
                                onKeyDown={onKey}
                                onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                                onBlur={() => setFocusVisible(false)}
                                style={{
                                    position: "relative",
                                    height,
                                    borderRadius: radius,
                                    border: `1px solid ${p.line}`,
                                    background: p.surface,
                                    overflow: "hidden",
                                    touchAction: "pan-y",
                                    cursor: "crosshair",
                                    outline: focusVisible ? `2px solid ${accent}` : "none",
                                    outlineOffset: 2,
                                    boxSizing: "border-box",
                                }}
                            >
                                {grid && (
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                                        {Array.from({ length: 9 }, (_, i) => {
                                            const at = (i + 1) * 10
                                            const strong = at === 50
                                            return (
                                                <React.Fragment key={at}>
                                                    <line x1={at} x2={at} y1="0" y2="100" stroke={strong ? p.gridStrong : p.grid} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                                                    <line x1="0" x2="100" y1={at} y2={at} stroke={p.grid} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                                                </React.Fragment>
                                            )
                                        })}
                                    </svg>
                                )}
                                {grid &&
                                    Array.from({ length: 10 }, (_, i) => (
                                        <span
                                            key={i}
                                            aria-hidden
                                            style={{ position: "absolute", left: 0, top: `${i * 10}%`, width: 5, height: 1, background: p.gridStrong }}
                                        />
                                    ))}

                                <motion.div
                                    key={`${uid}-${animate}`}
                                    initial={animate ? { scaleY: 0.02, opacity: 0 } : false}
                                    animate={{ scaleY: 1, opacity: 1 }}
                                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                                    style={{ position: "absolute", inset: 0, transformOrigin: "50% 100%" }}
                                >
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
                                        <defs>
                                            {idx.map((i) => (
                                                <linearGradient key={i} id={`${uid}-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0" stopColor={colors[i % colors.length]} stopOpacity={theme === "light" ? 0.34 : 0.5} />
                                                    <stop offset="1" stopColor={colors[i % colors.length]} stopOpacity={0.03} />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        {idx.map((i) => {
                                            const d = paths(data[i])
                                            const c = colors[i % colors.length]
                                            return (
                                                <g key={i}>
                                                    <path d={d.area} fill={`url(#${uid}-fill-${i})`} />
                                                    <path
                                                        d={d.line}
                                                        fill="none"
                                                        stroke={c}
                                                        strokeWidth="2"
                                                        strokeLinejoin="round"
                                                        vectorEffect="non-scaling-stroke"
                                                        style={{ filter: theme === "light" ? "none" : `drop-shadow(0 0 5px ${c})` }}
                                                    />
                                                </g>
                                            )
                                        })}
                                    </svg>
                                </motion.div>

                                {pos !== null && (
                                    <>
                                        <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${pos * 100}%`, width: 1, background: p.gridStrong }} />
                                        {idx.map((i) => (
                                            <span
                                                key={i}
                                                aria-hidden
                                                style={{
                                                    position: "absolute",
                                                    left: `${pos * 100}%`,
                                                    bottom: `${density(data[i], pos)}%`,
                                                    width: 9,
                                                    height: 9,
                                                    marginLeft: -4.5,
                                                    marginBottom: -4.5,
                                                    borderRadius: "50%",
                                                    background: colors[i % colors.length],
                                                    border: `2px solid ${p.surface}`,
                                                    boxSizing: "border-box",
                                                }}
                                            />
                                        ))}
                                    </>
                                )}

                                <div aria-hidden style={{ position: "absolute", left: 14, top: 12, display: "flex", flexDirection: "column", gap: 3, fontSize: 12, lineHeight: 1.3 }}>
                                    {idx.map((i) => (
                                        <span key={i} style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: label(data[i], i) }}>
                                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors[i % colors.length] }} />
                                                {data[i].label}
                                            </span>
                                            <span style={{ color: p.faint, fontVariantNumeric: "tabular-nums" }}>
                                                {pos === null ? `peak ${Math.round(data[i].peak)}` : Math.round(density(data[i], pos))}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {reflection && (
                                <div
                                    aria-hidden
                                    style={{
                                        position: "relative",
                                        height: refHeight,
                                        overflow: "hidden",
                                        pointerEvents: "none",
                                        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0) 92%)",
                                        maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0) 92%)",
                                        filter: "blur(1.2px)",
                                    }}
                                >
                                    <motion.svg
                                        viewBox="0 0 100 100"
                                        preserveAspectRatio="none"
                                        initial={animate ? { opacity: 0 } : false}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.9, delay: 0.15 }}
                                        style={{ position: "absolute", left: 0, top: 0, width: "100%", height, transform: "scaleY(-1)", transformOrigin: "50% 50%", overflow: "visible" }}
                                    >
                                        {idx.map((i) => {
                                            const d = paths(data[i])
                                            const c = colors[i % colors.length]
                                            return (
                                                <g key={i}>
                                                    <path d={d.area} fill={`url(#${uid}-fill-${i})`} />
                                                    <path d={d.line} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                                                </g>
                                            )
                                        })}
                                    </motion.svg>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                {pos === null ? "" : `Position ${Math.round(pos * 100)} percent`}
            </span>
          </div>
        </MotionConfig>
    )
}

addPropertyControls(DistributionChart, {
    series: {
        type: ControlType.Array,
        title: "Series",
        maxCount: 4,
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, title: "Label", defaultValue: "Series" },
                center: { type: ControlType.Number, title: "Center", defaultValue: 50, min: 0, max: 100 },
                spread: { type: ControlType.Number, title: "Spread", defaultValue: 20, min: 2, max: 60 },
                peak: { type: ControlType.Number, title: "Peak", defaultValue: 50, min: 0, max: 100 },
                shape: { type: ControlType.Number, title: "Shape", defaultValue: 2, min: 2, max: 10, step: 0.5 },
            },
        },
        defaultValue: SAMPLE,
    },
    layout: {
        type: ControlType.Enum,
        title: "Layout",
        options: ["split", "overlay"],
        optionTitles: ["Side by side", "Overlaid"],
        defaultValue: "split",
    },
    reflection: { type: ControlType.Boolean, title: "Reflection", defaultValue: true },
    grid: { type: ControlType.Boolean, title: "Grid", defaultValue: true },
    animate: { type: ControlType.Boolean, title: "Animate", defaultValue: true },
    height: { type: ControlType.Number, title: "Height", defaultValue: 300, min: 160, max: 560 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    secondary: { type: ControlType.Color, title: "Second curve", defaultValue: "#4fa8dc" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 6, min: 0, max: 20 },
})

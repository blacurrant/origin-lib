import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * LayeredStack: a deck of glass layers that sit compressed under a slight
 * perspective tilt. Hover (or focus) fans them out with a staggered spring so
 * every title can be read, and leaving collapses them again. Click a layer to
 * bring it to the front. Layers are generated gradients, nothing is fetched.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 310
 */

type Theme = "dark" | "light"

interface Layer {
    title: string
    subtitle: string
    color: string
}

interface LayeredStackProps {
    items: Layer[]
    spread: number
    perspective: number
    accent: string
    theme: Theme
    radius: number
}

const SAMPLE: Layer[] = [
    { title: "Overview", subtitle: "Everything at a glance", color: "#fa7319" },
    { title: "Analytics", subtitle: "Trends and cohorts", color: "#7c5cff" },
    { title: "Automations", subtitle: "Rules that run themselves", color: "#12a5c8" },
    { title: "Audience", subtitle: "Who is showing up", color: "#d946a8" },
    { title: "Archive", subtitle: "Everything shipped so far", color: "#2f9e6e" },
]

const FALLBACK = ["#fa7319", "#7c5cff", "#12a5c8", "#d946a8", "#2f9e6e", "#d9a21b", "#e0524a", "#4a7bd9"]

function palette(theme: Theme) {
    return theme === "light"
        ? { text: "#141413", soft: "#5c5a55", shadow: "rgba(20,20,19,0.32)" }
        : { text: "#f7f7f7", soft: "#b7b7b8", shadow: "rgba(0,0,0,0.65)" }
}

const CARD_H = 140

export default function LayeredStack({
    items = SAMPLE,
    spread = 40,
    perspective = 900,
    accent = "#fa7319",
    theme = "dark",
    radius = 16,
}: Partial<LayeredStackProps>) {
    const p = palette(theme)
    const n = items.length
    const [order, setOrder] = React.useState<number[]>(() => items.map((_, i) => i))
    const [hover, setHover] = React.useState(false)
    const [focused, setFocused] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(-1)
    const open = hover || focused

    // Keep the order valid when the item list changes.
    const safeOrder = React.useMemo(() => {
        const kept = order.filter((i) => i < n)
        for (let i = 0; i < n; i++) if (!kept.includes(i)) kept.push(i)
        return kept
    }, [order, n])

    const bringToFront = (i: number) => setOrder([i, ...safeOrder.filter((x) => x !== i)])

    const step = Math.max(8, Math.min(spread, 90))
    const closedStep = Math.min(11, step * 0.45)
    const frontTop = Math.max(0, n - 1) * step
    const height = CARD_H + frontTop

    return (
        <MotionConfig reducedMotion="user">
            <div
                role="group"
                aria-label="Layered stack. Hover to fan out the layers, click a layer to bring it to the front."
                onPointerEnter={() => setHover(true)}
                onPointerLeave={() => setHover(false)}
                onFocus={(e) => {
                    if ((e.target as HTMLElement).matches(":focus-visible")) setFocused(true)
                }}
                onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
                    setFocusVisible(-1)
                }}
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 360,
                    height,
                    margin: "0 auto",
                    perspective,
                    perspectiveOrigin: "50% 40%",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                {items.map((item, i) => {
                    const pos = safeOrder.indexOf(i)
                    const isFront = pos === 0
                    const color = item.color || FALLBACK[i % FALLBACK.length]
                    const y = frontTop - pos * (open ? step : closedStep)
                    const scale = open ? 1 - pos * 0.018 : 1 - pos * 0.045
                    const dim = open ? Math.min(0.5, pos * 0.07) : Math.min(0.62, pos * 0.15)
                    const delay = open ? pos * 0.04 : (n - 1 - pos) * 0.022
                    return (
                        <motion.button
                            key={i}
                            type="button"
                            onClick={() => bringToFront(i)}
                            onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible") ? i : -1)}
                            aria-label={`${item.title}. ${item.subtitle}`}
                            aria-current={isFront ? "true" : undefined}
                            initial={false}
                            animate={{ y, scale, rotateX: open ? 8 : 12 }}
                            whileTap={{ scale: scale * 0.985 }}
                            transition={{ type: "spring", stiffness: 240, damping: 22, mass: 0.9, delay }}
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                display: "block",
                                width: "100%",
                                height: CARD_H,
                                zIndex: n - pos,
                                transformOrigin: "50% 0%",
                                padding: 0,
                                margin: 0,
                                textAlign: "left",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                color: "#ffffff",
                                borderRadius: radius,
                                borderWidth: 1,
                                borderStyle: "solid",
                                borderColor: isFront ? `color-mix(in srgb, ${accent} 70%, rgba(255,255,255,0.4))` : "rgba(255,255,255,0.2)",
                                background: `linear-gradient(150deg, color-mix(in srgb, ${color} 88%, #ffffff) 0%, ${color} 38%, color-mix(in srgb, ${color} 52%, #05050a) 100%)`,
                                boxShadow: `0 -10px 26px -14px ${p.shadow}, inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -24px 40px -28px rgba(0,0,0,0.5)`,
                                outline: focusVisible === i ? `2px solid ${accent}` : "none",
                                outlineOffset: 3,
                                overflow: "hidden",
                                boxSizing: "border-box",
                                WebkitTapHighlightColor: "transparent",
                            }}
                        >
                            {/* glass sheen */}
                            <span
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background:
                                        "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.32), rgba(255,255,255,0) 55%), linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 30%)",
                                    pointerEvents: "none",
                                }}
                            />
                            {/* title strip: always readable once fanned */}
                            <span
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    height: Math.max(30, Math.min(step, 40)),
                                    padding: "0 16px",
                                    boxSizing: "border-box",
                                }}
                            >
                                <span
                                    aria-hidden
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        letterSpacing: "0.04em",
                                        opacity: 0.7,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em", textShadow: "0 1px 8px rgba(0,0,0,0.25)" }}>
                                    {item.title}
                                </span>
                                <span
                                    style={{
                                        marginLeft: "auto",
                                        fontSize: 12,
                                        opacity: 0.78,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {item.subtitle}
                                </span>
                            </span>
                            {/* body art, only seen on the front layer */}
                            <span aria-hidden style={{ position: "absolute", left: 16, right: 16, top: 52, display: "grid", gap: 8 }}>
                                {[0.72, 0.5, 0.62].map((w, k) => (
                                    <span
                                        key={k}
                                        style={{ display: "block", height: 8, width: `${w * 100}%`, borderRadius: 4, background: "rgba(255,255,255,0.26)" }}
                                    />
                                ))}
                            </span>
                            <span
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    right: -26,
                                    bottom: -44,
                                    width: 130,
                                    height: 130,
                                    borderRadius: "50%",
                                    background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0.08) 62%, rgba(255,255,255,0) 72%)",
                                }}
                            />
                            {isFront && (
                                <span
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        left: 16,
                                        bottom: 14,
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: accent,
                                        boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 30%, transparent), 0 0 14px ${accent}`,
                                    }}
                                />
                            )}
                            {/* depth dimming */}
                            <motion.span
                                aria-hidden
                                initial={false}
                                animate={{ opacity: dim }}
                                transition={{ duration: 0.2, delay }}
                                style={{ position: "absolute", inset: 0, background: "#050509", pointerEvents: "none" }}
                            />
                        </motion.button>
                    )
                })}
            </div>
        </MotionConfig>
    )
}

addPropertyControls(LayeredStack, {
    items: {
        type: ControlType.Array,
        title: "Layers",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Layer" },
                subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "" },
                color: { type: ControlType.Color, title: "Color", defaultValue: "#fa7319" },
            },
        },
        defaultValue: SAMPLE,
    },
    spread: { type: ControlType.Number, title: "Spread", defaultValue: 40, min: 24, max: 80, step: 1, unit: "px" },
    perspective: { type: ControlType.Number, title: "Perspective", defaultValue: 900, min: 300, max: 2000, step: 10 },
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

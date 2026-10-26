import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import {
    MotionConfig,
    animate,
    motion,
    useAnimationControls,
    useMotionValue,
    useReducedMotion,
    useSpring,
    useTransform,
} from "framer-motion"
import type { AnimationPlaybackControls, MotionValue } from "framer-motion"

/**
 * Dock: a frosted glass dock. Icon tiles magnify with a smooth distance
 * falloff as the pointer moves along the row, the hovered one gets a label,
 * a click makes it bounce, and running items get a small dot.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 170
 */

type Theme = "dark" | "light"
type Glyph = "compass" | "mail" | "music" | "camera" | "calendar" | "settings" | "chat" | "folder"

interface DockItemData {
    label: string
    glyph: Glyph
}

interface DockProps {
    items: DockItemData[]
    baseSize: number
    magnification: number
    distance: number
    accent: string
    theme: Theme
    radius: number
}

const SAMPLE: DockItemData[] = [
    { label: "Explore", glyph: "compass" },
    { label: "Mail", glyph: "mail" },
    { label: "Music", glyph: "music" },
    { label: "Camera", glyph: "camera" },
    { label: "Calendar", glyph: "calendar" },
    { label: "Settings", glyph: "settings" },
]

const GLYPH_OPTIONS: Glyph[] = ["compass", "mail", "music", "camera", "calendar", "settings", "chat", "folder"]

function palette(theme: Theme) {
    return theme === "light"
        ? {
              bar: "rgba(255,255,255,0.58)",
              border: "rgba(20,20,19,0.1)",
              barShadow: "0 14px 36px rgba(60,40,20,0.2), inset 0 1px 0 rgba(255,255,255,0.8)",
              tip: "#141413",
              tipText: "#f7f7f7",
              dot: "#141413",
          }
        : {
              bar: "rgba(255,255,255,0.09)",
              border: "rgba(255,255,255,0.16)",
              barShadow: "0 16px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
              tip: "#f7f7f7",
              tipText: "#141413",
              dot: "#f7f7f7",
          }
}

function tileColors(glyph: Glyph, accent: string): [string, string] {
    switch (glyph) {
        case "compass":
            return [`color-mix(in srgb, ${accent} 80%, #ffffff)`, `color-mix(in srgb, ${accent} 78%, #3a1200)`]
        case "mail":
            return ["#5aaeff", "#2262e6"]
        case "music":
            return ["#ff6d86", "#d11f4d"]
        case "camera":
            return ["#9aa0aa", "#4a4e57"]
        case "calendar":
            return ["#46d98a", "#139155"]
        case "settings":
            return ["#9a82ff", "#5638d8"]
        case "chat":
            return ["#3fd6c4", "#12877f"]
        default:
            return ["#ffc65a", "#e0881a"]
    }
}

function GlyphIcon({ glyph }: { glyph: Glyph }) {
    const common = {
        fill: "none",
        stroke: "#ffffff",
        strokeWidth: 1.7,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    }
    let body: React.ReactNode
    switch (glyph) {
        case "compass":
            body = (
                <>
                    <circle cx="12" cy="12" r="8.5" {...common} />
                    <path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z" {...common} fill="#ffffff" fillOpacity="0.9" />
                </>
            )
            break
        case "mail":
            body = (
                <>
                    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" {...common} />
                    <path d="M4.5 7.5l7.5 6 7.5-6" {...common} />
                </>
            )
            break
        case "music":
            body = (
                <>
                    <path d="M9 17.5V6.5l9-2v11" {...common} />
                    <circle cx="6.8" cy="17.6" r="2.4" {...common} fill="#ffffff" fillOpacity="0.9" />
                    <circle cx="15.8" cy="15.6" r="2.4" {...common} fill="#ffffff" fillOpacity="0.9" />
                </>
            )
            break
        case "camera":
            body = (
                <>
                    <path d="M4 8.5a2 2 0 0 1 2-2h2.2l1.2-1.8h5.2l1.2 1.8H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" {...common} />
                    <circle cx="12" cy="12.6" r="3.3" {...common} />
                </>
            )
            break
        case "calendar":
            body = (
                <>
                    <rect x="4" y="5.5" width="16" height="14" rx="2.5" {...common} />
                    <path d="M4 10h16M8.5 3.8v3.4M15.5 3.8v3.4" {...common} />
                    <circle cx="9" cy="14" r="0.9" fill="#ffffff" />
                    <circle cx="12.2" cy="14" r="0.9" fill="#ffffff" />
                    <circle cx="15.4" cy="14" r="0.9" fill="#ffffff" />
                </>
            )
            break
        case "settings":
            body = (
                <>
                    <path d="M4.5 7.5h8M17.5 7.5h2M4.5 16.5h2M11.5 16.5h8" {...common} />
                    <circle cx="15" cy="7.5" r="2.4" {...common} />
                    <circle cx="9" cy="16.5" r="2.4" {...common} />
                </>
            )
            break
        case "chat":
            body = <path d="M5 6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H11l-4.5 3.5V16H7a2 2 0 0 1-2-2z" {...common} />
            break
        default:
            body = <path d="M3.8 7.5a2 2 0 0 1 2-2h3.6l2 2.4h6.8a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2z" {...common} />
    }
    return (
        <svg viewBox="0 0 24 24" width="56%" height="56%" aria-hidden style={{ display: "block", overflow: "visible" }}>
            {body}
        </svg>
    )
}

const FAR = -100000

interface DockTileProps {
    item: DockItemData
    mouseX: MotionValue<number>
    base: number
    mag: number
    distance: number
    active: boolean
    shown: boolean
    accent: string
    p: ReturnType<typeof palette>
    onHover: () => void
    onClick: () => void
    onFocusTile: (visible: boolean) => void
}

function DockTile({ item, mouseX, base, mag, distance, active, shown, accent, p, onHover, onClick, onFocusTile }: DockTileProps) {
    const ref = React.useRef<HTMLDivElement | null>(null)
    const bounce = useAnimationControls()
    const [focusVisible, setFocusVisible] = React.useState(false)
    const target = useTransform(mouseX, (x) => {
        const el = ref.current
        if (!el || x <= FAR / 2) return base
        const r = el.getBoundingClientRect()
        const d = Math.abs(x - (r.left + r.width / 2))
        if (d >= distance) return base
        const f = (1 + Math.cos((Math.PI * d) / distance)) / 2
        return base * (1 + (mag - 1) * f)
    })
    const size = useSpring(target, { stiffness: 380, damping: 28, mass: 0.5 })
    const [c1, c2] = tileColors(item.glyph, accent)

    const press = () => {
        bounce.start({
            y: [0, -26, 0, -11, 0],
            transition: { duration: 0.8, times: [0, 0.26, 0.52, 0.76, 1], ease: ["easeOut", "easeIn", "easeOut", "easeIn"] },
        })
        onClick()
    }

    return (
        <motion.div ref={ref} style={{ position: "relative", width: size, height: size, flex: "none" }}>
            <motion.div
                initial={false}
                animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 6, scale: shown ? 1 : 0.92 }}
                transition={{ type: "spring", stiffness: 520, damping: 32 }}
                aria-hidden
                style={{
                    position: "absolute",
                    left: "50%",
                    bottom: "100%",
                    x: "-50%",
                    marginBottom: 12,
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: p.tip,
                    color: p.tipText,
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
                    zIndex: 5,
                }}
            >
                {item.label}
            </motion.div>
            <motion.button
                type="button"
                aria-label={item.label}
                onClick={press}
                onPointerEnter={onHover}
                onFocus={(e) => {
                    const v = e.currentTarget.matches(":focus-visible")
                    setFocusVisible(v)
                    onFocusTile(v)
                }}
                onBlur={() => {
                    setFocusVisible(false)
                    onFocusTile(false)
                }}
                animate={bounce}
                whileTap={{ scale: 0.94 }}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    padding: 0,
                    border: "none",
                    borderRadius: "23%",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    background: `linear-gradient(160deg, ${c1}, ${c2})`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.28)",
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: 3,
                    fontFamily: "inherit",
                }}
            >
                <GlyphIcon glyph={item.glyph} />
            </motion.button>
            <motion.span
                aria-hidden
                initial={false}
                animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.3 }}
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "100%",
                    marginTop: 4,
                    width: 4,
                    height: 4,
                    marginLeft: -2,
                    borderRadius: "50%",
                    background: accent,
                    boxShadow: `0 0 6px ${accent}`,
                }}
            />
        </motion.div>
    )
}

export default function Dock({
    items = SAMPLE,
    baseSize = 52,
    magnification = 1.7,
    distance = 140,
    accent = "#fa7319",
    theme = "dark",
    radius = 24,
}: Partial<DockProps>) {
    const p = palette(theme)
    const reduce = useReducedMotion()
    const mouseX = useMotionValue(FAR)
    const barRef = React.useRef<HTMLDivElement | null>(null)
    const intro = React.useRef<AnimationPlaybackControls | null>(null)
    const [hovered, setHovered] = React.useState<number | null>(null)
    const [running, setRunning] = React.useState<number[]>([0, 2])

    // One gentle sweep on mount so the magnification reads right away.
    React.useEffect(() => {
        if (reduce) return
        const timer = window.setTimeout(() => {
            const el = barRef.current
            if (!el) return
            const r = el.getBoundingClientRect()
            intro.current = animate(mouseX, [r.left + 20, r.right - 20], {
                duration: 1.5,
                ease: [0.45, 0, 0.35, 1],
                onComplete: () => mouseX.set(FAR),
            })
        }, 700)
        return () => {
            window.clearTimeout(timer)
            intro.current?.stop()
        }
    }, [reduce, mouseX])

    const stopIntro = () => {
        intro.current?.stop()
        intro.current = null
    }

    const base = Math.max(24, baseSize)
    const mag = Math.max(1, magnification)
    const list = items.length > 0 ? items : SAMPLE

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: Math.round(base * mag) + 80,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: 14,
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                }}
            >
                <div
                    ref={barRef}
                    onPointerMove={(e) => {
                        if (reduce) return
                        stopIntro()
                        mouseX.set(e.clientX)
                    }}
                    onPointerLeave={() => {
                        mouseX.set(FAR)
                        setHovered(null)
                    }}
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 8,
                        height: base + 28,
                        boxSizing: "border-box",
                        padding: "0 12px 14px",
                        borderRadius: radius,
                        background: p.bar,
                        border: `1px solid ${p.border}`,
                        boxShadow: p.barShadow,
                        backdropFilter: "blur(22px) saturate(170%)",
                        WebkitBackdropFilter: "blur(22px) saturate(170%)",
                        touchAction: "pan-y",
                    }}
                >
                    {list.map((item, i) => (
                        <DockTile
                            key={`${item.label}-${i}`}
                            item={item}
                            mouseX={mouseX}
                            base={base}
                            mag={reduce ? 1 : mag}
                            distance={Math.max(40, distance)}
                            active={running.includes(i)}
                            shown={hovered === i}
                            accent={accent}
                            p={p}
                            onHover={() => setHovered(i)}
                            onFocusTile={(v) => setHovered(v ? i : null)}
                            onClick={() => setRunning((r) => (r.includes(i) ? r : [...r, i]))}
                        />
                    ))}
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(Dock, {
    items: {
        type: ControlType.Array,
        title: "Items",
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, title: "Label", defaultValue: "App" },
                glyph: {
                    type: ControlType.Enum,
                    title: "Glyph",
                    options: GLYPH_OPTIONS,
                    optionTitles: ["Compass", "Mail", "Music", "Camera", "Calendar", "Settings", "Chat", "Folder"],
                    defaultValue: "compass",
                },
            },
        },
        defaultValue: SAMPLE as any,
    },
    baseSize: { type: ControlType.Number, title: "Base size", defaultValue: 52, min: 32, max: 80, step: 1 },
    magnification: { type: ControlType.Number, title: "Magnify", defaultValue: 1.7, min: 1, max: 2.5, step: 0.05 },
    distance: { type: ControlType.Number, title: "Distance", defaultValue: 140, min: 60, max: 300, step: 5 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 24, min: 0, max: 40, step: 1 },
})

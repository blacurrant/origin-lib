import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion"

/**
 * Tilt: a card that leans in 3D toward the pointer on springs, with a moving
 * specular glare and layered depth. The title, subtitle and badge float at
 * different heights above generated gradient art. It eases flat on leave and
 * does not tilt for reduced motion.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 320
 */

type Theme = "dark" | "light"

interface TiltProps {
    strength: number
    glare: number
    title: string
    subtitle: string
    badge: string
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme, accent: string) {
    return theme === "light"
        ? {
              a: `color-mix(in srgb, ${accent} 78%, #ffffff)`,
              b: accent,
              c: `color-mix(in srgb, ${accent} 40%, #4a1a3a)`,
              ink: "#fffaf5",
              shadow: "rgba(70, 40, 10, 0.28)",
          }
        : {
              a: accent,
              b: `color-mix(in srgb, ${accent} 45%, #2a0f3a)`,
              c: "#12101a",
              ink: "#ffffff",
              shadow: "rgba(0, 0, 0, 0.6)",
          }
}

const SPRING = { stiffness: 220, damping: 20, mass: 0.7 }

export default function Tilt({
    strength = 14,
    glare = 0.45,
    title = "Aurora Pass",
    subtitle = "Move your pointer across the card",
    badge = "Limited",
    accent = "#fa7319",
    theme = "dark",
    radius = 22,
}: Partial<TiltProps>) {
    const p = palette(theme, accent)
    const reduce = useReducedMotion()

    // Pointer position inside the card, from -0.5 to 0.5 on each axis.
    const px = useMotionValue(0)
    const py = useMotionValue(0)
    const sx = useSpring(px, SPRING)
    const sy = useSpring(py, SPRING)
    const hover = useSpring(0, { stiffness: 260, damping: 28 })

    const rotateX = useTransform(sy, [-0.5, 0.5], [strength, -strength])
    const rotateY = useTransform(sx, [-0.5, 0.5], [-strength, strength])
    const scale = useTransform(hover, [0, 1], [1, 1.035])

    // Glare follows the pointer, art layers shift against it for parallax.
    const gx = useTransform(sx, [-0.5, 0.5], [0, 100])
    const gy = useTransform(sy, [-0.5, 0.5], [0, 100])
    const glareAlpha = useTransform(hover, (h) => h * Math.max(0, Math.min(1, glare)))
    const glareBg = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,${glareAlpha}) 0%, rgba(255,255,255,0) 52%)`
    const sheenOpacity = useTransform(hover, [0, 1], [0.0, 0.5])
    const sheenPos = useTransform(sx, [-0.5, 0.5], [-30, 130])
    const sheenBg = useMotionTemplate`linear-gradient(115deg, rgba(255,255,255,0) ${sheenPos}%, rgba(255,255,255,0.22) calc(${sheenPos}% + 10%), rgba(255,255,255,0) calc(${sheenPos}% + 24%))`
    const artX = useTransform(sx, [-0.5, 0.5], [10, -10])
    const artY = useTransform(sy, [-0.5, 0.5], [10, -10])
    const shadowX = useTransform(sx, [-0.5, 0.5], [strength * 1.6, -strength * 1.6])
    const shadowY = useTransform(sy, [-0.5, 0.5], [strength * 1.6 + 18, -strength * 1.6 + 18])
    const shadow = useMotionTemplate`${shadowX}px ${shadowY}px 46px -6px ${p.shadow}`

    const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (reduce) return
        const r = e.currentTarget.getBoundingClientRect()
        px.set((e.clientX - r.left) / Math.max(1, r.width) - 0.5)
        py.set((e.clientY - r.top) / Math.max(1, r.height) - 0.5)
        hover.set(1)
    }
    const onLeave = () => {
        px.set(0)
        py.set(0)
        hover.set(0)
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    maxWidth: 300,
                    height: 320,
                    boxSizing: "border-box",
                    padding: 10,
                    perspective: 900,
                    fontFamily: "inherit",
                }}
            >
                <div
                    onPointerMove={onMove}
                    onPointerEnter={onMove}
                    onPointerLeave={onLeave}
                    onPointerCancel={onLeave}
                    style={{ width: "100%", height: "100%", touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none" }}
                >
                    <motion.div
                        style={{
                            position: "relative",
                            width: "100%",
                            height: "100%",
                            rotateX,
                            rotateY,
                            scale,
                            transformStyle: "preserve-3d",
                            willChange: "transform",
                        }}
                    >
                        {/* Art plane */}
                        <motion.div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: radius,
                                overflow: "hidden",
                                boxShadow: shadow,
                                background: `linear-gradient(155deg, ${p.a} 0%, ${p.b} 52%, ${p.c} 100%)`,
                            }}
                        >
                            <motion.svg
                                aria-hidden
                                viewBox="0 0 280 300"
                                preserveAspectRatio="xMidYMid slice"
                                style={{ position: "absolute", inset: -14, width: "calc(100% + 28px)", height: "calc(100% + 28px)", x: artX, y: artY }}
                            >
                                <defs>
                                    <radialGradient id="tilt-orb" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                                        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.18" />
                                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                    </radialGradient>
                                </defs>
                                <circle cx="190" cy="92" r="74" fill="url(#tilt-orb)" />
                                {[44, 74, 104, 134].map((r, i) => (
                                    <circle
                                        key={r}
                                        cx="190"
                                        cy="92"
                                        r={r}
                                        fill="none"
                                        stroke="#ffffff"
                                        strokeOpacity={0.28 - i * 0.05}
                                        strokeWidth="1"
                                    />
                                ))}
                                <path d="M-10 238 C 50 196, 96 252, 156 214 S 250 190, 300 224 L 300 320 L -10 320 Z" fill="#000000" fillOpacity="0.2" />
                                <path d="M-10 262 C 40 232, 100 276, 166 246 S 256 232, 300 256 L 300 320 L -10 320 Z" fill="#000000" fillOpacity="0.28" />
                            </motion.svg>
                            <div
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)",
                                }}
                            />
                            <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: sheenBg, opacity: sheenOpacity }} />
                            <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: glareBg, mixBlendMode: "soft-light" }} />
                            <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: glareBg, opacity: 0.55 }} />
                            <div
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: radius,
                                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
                                }}
                            />
                        </motion.div>

                        {/* Floating layers */}
                        <div
                            style={{
                                position: "absolute",
                                top: 18,
                                left: 18,
                                transform: "translateZ(70px)",
                                padding: "5px 11px",
                                borderRadius: 999,
                                background: "rgba(10,10,12,0.42)",
                                backdropFilter: "blur(8px)",
                                WebkitBackdropFilter: "blur(8px)",
                                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
                                color: p.ink,
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                pointerEvents: "none",
                            }}
                        >
                            {badge}
                        </div>
                        <div
                            style={{
                                position: "absolute",
                                left: 22,
                                right: 22,
                                bottom: 54,
                                transform: "translateZ(54px)",
                                color: p.ink,
                                fontSize: 28,
                                fontWeight: 700,
                                lineHeight: 1.08,
                                letterSpacing: "-0.02em",
                                textShadow: "0 2px 14px rgba(0,0,0,0.35)",
                                pointerEvents: "none",
                            }}
                        >
                            {title}
                        </div>
                        <div
                            style={{
                                position: "absolute",
                                left: 22,
                                right: 22,
                                bottom: 22,
                                transform: "translateZ(30px)",
                                color: p.ink,
                                opacity: 0.82,
                                fontSize: 13,
                                lineHeight: 1.4,
                                pointerEvents: "none",
                            }}
                        >
                            {subtitle}
                        </div>
                    </motion.div>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(Tilt, {
    strength: { type: ControlType.Number, title: "Strength", defaultValue: 14, min: 0, max: 30, step: 1 },
    glare: { type: ControlType.Number, title: "Glare", defaultValue: 0.45, min: 0, max: 1, step: 0.05 },
    title: { type: ControlType.String, title: "Title", defaultValue: "Aurora Pass" },
    subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "Move your pointer across the card" },
    badge: { type: ControlType.String, title: "Badge", defaultValue: "Limited" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 22, min: 0, max: 40, step: 1 },
})

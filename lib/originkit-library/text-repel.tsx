import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion"
import type { MotionValue } from "framer-motion"

/**
 * TextRepel: large type where every letter is pushed away from the pointer
 * inside a radius, then springs back when the pointer leaves. Each letter has
 * its own spring driven by motion values (no React state per frame). Until the
 * pointer arrives a ghost cursor sweeps through the text so the effect is
 * visible at a glance. Reduced motion renders plain static text.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 260
 */

type Theme = "dark" | "light"

interface TextRepelProps {
    text: string
    radius: number
    strength: number
    fontSize: number
    weight: number
    demo: boolean
    accent: string
    theme: Theme
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#f4f2ee", line: "#e4e1db", text: "#141413", faint: "#76736d" }
        : { surface: "#0e0e0f", line: "#2d2d2f", text: "#f7f7f7", faint: "#8a8c8f" }
}

interface LetterHandle {
    el: HTMLSpanElement
    x: MotionValue<number>
    y: MotionValue<number>
    r: MotionValue<number>
}

interface LetterProps {
    char: string
    index: number
    reg: (i: number, h: LetterHandle | null) => void
    accent: string
}

const SPRING = { stiffness: 230, damping: 15, mass: 0.55 }

function Letter({ char, index, reg, accent }: LetterProps) {
    const ref = React.useRef<HTMLSpanElement | null>(null)
    const x = useSpring(0, SPRING)
    const y = useSpring(0, SPRING)
    const r = useSpring(0, SPRING)
    const heat = useTransform([x, y], (v) => Math.min(1, Math.hypot(v[0] as number, v[1] as number) / 40))
    const scale = useTransform(heat, (h) => 1 + h * 0.12)
    const baseOpacity = useTransform(heat, (h) => 1 - h)
    React.useEffect(() => {
        if (ref.current) reg(index, { el: ref.current, x, y, r })
        return () => reg(index, null)
    }, [index, reg, x, y, r])
    return (
        <motion.span
            ref={ref}
            aria-hidden
            style={{ position: "relative", display: "inline-block", x, y, rotate: r, scale, willChange: "transform" }}
        >
            <motion.span aria-hidden style={{ display: "inline-block", opacity: baseOpacity }}>
                {char}
            </motion.span>
            <motion.span aria-hidden style={{ position: "absolute", left: 0, top: 0, color: accent, opacity: heat }}>
                {char}
            </motion.span>
        </motion.span>
    )
}

export default function TextRepel({
    text = "Push me away",
    radius = 120,
    strength = 52,
    fontSize = 76,
    weight = 700,
    demo = true,
    accent = "#fa7319",
    theme = "dark",
}: Partial<TextRepelProps>) {
    const p = palette(theme)
    const reduce = useReducedMotion()
    const root = React.useRef<HTMLDivElement | null>(null)
    const handles = React.useRef<Array<LetterHandle | null>>([])
    const wrap = React.useRef<HTMLDivElement | null>(null)
    const hovering = React.useRef(false)
    const mx = useMotionValue(0)
    const my = useMotionValue(0)
    const sx = useSpring(mx, { stiffness: 260, damping: 28 })
    const sy = useSpring(my, { stiffness: 260, damping: 28 })
    const glow = useMotionValue(0)
    const glowBg = useMotionTemplate`radial-gradient(circle ${radius}px at ${sx}px ${sy}px, color-mix(in srgb, ${accent} 24%, transparent), transparent 70%)`

    const reg = React.useCallback((i: number, h: LetterHandle | null) => {
        handles.current[i] = h
    }, [])

    const push = React.useCallback(
        (px: number, py: number) => {
            const hs = handles.current
            const ox = wrap.current?.offsetLeft ?? 0
            const oy = wrap.current?.offsetTop ?? 0
            for (let i = 0; i < hs.length; i++) {
                const h = hs[i]
                if (!h) continue
                const cx = ox + h.el.offsetLeft + h.el.offsetWidth / 2
                const cy = oy + h.el.offsetTop + h.el.offsetHeight / 2
                const dx = cx - px
                const dy = cy - py
                const d = Math.hypot(dx, dy)
                if (d < radius && d > 0.001) {
                    const f = Math.pow(1 - d / radius, 1.4)
                    const vy = dy * 1.3 + (dy >= 0 ? 1 : -1) * Math.abs(dx) * 0.3
                    const vl = Math.hypot(dx, vy) || 1
                    h.x.set((dx / vl) * f * strength)
                    h.y.set((vy / vl) * f * strength)
                    h.r.set((dx / radius) * f * 38)
                } else {
                    h.x.set(0)
                    h.y.set(0)
                    h.r.set(0)
                }
            }
        },
        [radius, strength]
    )

    const relax = React.useCallback(() => {
        for (const h of handles.current) {
            if (!h) continue
            h.x.set(0)
            h.y.set(0)
            h.r.set(0)
        }
    }, [])

    const local = (e: React.PointerEvent) => {
        const rect = e.currentTarget.getBoundingClientRect()
        return [e.clientX - rect.left, e.clientY - rect.top] as const
    }

    const onMove = (e: React.PointerEvent) => {
        const [px, py] = local(e)
        if (!hovering.current) {
            hovering.current = true
            sx.jump(px)
            sy.jump(py)
            animate(glow, 1, { duration: 0.18 })
        }
        mx.set(px)
        my.set(py)
        push(px, py)
    }

    const onLeave = () => {
        hovering.current = false
        animate(glow, 0, { duration: 0.3 })
        relax()
    }

    // ghost cursor so the effect shows without a pointer
    React.useEffect(() => {
        if (reduce || !demo) return
        const el = root.current
        if (!el) return
        let raf = 0
        let visible = true
        const t0 = performance.now()
        let io: IntersectionObserver | null = null
        if (typeof IntersectionObserver !== "undefined") {
            io = new IntersectionObserver((entries) => {
                visible = entries[0]?.isIntersecting ?? true
            })
            io.observe(el)
        }
        const tick = () => {
            raf = requestAnimationFrame(tick)
            if (hovering.current || !visible) return
            const t = (performance.now() - t0) / 1000
            const w = el.offsetWidth
            const h = el.offsetHeight
            const px = w * (0.5 + 0.34 * Math.sin(t * 0.9))
            const py = h * (0.5 + 0.18 * Math.sin(t * 1.6 + 1))
            mx.set(px)
            my.set(py)
            glow.set(0.55)
            push(px, py)
        }
        raf = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(raf)
            io?.disconnect()
        }
    }, [reduce, demo, push, mx, my, glow])

    // when the demo stops (prop change) make sure letters rest
    React.useEffect(() => {
        if (!demo) {
            glow.set(0)
            relax()
        }
    }, [demo, glow, relax])

    const words = text.split(/\s+/).filter(Boolean)
    let idx = 0
    const textStyle: React.CSSProperties = {
        fontFamily: "inherit",
        fontSize,
        fontWeight: weight,
        lineHeight: 1.04,
        letterSpacing: "-0.035em",
        color: p.text,
        textAlign: "center",
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                ref={root}
                role="img"
                aria-label={text}
                onPointerMove={reduce ? undefined : onMove}
                onPointerDown={reduce ? undefined : onMove}
                onPointerLeave={reduce ? undefined : onLeave}
                onPointerUp={(e) => {
                    if (e.pointerType !== "mouse") onLeave()
                }}
                onPointerCancel={onLeave}
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 640,
                    boxSizing: "border-box",
                    padding: "40px 28px",
                    minHeight: 240,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 18,
                    background: p.surface,
                    border: `1px solid ${p.line}`,
                    overflow: "hidden",
                    touchAction: "pan-y",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    cursor: "default",
                }}
            >
                <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: glowBg, opacity: glow, pointerEvents: "none" }} />
                <div ref={wrap} style={{ position: "relative", ...textStyle }}>
                    {words.map((w, wi) => (
                        <React.Fragment key={wi}>
                            {wi > 0 && " "}
                            <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                                {Array.from(w).map((ch) => {
                                    const i = idx++
                                    return <Letter key={i} char={ch} index={i} reg={reg} accent={accent} />
                                })}
                            </span>
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(TextRepel, {
    text: { type: ControlType.String, title: "Text", defaultValue: "Push me away" },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 120, min: 40, max: 320 },
    strength: { type: ControlType.Number, title: "Strength", defaultValue: 52, min: 10, max: 200 },
    fontSize: { type: ControlType.Number, title: "Font size", defaultValue: 76, min: 24, max: 200 },
    weight: { type: ControlType.Number, title: "Weight", defaultValue: 520, min: 100, max: 900, step: 100 },
    demo: { type: ControlType.Boolean, title: "Ghost cursor", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
})

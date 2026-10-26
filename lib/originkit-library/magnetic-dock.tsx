import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion"
import type { MotionValue } from "framer-motion"

/**
 * MagneticDock: a floating bar of icon buttons. Inside a radius each button is
 * pulled toward the pointer (spring translate and a touch of scale) and snaps
 * back on leave, the bar itself stretches toward the cursor, and a label chip
 * follows the hovered item. Unlike a magnifying dock, buttons move toward the
 * pointer instead of growing by distance. A ghost cursor sweeps the bar until a
 * real pointer arrives.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 200
 */

type Theme = "dark" | "light"
type Glyph = "home" | "search" | "bell" | "mail" | "heart" | "settings" | "user" | "star" | "play" | "folder" | "bolt"

interface DockItem {
    label: string
    icon: Glyph
}

interface MagneticDockProps {
    items: DockItem[]
    strength: number
    radius: number
    demo: boolean
    accent: string
    theme: Theme
}

function palette(theme: Theme) {
    return theme === "light"
        ? {
              surface: "#f1efea",
              bar: "rgba(255,255,255,0.82)",
              barLine: "rgba(20,20,19,0.1)",
              btn: "rgba(20,20,19,0.05)",
              icon: "#4b4944",
              chip: "#141413",
              chipText: "#f7f7f7",
              shadow: "0 14px 28px -12px rgba(20,20,19,0.35)",
          }
        : {
              surface: "#0d0d0e",
              bar: "rgba(36,37,39,0.78)",
              barLine: "rgba(255,255,255,0.09)",
              btn: "rgba(255,255,255,0.055)",
              icon: "#b9bbbe",
              chip: "#f7f7f7",
              chipText: "#141413",
              shadow: "0 18px 34px -14px rgba(0,0,0,0.85)",
          }
}

const GLYPHS: Record<Glyph, React.ReactNode> = {
    home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
        </>
    ),
    bell: (
        <>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </>
    ),
    mail: (
        <>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-10 6L2 7" />
        </>
    ),
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />,
    settings: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
    user: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </>
    ),
    star: <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
    play: <path d="M6 3l14 9-14 9z" />,
    folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    bolt: <path d="M13 2L3 14h9l-1 8 10-12h-9z" />,
}

const SAMPLE: DockItem[] = [
    { label: "Home", icon: "home" },
    { label: "Search", icon: "search" },
    { label: "Alerts", icon: "bell" },
    { label: "Messages", icon: "mail" },
    { label: "Favorites", icon: "heart" },
    { label: "Settings", icon: "settings" },
]

const GLYPH_NAMES = Object.keys(GLYPHS) as Glyph[]

function Icon({ name, color }: { name: Glyph; color: string }) {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -11, marginTop: -11 }}
        >
            {GLYPHS[name] ?? GLYPHS.star}
        </svg>
    )
}

interface ItemHandle {
    el: HTMLButtonElement
    x: MotionValue<number>
    y: MotionValue<number>
    heat: MotionValue<number>
}

const SPRING = { stiffness: 320, damping: 19, mass: 0.6 }
const SIZE = 48

interface ItemProps {
    item: DockItem
    index: number
    reg: (i: number, h: ItemHandle | null) => void
    selected: boolean
    focusVisible: boolean
    accent: string
    iconColor: string
    btnBg: string
    radius: number
    onSelect: (i: number) => void
    onFocusItem: (i: number) => void
    onBlurItem: (i: number) => void
}

function DockButton({ item, index, reg, selected, focusVisible, accent, iconColor, btnBg, radius, onSelect, onFocusItem, onBlurItem }: ItemProps) {
    const ref = React.useRef<HTMLButtonElement | null>(null)
    const x = useSpring(0, SPRING)
    const y = useSpring(0, SPRING)
    const heat = useSpring(0, { stiffness: 260, damping: 24 })
    const scale = useTransform(heat, (h) => 1 + h * 0.12)
    const tintOpacity = useTransform(heat, (h) => h * 0.2 + (selected ? 0.1 : 0))
    const accentIconOpacity = useTransform(heat, (h) => Math.max(h, selected ? 1 : 0))
    React.useEffect(() => {
        if (ref.current) reg(index, { el: ref.current, x, y, heat })
        return () => reg(index, null)
    }, [index, reg, x, y, heat])
    return (
        <motion.button
            ref={ref}
            type="button"
            aria-label={item.label}
            aria-pressed={selected}
            onClick={() => onSelect(index)}
            onFocus={(e) => {
                if (e.currentTarget.matches(":focus-visible")) onFocusItem(index)
            }}
            onBlur={() => onBlurItem(index)}
            whileTap={{ scale: 0.92 }}
            style={{
                position: "relative",
                width: SIZE,
                height: SIZE,
                flex: "none",
                padding: 0,
                border: "none",
                borderRadius: radius,
                background: btnBg,
                cursor: "pointer",
                x,
                y,
                scale,
                outline: focusVisible ? `2px solid ${accent}` : "none",
                outlineOffset: 3,
                fontFamily: "inherit",
                touchAction: "manipulation",
            }}
        >
            <motion.span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: radius, background: accent, opacity: tintOpacity }} />
            <Icon name={item.icon} color={iconColor} />
            <motion.span aria-hidden style={{ position: "absolute", inset: 0, opacity: accentIconOpacity }}>
                <Icon name={item.icon} color={accent} />
            </motion.span>
            {selected && <span aria-hidden style={{ position: "absolute", left: "50%", bottom: 4, width: 4, height: 4, marginLeft: -2, borderRadius: 2, background: accent }} />}
        </motion.button>
    )
}

export default function MagneticDock({
    items = SAMPLE,
    strength = 0.45,
    radius = 120,
    demo = true,
    accent = "#fa7319",
    theme = "dark",
}: Partial<MagneticDockProps>) {
    const p = palette(theme)
    const list = items.length > 0 ? items : SAMPLE
    const reduce = useReducedMotion()
    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const barRef = React.useRef<HTMLDivElement | null>(null)
    const wrapRef = React.useRef<HTMLDivElement | null>(null)
    const barPos = () => ({ x: (wrapRef.current?.offsetLeft ?? 0) + (barRef.current?.offsetLeft ?? 0), y: (wrapRef.current?.offsetTop ?? 0) + (barRef.current?.offsetTop ?? 0) })
    const handles = React.useRef<Array<ItemHandle | null>>([])
    const hovering = React.useRef(false)
    const hoverIdx = React.useRef<number | null>(null)
    const [shown, setShown] = React.useState<number>(0)
    const [hovered, setHovered] = React.useState<number | null>(null)
    const [selected, setSelected] = React.useState<number | null>(null)
    const [focusIdx, setFocusIdx] = React.useState<number | null>(null)

    // bar background: stretches toward the cursor
    const bgX = useSpring(0, { stiffness: 150, damping: 17 })
    const bgY = useSpring(0, { stiffness: 150, damping: 17 })
    const bgSX = useSpring(1, { stiffness: 170, damping: 15 })
    const bgSY = useSpring(1, { stiffness: 170, damping: 15 })
    const originX = useMotionValue(50)
    const originY = useMotionValue(50)
    const origin = useMotionTemplate`${originX}% ${originY}%`
    const gx = useSpring(0, { stiffness: 300, damping: 30 })
    const gy = useSpring(0, { stiffness: 300, damping: 30 })
    const glowO = useSpring(0, { stiffness: 200, damping: 26 })
    const glow = useMotionTemplate`radial-gradient(circle 90px at ${gx}px ${gy}px, color-mix(in srgb, ${accent} 30%, transparent), transparent 70%)`
    const chipX = useSpring(0, { stiffness: 260, damping: 26 })

    const reg = React.useCallback((i: number, h: ItemHandle | null) => {
        handles.current[i] = h
    }, [])

    const relax = React.useCallback(() => {
        for (const h of handles.current) {
            if (!h) continue
            h.x.set(0)
            h.y.set(0)
            h.heat.set(0)
        }
        bgX.set(0)
        bgY.set(0)
        bgSX.set(1)
        bgSY.set(1)
        glowO.set(0)
        hoverIdx.current = null
        setHovered(null)
    }, [bgX, bgY, bgSX, bgSY, glowO])

    // px, py are in root coordinates
    const drive = React.useCallback(
        (px: number, py: number) => {
            const bar = barRef.current
            if (!bar) return
            const bp = barPos()
            const bl = bp.x
            const bt = bp.y
            const bw = bar.offsetWidth
            const bh = bar.offsetHeight
            // distance from pointer to the bar rectangle
            const ox = Math.max(bl - px, 0, px - (bl + bw))
            const oy = Math.max(bt - py, 0, py - (bt + bh))
            const prox = Math.max(0, 1 - Math.hypot(ox, oy) / (radius * 1.3))
            const fx = Math.min(1, Math.max(0, (px - bl) / bw))
            const fy = Math.min(1, Math.max(0, (py - bt) / bh))
            originX.set((1 - fx) * 100)
            originY.set((1 - fy) * 100)
            bgSX.set(1 + 0.09 * prox * (0.4 + Math.abs(fx - 0.5)))
            bgSY.set(1 + 0.16 * prox)
            bgX.set((px - (bl + bw / 2)) * 0.05 * prox)
            bgY.set(Math.max(-7, Math.min(7, (py - (bt + bh / 2)) * 0.2)) * prox)
            gx.set(px - bl)
            gy.set(py - bt)
            glowO.set(prox)

            let best = -1
            let bestD = Infinity
            const hs = handles.current
            for (let i = 0; i < hs.length; i++) {
                const h = hs[i]
                if (!h) continue
                const cx = bl + h.el.offsetLeft + h.el.offsetWidth / 2
                const cy = bt + h.el.offsetTop + h.el.offsetHeight / 2
                const dx = px - cx
                const dy = py - cy
                const d = Math.hypot(dx, dy)
                const f = d < radius ? Math.pow(1 - d / radius, 1.35) : 0
                const mx = dx * strength * f * 0.55
                const my = dy * strength * f
                const m = Math.hypot(mx, my)
                const cap = 20
                const k = m > cap ? cap / m : 1
                h.x.set(mx * k)
                h.y.set(my * k)
                h.heat.set(f)
                if (d < bestD) {
                    bestD = d
                    best = i
                }
            }
            const next = best >= 0 && bestD < SIZE * 0.95 && prox > 0.25 ? best : null
            if (next !== hoverIdx.current) {
                hoverIdx.current = next
                setHovered(next)
                if (next !== null) {
                    setShown(next)
                    const h = hs[next]
                    if (h) chipX.set(h.el.offsetLeft + h.el.offsetWidth / 2)
                }
            }
        },
        [radius, strength, originX, originY, bgSX, bgSY, bgX, bgY, gx, gy, glowO, chipX]
    )

    const local = (e: React.PointerEvent) => {
        const rect = e.currentTarget.getBoundingClientRect()
        return [e.clientX - rect.left, e.clientY - rect.top] as const
    }

    const onMove = (e: React.PointerEvent) => {
        const [px, py] = local(e)
        if (!hovering.current) {
            hovering.current = true
            gx.jump(px - barPos().x)
            gy.jump(py - barPos().y)
        }
        drive(px, py)
    }

    const onLeave = () => {
        hovering.current = false
        relax()
    }

    // ghost cursor
    React.useEffect(() => {
        if (reduce || !demo) return
        const root = rootRef.current
        if (!root) return
        let raf = 0
        let visible = true
        const t0 = performance.now()
        let io: IntersectionObserver | null = null
        if (typeof IntersectionObserver !== "undefined") {
            io = new IntersectionObserver((entries) => {
                visible = entries[0]?.isIntersecting ?? true
            })
            io.observe(root)
        }
        const tick = () => {
            raf = requestAnimationFrame(tick)
            const bar = barRef.current
            if (!bar || hovering.current || !visible || focusIdx !== null) return
            const t = (performance.now() - t0) / 1000
            const bp = barPos()
            const px = bp.x + bar.offsetWidth * (0.5 + 0.56 * Math.sin(t * 0.85))
            const py = bp.y + bar.offsetHeight * (0.58 + 0.34 * Math.sin(t * 1.9))
            drive(px, py)
        }
        raf = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(raf)
            io?.disconnect()
        }
    }, [reduce, demo, drive, focusIdx])

    React.useEffect(() => {
        if (!demo && !hovering.current && focusIdx === null) relax()
    }, [demo, relax, focusIdx])

    const onFocusItem = (i: number) => {
        setFocusIdx(i)
        const bar = barRef.current
        const h = handles.current[i]
        if (!bar || !h) return
        hoverIdx.current = i
        setHovered(i)
        setShown(i)
        chipX.set(h.el.offsetLeft + h.el.offsetWidth / 2)
        const bp = barPos()
        drive(bp.x + h.el.offsetLeft + h.el.offsetWidth / 2, bp.y + h.el.offsetTop + h.el.offsetHeight / 2)
    }

    const onBlurItem = (i: number) => {
        setFocusIdx((f) => (f === i ? null : f))
        if (!hovering.current) relax()
    }

    const chipLabel = list[Math.min(shown, list.length - 1)]?.label ?? ""

    return (
        <MotionConfig reducedMotion="user">
            <div
                ref={rootRef}
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
                    maxWidth: 480,
                    height: 200,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 20,
                    background: `radial-gradient(60% 80% at 50% 50%, color-mix(in srgb, ${accent} 9%, transparent), transparent 75%), ${p.surface}`,
                    fontFamily: "inherit",
                    overflow: "hidden",
                    touchAction: "pan-y",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                }}
            >
                <div ref={wrapRef} style={{ position: "relative", marginTop: -14 }}>
                    <div
                        ref={barRef}
                        role="toolbar"
                        aria-label="Dock"
                        style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 26 }}
                    >
                        <motion.div
                            aria-hidden
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: 26,
                                background: p.bar,
                                boxShadow: `inset 0 0 0 1px ${p.barLine}, ${p.shadow}`,
                                backdropFilter: "blur(14px)",
                                WebkitBackdropFilter: "blur(14px)",
                                overflow: "hidden",
                                x: bgX,
                                y: bgY,
                                scaleX: bgSX,
                                scaleY: bgSY,
                                transformOrigin: origin,
                            }}
                        >
                            <motion.div style={{ position: "absolute", inset: 0, background: glow, opacity: glowO }} />
                        </motion.div>
                        {list.map((it, i) => (
                            <DockButton
                                key={i}
                                item={it}
                                index={i}
                                reg={reg}
                                selected={selected === i}
                                focusVisible={focusIdx === i}
                                accent={accent}
                                iconColor={p.icon}
                                btnBg={p.btn}
                                radius={16}
                                onSelect={(k) => setSelected((s) => (s === k ? null : k))}
                                onFocusItem={onFocusItem}
                                onBlurItem={onBlurItem}
                            />
                        ))}
                    </div>
                    <motion.div aria-hidden style={{ position: "absolute", left: 0, top: "100%", x: chipX, pointerEvents: "none" }}>
                        <div style={{ transform: "translateX(-50%)", display: "inline-block" }}>
                        <motion.div
                            initial={false}
                            animate={{ opacity: hovered !== null ? 1 : 0, y: hovered !== null ? 0 : -5, scale: hovered !== null ? 1 : 0.94 }}
                            transition={{ type: "spring", stiffness: 420, damping: 30 }}
                            style={{
                                marginTop: 14,
                                padding: "5px 10px",
                                borderRadius: 999,
                                background: p.chip,
                                color: p.chipText,
                                fontSize: 12,
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                lineHeight: 1.2,
                                boxShadow: `0 6px 16px -6px rgba(0,0,0,0.5), 0 0 0 1px color-mix(in srgb, ${accent} 50%, transparent)`,
                            }}
                        >
                            {chipLabel}
                        </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(MagneticDock, {
    items: {
        type: ControlType.Array,
        title: "Items",
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, title: "Label", defaultValue: "Item" },
                icon: { type: ControlType.Enum, title: "Icon", options: GLYPH_NAMES, defaultValue: "star" },
            },
        },
        defaultValue: SAMPLE,
    },
    strength: { type: ControlType.Number, title: "Strength", defaultValue: 0.45, min: 0, max: 1, step: 0.05 },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 120, min: 40, max: 300 },
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

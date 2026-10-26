import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion"
import type { MotionValue } from "framer-motion"

/**
 * CoverflowDrag: a drag-first coverflow. The centre card faces front, the
 * cards either side are turned and pushed back, mirrored left and right. Drag
 * with momentum and it springs to the nearest card; click a side card or use
 * the arrow keys to centre it. An optional reflection sits under each card.
 * Cards are generated gradient art, or an image when you provide one.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 330
 */

type Theme = "dark" | "light"

interface CoverItem {
    title: string
    subtitle: string
    color: string
    image: string
}

interface CoverflowDragProps {
    items: CoverItem[]
    angle: number
    reflection: boolean
    accent: string
    theme: Theme
    radius: number
}

const SAMPLE: CoverItem[] = [
    { title: "Golden Hour", subtitle: "Warm light, long shadows", color: "#fa7319", image: "" },
    { title: "Deep Blue", subtitle: "Quiet water at night", color: "#2b7fe0", image: "" },
    { title: "Violet Static", subtitle: "Neon through glass", color: "#8b5cf6", image: "" },
    { title: "Sea Glass", subtitle: "Soft green and salt", color: "#12a58b", image: "" },
    { title: "Rosewater", subtitle: "Pink, slow and dusty", color: "#e0529c", image: "" },
    { title: "Ember", subtitle: "Last coals of the day", color: "#e0524a", image: "" },
    { title: "Citrine", subtitle: "Bright, sharp, honest", color: "#d9a21b", image: "" },
]

const FALLBACK = ["#fa7319", "#2b7fe0", "#8b5cf6", "#12a58b", "#e0529c", "#e0524a", "#d9a21b"]
const CARD_W = 146
const CARD_H = 184
const NEAR = 112 // gap from the centre card to its first neighbour
const FAR = 40 // gap between the following cards
const PX_PER_CARD = 72
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r2 = (v: number) => Math.round(v * 100) / 100

function palette(theme: Theme) {
    return theme === "light"
        ? { text: "#141413", soft: "#5c5a55", faint: "#76736d", shade: "#f3f1ed", shadeMax: 0.55, refl: 0.26, dot: "#cfccc5" }
        : { text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f", shade: "#050509", shadeMax: 0.6, refl: 0.5, dot: "#3a3b3e" }
}

function Art({ item, index, text }: { item: CoverItem; index: number; text: boolean }) {
    const color = item.color || FALLBACK[index % FALLBACK.length]
    const kind = index % 3
    return (
        <span
            aria-hidden
            style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                background: item.image
                    ? `center / cover no-repeat url("${item.image}")`
                    : `linear-gradient(160deg, color-mix(in srgb, ${color} 80%, #ffffff), ${color} 42%, color-mix(in srgb, ${color} 38%, #04040a))`,
            }}
        >
            {!item.image && (
                <>
                    {kind === 0 && (
                        <span
                            style={{
                                position: "absolute",
                                left: "50%",
                                top: "18%",
                                width: "78%",
                                aspectRatio: "1",
                                marginLeft: "-39%",
                                borderRadius: "50%",
                                background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.65), rgba(255,255,255,0.1) 62%, rgba(255,255,255,0) 72%)",
                            }}
                        />
                    )}
                    {kind === 1 && (
                        <span
                            style={{
                                position: "absolute",
                                inset: "-20% -20% 30% -20%",
                                transform: "rotate(-24deg)",
                                background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 10px, rgba(255,255,255,0) 10px 26px)",
                                WebkitMaskImage: "linear-gradient(180deg, #000, transparent)",
                                maskImage: "linear-gradient(180deg, #000, transparent)",
                            }}
                        />
                    )}
                    {kind === 2 && (
                        <>
                            <span
                                style={{
                                    position: "absolute",
                                    left: "-12%",
                                    top: "10%",
                                    width: "70%",
                                    aspectRatio: "1",
                                    borderRadius: "50%",
                                    background: "rgba(255,255,255,0.22)",
                                }}
                            />
                            <span
                                style={{
                                    position: "absolute",
                                    left: "34%",
                                    top: "24%",
                                    width: "70%",
                                    aspectRatio: "1",
                                    borderRadius: "50%",
                                    background: "rgba(255,255,255,0.16)",
                                    boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.35)",
                                }}
                            />
                        </>
                    )}
                </>
            )}
            <span
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 28%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.58))",
                }}
            />
            {text && (
                <span style={{ position: "absolute", left: 12, right: 12, bottom: 11, display: "grid", gap: 1, textAlign: "left", color: "#ffffff" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 650, letterSpacing: "0.08em", opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
                        {String(index + 1).padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 650, letterSpacing: "-0.01em", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>{item.title}</span>
                </span>
            )}
        </span>
    )
}

interface CardProps {
    item: CoverItem
    index: number
    pos: MotionValue<number>
    angle: number
    reflection: boolean
    radius: number
    accent: string
    shade: string
    shadeMax: number
    refl: number
    onPick: (i: number) => void
}

function Card({ item, index, pos, angle, reflection, radius, accent, shade, shadeMax, refl, onPick }: CardProps) {
    const d = useTransform(pos, (p) => index - p)
    const x = useTransform(d, (v) => {
        const a = Math.abs(v)
        return r2(Math.sign(v) * (Math.min(a, 1) * NEAR + Math.max(a - 1, 0) * FAR))
    })
    const z = useTransform(d, (v) => r2(-Math.min(Math.abs(v), 1) * 120))
    const rotateY = useTransform(d, (v) => r2(-clamp(v, -1, 1) * angle))
    const zIndex = useTransform(d, (v) => Math.round(100 - Math.abs(v) * 10))
    const dim = useTransform(d, (v) => r2(Math.min(Math.abs(v), 2) * 0.5 * shadeMax))
    const lit = useTransform(d, (v) => r2(clamp(1 - Math.abs(v) * 1.4, 0, 1)))

    return (
        <motion.div
            onClick={() => onPick(index)}
            style={{
                position: "absolute",
                left: "50%",
                top: 14,
                width: CARD_W,
                height: CARD_H,
                marginLeft: -CARD_W / 2,
                x,
                z,
                rotateY,
                zIndex,
                cursor: "pointer",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: radius,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "rgba(255,255,255,0.2)",
                    boxShadow: "0 14px 28px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.3)",
                    boxSizing: "border-box",
                }}
            >
                <Art item={item} index={index} text />
                <motion.span style={{ position: "absolute", inset: 0, background: shade, opacity: dim, pointerEvents: "none" }} />
                <motion.span
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: radius,
                        boxShadow: `inset 0 0 0 1.5px ${accent}`,
                        opacity: lit,
                        pointerEvents: "none",
                    }}
                />
            </div>
            {reflection && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "100%",
                        marginTop: 5,
                        height: 58,
                        overflow: "hidden",
                        pointerEvents: "none",
                        WebkitMaskImage: `linear-gradient(180deg, rgba(0,0,0,${refl}), rgba(0,0,0,0))`,
                        maskImage: `linear-gradient(180deg, rgba(0,0,0,${refl}), rgba(0,0,0,0))`,
                    }}
                >
                    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: CARD_H, transform: "scaleY(-1)", borderRadius: radius, overflow: "hidden" }}>
                        <Art item={item} index={index} text={false} />
                        <motion.span style={{ position: "absolute", inset: 0, background: shade, opacity: dim }} />
                    </div>
                </div>
            )}
        </motion.div>
    )
}

export default function CoverflowDrag({
    items = SAMPLE,
    angle = 55,
    reflection = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 14,
}: Partial<CoverflowDragProps>) {
    const p = palette(theme)
    const n = Math.max(1, items.length)
    const start = Math.floor((n - 1) / 2)
    const pos = useMotionValue(start)
    const tween = React.useRef<{ stop: () => void } | null>(null)
    const targetRef = React.useRef(start)
    const activeRef = React.useRef(start)
    const drag = React.useRef({ id: -1, x: 0, t: 0, startX: 0, v: 0, active: false, moved: false })
    const [active, setActive] = React.useState(start)
    const [focusVisible, setFocusVisible] = React.useState(false)

    useMotionValueEvent(pos, "change", (v) => {
        const i = clamp(Math.round(v), 0, n - 1)
        if (i !== activeRef.current) {
            activeRef.current = i
            setActive(i)
        }
    })

    React.useEffect(() => () => tween.current?.stop(), [])

    const goTo = React.useCallback(
        (i: number, velocity = 0) => {
            const target = clamp(i, 0, n - 1)
            tween.current?.stop()
            targetRef.current = target
            tween.current = animate(pos, target, {
                type: "spring",
                stiffness: 210,
                damping: 26,
                mass: 0.9,
                velocity,
                onComplete: () => {
                    tween.current = null
                },
            })
        },
        [n, pos]
    )

    // Keep the position valid if the number of cards changes.
    React.useEffect(() => {
        goTo(clamp(targetRef.current, 0, n - 1))
    }, [n, goTo])

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === "mouse") return
        tween.current?.stop()
        tween.current = null
        const d = drag.current
        d.id = e.pointerId
        d.x = e.clientX
        d.startX = e.clientX
        d.t = performance.now()
        d.v = 0
        d.active = false
        d.moved = false
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current
        if (d.id !== e.pointerId) return
        if (!d.active && Math.abs(e.clientX - d.startX) > 5) {
            d.active = true
            d.moved = true
            try {
                e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
                /* not capturable */
            }
        }
        if (!d.active) return
        const now = performance.now()
        const dx = e.clientX - d.x
        const cur = pos.get()
        const delta = -dx / PX_PER_CARD
        let next = cur + delta
        // Rubber band past either end.
        if (next < 0 || next > n - 1) next = cur + delta * 0.35
        pos.set(next)
        const inst = (delta / Math.max(1, now - d.t)) * 1000
        d.v = d.v * 0.6 + inst * 0.4
        d.x = e.clientX
        d.t = now
    }

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current
        if (d.id !== e.pointerId) return
        d.id = -1
        if (!d.active) return
        d.active = false
        const v = performance.now() - d.t > 90 ? 0 : clamp(d.v, -10, 10)
        goTo(Math.round(pos.get() + v * 0.1), v)
    }

    const pick = (i: number) => {
        if (drag.current.moved) {
            drag.current.moved = false
            return
        }
        goTo(i)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const cur = targetRef.current
        let next = cur
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = cur + 1
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = cur - 1
        else if (e.key === "Home") next = 0
        else if (e.key === "End") next = n - 1
        else return
        e.preventDefault()
        goTo(next)
    }

    const current = items[active] ?? items[0]
    const stageH = CARD_H + (reflection ? 76 : 28)

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    maxWidth: 480,
                    margin: "0 auto",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    display: "grid",
                    gap: 4,
                    justifyItems: "center",
                }}
            >
                <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Coverflow. Drag, click a card or use the arrow keys."
                    aria-valuemin={1}
                    aria-valuemax={n}
                    aria-valuenow={active + 1}
                    aria-valuetext={current?.title}
                    onKeyDown={onKeyDown}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    style={{
                        position: "relative",
                        width: "100%",
                        height: stageH,
                        perspective: 900,
                        perspectiveOrigin: "50% 38%",
                        overflow: "hidden",
                        touchAction: "pan-y",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        cursor: "grab",
                        borderRadius: 16,
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: -2,
                    }}
                >
                    {items.map((item, i) => (
                        <Card
                            key={i}
                            item={item}
                            index={i}
                            pos={pos}
                            angle={angle}
                            reflection={reflection}
                            radius={radius}
                            accent={accent}
                            shade={p.shade}
                            shadeMax={p.shadeMax}
                            refl={p.refl}
                            onPick={pick}
                        />
                    ))}
                </div>
                <div style={{ height: 40, display: "grid", justifyItems: "center", alignContent: "start" }}>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={active}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            aria-live="polite"
                            style={{ display: "grid", justifyItems: "center", gap: 1 }}
                        >
                            <span style={{ fontSize: 15, fontWeight: 650, color: p.text, letterSpacing: "-0.01em" }}>{current?.title}</span>
                            <span style={{ fontSize: 12, color: p.faint }}>{current?.subtitle}</span>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(CoverflowDrag, {
    items: {
        type: ControlType.Array,
        title: "Cards",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Card" },
                subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "" },
                color: { type: ControlType.Color, title: "Color", defaultValue: "#fa7319" },
                image: { type: ControlType.String, title: "Image URL", defaultValue: "" },
            },
        },
        defaultValue: SAMPLE,
    },
    angle: { type: ControlType.Number, title: "Angle", defaultValue: 55, min: 0, max: 80, step: 1, unit: "deg" },
    reflection: { type: ControlType.Boolean, title: "Reflection", defaultValue: true },
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

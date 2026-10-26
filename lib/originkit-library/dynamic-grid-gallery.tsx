import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion } from "framer-motion"
import type { AnimationPlaybackControls } from "framer-motion"

/**
 * DynamicGridGallery: a grid of tiles where hovering (or focusing) one makes
 * its column and row grow while every other track shrinks, so the whole grid
 * reflows on a spring without overflowing. Click or press Enter to pin a tile
 * and reveal its title and caption. Arrow keys move focus between tiles.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 440
 * @framerIntrinsicHeight 320
 */

type Theme = "dark" | "light"

interface Tile {
    title: string
    caption: string
    image: string
}

interface DynamicGridGalleryProps {
    items: Tile[]
    columns: number
    gap: number
    expand: number
    height: number
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", raised: "#ece9e3", line: "#e4e1db", text: "#141413", soft: "#5c5a55", faint: "#76736d" }
        : { surface: "#141415", raised: "#262829", line: "#2d2d2f", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f" }
}

const SAMPLE: Tile[] = [
    { title: "Dusk Line", caption: "Long exposure of the harbour as the lights come on.", image: "" },
    { title: "Paper Bloom", caption: "Folded stock photographed under a single lamp.", image: "" },
    { title: "Slow Static", caption: "Analogue noise captured from an unplugged tuner.", image: "" },
    { title: "Salt Flat", caption: "A horizon with nothing on it, shot at noon.", image: "" },
    { title: "Night Tram", caption: "The last service crossing the river bridge.", image: "" },
    { title: "Greenhouse", caption: "Condensation and low winter sun on old glass.", image: "" },
    { title: "Copper Hour", caption: "Warm light across a stairwell for ten minutes.", image: "" },
    { title: "Open Window", caption: "A curtain, a breeze and an unmade bed.", image: "" },
    { title: "Tide Chart", caption: "Patterns the water leaves behind at low tide.", image: "" },
]

function hash(n: number) {
    let x = (n + 1) * 2654435761
    x = ((x >>> 16) ^ x) * 45679
    return ((x >>> 0) % 10000) / 10000
}

function art(i: number, accent: string, dark: boolean) {
    const r1 = hash(i * 3 + 1)
    const r2 = hash(i * 7 + 2)
    const r3 = hash(i * 11 + 5)
    const hue = i === 0 ? -1 : Math.round(r1 * 360)
    const a = hue < 0 ? accent : `hsl(${hue} 72% ${dark ? 56 : 62}%)`
    const b = `hsl(${((hue < 0 ? 24 : hue) + 50 + r2 * 80) % 360} 70% ${dark ? 30 : 48}%)`
    const c = `hsl(${((hue < 0 ? 24 : hue) + 200 + r3 * 60) % 360} 70% ${dark ? 44 : 58}%)`
    return `radial-gradient(circle at ${Math.round(r2 * 100)}% ${Math.round(r3 * 60)}%, ${a}, transparent 58%), radial-gradient(circle at ${Math.round(r3 * 100)}% 100%, ${c}, transparent 60%), linear-gradient(${Math.round(r1 * 360)}deg, ${b}, ${dark ? "#101012" : "#d9d4ca"})`
}

function Shapes({ i }: { i: number }) {
    const kind = i % 4
    const r = hash(i * 19 + 4)
    const stroke = "rgba(255,255,255,0.28)"
    return (
        <svg aria-hidden width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, display: "block" }}>
            {kind === 0 &&
                [0, 1, 2, 3].map((k) => <circle key={k} cx={30 + r * 40} cy={60} r={12 + k * 14} fill="none" stroke={stroke} strokeWidth="0.6" />)}
            {kind === 1 &&
                [0, 1, 2, 3, 4].map((k) => (
                    <path key={k} d={`M-5 ${30 + k * 11} Q 25 ${10 + k * 11 + r * 30} 50 ${30 + k * 11} T 105 ${30 + k * 11}`} fill="none" stroke={stroke} strokeWidth="0.6" />
                ))}
            {kind === 2 &&
                [0, 1, 2, 3, 4, 5].map((k) => <line key={k} x1={k * 20 - 10} y1="110" x2={k * 20 + 30 + r * 20} y2="-10" stroke={stroke} strokeWidth="0.6" />)}
            {kind === 3 && <rect x={22 + r * 20} y="26" width="46" height="46" rx="6" fill="none" stroke={stroke} strokeWidth="0.7" transform={`rotate(${Math.round(r * 40)} 50 50)`} />}
        </svg>
    )
}

function blend(a: number[], b: number[], k: number) {
    return a.map((v, i) => Math.max(0.2, v + (b[i] - v) * k))
}

function template(ws: number[]) {
    return ws.map((w) => `minmax(0, ${w.toFixed(3)}fr)`).join(" ")
}

const SPRING = { type: "spring" as const, stiffness: 260, damping: 28, mass: 0.9 }

export default function DynamicGridGallery({
    items = SAMPLE,
    columns = 3,
    gap = 6,
    expand = 2.4,
    height = 320,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
}: Partial<DynamicGridGalleryProps>) {
    const p = palette(theme)
    const dark = theme !== "light"
    const reduce = useReducedMotion()
    const list = items.length > 0 ? items : SAMPLE
    const cols = Math.max(1, Math.min(6, Math.round(columns)))
    const rows = Math.ceil(list.length / cols)
    const grow = Math.max(1, expand)

    const [hovered, setHovered] = React.useState<number | null>(null)
    const [focused, setFocused] = React.useState<number | null>(null)
    const [pinned, setPinned] = React.useState<number | null>(null)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const [rove, setRove] = React.useState(0)
    const tiles = React.useRef<Array<HTMLButtonElement | null>>([])
    const gridRef = React.useRef<HTMLDivElement | null>(null)

    const active = hovered ?? focused ?? pinned
    const progress = useMotionValue(1)
    const state = React.useRef({ fc: Array(cols).fill(1) as number[], tc: Array(cols).fill(1) as number[], fr: Array(rows).fill(1) as number[], tr: Array(rows).fill(1) as number[] })
    const anim = React.useRef<AnimationPlaybackControls | null>(null)

    const apply = React.useCallback(() => {
        const el = gridRef.current
        if (!el) return
        const k = progress.get()
        const s = state.current
        el.style.gridTemplateColumns = template(blend(s.fc, s.tc, k))
        el.style.gridTemplateRows = template(blend(s.fr, s.tr, k))
    }, [progress])

    React.useEffect(() => progress.on("change", apply), [progress, apply])

    React.useEffect(() => {
        const s = state.current
        const k = progress.get()
        // Freeze the current blended weights as the new start, then aim at the new target.
        const nc = s.fc.length === cols ? blend(s.fc, s.tc, k) : Array(cols).fill(1)
        const nr = s.fr.length === rows ? blend(s.fr, s.tr, k) : Array(rows).fill(1)
        s.fc = nc
        s.fr = nr
        s.tc = Array(cols)
            .fill(1)
            .map((_, c) => (active !== null && active % cols === c ? grow : 1))
        s.tr = Array(rows)
            .fill(1)
            .map((_, r) => (active !== null && Math.floor(active / cols) === r ? grow : 1))
        anim.current?.stop()
        if (reduce) {
            progress.set(1)
            apply()
            return
        }
        progress.set(0)
        apply()
        anim.current = animate(progress, 1, SPRING)
        return () => anim.current?.stop()
    }, [active, cols, rows, grow, reduce, progress, apply])

    const moveFocus = (e: React.KeyboardEvent, i: number) => {
        const r = Math.floor(i / cols)
        const c = i % cols
        let next = -1
        if (e.key === "ArrowRight") next = c + 1 < cols && i + 1 < list.length ? i + 1 : i
        else if (e.key === "ArrowLeft") next = c > 0 ? i - 1 : i
        else if (e.key === "ArrowDown") next = i + cols < list.length ? i + cols : i
        else if (e.key === "ArrowUp") next = r > 0 ? i - cols : i
        else if (e.key === "Home") next = 0
        else if (e.key === "End") next = list.length - 1
        if (next < 0) return
        e.preventDefault()
        tiles.current[next]?.focus()
    }

    const pinnedTile = pinned !== null ? list[pinned] : null

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 480,
                    height,
                    boxSizing: "border-box",
                    padding: gap,
                    borderRadius: radius + gap / 2,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    fontFamily: "inherit",
                    overflow: "hidden",
                }}
            >
                <div
                    ref={gridRef}
                    role="group"
                    aria-label="Gallery"
                    onPointerLeave={() => setHovered(null)}
                    style={{
                        display: "grid",
                        width: "100%",
                        height: "100%",
                        gap,
                        gridTemplateColumns: template(Array(cols).fill(1)),
                        gridTemplateRows: template(Array(rows).fill(1)),
                    }}
                >
                    {list.map((t, i) => {
                        const isActive = active === i
                        const isPinned = pinned === i
                        const showFocus = focusVisible && focused === i
                        return (
                            <button
                                key={i}
                                ref={(el) => {
                                    tiles.current[i] = el
                                }}
                                type="button"
                                aria-pressed={isPinned}
                                aria-label={`${t.title}. ${t.caption}`}
                                tabIndex={i === rove ? 0 : -1}
                                onPointerEnter={() => setHovered(i)}
                                onClick={() => setPinned((v) => (v === i ? null : i))}
                                onKeyDown={(e) => moveFocus(e, i)}
                                onFocus={(e) => {
                                    setFocused(i)
                                    setRove(i)
                                    setFocusVisible(e.currentTarget.matches(":focus-visible"))
                                }}
                                onBlur={() => {
                                    setFocused(null)
                                    setFocusVisible(false)
                                }}
                                style={{
                                    position: "relative",
                                    minWidth: 0,
                                    minHeight: 0,
                                    padding: 0,
                                    margin: 0,
                                    border: "none",
                                    borderRadius: radius,
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    background: p.raised,
                                    color: "#fff",
                                    fontFamily: "inherit",
                                    textAlign: "left",
                                    outline: showFocus ? `2px solid ${accent}` : "none",
                                    outlineOffset: -2,
                                }}
                            >
                                <div style={{ position: "absolute", inset: 0, background: t.image ? undefined : art(i, accent, dark) }}>
                                    {t.image ? (
                                        <img src={t.image} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                    ) : (
                                        <Shapes i={i} />
                                    )}
                                </div>
                                <div
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background: "linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0) 55%)",
                                        opacity: isActive ? 1 : 0.7,
                                        transition: "opacity 200ms",
                                    }}
                                />
                                <div style={{ position: "absolute", left: 10, right: 10, bottom: 8, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: isActive ? 13 : 11,
                                            fontWeight: 600,
                                            lineHeight: 1.25,
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                                            transition: "font-size 160ms",
                                        }}
                                    >
                                        {t.title}
                                    </div>
                                    <AnimatePresence initial={false}>
                                        {isPinned && (
                                            <motion.div
                                                key="cap"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto", transition: { ...SPRING, opacity: { duration: 0.2, delay: 0.08 } } }}
                                                exit={{ opacity: 0, height: 0, transition: { duration: 0.14 } }}
                                                style={{ overflow: "hidden" }}
                                            >
                                                <div style={{ fontSize: 11, lineHeight: 1.4, color: "rgba(255,255,255,0.82)", paddingTop: 2 }}>{t.caption}</div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <span
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        borderRadius: radius,
                                        boxShadow: `inset 0 0 0 2px ${accent}`,
                                        opacity: isPinned ? 1 : 0,
                                        transition: "opacity 160ms",
                                        pointerEvents: "none",
                                    }}
                                />
                                <span
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        left: 10,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        letterSpacing: "0.08em",
                                        color: "rgba(255,255,255,0.7)",
                                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    }}
                                >
                                    {i < 9 ? `0${i + 1}` : i + 1}
                                </span>
                                <AnimatePresence>
                                    {isPinned && (
                                        <motion.span
                                            aria-hidden
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.12 } }}
                                            transition={SPRING}
                                            style={{
                                                position: "absolute",
                                                top: 7,
                                                right: 8,
                                                width: 16,
                                                height: 16,
                                                borderRadius: 999,
                                                background: accent,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <svg width="9" height="9" viewBox="0 0 10 10">
                                                <path d="M2 5.2 4.2 7.4 8 3" fill="none" stroke="#141413" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>
                        )
                    })}
                </div>
                <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                    {pinnedTile ? `Pinned: ${pinnedTile.title}` : ""}
                </span>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(DynamicGridGallery, {
    items: {
        type: ControlType.Array,
        title: "Tiles",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Untitled" },
                caption: { type: ControlType.String, title: "Caption", defaultValue: "" },
                image: { type: ControlType.String, title: "Image URL", defaultValue: "" },
            },
        },
        defaultValue: SAMPLE,
    },
    columns: { type: ControlType.Number, title: "Columns", defaultValue: 3, min: 1, max: 6, step: 1 },
    gap: { type: ControlType.Number, title: "Gap", defaultValue: 6, min: 0, max: 24, step: 1 },
    expand: { type: ControlType.Number, title: "Expand", defaultValue: 2.4, min: 1, max: 5, step: 0.1 },
    height: { type: ControlType.Number, title: "Height", defaultValue: 320, min: 160, max: 720, step: 10 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 28 },
})

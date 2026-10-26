import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useInView, useReducedMotion } from "framer-motion"

/**
 * Signature: a signature pad. Strokes are smoothed with quadratic curves and
 * the line gets thinner the faster you move, like a real pen. Undo, clear, and
 * Replay, which writes the signature back out stroke by stroke. A scripted
 * signature writes itself on first view. onChange receives the signature as an
 * SVG string (empty when the pad is blank).
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 244
 */

type Theme = "dark" | "light"

interface SignatureProps {
    strokeWidth: number
    ink: string
    showControls: boolean
    autoplay: boolean
    accent: string
    theme: Theme
    radius: number
    onChange: (svg: string) => void
}

interface Pt {
    x: number
    y: number
    w: number
    t: number
}

interface Stroke {
    outline: string
    center: string
    len: number
}

const VW = 480
const VH = 190
const BASE_Y = 148

// A scripted, flowing cursive scribble drawn for this component.
const DEMO: { d: string; delay: number; duration: number }[] = [
    {
        d: "M 70 124 C 84 96, 104 56, 128 44 C 142 38, 150 52, 142 72 C 134 94, 112 122, 98 126 C 88 128, 96 112, 120 104 C 140 97, 158 94, 170 100 C 180 106, 172 126, 164 132 C 160 136, 166 128, 176 114 C 186 100, 196 88, 204 96 C 212 104, 202 124, 206 128 C 212 134, 226 112, 236 100 C 244 90, 252 92, 250 104 C 248 116, 244 128, 254 130 C 270 132, 288 98, 302 84 C 312 74, 322 72, 318 86 C 314 100, 308 124, 322 128 C 342 134, 366 100, 380 82 C 386 74, 394 76, 390 88 C 386 100, 380 118, 396 118 C 414 118, 430 96, 442 82",
        delay: 0.3,
        duration: 2.5,
    },
    { d: "M 78 154 C 150 142, 250 152, 340 141 C 384 136, 414 137, 446 124", delay: 2.9, duration: 0.7 },
    { d: "M 232 70 C 236 63, 243 63, 245 70", delay: 3.65, duration: 0.22 },
]

function palette(theme: Theme) {
    return theme === "light"
        ? {
              surface: "#ffffff",
              pad: "#fbfaf8",
              line: "#e4e1db",
              guide: "#c9c5bd",
              text: "#141413",
              soft: "#5c5a55",
              faint: "#76736d",
              raised: "#ece9e3",
              ink: "#141413",
          }
        : {
              surface: "#141415",
              pad: "#101011",
              line: "#2d2d2f",
              guide: "#3d3e41",
              text: "#f7f7f7",
              soft: "#b7b7b8",
              faint: "#8a8c8f",
              raised: "#262829",
              ink: "#f7f7f7",
          }
}

const f1 = (v: number) => Math.round(v * 10) / 10
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function mid(a: [number, number], b: [number, number]): [number, number] {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

// Quadratic smoothing through the midpoints of a polyline.
function smooth(arr: [number, number][]): string {
    const m = arr.length
    let d = ""
    for (let i = 1; i < m - 1; i++) {
        const c = arr[i]
        const e = mid(arr[i], arr[i + 1])
        d += ` Q ${f1(c[0])} ${f1(c[1])} ${f1(e[0])} ${f1(e[1])}`
    }
    const last = arr[m - 1]
    return d + ` L ${f1(last[0])} ${f1(last[1])}`
}

function build(pts: Pt[]): Stroke {
    const n = pts.length
    if (n === 1) {
        const { x, y, w } = pts[0]
        const r = Math.max(w, 1.4) / 2
        return {
            outline: `M ${f1(x - r)} ${f1(y)} a ${f1(r)} ${f1(r)} 0 1 0 ${f1(r * 2)} 0 a ${f1(r)} ${f1(r)} 0 1 0 ${f1(-r * 2)} 0 Z`,
            center: `M ${f1(x)} ${f1(y)} l 0.1 0`,
            len: 1,
        }
    }
    const left: [number, number][] = []
    const right: [number, number][] = []
    const half: number[] = []
    let len = 0
    for (let i = 0; i < n; i++) {
        const a = pts[Math.max(i - 1, 0)]
        const b = pts[Math.min(i + 1, n - 1)]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const l = Math.hypot(dx, dy) || 1
        const nx = -dy / l
        const ny = dx / l
        // Taper the first and last few points like a pen lifting.
        const taper = Math.min(1, 0.4 + i * 0.2, 0.4 + (n - 1 - i) * 0.2)
        const hw = Math.max(pts[i].w * taper, 0.7) / 2
        half.push(hw)
        left.push([pts[i].x + nx * hw, pts[i].y + ny * hw])
        right.push([pts[i].x - nx * hw, pts[i].y - ny * hw])
        if (i > 0) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    }
    const rr = right.slice().reverse()
    const hwEnd = f1(half[n - 1])
    const hwStart = f1(half[0])
    const outline =
        `M ${f1(left[0][0])} ${f1(left[0][1])}` +
        smooth(left) +
        ` A ${hwEnd} ${hwEnd} 0 0 0 ${f1(rr[0][0])} ${f1(rr[0][1])}` +
        smooth(rr) +
        ` A ${hwStart} ${hwStart} 0 0 0 ${f1(left[0][0])} ${f1(left[0][1])} Z`
    const c: [number, number][] = pts.map((p) => [p.x, p.y])
    const center = `M ${f1(c[0][0])} ${f1(c[0][1])}` + smooth(c)
    return { outline, center, len }
}

function toSvg(strokes: Stroke[], ink: string): string {
    if (strokes.length === 0) return ""
    const body = strokes.map((s) => `<path d="${s.outline}"/>`).join("")
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" fill="${ink}">${body}</svg>`
}

export default function Signature({
    strokeWidth = 2.6,
    ink = "",
    showControls = true,
    autoplay = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 14,
    onChange = () => {},
}: Partial<SignatureProps>) {
    const p = palette(theme)
    const color = ink || p.ink
    const uid = "sig" + React.useId().replace(/:/g, "")
    const reduce = useReducedMotion()
    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const svgRef = React.useRef<SVGSVGElement | null>(null)
    const liveRef = React.useRef<SVGPathElement | null>(null)
    const inView = useInView(rootRef, { once: true, amount: 0.35 })
    const cur = React.useRef<Pt[] | null>(null)
    const [strokes, setStrokes] = React.useState<Stroke[]>([])
    const [demo, setDemo] = React.useState(false)
    const [demoKey, setDemoKey] = React.useState(0)
    const [replayKey, setReplayKey] = React.useState(0)
    const [replaying, setReplaying] = React.useState(false)
    const [focus, setFocus] = React.useState("")
    const [hover, setHover] = React.useState("")
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const onChangeRef = React.useRef(onChange)
    onChangeRef.current = onChange
    const mounted = React.useRef(false)
    const touched = React.useRef(false)

    React.useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current)
        },
        []
    )

    // Write the scripted signature the first time the pad scrolls into view.
    React.useEffect(() => {
        if (autoplay && inView && !touched.current) {
            setDemo(true)
            setDemoKey((k) => k + 1)
        }
    }, [autoplay, inView])

    // Notify the host whenever the drawn signature changes.
    React.useEffect(() => {
        if (!mounted.current) {
            mounted.current = true
            return
        }
        onChangeRef.current?.(toSvg(strokes, color))
    }, [strokes, color])

    const stopReplay = () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        setReplaying(false)
    }

    const toPt = (e: React.PointerEvent<SVGSVGElement>): Pt => {
        const rect = svgRef.current!.getBoundingClientRect()
        return {
            x: ((e.clientX - rect.left) * VW) / rect.width,
            y: ((e.clientY - rect.top) * VH) / rect.height,
            w: strokeWidth,
            t: e.timeStamp,
        }
    }

    const paintLive = (pts: Pt[]) => {
        if (liveRef.current) liveRef.current.setAttribute("d", pts.length ? build(pts).outline : "")
    }

    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.button !== 0 && e.pointerType === "mouse") return
        touched.current = true
        stopReplay()
        if (demo) setDemo(false)
        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
            /* not capturable */
        }
        const pt = toPt(e)
        pt.w = strokeWidth * 1.1
        cur.current = [pt]
        paintLive(cur.current)
    }

    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const pts = cur.current
        if (!pts) return
        const next = toPt(e)
        const last = pts[pts.length - 1]
        const dist = Math.hypot(next.x - last.x, next.y - last.y)
        if (dist < 1.4) return
        const speed = dist / Math.max(1, next.t - last.t) // viewBox px per ms
        const target = strokeWidth * clamp(1.75 - speed * 1.05, 0.38, 1.6)
        next.w = last.w * 0.72 + target * 0.28
        pts.push(next)
        paintLive(pts)
    }

    const endStroke = (e: React.PointerEvent<SVGSVGElement>) => {
        const pts = cur.current
        if (!pts) return
        cur.current = null
        try {
            e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
            /* already released */
        }
        paintLive([])
        setStrokes((s) => [...s, build(pts)])
    }

    const undo = () => {
        stopReplay()
        setStrokes((s) => s.slice(0, -1))
    }
    const clear = () => {
        stopReplay()
        touched.current = true
        setDemo(false)
        setStrokes([])
    }

    const replay = () => {
        if (timer.current) clearTimeout(timer.current)
        if (strokes.length === 0) {
            setDemo(true)
            setDemoKey((k) => k + 1)
            return
        }
        const total = strokes.reduce((acc, s) => acc + clamp(s.len / 320, 0.18, 1.8) + 0.12, 0.2)
        setReplayKey((k) => k + 1)
        setReplaying(true)
        timer.current = setTimeout(() => {
            setReplaying(false)
            timer.current = null
        }, total * 1000 + 120)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Backspace" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z")) {
            e.preventDefault()
            undo()
        } else if (e.key === "Delete" || e.key === "Escape") {
            e.preventDefault()
            clear()
        }
    }

    // Reveal timing for each stroke during replay.
    const schedule = React.useMemo(() => {
        let t = 0.1
        return strokes.map((s) => {
            const duration = clamp(s.len / 320, 0.18, 1.8)
            const item = { delay: t, duration }
            t += duration + 0.12
            return item
        })
    }, [strokes])

    const hasInk = strokes.length > 0
    const demoStroke = strokeWidth * 1.15

    const btn = (key: string, disabled: boolean, primary: boolean): React.CSSProperties => ({
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 30,
        padding: "0 11px",
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: primary ? `color-mix(in srgb, ${accent} 55%, transparent)` : p.line,
        background: primary
            ? `color-mix(in srgb, ${accent} ${hover === key ? 24 : 14}%, transparent)`
            : hover === key && !disabled
              ? p.raised
              : "transparent",
        color: primary ? accent : p.soft,
        opacity: disabled ? 0.4 : 1,
        fontFamily: "inherit",
        fontSize: 12.5,
        fontWeight: 550,
        cursor: disabled ? "default" : "pointer",
        outline: focus === key ? `2px solid ${accent}` : "none",
        outlineOffset: 2,
        transition: "background 120ms, opacity 120ms",
    })

    const buttonProps = (key: string) => ({
        onPointerEnter: () => setHover(key),
        onPointerLeave: () => setHover(""),
        onFocus: (e: React.FocusEvent<HTMLButtonElement>) => setFocus(e.currentTarget.matches(":focus-visible") ? key : ""),
        onBlur: () => setFocus(""),
    })

    return (
        <MotionConfig reducedMotion="user">
            <div
                ref={rootRef}
                style={{
                    width: "100%",
                    maxWidth: 480,
                    margin: "0 auto",
                    borderRadius: radius,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: p.line,
                    background: p.surface,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                <div
                    tabIndex={0}
                    role="group"
                    aria-label="Signature pad. Draw with a mouse, finger or stylus. Backspace undoes the last stroke, Delete clears."
                    onKeyDown={onKeyDown}
                    onFocus={(e) => {
                        if (e.target === e.currentTarget) setFocus(e.currentTarget.matches(":focus-visible") ? "pad" : "")
                    }}
                    onBlur={(e) => {
                        if (e.target === e.currentTarget) setFocus("")
                    }}
                    style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: `${VW} / ${VH}`,
                        background: p.pad,
                        outline: focus === "pad" ? `2px solid ${accent}` : "none",
                        outlineOffset: -2,
                    }}
                >
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${VW} ${VH}`}
                        width="100%"
                        height="100%"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endStroke}
                        onPointerCancel={endStroke}
                        style={{ display: "block", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", cursor: "crosshair" }}
                    >
                        <defs>
                            {strokes.map((s, i) => (
                                <mask key={i} id={`${uid}-m${i}`} maskUnits="userSpaceOnUse" x={0} y={0} width={VW} height={VH}>
                                    {replaying && (
                                        <motion.path
                                            key={replayKey}
                                            d={s.center}
                                            fill="none"
                                            stroke="#ffffff"
                                            strokeWidth={26}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ delay: schedule[i]?.delay ?? 0, duration: schedule[i]?.duration ?? 0.4, ease: [0.4, 0.1, 0.4, 1] }}
                                        />
                                    )}
                                </mask>
                            ))}
                        </defs>

                        {/* baseline with the sign-here mark */}
                        <line x1={20} y1={BASE_Y} x2={VW - 20} y2={BASE_Y} stroke={p.guide} strokeWidth={1} strokeDasharray="1 5" strokeLinecap="round" />
                        <path d="M 26 128 L 40 144 M 40 128 L 26 144" fill="none" stroke={accent} strokeWidth={2.2} strokeLinecap="round" />
                        <text x={VW / 2} y={BASE_Y + 20} textAnchor="middle" fontSize={10.5} letterSpacing="0.14em" fill={p.faint} style={{ fontFamily: "inherit" }}>
                            SIGN HERE
                        </text>

                        {/* scripted signature */}
                        {demo &&
                            DEMO.map((s, i) => (
                                <motion.path
                                    key={`${demoKey}-${i}`}
                                    d={s.d}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={demoStroke}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={reduce ? false : { pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: s.delay, duration: s.duration, ease: [0.45, 0.05, 0.35, 1] }}
                                />
                            ))}

                        {/* drawn strokes */}
                        {strokes.map((s, i) => (
                            <g key={i} mask={replaying ? `url(#${uid}-m${i})` : undefined}>
                                <path d={s.outline} fill={color} />
                            </g>
                        ))}
                        <path ref={liveRef} d="" fill={color} />
                    </svg>
                </div>

                {showControls && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minHeight: 46,
                            padding: "8px 12px",
                            borderTopWidth: 1,
                            borderTopStyle: "solid",
                            borderTopColor: p.line,
                            boxSizing: "border-box",
                        }}
                    >
                        <span style={{ fontSize: 12, color: p.faint, marginRight: "auto" }} aria-live="polite">
                            {hasInk ? `${strokes.length} ${strokes.length === 1 ? "stroke" : "strokes"}` : demo ? "Draw to replace this one" : "Draw your signature"}
                        </span>
                        <button type="button" onClick={undo} disabled={!hasInk} aria-label="Undo last stroke" style={btn("undo", !hasInk, false)} {...buttonProps("undo")}>
                            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                                <path d="M5 3 2 6l3 3M2.5 6H9a3 3 0 0 1 0 6H6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Undo
                        </button>
                        <button type="button" onClick={clear} disabled={!hasInk && !demo} aria-label="Clear signature" style={btn("clear", !hasInk && !demo, false)} {...buttonProps("clear")}>
                            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                                <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            Clear
                        </button>
                        <button type="button" onClick={replay} aria-label="Replay signature" style={btn("replay", false, true)} {...buttonProps("replay")}>
                            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                                <path d="M4 2.8v8.4L11 7z" fill="currentColor" />
                            </svg>
                            Replay
                        </button>
                    </div>
                )}
            </div>
        </MotionConfig>
    )
}

addPropertyControls(Signature, {
    strokeWidth: { type: ControlType.Number, title: "Stroke", defaultValue: 2.6, min: 1, max: 8, step: 0.1 },
    ink: { type: ControlType.Color, title: "Ink", defaultValue: "" },
    showControls: { type: ControlType.Boolean, title: "Controls", defaultValue: true },
    autoplay: { type: ControlType.Boolean, title: "Autoplay", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 14, min: 0, max: 28 },
    onChange: { type: ControlType.EventHandler },
})

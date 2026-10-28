import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    openMs: 530,
    closeMs: 670,
    holdMs: 2600,
    idleMs: 2600,
    autoPlay: true,
    coverScale: 118,
    coverAspect: 69,
    gap: 3,
    heightJitter: 3,
    perspective: 1600,
    lift: 3,
    tilt: 6,
    titleSize: 44,
    monogramSize: 28,
    monogramOpacity: 45,
    textOpacity: 92,
    coverTitleSize: 13,
    kickerSize: 5,
    readsSize: 4,
    coverStrip: 6,
    artScale: 100,
    shade: 12,
    highlight: 8,
    shadowOpacity: 55,
    floorColor: "#FFFFFF",
    floorOpacity: 10,
    rowOffset: 0,
    starColor: "#D9A55A",
    hover: 50,
    grain: 0,
    vignette: 0,
}

// ── moved controls (builder) ──
/**
 * Controls moved in the builder: into Advanced, out of it, or into groups of
 * their own. The code reads each one where it was first written, so the props
 * are put back in that shape before anything reads them.
 */
const MOVED_CONTROLS: { into: Record<string, string>; out: Record<string, string> } = {"into":{},"out":{"hover":"advanced"}}
const GROUP_FALLBACKS: Record<string, any> = { advanced: ADVANCED_DEFAULTS }
function withMovedControls(props: any): any {
    const out = { ...props }
    for (const [k, g] of Object.entries(MOVED_CONTROLS.into)) out[k] = props?.[g]?.[k] ?? GROUP_FALLBACKS[g]?.[k]
    for (const [k, g] of Object.entries(MOVED_CONTROLS.out)) {
        if (out[k] !== undefined) out[g] = { ...(out[g] ?? {}), [k]: out[k] }
    }
    return out
}
// ── /moved controls ──

const DEFAULT_BOOKS = [
    { title: "United States", subtitle: "18M reads", spineColor: "#181924", textColor: "#FFFFFF", coverColor: "#1C2538", cover: {"src":"https://images.unsplash.com/photo-1792187790722-66db7d13a53f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""} },
    { title: "J. Robert Oppenheimer", subtitle: "9.4M reads", spineColor: "#EDE3CF", textColor: "#2A2A2A", coverColor: "#E4D9C2", cover: {"src":"https://images.unsplash.com/photo-1792964785281-0397544a4245?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""} },
    { title: "Wikipedia", subtitle: "12M reads", spineColor: "#E6DABE", textColor: "#2A2A2A", coverColor: "#E9DFC6", cover: {"src":"https://images.unsplash.com/photo-1792592108795-076164280be6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""} },
    { title: "Elon Musk", subtitle: "21M reads", spineColor: "#A9482A", textColor: "#FFFFFF", coverColor: "#A9482A", cover: {"src":"https://images.unsplash.com/photo-1792676818211-6ab6ccfd86c4?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""} },
]

const FALLBACK_BOOK = { title: "Untitled", subtitle: "1M reads", spineColor: "#3D4D6C", textColor: "#FFFFFF", coverColor: "#3D4D6C" }

const JITTER = [0, 0.6, -1, 0.3, -0.4, 0.8]
const SANS = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"

// ── easing (measured: open 0.53 s, close 0.67 s) ──
function bezier(x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const sx = (t: number) => ((ax * t + bx) * t + cx) * t
    const sy = (t: number) => ((ay * t + by) * t + cy) * t
    const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let t = x
        for (let i = 0; i < 8; i++) {
            const e = sx(t) - x
            const d = dx(t)
            if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break
            t -= e / d
        }
        if (t < 0 || t > 1 || Math.abs(sx(t) - x) > 1e-3) {
            let lo = 0, hi = 1
            t = x
            for (let i = 0; i < 30; i++) {
                if (sx(t) < x) lo = t
                else hi = t
                t = (lo + hi) / 2
            }
        }
        return sy(t)
    }
}
const OPEN_EASE = bezier(0.38, 0.25, 0.28, 0.98)
const CLOSE_EASE = bezier(0.1, 0, 0.38, 0.98)

// ── colour helpers ──
function parseColor(c: string): [number, number, number, number] {
    if (!c || typeof c !== "string") return [0, 0, 0, 1]
    const s = c.trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4) h = h.split("").map((ch) => ch + ch).join("")
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
        const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
        return [r || 0, g || 0, b || 0, a]
    }
    const m = s.match(/rgba?\(([^)]+)\)/i)
    if (m) {
        const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat)
        return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] ?? 1]
    }
    return [0, 0, 0, 1]
}
function mix(a: string, b: string, t: number) {
    const A = parseColor(a), B = parseColor(b)
    const f = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t)
    return `rgb(${f(0)}, ${f(1)}, ${f(2)})`
}
function rgba(c: string, a: number) {
    const [r, g, b] = parseColor(c)
    return `rgba(${r}, ${g}, ${b}, ${a})`
}
function lum(c: string) {
    const [r, g, b] = parseColor(c)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
function imgSrc(v: any): string {
    if (!v) return ""
    if (typeof v === "string") return v
    return v.src || ""
}
function defined(o: any) {
    const out: any = {}
    if (!o) return out
    for (const k of Object.keys(o)) if (o[k] !== undefined && o[k] !== null && o[k] !== "") out[k] = o[k]
    return out
}

function starPath(cx: number, cy: number, r: number) {
    let d = ""
    for (let k = 0; k < 12; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 6
        const rr = k % 2 ? r * 0.5 : r
        d += (k ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(2) + " " + (cy + Math.sin(a) * rr).toFixed(2)
    }
    return d + "Z"
}

const STARS = [
    [50, 76], [45, 80.5], [55, 80.5], [40, 85], [50, 85], [60, 85], [35, 89.5],
    [45, 89.5], [55, 89.5], [65, 89.5], [42, 94], [50, 94], [58, 94],
]

// Built-in cover art, drawn when no cover image is set (or until it loads).
function CoverArt({ variant, ink, star, bg, uid }: { variant: number; ink: string[]; star: string; bg: string; uid: string }) {
    const [c1, c2, c3] = ink
    const svg = (children: React.ReactNode) => (
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", overflow: "visible" }}>
            {children}
        </svg>
    )
    if (variant === 0) {
        const wing = "M48 44 C42 30 30 16 8 10 C14 18 16 24 22 30 C14 28 8 30 4 34 C14 36 22 40 28 46 C20 46 14 50 12 54 C24 52 36 54 46 58 Z"
        const feathers = [[10, 12], [16, 21], [8, 32], [20, 38], [14, 52], [27, 48], [33, 30]]
        const half = (
            <g>
                <path d={wing} fill={c2} />
                {feathers.map(([x, y], k) => (
                    <line key={k} x1={46} y1={52} x2={x} y2={y} stroke={c3} strokeWidth={0.6} opacity={0.7} />
                ))}
                <path d="M48 44 C42 30 30 16 8 10" fill="none" stroke={c1} strokeWidth={0.8} opacity={0.8} />
            </g>
        )
        return svg(
            <g>
                {half}
                <g transform="translate(100 0) scale(-1 1)">{half}</g>
                <path d="M45 62 L50 72 L55 62 Z" fill={c2} stroke={c3} strokeWidth={0.4} />
                <ellipse cx={50} cy={52} rx={6} ry={13} fill={c2} stroke={c3} strokeWidth={0.5} />
                <circle cx={50} cy={36} r={5} fill={c1} />
                <path d="M51 37 L57 39 L51 41 Z" fill={star} />
                {STARS.map(([x, y], k) => (
                    <path key={k} d={starPath(x, y, 2.2)} fill={star} />
                ))}
            </g>
        )
    }
    if (variant === 1) {
        const clip = `${uid}-head`
        return svg(
            <g>
                <defs>
                    <clipPath id={clip}>
                        <ellipse cx={50} cy={46} rx={14} ry={18} />
                    </clipPath>
                </defs>
                <path d="M14 100 C18 78 34 70 50 70 C66 70 82 78 86 100 Z" fill={c2} />
                {Array.from({ length: 10 }).map((_, k) => (
                    <line key={k} x1={20 + k * 7} y1={100} x2={30 + k * 6} y2={76} stroke={c3} strokeWidth={0.5} opacity={0.5} />
                ))}
                <path d="M42 70 L50 84 L58 70" fill={c1} stroke={c3} strokeWidth={0.6} />
                <rect x={45} y={58} width={10} height={13} fill={c1} />
                <ellipse cx={50} cy={46} rx={14} ry={18} fill={c1} stroke={c3} strokeWidth={0.8} />
                <g clipPath={`url(#${clip})`}>
                    {Array.from({ length: 9 }).map((_, k) => (
                        <line key={k} x1={53 + k * 2} y1={28} x2={45 + k * 2} y2={66} stroke={c3} strokeWidth={0.45} opacity={0.6} />
                    ))}
                </g>
                <path d="M42 44 h5 M53 44 h5" stroke={c3} strokeWidth={0.9} />
                <path d="M50 46 L48 53 L51 53" fill="none" stroke={c3} strokeWidth={0.6} />
                <path d="M45 58 Q50 60 55 58" fill="none" stroke={c3} strokeWidth={0.6} />
                <path d="M34 30 C34 12 66 12 66 30 Z" fill={c3} />
                <ellipse cx={50} cy={30} rx={26} ry={4.5} fill={c3} />
                <path d="M35 26 h30" stroke={c2} strokeWidth={1.2} opacity={0.7} />
            </g>
        )
    }
    if (variant === 2) {
        const grad = `${uid}-globe`
        const clip = `${uid}-gclip`
        return svg(
            <g>
                <defs>
                    <radialGradient id={grad} cx="38%" cy="34%" r="70%">
                        <stop offset="0%" stopColor={c1} />
                        <stop offset="70%" stopColor={c2} />
                        <stop offset="100%" stopColor={c3} />
                    </radialGradient>
                    <clipPath id={clip}>
                        <circle cx={50} cy={54} r={34} />
                    </clipPath>
                </defs>
                <circle cx={50} cy={54} r={34} fill={`url(#${grad})`} />
                <g clipPath={`url(#${clip})`} fill="none" stroke={c3} strokeWidth={0.6} opacity={0.75}>
                    {[10, 22, 32].map((rx) => (
                        <ellipse key={rx} cx={50} cy={54} rx={rx} ry={34} />
                    ))}
                    {[34, 44, 54, 64, 74].map((y) => (
                        <path key={y} d={`M14 ${y} Q32 ${y + 3} 50 ${y} T86 ${y}`} />
                    ))}
                    <path d="M54 19 L68 23 L66 35 L52 33 Z" fill={bg} stroke="none" />
                </g>
                <circle cx={50} cy={54} r={34} fill="none" stroke={c3} strokeWidth={0.8} />
                <path d="M74 10 L82 12 L81 19 L73 17 Z" fill={c2} stroke={c3} strokeWidth={0.5} transform="rotate(14 78 15)" />
                <path d="M82 24 L88 25 L87 31 L81 30 Z" fill={c1} stroke={c3} strokeWidth={0.5} transform="rotate(-10 85 28)" />
            </g>
        )
    }
    return svg(
        <g>
            <circle cx={50} cy={50} r={44} fill="none" stroke={c2} strokeWidth={0.6} />
            {Array.from({ length: 32 }).map((_, k) => {
                const a = (k / 32) * Math.PI * 2
                const r2 = k % 2 ? 32 : 40
                return (
                    <line key={k} x1={50 + Math.cos(a) * 19} y1={50 + Math.sin(a) * 19} x2={50 + Math.cos(a) * r2} y2={50 + Math.sin(a) * r2} stroke={c1} strokeWidth={0.8} opacity={0.85} />
                )
            })}
            <circle cx={50} cy={50} r={14} fill={star} />
            <circle cx={50} cy={50} r={14} fill="none" stroke={c3} strokeWidth={0.6} opacity={0.6} />
        </g>
    )
}

type Geom = {
    n: number; hs: number; sw: number; cw: number; gap: number; k: number
    W: number; H: number; heights: number[]; startX: number; floorY: number; boxH: number; P: number
}
type Slot = { x: number; w: number; th: number; m: number; e: number }

function rowLayout(g: Geom, es: number[]): Slot[] {
    const out: Slot[] = []
    let x = g.startX
    for (let i = 0; i < g.n; i++) {
        const e = es[i] ?? 0
        const th = (e * Math.PI) / 2
        const m = 1 + (g.k - 1) * e
        const w = m * (g.sw * Math.cos(th) + g.cw * Math.sin(th))
        out.push({ x, w, th, m, e })
        x += w + g.gap
    }
    return out
}

function slotStyles(g: Geom, L: Slot, liftPx: number, tiltDeg: number, shadowOp: number) {
    return {
        slot: {
            transform: `translate3d(${L.x}px, ${g.floorY - g.boxH}px, 0px)`,
            width: `${Math.max(1, L.w)}px`,
            height: `${g.boxH}px`,
            perspective: `${g.P}px`,
            perspectiveOrigin: `${L.w / 2}px ${g.boxH * 0.55}px`,
        },
        book: {
            transform: `translateY(${-liftPx}px) translateZ(${-g.sw * Math.sin(L.th)}px) scale(${L.m}) rotateX(${tiltDeg}deg) rotateY(${(-L.th * 180) / Math.PI}deg)`,
        },
        shadow: {
            transform: `translate3d(${L.x - L.w * 0.08}px, ${g.floorY - g.hs * 0.035}px, 0px)`,
            width: `${L.w * 1.16}px`,
            height: `${g.hs * (0.07 + 0.03 * L.e)}px`,
            opacity: `${shadowOp * (0.6 + 0.4 * L.e)}`,
        },
    }
}

/**
 * Bookshelf Cover Flip
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function BookshelfCoverFlip(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        label = "Grokipedia",
        monogram = "G",
        size = 440,
        spineWidth = 14,
        speed = 50,
        font = { fontSize: 16, lineHeight: "1em" },
        style,
    } = props

    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const rawBooks = Array.isArray(props.books) && props.books.length ? props.books : DEFAULT_BOOKS
    const books = rawBooks.slice(0, 6).map((b: any) => ({ ...FALLBACK_BOOK, ...defined(b) }))
    const n = books.length

    const uid = "bs" + React.useId().replace(/[^a-zA-Z0-9]/g, "")
    const rootRef = useRef<HTMLDivElement>(null)
    const slotEls = useRef<(HTMLDivElement | null)[]>([])
    const bookEls = useRef<(HTMLDivElement | null)[]>([])
    const shadowEls = useRef<(HTMLDivElement | null)[]>([])
    const [dims, setDims] = useState({ w: 1200, h: 800 })
    const [loaded, setLoaded] = useState<Record<string, boolean>>({})

    const rt = RenderTarget.current()
    const isStatic = rt === RenderTarget.thumbnail || rt === RenderTarget.export

    const stRef = useRef<any>(null)
    if (!stRef.current) {
        stRef.current = {
            es: [1], tw: [{ from: 1, to: 1, t: 0, dur: 0.5, open: true }], lift: [0],
            active: 0, autoIdx: 0, holdT: 0, idleT: 0, pointerIn: false, hovered: -1,
            py: 0, ty: 0, reduce: false,
        }
    }
    const st = stRef.current
    while (st.es.length < n) {
        st.es.push(0)
        st.tw.push({ from: 0, to: 0, t: 0, dur: 0.5, open: true })
        st.lift.push(0)
    }
    st.es.length = n
    st.tw.length = n
    st.lift.length = n
    if (st.active >= n) st.active = 0
    if (st.autoIdx >= n) st.autoIdx = 0

    // ── geometry ──
    const W = dims.w || 1200
    const H = dims.h || 800
    const k = adv.coverScale / 100
    const sw0 = (size * spineWidth) / 100
    const cw0 = (size * adv.coverAspect) / 100
    const gap0 = (size * adv.gap) / 100
    const rowOpen0 = (n - 1) * (sw0 + gap0) + k * cw0
    const jMax = 1 + (0.8 * adv.heightJitter) / 100
    const fit = Math.max(0.05, Math.min(1, (W * 0.9) / Math.max(1, rowOpen0), (H * 0.82) / Math.max(1, size * k * jMax)))
    const hs = size * fit
    const sw = sw0 * fit
    const cw = cw0 * fit
    const gap = gap0 * fit
    const rowOpenW = rowOpen0 * fit
    const heights = books.map((_: any, i: number) => hs * (1 + (JITTER[i % JITTER.length] * adv.heightJitter) / 100))
    const startX = (W - rowOpenW) / 2
    const floorY = H / 2 + (hs * k) / 2 + (H * adv.rowOffset) / 100
    const g: Geom = {
        n, hs, sw, cw, gap, k, W, H, heights, startX, floorY,
        boxH: hs * k * jMax * 1.1,
        P: adv.perspective * (hs / 440),
    }
    const geomRef = useRef(g)
    geomRef.current = g
    const propsRef = useRef(props)
    propsRef.current = props

    const hoverK = (a: any) => a.hover / 50

    const initLayout = rowLayout(g, st.es)
    const initStyles = initLayout.map((L, i) =>
        slotStyles(g, L, (adv.lift / 100) * hs * st.lift[i] * hoverK(adv), adv.tilt * st.ty * st.lift[i] * hoverK(adv), adv.shadowOpacity / 100)
    )

    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const measure = () => {
            const w = el.offsetWidth, h = el.offsetHeight
            setDims((d) => (d.w === w && d.h === h ? d : { w, h }))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        const set = () => (stRef.current.reduce = mq.matches)
        set()
        mq.addEventListener?.("change", set)
        return () => mq.removeEventListener?.("change", set)
    }, [])

    useEffect(() => {
        let raf = 0
        let last = -1
        const tick = (now: number) => {
            raf = requestAnimationFrame(tick)
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            last = now
            const s = stRef.current
            const p = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const geo = geomRef.current
            const count = geo.n
            const rate = Math.max(0, (p.speed ?? 50) / 50)
            const hk = a.hover / 50

            if (isStatic) {
                s.active = 0
                for (let i = 0; i < count; i++) s.es[i] = i === 0 ? 1 : 0
            } else {
                // who is open
                if (s.pointerIn) {
                    s.active = s.hovered
                    if (s.hovered >= 0) s.autoIdx = s.hovered
                } else if (a.autoPlay && !s.reduce && rate > 0 && count > 1) {
                    if (s.active < 0) {
                        s.idleT += dt * rate
                        if (s.idleT >= a.idleMs / 1000) {
                            s.autoIdx = (s.autoIdx + 1) % count
                            s.active = s.autoIdx
                            s.holdT = 0
                        }
                    } else {
                        s.holdT += dt * rate
                        if (s.holdT >= a.holdMs / 1000) {
                            s.autoIdx = (s.active + 1) % count
                            s.active = s.autoIdx
                            s.holdT = 0
                        }
                    }
                }
                // tweens: one opens while the other closes, same beat
                for (let i = 0; i < count; i++) {
                    const tw = s.tw[i]
                    const target = i === s.active ? 1 : 0
                    if (tw.to !== target) {
                        tw.from = s.es[i]
                        tw.to = target
                        tw.t = 0
                        tw.open = target > tw.from
                        const base = (tw.open ? a.openMs : a.closeMs) / 1000
                        tw.dur = Math.max(0.05, base * Math.abs(target - tw.from))
                    }
                    if (s.reduce) {
                        s.es[i] = target
                    } else if (rate > 0) {
                        tw.t += dt * rate
                        const u = Math.min(1, tw.t / tw.dur)
                        const ez = tw.open ? OPEN_EASE(u) : CLOSE_EASE(u)
                        s.es[i] = tw.from + (tw.to - tw.from) * ez
                    }
                    const lt = s.pointerIn && s.hovered === i ? 1 : 0
                    s.lift[i] += (lt - s.lift[i]) * (1 - Math.exp(-dt * 8))
                }
                s.ty += (s.py - s.ty) * (1 - Math.exp(-dt * 6))
            }

            const L = rowLayout(geo, s.es)
            for (let i = 0; i < count; i++) {
                const ss = slotStyles(
                    geo, L[i],
                    (a.lift / 100) * geo.hs * s.lift[i] * hk,
                    a.tilt * s.ty * s.lift[i] * hk,
                    a.shadowOpacity / 100
                )
                const se = slotEls.current[i], be = bookEls.current[i], sh = shadowEls.current[i]
                if (se) Object.assign(se.style, ss.slot)
                if (be) Object.assign(be.style, ss.book)
                if (sh) Object.assign(sh.style, ss.shadow)
            }
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [isStatic])

    // Hit test against the settled layout, so a book shifting under the pointer never hands the hover on.
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const s = stRef.current
        const geo = geomRef.current
        const x = e.nativeEvent.offsetX
        const y = e.nativeEvent.offsetY
        s.pointerIn = true
        s.idleT = 0
        const mid = geo.floorY - (geo.hs * geo.k) / 2
        s.py = Math.max(-1, Math.min(1, (y - mid) / ((geo.hs * geo.k) / 2)))
        const targets = Array.from({ length: geo.n }, (_, i) => (i === s.active ? 1 : 0))
        const L = rowLayout(geo, targets)
        const inBand = y >= geo.floorY - geo.hs * geo.k * 1.12 && y <= geo.floorY + geo.hs * 0.1
        const left = L[0].x - geo.gap
        const right = L[L.length - 1].x + L[L.length - 1].w + geo.gap
        if (!inBand || x < left || x > right) {
            s.hovered = -1
            return
        }
        for (let i = 0; i < L.length; i++) {
            if (x >= L[i].x - geo.gap / 2 && x <= L[i].x + L[i].w + geo.gap / 2) {
                s.hovered = i
                return
            }
        }
    }
    const onPointerLeave = () => {
        const s = stRef.current
        s.pointerIn = false
        s.hovered = -1
        s.active = -1
        s.idleT = 0
        s.py = 0
    }

    const fontFamily = font?.fontFamily || SERIF
    const fontWeight = font?.fontWeight ?? 400
    const fontStyle = font?.fontStyle ?? "normal"
    const letterSpacing = font?.letterSpacing ?? "normal"
    const floorX = startX - gap * 4
    const floorW = rowOpenW + gap * 8
    const fade = "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)"

    return (
        <div
            ref={rootRef}
            onPointerMove={onPointerMove}
            onPointerEnter={onPointerMove}
            onPointerLeave={onPointerLeave}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 1200,
                minHeight: 800,
                ...style,
                background,
                overflow: "hidden",
                isolation: "isolate",
            }}
        >
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {/* floor */}
                <div
                    style={{
                        position: "absolute", left: floorX, top: floorY, width: floorW, height: hs * 0.16,
                        background: `linear-gradient(180deg, ${rgba(adv.floorColor, (adv.floorOpacity / 100) * 0.6)} 0%, ${rgba(adv.floorColor, 0)} 100%)`,
                        WebkitMaskImage: fade, maskImage: fade,
                    }}
                />
                <div
                    style={{
                        position: "absolute", left: floorX, top: floorY, width: floorW, height: 1,
                        background: rgba(adv.floorColor, Math.min(1, (adv.floorOpacity / 100) * 1.5)),
                        WebkitMaskImage: fade, maskImage: fade,
                    }}
                />
                {/* contact shadows */}
                {books.map((_: any, i: number) => (
                    <div
                        key={"sh" + i}
                        ref={(el) => { shadowEls.current[i] = el }}
                        style={{
                            position: "absolute", left: 0, top: 0,
                            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 72%)",
                            ...initStyles[i].shadow,
                        }}
                    />
                ))}
                {/* books */}
                {books.map((b: any, i: number) => {
                    const h = heights[i]
                    const src = imgSrc(b.cover)
                    const coverText = lum(b.coverColor) > 0.55 ? "#1A1A1A" : "#FFFFFF"
                    const ink = lum(b.coverColor) > 0.55 ? ["#FBF6EA", "#A99C86", "#4A4136"] : ["#D2D0CC", "#8E949D", "#2F3442"]
                    const strip = (cw * adv.coverStrip) / 100
                    const inset = strip + cw * 0.1
                    const hl = adv.highlight / 100
                    const sd = adv.shade / 100
                    return (
                        <div
                            key={"b" + i}
                            ref={(el) => { slotEls.current[i] = el }}
                            style={{ position: "absolute", left: 0, top: 0, ...initStyles[i].slot }}
                        >
                            <div
                                ref={(el) => { bookEls.current[i] = el }}
                                style={{
                                    position: "absolute", left: 0, bottom: 0, width: sw, height: h,
                                    transformStyle: "preserve-3d", transformOrigin: "0px 100% 0px",
                                    ...initStyles[i].book,
                                }}
                            >
                                {/* spine face */}
                                <div
                                    style={{
                                        position: "absolute", left: 0, bottom: 0, width: sw, height: h,
                                        background: b.spineColor, borderRadius: 1, overflow: "hidden",
                                        backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            position: "absolute", inset: 0,
                                            background: `linear-gradient(90deg, rgba(255,255,255,${hl}) 0px, rgba(255,255,255,0) ${sw * 0.12}px, rgba(0,0,0,0) ${sw * 0.55}px, rgba(0,0,0,${sd}) 100%), linear-gradient(180deg, rgba(0,0,0,0) 72%, rgba(0,0,0,${sd * 0.8}) 100%)`,
                                        }}
                                    />
                                    <div
                                        style={{
                                            position: "absolute", top: h * 0.048, bottom: h * 0.14, left: 0, right: 0,
                                            display: "flex", justifyContent: "center", overflow: "hidden",
                                        }}
                                    >
                                        <span
                                            style={{
                                                writingMode: "vertical-rl", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                                maxHeight: "100%", fontFamily, fontWeight, fontStyle, letterSpacing,
                                                fontSize: (sw * adv.titleSize) / 100, lineHeight: 1,
                                                color: b.textColor, opacity: adv.textOpacity / 100,
                                            }}
                                        >
                                            {b.title}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            position: "absolute", left: 0, right: 0, bottom: h * 0.035, textAlign: "center",
                                            fontFamily: SERIF, fontStyle: "italic", fontSize: (sw * adv.monogramSize) / 100, lineHeight: 1,
                                            color: b.textColor, opacity: adv.monogramOpacity / 100,
                                        }}
                                    >
                                        {monogram}
                                    </div>
                                </div>
                                {/* cover face, hinged on the spine's right edge */}
                                <div
                                    style={{
                                        position: "absolute", left: sw, bottom: 0, width: cw, height: h,
                                        transformOrigin: "0% 50%", transform: "rotateY(90deg)",
                                        backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                                        background: `linear-gradient(180deg, ${mix(b.coverColor, "#FFFFFF", 0.08)} 0%, ${b.coverColor} 100%)`,
                                        overflow: "hidden", color: coverText,
                                    }}
                                >
                                    <div
                                        style={{
                                            position: "absolute", left: inset, right: cw * 0.08, top: h * 0.07, height: h * 0.5,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}
                                    >
                                        {!(src && loaded[src]) && (
                                            <div style={{ width: `${adv.artScale}%`, height: `${adv.artScale}%` }}>
                                                <CoverArt variant={i % 4} ink={ink} star={adv.starColor} bg={b.coverColor} uid={`${uid}-${i}`} />
                                            </div>
                                        )}
                                        {src && (
                                            <img
                                                src={src}
                                                alt=""
                                                draggable={false}
                                                onLoad={() => setLoaded((m) => (m[src] ? m : { ...m, [src]: true }))}
                                                onError={() => setLoaded((m) => ({ ...m, [src]: false }))}
                                                style={{
                                                    position: "absolute", inset: 0, width: "100%", height: "100%",
                                                    objectFit: "cover", opacity: loaded[src] ? 1 : 0,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            position: "absolute", left: 0, top: 0, bottom: 0, width: strip,
                                            background: mix(b.coverColor, "#000000", 0.1),
                                            borderRight: "1px solid rgba(255,255,255,0.14)",
                                            display: "flex", justifyContent: "center", paddingTop: h * 0.04, overflow: "hidden",
                                        }}
                                    >
                                        <span
                                            style={{
                                                writingMode: "vertical-rl", whiteSpace: "nowrap", fontFamily, fontWeight,
                                                fontSize: cw * 0.036, lineHeight: 1, opacity: 0.75,
                                            }}
                                        >
                                            {b.title}
                                        </span>
                                    </div>
                                    <div style={{ position: "absolute", left: inset, right: cw * 0.08, bottom: h * 0.12 }}>
                                        <div
                                            style={{
                                                fontFamily: SANS, fontWeight: 500, fontSize: (cw * adv.kickerSize) / 100,
                                                lineHeight: 1.2, opacity: 0.8, marginBottom: cw * 0.025,
                                            }}
                                        >
                                            {label}
                                        </div>
                                        <div
                                            style={{
                                                fontFamily, fontWeight, fontStyle, letterSpacing,
                                                fontSize: (cw * adv.coverTitleSize) / 100, lineHeight: 1.08,
                                            }}
                                        >
                                            {b.title}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            position: "absolute", left: inset, bottom: h * 0.05,
                                            display: "flex", alignItems: "center", gap: cw * 0.03,
                                            fontFamily: SANS, fontSize: (cw * adv.readsSize) / 100, opacity: 0.7,
                                        }}
                                    >
                                        <span style={{ width: cw * 0.06, height: 1, background: "currentColor" }} />
                                        <span>{b.subtitle}</span>
                                    </div>
                                    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.2)" }} />
                                </div>
                            </div>
                        </div>
                    )
                })}
                {adv.grain > 0 && (
                    <div
                        style={{
                            position: "absolute", inset: 0, opacity: (adv.grain / 100) * 0.5, mixBlendMode: "overlay",
                            backgroundImage:
                                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
                        }}
                    />
                )}
                {adv.vignette > 0 && (
                    <div
                        style={{
                            position: "absolute", inset: 0,
                            background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${adv.vignette / 100}) 100%)`,
                        }}
                    />
                )}
            </div>
        </div>
    )
}

addPropertyControls(BookshelfCoverFlip, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Colour behind the shelf.",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "serif",
        defaultValue: { fontSize: 16, lineHeight: "1em" },
        description: "Typeface of the spine and cover titles.",
    },
    label: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "Grokipedia",
        description: "Small label above the title on every cover.",
    },
    monogram: {
        type: ControlType.String,
        title: "Monogram",
        defaultValue: "G",
        description: "Mark at the foot of every spine.",
    },
    books: {
        type: ControlType.Array,
        title: "Books",
        maxCount: 6,
        description: "Each book on the shelf: its spine, its cover and the words on both.",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title", defaultValue: "Untitled", description: "Shown down the spine and on the cover." },
                subtitle: { type: ControlType.String, title: "Reads", defaultValue: "1M reads", description: "Small line at the foot of the cover." },
                spineColor: { type: ControlType.Color, title: "Spine", defaultValue: "#3D4D6C", description: "Spine colour." },
                textColor: { type: ControlType.Color, title: "Spine Text", defaultValue: "#FFFFFF", description: "Colour of the spine title and monogram." },
                coverColor: { type: ControlType.Color, title: "Cover", defaultValue: "#3D4D6C", description: "Cover colour; the cover text picks black or white to suit it." },
                cover: { type: ControlType.ResponsiveImage, title: "Image", description: "Cover picture. Empty draws the built-in engraving." },
            },
        },
        defaultValue: [
            { title: "United States", subtitle: "18M reads", spineColor: "#181924", textColor: "#FFFFFF", coverColor: "#1C2538" },
            { title: "J. Robert Oppenheimer", subtitle: "9.4M reads", spineColor: "#EDE3CF", textColor: "#2A2A2A", coverColor: "#E4D9C2" },
            { title: "Wikipedia", subtitle: "12M reads", spineColor: "#E6DABE", textColor: "#2A2A2A", coverColor: "#E9DFC6" },
            { title: "Elon Musk", subtitle: "21M reads", spineColor: "#A9482A", textColor: "#FFFFFF", coverColor: "#A9482A" },
        ],
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 200,
        max: 800,
        step: 1,
        unit: "px",
        defaultValue: 440,
        description: "Spine height. Covers and spacing follow; the shelf shrinks to fit the frame.",
    },
    spineWidth: {
        type: ControlType.Number,
        title: "Spine Width",
        min: 6,
        max: 24,
        step: 1,
        unit: "%",
        defaultValue: 14,
        description: "Spine thickness as a share of its height.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "How fast books turn and the shelf cycles. 0 stops it.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Strength of the lift and lean under the pointer. 0 turns it off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            openMs: { type: ControlType.Number, title: "Open", min: 100, max: 3000, step: 10, unit: "ms", defaultValue: 530, description: "Time for a book to turn to its cover." },
            closeMs: { type: ControlType.Number, title: "Close", min: 100, max: 3000, step: 10, unit: "ms", defaultValue: 670, description: "Time for a book to turn back to its spine." },
            holdMs: { type: ControlType.Number, title: "Hold", min: 300, max: 10000, step: 50, unit: "ms", defaultValue: 2600, description: "How long each book stays open when nothing is hovered." },
            idleMs: { type: ControlType.Number, title: "Idle", min: 0, max: 10000, step: 50, unit: "ms", defaultValue: 2600, description: "Rest after the pointer leaves before cycling resumes." },
            autoPlay: { type: ControlType.Boolean, title: "Auto Play", defaultValue: true, description: "Open the books in turn when nothing is hovered." },
            coverScale: { type: ControlType.Number, title: "Cover Scale", min: 100, max: 160, step: 1, unit: "%", defaultValue: 118, description: "How much larger an open book draws than a spine." },
            coverAspect: { type: ControlType.Number, title: "Cover Aspect", min: 40, max: 100, step: 1, unit: "%", defaultValue: 69, description: "Cover width as a share of its height." },
            gap: { type: ControlType.Number, title: "Gap", min: 0, max: 12, step: 1, unit: "%", defaultValue: 3, description: "Space between books, as a share of spine height." },
            heightJitter: { type: ControlType.Number, title: "Height Variety", min: 0, max: 15, step: 1, unit: "%", defaultValue: 3, description: "How much spine heights differ." },
            perspective: { type: ControlType.Number, title: "Perspective", min: 400, max: 6000, step: 50, unit: "px", defaultValue: 1600, description: "Camera distance for the turn." },
            lift: { type: ControlType.Number, title: "Lift", min: 0, max: 10, step: 1, unit: "%", defaultValue: 3, description: "How far a hovered book rises." },
            tilt: { type: ControlType.Number, title: "Tilt", min: 0, max: 20, step: 1, unit: "°", defaultValue: 6, description: "How far a hovered book leans with the pointer." },
            titleSize: { type: ControlType.Number, title: "Spine Text", min: 20, max: 80, step: 1, unit: "%", defaultValue: 44, description: "Spine title size, share of spine width." },
            monogramSize: { type: ControlType.Number, title: "Monogram Size", min: 10, max: 60, step: 1, unit: "%", defaultValue: 28, description: "Monogram size, share of spine width." },
            monogramOpacity: { type: ControlType.Number, title: "Monogram Alpha", min: 0, max: 100, step: 1, unit: "%", defaultValue: 45, description: "Monogram opacity." },
            textOpacity: { type: ControlType.Number, title: "Text Alpha", min: 0, max: 100, step: 1, unit: "%", defaultValue: 92, description: "Spine title opacity." },
            coverTitleSize: { type: ControlType.Number, title: "Cover Title", min: 5, max: 25, step: 1, unit: "%", defaultValue: 13, description: "Cover title size, share of cover width." },
            kickerSize: { type: ControlType.Number, title: "Label Size", min: 2, max: 12, step: 1, unit: "%", defaultValue: 5, description: "Cover label size, share of cover width." },
            readsSize: { type: ControlType.Number, title: "Reads Size", min: 2, max: 10, step: 1, unit: "%", defaultValue: 4, description: "Reads line size, share of cover width." },
            coverStrip: { type: ControlType.Number, title: "Cover Strip", min: 0, max: 15, step: 1, unit: "%", defaultValue: 6, description: "Darker binding strip on the cover's left edge." },
            artScale: { type: ControlType.Number, title: "Art Scale", min: 30, max: 100, step: 1, unit: "%", defaultValue: 100, description: "Size of the built-in cover art." },
            shade: { type: ControlType.Number, title: "Shade", min: 0, max: 50, step: 1, unit: "%", defaultValue: 12, description: "Darkening toward the spine's right and bottom." },
            highlight: { type: ControlType.Number, title: "Highlight", min: 0, max: 40, step: 1, unit: "%", defaultValue: 8, description: "Light along the spine's left edge." },
            shadowOpacity: { type: ControlType.Number, title: "Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 55, description: "Contact shadow under each book." },
            floorColor: { type: ControlType.Color, title: "Floor", defaultValue: "#FFFFFF", description: "Colour of the floor line and sheen." },
            floorOpacity: { type: ControlType.Number, title: "Floor Alpha", min: 0, max: 100, step: 1, unit: "%", defaultValue: 10, description: "Strength of the floor line and sheen." },
            rowOffset: { type: ControlType.Number, title: "Row Offset", min: -30, max: 30, step: 1, unit: "%", defaultValue: 0, description: "Moves the shelf up or down." },
            starColor: { type: ControlType.Color, title: "Accent", defaultValue: "#D9A55A", description: "Gold of the built-in art's stars and suns." },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Darkening at the edges." },
        },
    },
})

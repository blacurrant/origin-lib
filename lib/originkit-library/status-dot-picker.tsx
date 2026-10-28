import * as React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

const DEFAULT_IMAGE = {"src":"https://images.unsplash.com/photo-1792676818211-6ab6ccfd86c4?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""}

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    hover: 50,
    grain: 0,
    vignette: 0,
    centerX: 50,
    centerY: 52,
    avatarScale: 120,
    openMs: 340,
    closeMs: 270,
    staggerMs: 40,
    openDelayMs: 120,
    closeDelayMs: 350,
    morphBlur: 8,
    labelBlur: 4,
    labelFadeMs: 180,
    tooltipSlideMs: 140,
    glossMs: 250,
    glossStrength: 75,
    buttonSize: 44,
    buttonGap: 50,
    trayX: 43,
    trayY: 50,
    trayPad: 5,
    ringSize: 37,
    dotSize: 26,
    dotY: 39,
    tooltipGap: 5,
    iconSize: 52,
    glassColor: "#1C1C1E",
    glassOpacity: 92,
    borderColor: "#2E2E32",
    tooltipColor: "#232326",
    textColor: "#F4F4F4",
    shadowOpacity: 45,
    parallax: 10,
    demoRestMs: 1200,
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

const isBrowser = typeof window !== "undefined"
const useIsoLayoutEffect = isBrowser ? useLayoutEffect : useEffect

const STATUS_KEYS = ["online", "focus", "dnd"]
const DEMO_LEN = 7.4

function num(v: any, d: number) {
    return typeof v === "number" && isFinite(v) ? v : d
}
function clamp(v: number, a = 0, b = 1) {
    return v < a ? a : v > b ? b : v
}
function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}
function smooth(v: number) {
    const x = clamp(v)
    return x * x * (3 - 2 * x)
}
function approach(v: number, target: number, stepSize: number) {
    if (v < target) return Math.min(target, v + stepSize)
    if (v > target) return Math.max(target, v - stepSize)
    return v
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx
    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by
    const sx = (u: number) => ((ax * u + bx) * u + cx) * u
    const sy = (u: number) => ((ay * u + by) * u + cy) * u
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let lo = 0
        let hi = 1
        let u = x
        for (let i = 0; i < 22; i++) {
            u = (lo + hi) / 2
            if (sx(u) < x) lo = u
            else hi = u
        }
        return sy(u)
    }
}
const OPEN_EASE = bezier(0.63, 0.08, 0.23, 0.85)
const CLOSE_EASE = bezier(0.2, 0.8, 0.2, 1)

function parseColor(c: any): number[] {
    if (typeof c !== "string") return [0, 0, 0, 1]
    const s = c.trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((x) => x + x)
                .join("")
        const n = parseInt(h.slice(0, 6), 16) || 0
        const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
    }
    const m = s.match(/rgba?\(([^)]+)\)/i)
    if (m) {
        const p = m[1]
            .split(/[\s,\/]+/)
            .filter(Boolean)
            .map(parseFloat)
        return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] ?? 1]
    }
    return [0, 0, 0, 1]
}
function rgba(c: any, a: number) {
    const [r, g, b, ca] = parseColor(c)
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clamp(a * ca)})`
}
function mixRgb(c: any, to: number[], t: number) {
    const [r, g, b] = parseColor(c)
    return `rgb(${Math.round(lerp(r, to[0], t))},${Math.round(lerp(g, to[1], t))},${Math.round(lerp(b, to[2], t))})`
}
function buttonFill(c: any) {
    return `radial-gradient(120% 100% at 50% 6%, ${mixRgb(c, [255, 255, 255], 0.26)} 0%, ${mixRgb(c, [255, 255, 255], 0)} 55%, ${mixRgb(c, [0, 0, 0], 0.12)} 100%)`
}
function srcOf(v: any): string {
    if (!v) return ""
    if (typeof v === "string") return v
    return typeof v.src === "string" ? v.src : ""
}

let measureCtx: CanvasRenderingContext2D | null = null
function textWidth(label: string, f: any, fs: number) {
    if (!isBrowser) return label.length * fs * 0.55
    if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")
    if (!measureCtx) return label.length * fs * 0.55
    measureCtx.font = `${f.fontStyle || "normal"} ${f.fontWeight || 600} ${fs}px ${f.fontFamily || "Inter, system-ui, sans-serif"}`
    let w = measureCtx.measureText(label).width
    const ls = f.letterSpacing
    let lsPx = 0
    if (typeof ls === "number") lsPx = ls
    else if (typeof ls === "string") {
        const v = parseFloat(ls) || 0
        lsPx = ls.trim().endsWith("em") ? v * fs : v
    }
    w += lsPx * Math.max(0, label.length - 1)
    return w
}

// ── built-in portrait ──
function seeded(seed: number) {
    let s = seed % 2147483647
    if (s <= 0) s += 2147483646
    return () => (s = (s * 16807) % 2147483647) / 2147483647
}
const GREENS = ["#5DB451", "#4C9E45", "#71C25E", "#3E8040", "#86C96E", "#2F6B36"]
function leafSet(seed: number, n: number, fx: (r: () => number) => number, fy: (r: () => number) => number, sMin: number, sMax: number) {
    const r = seeded(seed)
    return Array.from({ length: n }, () => ({
        x: fx(r),
        y: fy(r),
        s: sMin + r() * (sMax - sMin),
        a: r() * 360,
        c: GREENS[Math.floor(r() * GREENS.length)],
    }))
}
const LEAF = "M0 -1 C0.62 -0.55 0.62 0.55 0 1 C-0.62 0.55 -0.62 -0.55 0 -1 Z"
const CANOPY = leafSet(11, 34, (r) => r() * 70 - 5, (r) => r() * 48 - 6, 5, 10)
const BUSH_L = leafSet(23, 46, (r) => r() * 62 - 4, (r) => 92 + r() * 110, 6, 12)
const BUSH_R = leafSet(37, 46, (r) => 140 + r() * 64, (r) => 88 + r() * 114, 6, 12)
const FRONT = leafSet(53, 26, (r) => r() * 210 - 5, (r) => 176 + r() * 30, 11, 19)
const FLOWERS = [
    { x: 26, y: 128, c: "#FFFFFF" },
    { x: 40, y: 150, c: "#F29A9A" },
    { x: 16, y: 162, c: "#FFFFFF" },
    { x: 54, y: 118, c: "#FFFFFF" },
    { x: 168, y: 130, c: "#FFFFFF" },
    { x: 183, y: 150, c: "#FFFFFF" },
    { x: 160, y: 166, c: "#F29A9A" },
    { x: 150, y: 116, c: "#FFFFFF" },
]
const CURLS = (() => {
    const r = seeded(71)
    const out: any[] = []
    for (let i = 0; i < 28; i++) {
        const a = Math.PI * (1.02 + r() * 0.96)
        const rr = 0.75 + r() * 0.3
        out.push({
            x: 100 + Math.cos(a) * 29 * rr,
            y: 84 + Math.sin(a) * 24 * rr,
            r: 5 + r() * 3.5,
            c: r() < 0.5 ? "#2B2323" : "#3B2C26",
        })
    }
    return out
})()

function Leaves({ set }: { set: any[] }) {
    return (
        <>
            {set.map((l, i) => (
                <path key={i} d={LEAF} fill={l.c} transform={`translate(${l.x} ${l.y}) rotate(${l.a}) scale(${l.s * 0.62} ${l.s})`} />
            ))}
        </>
    )
}

function Portrait({ uid }: { uid: string }) {
    return (
        <svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
            <defs>
                <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#E4E1C9" />
                    <stop offset="1" stopColor="#CFE0DD" />
                </linearGradient>
                <filter id={`${uid}-blur`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.4" />
                </filter>
            </defs>
            <rect width="200" height="200" fill={`url(#${uid}-sky)`} />
            <path d="M0 88 C30 68 55 76 80 86 C105 72 135 64 165 78 C180 84 192 82 200 78 L200 200 L0 200 Z" fill="#B6C1A6" />
            <path d="M0 104 C25 90 52 96 72 104 C100 92 140 88 200 100 L200 200 L0 200 Z" fill="#98A96D" />
            <path d="M0 122 C30 112 60 116 90 124 C120 114 160 110 200 120 L200 200 L0 200 Z" fill="#6B7950" />
            <path d="M-2 40 C18 50 32 62 42 86 L49 84 C39 58 26 44 6 30 Z" fill="#6E4B30" />
            <Leaves set={CANOPY} />
            <Leaves set={BUSH_L} />
            <Leaves set={BUSH_R} />
            {FLOWERS.map((f, i) => (
                <g key={i} transform={`translate(${f.x} ${f.y})`}>
                    {[0, 1, 2, 3, 4].map((k) => (
                        <circle key={k} cx={Math.cos((k / 5) * Math.PI * 2) * 3} cy={Math.sin((k / 5) * Math.PI * 2) * 3} r="2.6" fill={f.c} />
                    ))}
                    <circle r="1.7" fill="#F2C94C" />
                </g>
            ))}
            <path d="M38 205 C40 168 62 152 100 150 C138 152 160 168 162 205 Z" fill="#1E1A1A" />
            <path d="M88 126 L88 151 C95 158 105 158 112 151 L112 126 Z" fill="#B8875F" />
            <path d="M84 151 C90 160 110 160 116 151" stroke="#2B2323" strokeWidth="2.4" fill="none" />
            <ellipse cx="73" cy="104" rx="5" ry="8" fill="#C99470" />
            <ellipse cx="127" cy="104" rx="5" ry="8" fill="#C99470" />
            <ellipse cx="100" cy="100" rx="27" ry="32" fill="#D9A882" />
            <path d="M72 96 C70 74 82 62 100 62 C120 62 132 74 128 96 C124 86 118 80 100 80 C84 80 76 86 72 96 Z" fill="#2B2323" />
            {CURLS.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={c.c} />
            ))}
            <path d="M82 90 C86 87 92 87 95 89" stroke="#2B2323" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <path d="M105 89 C108 87 114 87 118 90" stroke="#2B2323" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <ellipse cx="89" cy="98" rx="2.4" ry="2.8" fill="#2B2323" />
            <ellipse cx="111" cy="98" rx="2.4" ry="2.8" fill="#2B2323" />
            <path d="M100 98 C98 106 96 110 99 112 C101 112.5 103 112 104 110" stroke="#A8724F" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <path d="M73 102 C74 124 86 141 100 142 C114 141 126 124 127 102 C122 112 116 116 112 118 C106 114 94 114 88 118 C84 116 78 112 73 102 Z" fill="#3A2B25" />
            <path d="M86 118 C92 113 98 115 100 117 C102 115 108 113 114 118 C108 118 104 119 100 120 C96 119 92 118 86 118 Z" fill="#2E221E" />
            <ellipse cx="100" cy="123.5" rx="9" ry="4.6" fill="#5A2A26" />
            <path d="M91.5 121 C96 122.5 104 122.5 108.5 121 L108 123 C104 124 96 124 92 123 Z" fill="#F5F0E8" />
            <g filter={`url(#${uid}-blur)`}>
                <Leaves set={FRONT} />
            </g>
        </svg>
    )
}

// ── status icons ──
function StatusIcon({ kind, color }: { kind: number; color: string }) {
    if (kind === 0)
        return (
            <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ display: "block" }}>
                <path
                    d="M12 4.2c-4.97 0-9 3.13-9 7 0 2.1 1.2 3.98 3.1 5.26-.17 1.2-.7 2.3-1.6 3.24 1.9-.1 3.5-.75 4.7-1.7.9.2 1.8.3 2.8.3 4.97 0 9-3.13 9-7s-4.03-7.1-9-7.1z"
                    fill="#FFFFFF"
                />
            </svg>
        )
    if (kind === 1)
        return (
            <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ display: "block" }}>
                <circle cx="12" cy="12" r="8.4" stroke="#FFFFFF" strokeWidth="2.3" fill="none" />
                <circle cx="12" cy="12" r="4.4" stroke="#FFFFFF" strokeWidth="2.3" fill="none" />
                <circle cx="12" cy="12" r="1.4" fill="#FFFFFF" />
            </svg>
        )
    return (
        <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ display: "block" }}>
            <path
                d="M12 3a1.5 1.5 0 0 0-1.5 1.5v.4A5.5 5.5 0 0 0 6.5 10.3V14l-1.6 2.2a.6.6 0 0 0 .5 1h13.2a.6.6 0 0 0 .5-1L17.5 14v-3.7a5.5 5.5 0 0 0-4-5.4v-.4A1.5 1.5 0 0 0 12 3z"
                fill="#FFFFFF"
            />
            <path d="M10 18.3a2 2 0 0 0 4 0z" fill="#FFFFFF" />
            <line x1="4" y1="4" x2="20" y2="20" stroke={color} strokeWidth="3.6" strokeLinecap="round" />
            <line x1="4" y1="4" x2="20" y2="20" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
    )
}

const GRAIN_BG = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

/**
 * Status Dot Picker — an avatar's status dot grows into a three-button pill, a tooltip names the
 * hovered status, and a pick squeezes the pill back into a dot of that colour.
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function StatusDotPicker(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        onlineColor = "#28C840",
        focusColor = "#FFC300",
        dndColor = "#FF7A1A",
        onlineLabel = "Online",
        focusLabel = "Focus",
        dndLabel = "Do Not Disturb",
        font = {},
        image = DEFAULT_IMAGE,
        images,
        size = 320,
        speed = 50,
        status = "dnd",
        style,
    } = props

    const propsRef = useRef(props)
    propsRef.current = props

    const rootRef = useRef<HTMLDivElement>(null)
    const avatarRef = useRef<HTMLDivElement>(null)
    const capRef = useRef<HTMLDivElement>(null)
    const btnRefs = useRef<(HTMLDivElement | null)[]>([])
    const iconRefs = useRef<(HTMLDivElement | null)[]>([])
    const glossRefs = useRef<(HTMLDivElement | null)[]>([])
    const tipRef = useRef<HTMLDivElement>(null)
    const labelRefs = useRef<(HTMLDivElement | null)[]>([])
    const grainRef = useRef<HTMLDivElement>(null)
    const vigRef = useRef<HTMLDivElement>(null)
    const uid = useRef("okav" + Math.random().toString(36).slice(2, 8)).current

    const [loaded, setLoaded] = useState<Record<string, boolean>>({})
    const markLoaded = (src: string) => setLoaded((m) => (m[src] ? m : { ...m, [src]: true }))

    const f = { fontFamily: "Inter, system-ui, sans-serif", fontWeight: 600, letterSpacing: "-0.01em", ...(font || {}) }
    const { fontSize: _ignoredFontSize, ...fontRest } = f as any

    const colors = [onlineColor, focusColor, dndColor]
    const labels = [onlineLabel, focusLabel, dndLabel]
    const avatarSrc = srcOf(image)
    const iconSrcs = (Array.isArray(images) ? images : []).map(srcOf).filter(Boolean)

    useIsoLayoutEffect(() => {
        const root = rootRef.current
        if (!root) return
        const rt = RenderTarget.current()
        const isStatic = rt === RenderTarget.thumbnail || rt === RenderTarget.export
        let reduced = false
        try {
            reduced = isBrowser && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
        } catch (e) {}
        const still = isStatic || reduced

        const S: any = {
            w: root.offsetWidth,
            h: root.offsetHeight,
            simT: 0,
            last: -1,
            tw: { from: 0, to: 0, t0: 0, dur: 0, open: false },
            openTarget: false,
            status: Math.max(0, STATUS_KEYS.indexOf(propsRef.current.status ?? "dnd")),
            propStatus: propsRef.current.status,
            lo: [0, 0, 0],
            bh: [0, 0, 0],
            tv: 0,
            tx: 0,
            tW: 0,
            tipInit: false,
            tipIdx: 0,
            glossT0: -10,
            lock: false,
            inTime: 0,
            outTime: 0,
            demo: false,
            demoT: 0,
            s0: 0,
            idle: 1e9,
            px: 0,
            py: 0,
        }
        const ptr = { inside: false, x: 0, y: 0, click: false }

        const valP = (t: number) => {
            const tw = S.tw
            const u = tw.dur <= 0 ? 1 : clamp((t - tw.t0) / tw.dur)
            const e = tw.open ? OPEN_EASE(u) : CLOSE_EASE(u)
            return tw.from + (tw.to - tw.from) * e
        }
        const setOpen = (on: boolean, t: number, adv: any) => {
            const cur = valP(t)
            const to = on ? 1 : 0
            const ms = on ? num(adv.openMs, 340) : num(adv.closeMs, 270)
            S.tw = { from: cur, to, t0: t, dur: still ? 0 : (Math.max(0, ms) / 1000) * Math.abs(to - cur), open: on }
            S.openTarget = on
        }
        const select = (i: number, t: number, adv: any) => {
            S.status = i
            setOpen(false, t, adv)
            S.lock = true
            S.glossT0 = t + (num(adv.closeMs, 270) / 1000) * 0.9
        }

        const onMove = (e: PointerEvent) => {
            ptr.inside = true
            ptr.x = e.offsetX
            ptr.y = e.offsetY
        }
        const onEnter = (e: PointerEvent) => onMove(e)
        const onLeave = () => {
            ptr.inside = false
        }
        const onDown = (e: PointerEvent) => {
            onMove(e)
            ptr.click = true
        }
        const onUp = () => {}
        root.addEventListener("pointermove", onMove)
        root.addEventListener("pointerenter", onEnter)
        root.addEventListener("pointerleave", onLeave)
        root.addEventListener("pointerdown", onDown)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        const ro = new ResizeObserver(() => {
            S.w = root.offsetWidth
            S.h = root.offsetHeight
        })
        ro.observe(root)

        const tick = (dt: number) => {
            const P = propsRef.current
            const adv: any = { ...ADVANCED_DEFAULTS, ...(P.advanced ?? {}) }
            const rate = Math.max(0, num(P.speed, 50)) / 50
            const sdt = still ? 0 : dt * rate
            S.simT += sdt
            const t = S.simT
            const w = S.w || 1200
            const h = S.h || 800
            const fit = Math.max(0.05, Math.min(w / 1200, h / 800))
            const D = Math.max(40, num(P.size, 320)) * fit
            const cx = (w * num(adv.centerX, 50)) / 100
            const cy = (h * num(adv.centerY, 52)) / 100
            const hs = num(adv.avatarScale, 120) / 100
            const hk = clamp(num(adv.hover, 50) / 50, 0, 2)

            const b = (num(adv.buttonSize, 44) / 100) * D
            const step = (num(adv.buttonGap, 50) / 100) * D
            const pad = (num(adv.trayPad, 5) / 100) * D
            const x0 = (num(adv.trayX, 43) / 100) * D
            const sy = (-num(adv.trayY, 50) / 100) * D
            const trayL = x0 - b / 2 - pad
            const trayT = sy - b / 2 - pad
            const trayW = 2 * step + b + 2 * pad
            const trayH = b + 2 * pad
            const r0 = (num(adv.ringSize, 37) / 100) * D
            const dotD = (num(adv.dotSize, 26) / 100) * D
            const dX = trayL + r0 / 2
            const dY = (-num(adv.dotY, 39) / 100) * D
            const slots = [x0, x0 + step, x0 + 2 * step]

            if (P.status !== S.propStatus) {
                S.propStatus = P.status
                S.status = Math.max(0, STATUS_KEYS.indexOf(P.status ?? "dnd"))
                S.glossT0 = t
            }

            // ── pointer hit test ──
            const p0 = valP(t)
            const rx = ptr.x - cx - S.px
            const ry = ptr.y - cy - S.py
            const avR = (D / 2) * (1 + (hs - 1) * p0)
            const capT0 = lerp(dY - r0 / 2, trayT, p0)
            const capW0 = lerp(r0, trayW, p0)
            const capH0 = lerp(r0, trayH, p0)
            const m = 0.06 * D
            const inCap = rx > trayL - m && rx < trayL + capW0 + m && ry > capT0 - m && ry < capT0 + capH0 + m
            const inBridge = p0 > 0.5 && rx > 0 && rx < trayL + capW0 && ry > capT0 && ry < 0
            const inZone = ptr.inside && (Math.hypot(rx, ry) < avR + m * 0.5 || inCap || inBridge)
            let hitIdx = -1
            if (ptr.inside && p0 > 0.6) {
                for (let i = 0; i < 3; i++) if (Math.hypot(rx - slots[i], ry - sy) < b / 2 + pad * 0.5) hitIdx = i
            }

            // ── intent: demo, pointer or still ──
            if (ptr.inside) S.idle = 0
            else S.idle += dt
            const demoOn = !still && !ptr.inside && S.idle * 1000 >= num(adv.demoRestMs, 1200)
            if (demoOn && !S.demo) {
                S.demo = true
                S.demoT = 0
                S.s0 = S.status
            }
            if (!demoOn) S.demo = false

            let wantOpen = S.openTarget
            let hovWant = -1
            if (still) {
                wantOpen = true
                hovWant = hitIdx >= 0 ? hitIdx : S.status
                if (ptr.click && hitIdx >= 0) S.status = hitIdx
            } else if (S.demo) {
                const prev = S.demoT
                let tt = prev + sdt
                const A = (S.s0 + 1) % 3
                const H = (A + 1) % 3
                if (prev < 2.8 && tt >= 2.8) select(A, t, adv)
                if (prev < 6.6 && tt >= 6.6) select(S.s0, t, adv)
                if (tt >= DEMO_LEN) {
                    tt -= DEMO_LEN
                    S.s0 = S.status
                }
                S.demoT = tt
                wantOpen = (tt >= 0.73 && tt < 2.8) || (tt >= 4.13 && tt < 6.6)
                if (tt >= 1.5 && tt < 2.8) hovWant = tt < 2.15 ? H : A
                else if (tt >= 4.85 && tt < 6.6) hovWant = tt < 5.55 ? H : S.s0
            } else {
                if (inZone) {
                    S.outTime = 0
                    if (!S.lock) S.inTime += dt
                } else {
                    S.inTime = 0
                    S.outTime += dt
                    S.lock = false
                }
                if (!S.openTarget && !S.lock && S.inTime * 1000 >= num(adv.openDelayMs, 120)) wantOpen = true
                if (S.openTarget && S.outTime * 1000 >= num(adv.closeDelayMs, 350)) wantOpen = false
                hovWant = hitIdx
                if (ptr.click) {
                    if (hitIdx >= 0) {
                        select(hitIdx, t, adv)
                        wantOpen = false
                        hovWant = -1
                    } else if (inZone && !S.openTarget) {
                        wantOpen = true
                        S.lock = false
                    }
                }
            }
            ptr.click = false
            if (S.openTarget !== wantOpen) setOpen(wantOpen, t, adv)
            const p = valP(t)
            const hov = S.openTarget && p > 0.85 ? hovWant : -1

            // ── parallax (pointer response) ──
            const gx = ptr.inside ? clamp((ptr.x - cx) / (w * 0.5), -1, 1) : 0
            const gy = ptr.inside ? clamp((ptr.y - cy) / (h * 0.5), -1, 1) : 0
            const pk = 1 - Math.exp(-dt / 0.25)
            const pAmp = num(adv.parallax, 10) * fit * hk
            S.px += (gx * pAmp - S.px) * (still ? 1 : pk)
            S.py += (gy * pAmp - S.py) * (still ? 1 : pk)

            // ── avatar ──
            const av = avatarRef.current
            if (av) {
                av.style.width = `${D}px`
                av.style.height = `${D}px`
                av.style.transform = `translate3d(${cx - D / 2 + S.px * 0.6}px, ${cy - D / 2 + S.py * 0.6}px, 0) scale(${1 + (hs - 1) * p})`
                av.style.boxShadow = `0 ${0.06 * D}px ${0.16 * D}px rgba(0,0,0,${clamp(num(adv.shadowOpacity, 45) / 100)})`
            }
            const ox = cx + S.px
            const oy = cy + S.py

            // ── the morphing capsule ──
            const cap = capRef.current
            const cT = lerp(dY - r0 / 2, trayT, p)
            const cW = lerp(r0, trayW, p)
            const cH = lerp(r0, trayH, p)
            if (cap) {
                cap.style.width = `${cW}px`
                cap.style.height = `${cH}px`
                cap.style.borderRadius = `${cH / 2}px`
                cap.style.transform = `translate3d(${ox + trayL}px, ${oy + cT}px, 0)`
                cap.style.background = rgba(adv.glassColor, clamp(num(adv.glassOpacity, 92) / 100))
                cap.style.border = `1px solid ${adv.borderColor}`
                cap.style.boxShadow = `0 ${0.02 * D}px ${0.07 * D}px rgba(0,0,0,0.35)`
            }

            // ── buttons ──
            const s = Math.min(0.3, Math.max(0, num(adv.staggerMs, 40) / Math.max(1, num(adv.openMs, 340))))
            const motion = 4 * p * (1 - p)
            const blurMax = num(adv.morphBlur, 8) * fit
            const fadeS = Math.max(0.001, num(adv.labelFadeMs, 180) / 1000)
            for (let i = 0; i < 3; i++) {
                const el = btnRefs.current[i]
                if (!el) continue
                const anchor = i === S.status
                const v = anchor ? 1 : clamp((p - s * i) / Math.max(0.05, 1 - 2 * s))
                const ve = smooth(v)
                const bx = lerp(dX, slots[i], p)
                const by = lerp(dY, sy, p)
                const sz = lerp(dotD, b, p) * (anchor ? 1 : lerp(0.6, 1, ve))
                S.bh[i] = still ? (hov === i ? 1 : 0) : approach(S.bh[i], hov === i ? 1 : 0, dt / 0.15)
                const bh = smooth(S.bh[i])
                const k = 1 + 0.03 * hk * bh
                const blur = still ? 0 : blurMax * (anchor ? 0.25 * motion : 1 - ve + 0.4 * motion)
                el.style.width = `${sz}px`
                el.style.height = `${sz}px`
                el.style.transform = `translate3d(${ox + bx - sz / 2}px, ${oy + by - sz / 2}px, 0) scale(${k})`
                el.style.opacity = `${anchor ? 1 : ve}`
                el.style.filter = `blur(${blur.toFixed(2)}px) brightness(${1 + 0.08 * hk * bh})`
                el.style.zIndex = anchor ? "4" : "3"
                const ic = iconRefs.current[i]
                if (ic) {
                    const isz = (num(adv.iconSize, 52) / 100) * sz
                    ic.style.width = `${isz}px`
                    ic.style.height = `${isz}px`
                    ic.style.opacity = `${anchor ? smooth((p - 0.35) / 0.65) : 1}`
                }
                const gl = glossRefs.current[i]
                if (gl) {
                    const g = (t - S.glossT0) / Math.max(0.01, num(adv.glossMs, 250) / 1000)
                    if (anchor && g >= 0 && g <= 1 && !still) {
                        gl.style.opacity = `${Math.sin(Math.PI * g) * clamp(num(adv.glossStrength, 75) / 100)}`
                        gl.style.transform = `translateX(${lerp(-110, 110, g)}%)`
                    } else gl.style.opacity = "0"
                }
            }

            // ── tooltip ──
            const fsBase = parseFloat(String(P.font?.fontSize ?? 40)) || 40
            const fs = (fsBase * D) / 320
            const th = fs * 2.33
            const padX = fs * 1.75
            if (hov >= 0) S.tipIdx = hov
            const idx = S.tipIdx
            const ff = { fontFamily: "Inter, system-ui, sans-serif", fontWeight: 600, letterSpacing: "-0.01em", ...(P.font || {}) }
            const lbls = [P.onlineLabel ?? "Online", P.focusLabel ?? "Focus", P.dndLabel ?? "Do Not Disturb"]
            const tW = textWidth(String(lbls[idx]), ff, fs) + 2 * padX
            const trayR = trayL + trayW
            const txT = tW >= trayW ? trayL + trayW / 2 : clamp(slots[idx], trayL + tW / 2, trayR - tW / 2)
            S.tv = still ? (hov >= 0 ? 1 : 0) : approach(S.tv, hov >= 0 ? 1 : 0, sdt / fadeS)
            if (hov >= 0) {
                for (let i = 0; i < 3; i++) {
                    const target = hov === i ? 1 : 0
                    S.lo[i] = still || S.tv < 0.02 ? target : approach(S.lo[i], target, sdt / fadeS)
                }
            }
            const slideK = 1 - Math.exp(-sdt / Math.max(0.005, num(adv.tooltipSlideMs, 140) / 3000))
            if (!S.tipInit || S.tv < 0.02 || still) {
                S.tx = txT
                S.tW = tW
                S.tipInit = true
            } else {
                S.tx += (txT - S.tx) * slideK
                S.tW += (tW - S.tW) * slideK
            }
            const tve = smooth(S.tv)
            const tip = tipRef.current
            if (tip) {
                const tyC = trayT - (num(adv.tooltipGap, 5) / 100) * D - th / 2
                const rise = (1 - tve) * 0.03 * D
                tip.style.width = `${S.tW}px`
                tip.style.height = `${th}px`
                tip.style.borderRadius = `${th / 2}px`
                tip.style.transform = `translate3d(${ox + S.tx - S.tW / 2}px, ${oy + tyC - th / 2 + rise}px, 0)`
                tip.style.opacity = `${tve}`
                tip.style.filter = still ? "none" : `blur(${((1 - tve) * num(adv.labelBlur, 4) * 1.5 * fit).toFixed(2)}px)`
                tip.style.background = adv.tooltipColor
                tip.style.border = `1px solid ${adv.borderColor}`
                tip.style.boxShadow = `0 ${0.015 * D}px ${0.05 * D}px rgba(0,0,0,0.3)`
            }
            for (let i = 0; i < 3; i++) {
                const le = labelRefs.current[i]
                if (!le) continue
                const lo = smooth(S.lo[i])
                le.style.fontSize = `${fs}px`
                le.style.color = adv.textColor
                le.style.opacity = `${lo}`
                le.style.filter = still ? "none" : `blur(${((1 - lo) * num(adv.labelBlur, 4) * fit).toFixed(2)}px)`
            }

            // ── overlays ──
            if (grainRef.current) grainRef.current.style.opacity = `${clamp(num(adv.grain, 0) / 100) * 0.6}`
            if (vigRef.current)
                vigRef.current.style.background = `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,${clamp(num(adv.vignette, 0) / 100)}) 100%)`

            root.style.cursor = !still && (hitIdx >= 0 || inZone) ? "pointer" : "default"
        }

        tick(0)
        let raf = 0
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop)
            let dt = S.last < 0 ? 0 : (now - S.last) / 1000
            S.last = now
            dt = Math.min(Math.max(dt, 0), 1 / 20)
            tick(dt)
        }
        raf = requestAnimationFrame(loop)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            root.removeEventListener("pointermove", onMove)
            root.removeEventListener("pointerenter", onEnter)
            root.removeEventListener("pointerleave", onLeave)
            root.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
        }
    }, [])

    const layer: React.CSSProperties = { position: "absolute", left: 0, top: 0, pointerEvents: "none", willChange: "transform" }

    return (
        <div
            ref={rootRef}
            style={{
                minWidth: 1200,
                minHeight: 800,
                ...style,
                position: "relative",
                width: style?.width ?? "100%",
                height: style?.height ?? "100%",
                overflow: "hidden",
                background,
                isolation: "isolate",
                touchAction: "manipulation",
                userSelect: "none",
            }}
        >
            <div ref={avatarRef} style={{ ...layer, zIndex: 1, borderRadius: "50%", transformOrigin: "50% 50%" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden" }}>
                    {!(avatarSrc && loaded[avatarSrc]) && <Portrait uid={uid} />}
                    {avatarSrc ? (
                        <img
                            src={avatarSrc}
                            alt=""
                            draggable={false}
                            onLoad={() => markLoaded(avatarSrc)}
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: loaded[avatarSrc] ? "block" : "none",
                            }}
                        />
                    ) : null}
                </div>
            </div>
            <div ref={capRef} style={{ ...layer, zIndex: 2, boxSizing: "border-box" }} />
            {[0, 1, 2].map((i) => {
                const src = iconSrcs.length ? iconSrcs[i % iconSrcs.length] : ""
                const hasUpload = !!(src && loaded[src])
                return (
                    <div
                        key={i}
                        ref={(el) => {
                            btnRefs.current[i] = el
                        }}
                        style={{
                            ...layer,
                            zIndex: 3,
                            borderRadius: "50%",
                            overflow: "hidden",
                            transformOrigin: "50% 50%",
                            background: buttonFill(colors[i]),
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 5px rgba(0,0,0,0.14)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0,
                        }}
                    >
                        <div
                            ref={(el) => {
                                iconRefs.current[i] = el
                            }}
                            style={{ position: "relative", flex: "none" }}
                        >
                            {!hasUpload && <StatusIcon kind={i} color={colors[i]} />}
                            {src ? (
                                <img
                                    src={src}
                                    alt=""
                                    draggable={false}
                                    onLoad={() => markLoaded(src)}
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                        display: hasUpload ? "block" : "none",
                                    }}
                                />
                            ) : null}
                        </div>
                        <div
                            ref={(el) => {
                                glossRefs.current[i] = el
                            }}
                            style={{
                                position: "absolute",
                                inset: 0,
                                opacity: 0,
                                background: "linear-gradient(115deg, rgba(255,255,255,0) 32%, rgba(255,255,255,1) 50%, rgba(255,255,255,0) 68%)",
                            }}
                        />
                    </div>
                )
            })}
            <div ref={tipRef} style={{ ...layer, zIndex: 5, boxSizing: "border-box", opacity: 0 }}>
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        ref={(el) => {
                            labelRefs.current[i] = el
                        }}
                        style={{
                            ...fontRest,
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            whiteSpace: "nowrap",
                            lineHeight: 1,
                            opacity: 0,
                        }}
                    >
                        {labels[i]}
                    </div>
                ))}
            </div>
            <div
                ref={grainRef}
                style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none", backgroundImage: GRAIN_BG, mixBlendMode: "overlay", opacity: 0 }}
            />
            <div ref={vigRef} style={{ position: "absolute", inset: 0, zIndex: 7, pointerEvents: "none" }} />
        </div>
    )
}

addPropertyControls(StatusDotPicker, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Fill behind the avatar.",
    },
    onlineColor: {
        type: ControlType.Color,
        title: "Online",
        defaultValue: "#28C840",
        description: "Colour of the Online button and dot.",
    },
    focusColor: {
        type: ControlType.Color,
        title: "Focus",
        defaultValue: "#FFC300",
        description: "Colour of the Focus button and dot.",
    },
    dndColor: {
        type: ControlType.Color,
        title: "Do Not Disturb",
        defaultValue: "#FF7A1A",
        description: "Colour of the Do Not Disturb button and dot.",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 40, variant: "Semibold", letterSpacing: "-0.01em", lineHeight: "1em" },
        description: "Tooltip type. Size is at the default avatar size and scales with it.",
    },
    onlineLabel: {
        type: ControlType.String,
        title: "Online Label",
        defaultValue: "Online",
        description: "Tooltip over the first button.",
    },
    focusLabel: {
        type: ControlType.String,
        title: "Focus Label",
        defaultValue: "Focus",
        description: "Tooltip over the second button.",
    },
    dndLabel: {
        type: ControlType.String,
        title: "Busy Label",
        defaultValue: "Do Not Disturb",
        description: "Tooltip over the third button.",
    },
    image: {
        defaultValue: DEFAULT_IMAGE,
        type: ControlType.ResponsiveImage,
        title: "Image",
        description: "Avatar picture. Empty draws the built-in portrait.",
    },
    images: {
        type: ControlType.Array,
        title: "Icons",
        maxCount: 3,
        control: { type: ControlType.ResponsiveImage },
        description: "Button icons in order. One goes on every button; empty draws the built-in icons.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 160,
        max: 600,
        step: 1,
        unit: "px",
        defaultValue: 320,
        description: "Avatar diameter at rest; the pill and tooltip scale with it.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "50 is the shipped rate, 0 stops.",
    },
    status: {
        type: ControlType.Enum,
        title: "Status",
        options: ["online", "focus", "dnd"],
        optionTitles: ["Online", "Focus", "Do Not Disturb"],
        defaultValue: "dnd",
        description: "Starting status shown on the dot.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Pointer response strength; 0 is off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain overlay." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening." },
            centerX: { type: ControlType.Number, title: "Center X", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Avatar centre across." },
            centerY: { type: ControlType.Number, title: "Center Y", min: 0, max: 100, step: 1, unit: "%", defaultValue: 52, description: "Avatar centre down." },
            avatarScale: { type: ControlType.Number, title: "Open Scale", min: 100, max: 150, step: 1, unit: "%", defaultValue: 120, description: "Avatar growth when open." },
            openMs: { type: ControlType.Number, title: "Open", min: 0, max: 2000, step: 10, unit: "ms", defaultValue: 340, description: "Dot to pill duration." },
            closeMs: { type: ControlType.Number, title: "Close", min: 0, max: 2000, step: 10, unit: "ms", defaultValue: 270, description: "Pill to dot duration." },
            staggerMs: { type: ControlType.Number, title: "Stagger", min: 0, max: 200, step: 1, unit: "ms", defaultValue: 40, description: "Delay between buttons." },
            openDelayMs: { type: ControlType.Number, title: "Open Delay", min: 0, max: 1000, step: 10, unit: "ms", defaultValue: 120, description: "Hover time before opening." },
            closeDelayMs: { type: ControlType.Number, title: "Close Delay", min: 0, max: 2000, step: 10, unit: "ms", defaultValue: 350, description: "Time away before closing." },
            morphBlur: { type: ControlType.Number, title: "Morph Blur", min: 0, max: 30, step: 1, unit: "px", defaultValue: 8, description: "Blur on buttons mid-morph." },
            labelBlur: { type: ControlType.Number, title: "Label Blur", min: 0, max: 20, step: 1, unit: "px", defaultValue: 4, description: "Blur on label cross-fades." },
            labelFadeMs: { type: ControlType.Number, title: "Label Fade", min: 10, max: 1000, step: 10, unit: "ms", defaultValue: 180, description: "Tooltip fade time." },
            tooltipSlideMs: { type: ControlType.Number, title: "Tooltip Slide", min: 10, max: 1000, step: 10, unit: "ms", defaultValue: 140, description: "Tooltip move and resize time." },
            glossMs: { type: ControlType.Number, title: "Gloss", min: 50, max: 1500, step: 10, unit: "ms", defaultValue: 250, description: "Shine sweep on a new dot." },
            glossStrength: { type: ControlType.Number, title: "Gloss Strength", min: 0, max: 100, step: 1, unit: "%", defaultValue: 75, description: "Shine brightness." },
            buttonSize: { type: ControlType.Number, title: "Button Size", min: 20, max: 80, step: 1, unit: "%", defaultValue: 44, description: "Button diameter, % of avatar." },
            buttonGap: { type: ControlType.Number, title: "Button Step", min: 20, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Button spacing, % of avatar." },
            trayX: { type: ControlType.Number, title: "Tray X", min: -50, max: 100, step: 1, unit: "%", defaultValue: 43, description: "First button across, % of avatar." },
            trayY: { type: ControlType.Number, title: "Tray Y", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Buttons above centre, % of avatar." },
            trayPad: { type: ControlType.Number, title: "Tray Padding", min: 0, max: 20, step: 1, unit: "%", defaultValue: 5, description: "Pill padding, % of avatar." },
            ringSize: { type: ControlType.Number, title: "Ring Size", min: 10, max: 60, step: 1, unit: "%", defaultValue: 37, description: "Collapsed ring, % of avatar." },
            dotSize: { type: ControlType.Number, title: "Dot Size", min: 5, max: 60, step: 1, unit: "%", defaultValue: 26, description: "Collapsed dot, % of avatar." },
            dotY: { type: ControlType.Number, title: "Dot Y", min: 0, max: 80, step: 1, unit: "%", defaultValue: 39, description: "Dot above centre, % of avatar." },
            tooltipGap: { type: ControlType.Number, title: "Tooltip Gap", min: 0, max: 30, step: 1, unit: "%", defaultValue: 5, description: "Space above the pill, % of avatar." },
            iconSize: { type: ControlType.Number, title: "Icon Size", min: 20, max: 90, step: 1, unit: "%", defaultValue: 52, description: "Icon, % of button." },
            glassColor: { type: ControlType.Color, title: "Pill", defaultValue: "#1C1C1E", description: "Pill and ring fill." },
            glassOpacity: { type: ControlType.Number, title: "Pill Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 92, description: "Pill fill opacity." },
            borderColor: { type: ControlType.Color, title: "Border", defaultValue: "#2E2E32", description: "Pill and tooltip edge." },
            tooltipColor: { type: ControlType.Color, title: "Tooltip", defaultValue: "#232326", description: "Tooltip fill." },
            textColor: { type: ControlType.Color, title: "Text", defaultValue: "#F4F4F4", description: "Tooltip text." },
            shadowOpacity: { type: ControlType.Number, title: "Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 45, description: "Avatar drop shadow." },
            parallax: { type: ControlType.Number, title: "Parallax", min: 0, max: 40, step: 1, unit: "px", defaultValue: 10, description: "Drift toward the pointer." },
            demoRestMs: { type: ControlType.Number, title: "Demo Rest", min: 0, max: 10000, step: 100, unit: "ms", defaultValue: 1200, description: "Idle time before the demo plays." },
        },
    },
})

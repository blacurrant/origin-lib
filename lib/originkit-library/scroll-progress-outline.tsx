import * as React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    rowGap: 58,
    indent: 26,
    textGap: 27,
    headerGap: 69,
    headerSize: 104,
    headerWeight: 500,
    iconWidth: 20,
    stubLength: 24,
    bendInset: 14,
    nodeSize: 10,
    lineWidth: 2,
    dashWidth: 2,
    dashLength: 5,
    dashGap: 5,
    dashColor: "#2E2E2E",
    arrowWidth: 22,
    arrowLength: 26,
    arrowNotch: 18,
    arrowColor: "#E6E6E6",
    headerColor: "#A8A8A8",
    passedColor: "#8A8A8A",
    labelFadeMs: 150,
    smoothMs: 220,
    turnMs: 70,
    cycleMs: 7090,
    downShare: 76,
    restShare: 12,
    hoverPull: 15,
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

const DEFAULT_ITEMS = [
    "Getting started",
    "- Install the kit",
    "- Add a block",
    "- Configure props",
    "Blocks",
    "- Browse the grid",
    "-- Open the inspector",
    "Publish",
]

type Row = { title: string; level: number }
type Pt = { x: number; y: number }
type Geo = {
    N: number
    k: number
    fs: number
    ox: number
    oy: number
    right: number
    nodes: Pt[]
    pts: Pt[]
    cum: number[]
    nodeLen: number[]
    total: number
    d: string
}

const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
const easeInOut = (t: number) => {
    const x = clamp(t)
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3)

function parseRows(items: any): Row[] {
    const list: any[] = Array.isArray(items) && items.length ? items : DEFAULT_ITEMS
    return list.map((raw) => {
        const s = String(raw ?? "")
        const m = s.match(/^\s*(-*)\s*(.*)$/)
        const level = Math.min(3, m ? m[1].length : 0)
        const title = m ? m[2] : s
        return { title, level }
    })
}

function rgbOf(c: any): number[] {
    if (typeof c !== "string") return [255, 255, 255]
    const s = c.trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4)
            h = h
                .slice(0, 3)
                .split("")
                .map((ch) => ch + ch)
                .join("")
        const n = parseInt(h.slice(0, 6), 16)
        if (isNaN(n)) return [255, 255, 255]
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const m = s.match(/rgba?\(([^)]+)\)/i)
    if (m) {
        const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat)
        return [p[0] || 0, p[1] || 0, p[2] || 0]
    }
    return [255, 255, 255]
}

function mixRgb(a: number[], b: number[], t: number): number[] {
    const u = clamp(t)
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
}

const rgbCss = (c: number[]) =>
    `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`

function buildGeo(rows: Row[], title: string, W: number, H: number, size: number, a: any): Geo {
    const N = rows.length
    const sz = Math.max(4, size)
    const u0 = sz / 24
    let longest = 0
    let maxLevel = 0
    rows.forEach((r) => {
        longest = Math.max(longest, r.title.length)
        maxLevel = Math.max(maxLevel, r.level)
    })
    const labelW = (9 + a.textGap + maxLevel * a.indent) * u0 + longest * sz * 0.54
    const headW =
        (9 + a.textGap + 2) * u0 + String(title ?? "").length * sz * (a.headerSize / 100) * 0.54
    const bw = Math.max(labelW, headW, a.iconWidth * u0, 1)
    const bh = Math.max(1, (a.headerGap + Math.max(0, N - 1) * Math.max(1, a.rowGap) + 32) * u0)
    const fit = Math.max(0.05, Math.min(1, (H * 0.9) / bh, (W * 0.92) / bw))
    const k = u0 * fit
    const ox = (W - bw * fit) / 2 + 9 * k
    const oy = (H - bh * fit) / 2 + 16 * k
    const nodes = rows.map((r, i) => ({
        x: ox + r.level * a.indent * k,
        y: oy + (a.headerGap + i * Math.max(1, a.rowGap)) * k,
    }))
    const pts: Pt[] = []
    const nodeIdx: number[] = []
    if (N) {
        pts.push({ x: nodes[0].x, y: nodes[0].y - a.stubLength * k })
        pts.push(nodes[0])
        nodeIdx.push(1)
        for (let i = 1; i < N; i++) {
            const A = nodes[i - 1]
            const B = nodes[i]
            if (Math.abs(B.x - A.x) > 0.5) {
                const bi = Math.min(a.bendInset * k, (B.y - A.y) * 0.45)
                pts.push({ x: A.x, y: A.y + bi })
                pts.push({ x: B.x, y: B.y - bi })
            }
            pts.push(B)
            nodeIdx.push(pts.length - 1)
        }
    }
    const cum = [0]
    for (let j = 1; j < pts.length; j++)
        cum.push(cum[j - 1] + Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y))
    const nodeLen = nodeIdx.map((j) => cum[j])
    const d = pts.map((p, j) => `${j ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")
    return {
        N,
        k,
        fs: sz * fit,
        ox,
        oy,
        right: ox - 9 * k + bw * fit,
        nodes,
        pts,
        cum,
        nodeLen,
        total: cum[cum.length - 1] || 0,
        d,
    }
}

function pointAt(g: Geo, s: number): Pt {
    if (!g.pts.length) return { x: 0, y: 0 }
    const v = clamp(s, 0, g.total)
    for (let j = 1; j < g.pts.length; j++) {
        if (v <= g.cum[j] || j === g.pts.length - 1) {
            const seg = g.cum[j] - g.cum[j - 1]
            const f = seg > 1e-6 ? clamp((v - g.cum[j - 1]) / seg) : 0
            const A = g.pts[j - 1]
            const B = g.pts[j]
            return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f }
        }
    }
    return g.pts[g.pts.length - 1]
}

function tangentAt(g: Geo, s: number, e: number): number {
    const A = pointAt(g, Math.max(0, s - e))
    const B = pointAt(g, Math.min(g.total, s + e))
    const tx = B.x - A.x
    const ty = B.y - A.y
    if (Math.hypot(tx, ty) < 1e-6) return 0
    return Math.atan2(-tx, ty)
}

function hToS(g: Geo, h: number): number {
    if (!g.N) return 0
    const M = g.N - 1
    const hh = clamp(h, 0, M)
    const i = Math.min(M, Math.floor(hh))
    if (i >= M) return g.nodeLen[M]
    const f = hh - i
    return g.nodeLen[i] + f * (g.nodeLen[i + 1] - g.nodeLen[i])
}

function currentIndex(g: Geo, s: number): number {
    let cur = 0
    for (let i = 0; i < g.N; i++) if (g.nodeLen[i] <= s + 2 * g.k) cur = i
    return cur
}

function demoH(t: number, M: number, a: any): number {
    if (M <= 0) return 0
    const cyc = Math.max(0.5, a.cycleMs / 1000)
    const d = clamp(a.downShare / 100, 0.1, 0.95)
    const tt = (((t % cyc) + cyc) % cyc) / cyc
    if (tt < d) {
        const hold = 0.6
        const u = (tt / d) * (M + hold)
        if (u >= M) return M
        const seg = Math.floor(u)
        const f = u - seg
        const r = clamp(a.restShare / 100, 0, 0.9)
        return seg + (f < r ? 0 : easeInOut((f - r) / (1 - r)))
    }
    // Fast flick back up, then a slow drift toward the top
    return M * (1 - easeOut((tt - d) / (1 - d)))
}

function findScroller(el: HTMLElement | null): any {
    if (typeof window === "undefined") return null
    let n = el ? el.parentElement : null
    while (n && n !== document.body && n !== document.documentElement) {
        const cs = getComputedStyle(n)
        if (/(auto|scroll|overlay)/.test(cs.overflowY) && n.scrollHeight - n.clientHeight > 2) return n
        n = n.parentElement
    }
    const de = document.scrollingElement || document.documentElement
    if (de && de.scrollHeight - window.innerHeight > 2) return window
    return null
}

function readScroll(sc: any): number | null {
    if (!sc) return null
    if (sc === window) {
        const de = document.scrollingElement || document.documentElement
        const r = de.scrollHeight - window.innerHeight
        return r > 2 ? clamp(window.scrollY / r) : null
    }
    const r = sc.scrollHeight - sc.clientHeight
    return r > 2 ? clamp(sc.scrollTop / r) : null
}

const GRAIN_URI =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

/**
 * Scroll Progress Outline
 * An "On this page" outline whose arrow rides the connecting path as the page scrolls.
 * With Autoplay on, it walks itself down the outline whenever the page isn't driving it.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function ScrollProgressOutline(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        activeColor = "#E6E6E6",
        textColor = "#767676",
        lineColor = "#4D4D4D",
        font,
        title = "On this page",
        items = DEFAULT_ITEMS,
        size = 24,
        speed = 11,
        trigger = "scroll",
        autoplay = true,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const rootRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const arrowRef = useRef<SVGPolygonElement>(null)
    const solidRef = useRef<SVGPathElement>(null)
    const labelRefs = useRef<(HTMLDivElement | null)[]>([])
    const nodeRefs = useRef<(SVGCircleElement | null)[]>([])
    const [dims, setDims] = useState({ w: 1200, h: 800 })

    const st = useRef<any>({
        h: 0,
        lastH: 0,
        angle: null as number | null,
        up: false,
        lit: [] as number[],
        over: 0,
        overT: 0,
        hoverRow: -1,
        demoT: 0,
        manualH: 0,
        manualUntil: 0,
        scroller: null,
        scrollerAge: 999,
        usingScroll: false,
    })

    useLayoutEffect(() => {
        const el = rootRef.current
        if (!el) return
        const measure = () => {
            const w = el.offsetWidth || 1200
            const h = el.offsetHeight || 800
            setDims((d) => (d.w === w && d.h === h ? d : { w, h }))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const itemsKey = JSON.stringify(items ?? null)
    const rows = useMemo(() => parseRows(items), [itemsKey])
    const geo = buildGeo(rows, title, dims.w, dims.h, size, adv)

    const geoRef = useRef(geo)
    geoRef.current = geo
    const propsRef = useRef(props)
    propsRef.current = props

    useEffect(() => {
        const target = RenderTarget.current()
        if (target === RenderTarget.thumbnail || target === RenderTarget.export) return
        const isCanvas = target === RenderTarget.canvas
        const reduced =
            typeof window !== "undefined" && window.matchMedia
                ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
                : false
        let raf = 0
        let last = -1
        const tick = (now: number) => {
            raf = requestAnimationFrame(tick)
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            last = now
            const p = propsRef.current
            const g = geoRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const S = st.current
            const N = g.N
            if (!N) return
            const M = N - 1
            const rate = Math.max(0, p.speed ?? 50) / 50

            let scrollP: number | null = null
            if (!isCanvas && (p.trigger ?? "scroll") === "scroll") {
                S.scrollerAge += dt
                if (S.scrollerAge > 1) {
                    S.scroller = findScroller(rootRef.current)
                    S.scrollerAge = 0
                }
                scrollP = readScroll(S.scroller)
            }
            S.usingScroll = scrollP !== null

            let target: number
            if (scrollP !== null) target = scrollP * M
            else if (now < S.manualUntil) target = S.manualH
            else {
                // Autoplay walks the demo; with it off the arrow holds where it is until someone drives it
                if (!reduced && ((p.autoplay ?? true) || isCanvas)) S.demoT += dt * rate
                target = reduced ? 0 : demoH(S.demoT, M, a)
            }

            const hov = Math.max(0, a.hover ?? 50) / 50
            S.over += (S.overT - S.over) * (1 - Math.exp(-dt / 0.12))
            if (S.hoverRow >= 0 && S.hoverRow < N && hov > 0)
                target += (S.hoverRow - target) * clamp((a.hoverPull / 100) * hov) * S.over
            target = clamp(target, 0, M)

            const tau = (Math.max(1, a.smoothMs) / 1000) * Math.min(3, 1 / Math.max(rate, 0.34))
            if (reduced) S.h = target
            else S.h += (target - S.h) * (1 - Math.exp(-dt / tau))
            S.h = clamp(S.h, 0, M)

            const dh = S.h - S.lastH
            S.lastH = S.h
            if (Math.abs(dh) > 1e-4) S.up = dh < 0

            const s = hToS(g, S.h)
            const pt = pointAt(g, s)
            const ang = tangentAt(g, s, 5 * g.k) + (S.up ? Math.PI : 0)
            if (S.angle == null || reduced) S.angle = ang
            else {
                let d = ang - S.angle
                d = ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
                S.angle += d * (1 - Math.exp(-dt / Math.max(0.001, a.turnMs / 1000)))
            }

            const arrow = arrowRef.current
            if (arrow)
                arrow.setAttribute(
                    "transform",
                    `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${((S.angle * 180) / Math.PI).toFixed(2)})`
                )
            const solid = solidRef.current
            if (solid) solid.setAttribute("stroke-dasharray", `${s.toFixed(2)} ${(g.total + 100).toFixed(0)}`)

            const cur = currentIndex(g, s)
            const fadeTau = Math.max(0.001, a.labelFadeMs / 1000 / 2.5)
            const kFade = reduced ? 1 : 1 - Math.exp(-dt / fadeTau)
            const cText = rgbOf(p.textColor ?? "#767676")
            const cPassed = rgbOf(a.passedColor)
            const cActive = rgbOf(p.activeColor ?? "#E6E6E6")
            const cHead = rgbOf(a.headerColor)
            const lineCol = p.lineColor ?? "#4D4D4D"
            const bgCol = p.background ?? "#000000"
            for (let i = 0; i < N; i++) {
                const tgt = i === cur ? 1 : 0
                if (S.lit[i] == null) S.lit[i] = tgt
                S.lit[i] += (tgt - S.lit[i]) * kFade
                let col = mixRgb(i < cur ? cPassed : cText, cActive, S.lit[i])
                if (i === S.hoverRow && hov > 0)
                    col = mixRgb(col, cHead, Math.min(1, 0.7 * hov) * S.over * (1 - S.lit[i]))
                const el = labelRefs.current[i]
                if (el) el.style.color = rgbCss(col)
                const nd = nodeRefs.current[i]
                if (nd) nd.setAttribute("fill", g.nodeLen[i] <= s + 0.5 ? lineCol : bgCol)
            }
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [])

    const rowAt = (x: number, y: number) => {
        const g = geoRef.current
        const a = { ...ADVANCED_DEFAULTS, ...(propsRef.current.advanced ?? {}) }
        if (x < g.ox - 24 * g.k || x > g.right + 24 * g.k) return -1
        const half = (Math.max(1, a.rowGap) * g.k) / 2
        for (let i = 0; i < g.N; i++) if (Math.abs(y - g.nodes[i].y) < half) return i
        return -1
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const S = st.current
        const row = rowAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        if (row >= 0) S.hoverRow = row
        S.overT = row >= 0 ? 1 : 0
        if (overlayRef.current) overlayRef.current.style.cursor = row >= 0 ? "pointer" : "default"
    }
    const onPointerLeave = () => {
        st.current.overT = 0
    }
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const S = st.current
        const g = geoRef.current
        const row = rowAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        if (row < 0 || !g.N) return
        const M = g.N - 1
        if (S.usingScroll && S.scroller) {
            const p = M > 0 ? row / M : 0
            if (S.scroller === window) {
                const de = document.scrollingElement || document.documentElement
                window.scrollTo({ top: p * (de.scrollHeight - window.innerHeight), behavior: "smooth" })
            } else {
                const sc = S.scroller as HTMLElement
                sc.scrollTo({ top: p * (sc.scrollHeight - sc.clientHeight), behavior: "smooth" })
            }
        } else {
            S.manualH = row
            S.manualUntil = performance.now() + 3000
        }
    }
    const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const S = st.current
        const g = geoRef.current
        if (S.usingScroll || !g.N) return
        const a = { ...ADVANCED_DEFAULTS, ...(propsRef.current.advanced ?? {}) }
        const now = performance.now()
        const base = now < S.manualUntil ? S.manualH : S.h
        S.manualH = clamp(base + e.deltaY / (Math.max(1, a.rowGap) * g.k * 2), 0, g.N - 1)
        S.manualUntil = now + 2500
    }

    // First paint from the current state
    const S = st.current
    const N = geo.N
    const h0 = clamp(S.h, 0, Math.max(0, N - 1))
    const s0 = hToS(geo, h0)
    const p0 = pointAt(geo, s0)
    const ang0 = S.angle ?? tangentAt(geo, s0, 5 * geo.k)
    const cur0 = currentIndex(geo, s0)
    const cTextR = rgbOf(textColor)
    const cPassedR = rgbOf(adv.passedColor)
    const cActiveR = rgbOf(activeColor)

    const k = geo.k
    const AW = adv.arrowWidth * k
    const AL = adv.arrowLength * k
    const notch = clamp(adv.arrowNotch / 100, 0, 0.8) * AL
    const arrowPts = `0,${(AL * 0.5).toFixed(2)} ${(AW / 2).toFixed(2)},${(-AL * 0.5).toFixed(2)} 0,${(-AL * 0.5 + notch).toFixed(2)} ${(-AW / 2).toFixed(2)},${(-AL * 0.5).toFixed(2)}`

    const fontStyle: any = { ...(font ?? {}) }
    if (!fontStyle.fontFamily) fontStyle.fontFamily = "Inter, system-ui, -apple-system, sans-serif"
    const iconX = geo.ox - 9 * k
    const iconW = adv.iconWidth * k
    const iconStroke = Math.max(1, 2 * k)
    const textX0 = geo.ox + adv.textGap * k

    return (
        <div
            ref={rootRef}
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
                userSelect: "none",
            }}
        >
            <svg
                width={dims.w}
                height={dims.h}
                style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
            >
                <g stroke={adv.headerColor} strokeWidth={iconStroke} strokeLinecap="round">
                    <line x1={iconX} y1={geo.oy - 6 * k} x2={iconX + iconW} y2={geo.oy - 6 * k} />
                    <line x1={iconX} y1={geo.oy} x2={iconX + iconW * 0.7} y2={geo.oy} />
                    <line x1={iconX} y1={geo.oy + 6 * k} x2={iconX + iconW} y2={geo.oy + 6 * k} />
                </g>
                <path
                    d={geo.d}
                    fill="none"
                    stroke={adv.dashColor}
                    strokeWidth={Math.max(0.75, adv.dashWidth * 0.75 * k)}
                    strokeDasharray={`${Math.max(1, adv.dashLength * k)} ${Math.max(1, adv.dashGap * k)}`}
                />
                <path
                    ref={solidRef}
                    d={geo.d}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={Math.max(1, adv.lineWidth * k)}
                    strokeLinecap="butt"
                    strokeLinejoin="miter"
                    strokeDasharray={`${s0.toFixed(2)} ${(geo.total + 100).toFixed(0)}`}
                />
                {geo.nodes.map((n, i) => (
                    <circle
                        key={i}
                        ref={(el) => {
                            nodeRefs.current[i] = el
                        }}
                        cx={n.x}
                        cy={n.y}
                        r={Math.max(1.5, (adv.nodeSize * k) / 2)}
                        fill={geo.nodeLen[i] <= s0 + 0.5 ? lineColor : background}
                        stroke={lineColor}
                        strokeWidth={Math.max(1, 1.5 * k)}
                    />
                ))}
                <polygon
                    ref={arrowRef}
                    points={arrowPts}
                    fill={adv.arrowColor}
                    transform={`translate(${p0.x.toFixed(2)} ${p0.y.toFixed(2)}) rotate(${((ang0 * 180) / Math.PI).toFixed(2)})`}
                />
            </svg>
            <div
                style={{
                    ...fontStyle,
                    position: "absolute",
                    left: textX0,
                    top: geo.oy,
                    transform: "translateY(-50%)",
                    fontSize: geo.fs * (adv.headerSize / 100),
                    fontWeight: adv.headerWeight,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    color: adv.headerColor,
                    pointerEvents: "none",
                }}
            >
                {title}
            </div>
            {rows.map((r, i) => {
                const n = geo.nodes[i]
                if (!n) return null
                const lit = i === cur0 ? 1 : 0
                const col = mixRgb(i < cur0 ? cPassedR : cTextR, cActiveR, lit)
                return (
                    <div
                        key={i}
                        ref={(el) => {
                            labelRefs.current[i] = el
                        }}
                        style={{
                            fontWeight: 400,
                            ...fontStyle,
                            position: "absolute",
                            left: n.x + adv.textGap * k,
                            top: n.y,
                            transform: "translateY(-50%)",
                            fontSize: geo.fs,
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                            color: rgbCss(col),
                            pointerEvents: "none",
                        }}
                    >
                        {r.title}
                    </div>
                )
            })}
            {adv.grain > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: GRAIN_URI,
                        backgroundSize: "160px 160px",
                        opacity: clamp(adv.grain / 100) * 0.35,
                        mixBlendMode: "overlay",
                        pointerEvents: "none",
                    }}
                />
            )}
            {adv.vignette > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.9) 100%)",
                        opacity: clamp(adv.vignette / 100),
                        pointerEvents: "none",
                    }}
                />
            )}
            <div
                ref={overlayRef}
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                onPointerDown={onPointerDown}
                onWheel={onWheel}
                style={{ position: "absolute", inset: 0 }}
            />
        </div>
    )
}

addPropertyControls(ScrollProgressOutline, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    activeColor: { type: ControlType.Color, title: "Active", defaultValue: "#E6E6E6" },
    textColor: { type: ControlType.Color, title: "Text", defaultValue: "#767676" },
    lineColor: { type: ControlType.Color, title: "Line", defaultValue: "#4D4D4D" },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    title: { type: ControlType.String, title: "Title", defaultValue: "On this page" },
    items: {
        type: ControlType.Array,
        title: "Items",
        maxCount: 20,
        control: { type: ControlType.String, placeholder: "- Section" },
        defaultValue: DEFAULT_ITEMS,
    },
    size: { type: ControlType.Number, title: "Size", min: 8, max: 64, step: 1, unit: "px", defaultValue: 24 },
    speed: { type: ControlType.Number, title: "Speed", min: 0, max: 100, step: 1, defaultValue: 11 },
    trigger: {
        type: ControlType.Enum,
        title: "Trigger",
        options: ["scroll", "auto"],
        optionTitles: ["Scroll", "Auto"],
        defaultValue: "scroll",
        displaySegmentedControl: true,
    },
    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Walks the arrow down the outline on a loop when the page isn't scrolling it. Always plays on the canvas.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            rowGap: { type: ControlType.Number, title: "Row Gap", min: 20, max: 160, step: 1, defaultValue: 58 },
            indent: { type: ControlType.Number, title: "Indent", min: 0, max: 80, step: 1, defaultValue: 26 },
            textGap: { type: ControlType.Number, title: "Text Gap", min: 0, max: 80, step: 1, defaultValue: 27 },
            headerGap: { type: ControlType.Number, title: "Header Gap", min: 20, max: 200, step: 1, defaultValue: 69 },
            headerSize: { type: ControlType.Number, title: "Header Size", min: 50, max: 200, step: 1, unit: "%", defaultValue: 104 },
            headerWeight: { type: ControlType.Number, title: "Header Weight", min: 100, max: 900, step: 100, defaultValue: 500 },
            iconWidth: { type: ControlType.Number, title: "Icon Width", min: 0, max: 60, step: 1, defaultValue: 20 },
            stubLength: { type: ControlType.Number, title: "Stub", min: 0, max: 80, step: 1, defaultValue: 24 },
            bendInset: { type: ControlType.Number, title: "Bend Inset", min: 0, max: 60, step: 1, defaultValue: 14 },
            nodeSize: { type: ControlType.Number, title: "Node Size", min: 2, max: 40, step: 1, defaultValue: 10 },
            lineWidth: { type: ControlType.Number, title: "Line Width", min: 1, max: 10, step: 1, defaultValue: 2 },
            dashWidth: { type: ControlType.Number, title: "Dash Width", min: 1, max: 10, step: 1, defaultValue: 2 },
            dashLength: { type: ControlType.Number, title: "Dash Length", min: 1, max: 30, step: 1, defaultValue: 5 },
            dashGap: { type: ControlType.Number, title: "Dash Gap", min: 1, max: 30, step: 1, defaultValue: 5 },
            dashColor: { type: ControlType.Color, title: "Dash Color", defaultValue: "#2E2E2E" },
            arrowWidth: { type: ControlType.Number, title: "Arrow Width", min: 4, max: 80, step: 1, defaultValue: 22 },
            arrowLength: { type: ControlType.Number, title: "Arrow Length", min: 4, max: 80, step: 1, defaultValue: 26 },
            arrowNotch: { type: ControlType.Number, title: "Arrow Notch", min: 0, max: 80, step: 1, unit: "%", defaultValue: 18 },
            arrowColor: { type: ControlType.Color, title: "Arrow Color", defaultValue: "#E6E6E6" },
            headerColor: { type: ControlType.Color, title: "Header Color", defaultValue: "#A8A8A8" },
            passedColor: { type: ControlType.Color, title: "Passed Color", defaultValue: "#8A8A8A" },
            labelFadeMs: { type: ControlType.Number, title: "Label Fade", min: 0, max: 1000, step: 10, unit: "ms", defaultValue: 150 },
            smoothMs: { type: ControlType.Number, title: "Smoothing", min: 1, max: 1000, step: 10, unit: "ms", defaultValue: 220 },
            turnMs: { type: ControlType.Number, title: "Turn", min: 1, max: 500, step: 5, unit: "ms", defaultValue: 70 },
            cycleMs: { type: ControlType.Number, title: "Demo Cycle", min: 1000, max: 30000, step: 10, unit: "ms", defaultValue: 7090 },
            downShare: { type: ControlType.Number, title: "Down Share", min: 10, max: 95, step: 1, unit: "%", defaultValue: 76 },
            restShare: { type: ControlType.Number, title: "Rest Share", min: 0, max: 90, step: 1, unit: "%", defaultValue: 12 },
            hoverPull: { type: ControlType.Number, title: "Hover Pull", min: 0, max: 100, step: 1, unit: "%", defaultValue: 15 },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
        },
    },
})

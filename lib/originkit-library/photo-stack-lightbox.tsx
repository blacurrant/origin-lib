import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

const DEFAULT_IMAGES = [{"image":{"src":"https://images.unsplash.com/photo-1791965558115-58fb666a7850?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"caption":""},{"image":{"src":"https://images.unsplash.com/photo-1792187790722-66db7d13a53f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"caption":""},{"image":{"src":"https://images.unsplash.com/photo-1792592108795-076164280be6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"caption":""},{"image":{"src":"https://images.unsplash.com/photo-1792614268370-d7a7046adbcf?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"caption":""},{"image":{"src":"https://images.unsplash.com/photo-1792676818211-6ab6ccfd86c4?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"caption":""},{"image":{"src":"https://images.unsplash.com/photo-1792964785281-0397544a4245?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"caption":""}]

/**
 * Photo Stack Lightbox
 * A centred stack of photo cards spreads into a scattered, tilted gallery.
 * A card flies to a centred lightbox with its caption while
 * the rest blur and fade. Click the stack to open it; click empty space to
 * fold the gallery back into the stack.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    hover: 50,
    grain: 0,
    vignette: 0,
    cycleMs: 10970,
    openAtMs: 70,
    spreadMs: 400,
    focusAtMs: 3000,
    focusMs: 300,
    holdMs: 470,
    gapMs: 530,
    hold2Ms: 300,
    collapseAtMs: 9400,
    collapseMs: 600,
    settleMs: 650,
    firstCard: 4,
    secondCard: 5,
    dimOpacity: 35,
    collapseBlur: 10,
    stackX: 683,
    stackY: 360,
    stackScale: 60,
    lightboxY: 308,
    lightboxScale: 189,
    spreadX: 100,
    spreadY: 100,
    shadow: 25,
    hoverLift: 4,
    parallax: 8,
    captionColor: "#9C9584",
    cardFill: "#1C1D1B",
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

const REF_W = 1366
const REF_H = 780
const CX = 683
const CY = 390
const CARD_W = 195
const CARD_H = 260

// Grid slots in reference px (centre) and tilt in degrees at Tilt = 4.
const GRID = [
    { x: 292, y: 184, r: -3 },
    { x: 680, y: 153, r: 3 },
    { x: 1070, y: 197, r: 2 },
    { x: 437, y: 482, r: -3 },
    { x: 680, y: 520, r: -4 },
    { x: 925, y: 468, r: 4 },
]
// Fan inside the collapsed stack: offset from the stack centre, tilt, layer.
const STACK = [
    { dx: -20, dy: 4, r: -8, z: 4 },
    { dx: 0, dy: 0, r: 3, z: 6 },
    { dx: 20, dy: 4, r: 8, z: 5 },
    { dx: -8, dy: 2, r: -4, z: 1 },
    { dx: 8, dy: 2, r: 4, z: 2 },
    { dx: 0, dy: 3, r: -1, z: 3 },
]
const DEPTH = [0.7, 1, 0.8, 1.2, 0.9, 1.1]

// Captions for the built-in photos, shown when no images are added.
const CAPTIONS = [
    "Saturday coffee on a marble table. The slowest, best hour of the week.",
    "The old town clock on the hill, keeping time over the harbour.",
    "A grassy headland at the edge of the city, wind and a long view out to sea.",
    "Bar Kismet. The first place I recommend anyone visiting go for dinner. Best seafood and cocktails in the city.",
    "Point Pleasant Park. Beautiful seaside trails, salty air, and one of my all-time favorite places to log kilometers.",
    "A cold, clear morning on the beach, surf rolling in over the rocks.",
]

const GRAIN_URI = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (v: number) => {
    const t = clamp01(v)
    return t * t * (3 - 2 * t)
}
const num = (v: any, d: number) => (typeof v === "number" && isFinite(v) ? v : d)

function bezier(x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx
    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by
    const sx = (t: number) => ((ax * t + bx) * t + cx) * t
    const sy = (t: number) => ((ay * t + by) * t + cy) * t
    const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let t = x
        for (let i = 0; i < 8; i++) {
            const e = sx(t) - x
            if (Math.abs(e) < 1e-5) break
            const d = dx(t)
            if (Math.abs(d) < 1e-6) break
            t -= e / d
        }
        return sy(clamp01(t))
    }
}
// Measured: fast start, long slow settle.
const EASE_SPREAD = bezier(0.3, 0.1, 0.2, 1)
const EASE_FOCUS = bezier(0.35, 0.15, 0.2, 1)
const EASE_COLLAPSE = bezier(0.4, 0, 0.2, 1)
const LINEAR = (t: number) => t

type Tw = { from: number; to: number; t0: number; dur: number; ease: (t: number) => number }
const still = (v: number): Tw => ({ from: v, to: v, t0: 0, dur: 1, ease: LINEAR })
const twVal = (tw: Tw, now: number) => tw.from + (tw.to - tw.from) * tw.ease(clamp01((now - tw.t0) / tw.dur))
const twDone = (tw: Tw, now: number) => now >= tw.t0 + tw.dur
const tween = (cur: Tw, to: number, dur: number, ease: (t: number) => number, now: number): Tw => ({
    from: twVal(cur, now),
    to,
    t0: now,
    dur: Math.max(1, dur),
    ease,
})

type Scene = { s: number; a: number; f: number; g: number }

function cardIndex(v: number) {
    return Math.min(5, Math.max(0, Math.round(v) - 1))
}

function focusTimes(adv: typeof ADVANCED_DEFAULTS) {
    const D = Math.max(1, adv.focusMs)
    const f1 = adv.focusAtMs
    const x1 = f1 + D + adv.holdMs
    const f2 = x1 + D + adv.gapMs
    const x2 = f2 + D + adv.hold2Ms
    return { D, f1, x1, f2, x2, gridRest: x2 + D + 100 }
}

function seg(ms: number, t0: number, dur: number, ease: (t: number) => number) {
    return ease(clamp01((ms - t0) / Math.max(1, dur)))
}

function autoScene(ms: number, adv: typeof ADVANCED_DEFAULTS): Scene {
    const o0 = adv.openAtMs
    const o1 = o0 + Math.max(1, adv.spreadMs)
    const c0 = adv.collapseAtMs
    const c1 = c0 + Math.max(1, adv.collapseMs)
    let s = 0
    let g = 0
    if (ms >= o0 && ms < o1) {
        const p = (ms - o0) / Math.max(1, adv.spreadMs)
        s = EASE_SPREAD(p)
        g = 0.45 * Math.sin(Math.PI * p)
    } else if (ms >= o1 && ms < c0) {
        s = 1
    } else if (ms >= c0 && ms < c1) {
        const p = (ms - c0) / Math.max(1, adv.collapseMs)
        s = 1 - EASE_COLLAPSE(p)
        g = smooth(p / 0.5)
    } else if (ms >= c1) {
        s = 0
        g = 1 - smooth((ms - c1) / Math.max(1, adv.settleMs))
    }
    const T = focusTimes(adv)
    let a: number
    let f: number
    if (ms < T.f2) {
        a = seg(ms, T.f1, T.D, EASE_FOCUS) - seg(ms, T.x1, T.D, EASE_FOCUS)
        f = cardIndex(adv.firstCard)
    } else {
        a = seg(ms, T.f2, T.D, EASE_FOCUS) - seg(ms, T.x2, T.D, EASE_FOCUS)
        f = cardIndex(adv.secondCard)
    }
    return { s, a: clamp01(a), f, g: clamp01(g) }
}

function srcOf(v: any): string | null {
    if (!v) return null
    if (typeof v === "string") return v
    if (typeof v.src === "string" && v.src) return v.src
    return null
}

// ── built-in photos ──
function Art({ i }: { i: number }) {
    const svg = {
        viewBox: "0 0 300 400",
        preserveAspectRatio: "xMidYMid slice",
        width: "100%",
        height: "100%",
        style: { display: "block" } as React.CSSProperties,
    }
    if (i === 0)
        return (
            <svg {...svg}>
                <rect width="300" height="400" fill="#ECEDEE" />
                <path d="M-10 60 C 60 90, 120 40, 200 110 S 290 130, 320 90" stroke="#B9C1C7" strokeWidth="2" fill="none" />
                <path d="M-10 300 C 50 270, 110 330, 180 290 S 260 250, 320 300" stroke="#C6CCD1" strokeWidth="1.5" fill="none" />
                <path d="M40 -10 C 70 80, 30 160, 90 240 S 70 360, 110 410" stroke="#CDD2D6" strokeWidth="1.2" fill="none" />
                <path d="M230 -10 C 210 90, 260 170, 230 260 S 250 350, 220 410" stroke="#B9C1C7" strokeWidth="1" fill="none" />
                <path d="M-10 200 C 60 190, 90 230, 160 215" stroke="#D3D7DA" strokeWidth="1" fill="none" />
                <rect x="212" y="226" width="44" height="16" rx="8" fill="#0B0B0A" transform="rotate(35 212 226)" />
                <circle cx="150" cy="190" r="82" fill="#0B0B0A" />
                <circle cx="150" cy="190" r="60" fill="#F3F3F1" />
                <circle cx="150" cy="190" r="50" fill="#14100C" />
                <ellipse cx="134" cy="172" rx="14" ry="6" fill="#FFFFFF" opacity="0.18" />
            </svg>
        )
    if (i === 1)
        return (
            <svg {...svg}>
                <defs>
                    <linearGradient id="pslSky1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#8EA6B8" />
                        <stop offset="1" stopColor="#C9D3DA" />
                    </linearGradient>
                </defs>
                <rect width="300" height="400" fill="url(#pslSky1)" />
                <ellipse cx="80" cy="70" rx="120" ry="42" fill="#E8ECEF" opacity="0.8" />
                <ellipse cx="230" cy="36" rx="90" ry="28" fill="#F1F3F5" opacity="0.65" />
                <ellipse cx="210" cy="150" rx="80" ry="22" fill="#E3E8EC" opacity="0.55" />
                <ellipse cx="60" cy="190" rx="70" ry="16" fill="#DCE2E7" opacity="0.5" />
                <rect x="148" y="214" width="4" height="16" fill="#5F6156" />
                <path d="M128 252 Q150 220 172 252 Z" fill="#7F958C" />
                <rect x="132" y="252" width="36" height="42" fill="#F4F4F2" />
                <circle cx="150" cy="273" r="11" fill="#2C3228" />
                <path d="M150 273 L150 266 M150 273 L155 275" stroke="#ECEDEE" strokeWidth="1.5" />
                <rect x="124" y="294" width="52" height="6" fill="#E3E3E0" />
                <rect x="120" y="300" width="60" height="48" fill="#F4F4F2" />
                <rect x="133" y="310" width="8" height="18" fill="#3A3F3A" />
                <rect x="159" y="310" width="8" height="18" fill="#3A3F3A" />
                <rect x="90" y="348" width="120" height="14" fill="#EDEDEA" />
                <rect x="70" y="362" width="160" height="5" fill="#2C3228" />
            </svg>
        )
    if (i === 2)
        return (
            <svg {...svg}>
                <defs>
                    <linearGradient id="pslSky2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#7C99A7" />
                        <stop offset="1" stopColor="#DCE2E4" />
                    </linearGradient>
                    <linearGradient id="pslGrass2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#4A5A33" />
                        <stop offset="1" stopColor="#222821" />
                    </linearGradient>
                </defs>
                <rect width="300" height="190" fill="url(#pslSky2)" />
                <ellipse cx="90" cy="30" rx="130" ry="34" fill="#F2F3F3" opacity="0.85" />
                <ellipse cx="250" cy="60" rx="90" ry="26" fill="#E9ECEC" opacity="0.8" />
                <ellipse cx="170" cy="100" rx="190" ry="26" fill="#4F6E78" opacity="0.85" />
                <ellipse cx="60" cy="140" rx="90" ry="18" fill="#E6EAEB" opacity="0.8" />
                <rect y="160" width="300" height="24" fill="#6F8D96" />
                <path d="M0 184 L120 177 L300 158 L300 400 L0 400 Z" fill="url(#pslGrass2)" />
                <path d="M20 240 L28 226 M60 270 L66 254 M110 230 L116 214 M170 290 L176 272 M230 250 L236 232 M260 330 L266 312 M80 350 L86 332" stroke="#5F6156" strokeWidth="2" opacity="0.5" />
            </svg>
        )
    if (i === 3)
        return (
            <svg {...svg}>
                <rect width="300" height="400" fill="#E8E6E0" />
                <rect x="220" y="30" width="56" height="150" fill="#F8F8F4" stroke="#CFCBC2" strokeWidth="4" />
                <ellipse cx="70" cy="50" rx="80" ry="34" fill="#3E5A34" />
                <ellipse cx="170" cy="120" rx="22" ry="62" fill="#4A6A3C" />
                <ellipse cx="240" cy="160" rx="18" ry="28" fill="#3E5A34" />
                <path d="M20 40 L30 150 M70 50 L60 170" stroke="#3E5A34" strokeWidth="3" />
                <rect y="196" width="300" height="204" fill="#3B2E24" />
                <rect x="0" y="230" width="40" height="70" fill="#8A5A35" />
                <rect x="40" y="208" width="30" height="40" fill="#8A5A35" />
                <path d="M150 198 L252 196 L258 206 L145 208 Z" fill="#8C857A" />
                <path d="M110 216 L252 212 L264 230 L100 234 Z" fill="#8C857A" />
                <path d="M60 246 L254 240 L274 268 L40 276 Z" fill="#938C80" />
                <path d="M10 300 L256 288 L296 342 L0 362 Z" fill="#9A9386" />
                <rect x="70" y="290" width="40" height="12" fill="#F4F4F0" transform="rotate(-3 70 290)" />
                <rect x="180" y="300" width="44" height="14" fill="#F4F4F0" transform="rotate(-3 180 300)" />
                <rect x="140" y="252" width="30" height="8" fill="#F4F4F0" />
                <ellipse cx="130" cy="296" rx="9" ry="20" fill="#D9E0E2" opacity="0.7" />
                <ellipse cx="150" cy="300" rx="8" ry="18" fill="#D9E0E2" opacity="0.6" />
                <rect x="0" y="362" width="300" height="38" fill="#2A211B" />
            </svg>
        )
    if (i === 4)
        return (
            <svg {...svg}>
                <rect width="300" height="400" fill="#EEE9DE" />
                <path d="M0 20 C 40 10, 90 40, 110 90 C 120 150, 100 220, 80 280 L0 290 Z" fill="#2F4A2E" />
                <circle cx="210" cy="70" r="70" fill="#E8A93A" />
                <circle cx="270" cy="140" r="60" fill="#D9822B" />
                <circle cx="180" cy="160" r="46" fill="#F0C25A" />
                <circle cx="250" cy="230" r="50" fill="#C2611F" />
                <circle cx="130" cy="200" r="28" fill="#B9762E" />
                <path d="M60 60 L70 290 M160 120 L166 260 M220 120 L214 270 M260 160 L254 280" stroke="#3A2E24" strokeWidth="3" />
                <ellipse cx="150" cy="250" rx="16" ry="10" fill="#F6F1E4" />
                <path d="M0 300 L140 255 L160 255 L300 300 L300 400 L0 400 Z" fill="#7F9AA6" />
                <path d="M0 300 L140 255 L120 255 L0 286 Z M300 300 L160 255 L180 255 L300 286 Z" fill="#8C6A3A" />
                <circle cx="60" cy="350" r="3" fill="#B9C1C7" />
                <circle cx="190" cy="330" r="2.5" fill="#5F6E73" />
                <circle cx="240" cy="372" r="3" fill="#B9C1C7" />
                <circle cx="120" cy="380" r="2" fill="#5F6E73" />
            </svg>
        )
    return (
        <svg {...svg}>
            <defs>
                <linearGradient id="pslSky5" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2F86C6" />
                    <stop offset="1" stopColor="#A8CFE6" />
                </linearGradient>
            </defs>
            <rect width="300" height="210" fill="url(#pslSky5)" />
            <rect y="205" width="300" height="55" fill="#3F6E93" />
            <path d="M0 250 C 40 240, 80 262, 130 250 S 220 240, 300 256 L300 300 C 220 290, 140 310, 60 296 S 10 300, 0 304 Z" fill="#F0F4F6" />
            <rect y="300" width="300" height="100" fill="#DDE6EA" />
            <path d="M0 330 C 50 320, 90 336, 140 326" stroke="#FFFFFF" strokeWidth="6" fill="none" opacity="0.7" />
            <path d="M110 400 L300 252 L300 400 Z" fill="#2A2A26" />
            <path d="M170 380 L230 320 M220 380 L270 330 M250 360 L290 300" stroke="#3E3E36" strokeWidth="4" />
        </svg>
    )
}



export default function PhotoStackLightbox(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        font,
        images = DEFAULT_IMAGES,
        autoPlay = true,
        speed = 50,
        scale = 100,
        tilt = 4,
        blur = 14,
        rounded = 20,
        style,
    } = props

    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const rootRef = useRef<HTMLDivElement>(null)
    const captionRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const cardRefs = useRef<(HTMLDivElement | null)[]>([])

    const [box, setBox] = useState({ w: 1200, h: 800 })
    const sizeRef = useRef({ w: 0, h: 0 })

    const [loaded, setLoaded] = useState<Record<string, "ok" | "err">>({})
    // Each item is { image, caption }; several go round the six cards in turn.
    const items = (Array.isArray(images) ? images : []).filter(Boolean)
    const cards = GRID.map((_, i) => {
        const it: any = items.length ? items[i % items.length] : null
        if (!it) return { src: null as string | null, caption: CAPTIONS[i] }
        return {
            src: srcOf(it.image) ?? srcOf(it),
            caption: typeof it.caption === "string" ? it.caption.trim() : "",
        }
    })

    const propsRef = useRef<any>(null)
    propsRef.current = {
        autoPlay,
        speed,
        scale,
        tilt,
        blur,
        rounded,
        cardCaptions: cards.map((c) => c.caption),
        advanced: props.advanced,
    }

    const stRef = useRef<any>({
        mode: "auto",
        autoMs: 0,
        last: 0,
        reduced: false,
        scene: { s: 0, a: 0, f: 3, g: 0 } as Scene,
        m: null,
        pointer: { x: 0, y: 0, over: false, down: false },
        overE: 0,
        hov: [0, 0, 0, 0, 0, 0],
        poses: [] as any[],
    })

    const hitAt = (x: number, y: number): number => {
        const st = stRef.current
        const order = st.poses
            .map((p: any, i: number) => ({ p, i }))
            .filter((o: any) => o.p && o.p.op > 0.05)
            .sort((A: any, B: any) => B.p.z - A.p.z)
        for (const { p, i } of order) {
            const dx = x - p.x
            const dy = y - p.y
            const rad = (-p.r * Math.PI) / 180
            const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
            const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
            if (Math.abs(lx) <= p.hw && Math.abs(ly) <= p.hh) return i
        }
        return -1
    }

    const press = (x: number, y: number) => {
        const st = stRef.current
        const P = propsRef.current
        const A = { ...ADVANCED_DEFAULTS, ...(P.advanced ?? {}) }
        const now = performance.now()
        const rate = Math.max(0.1, num(P.speed, 50) / 50)
        const dur = (ms: number) => (st.reduced ? 150 : ms / rate)
        if (st.mode === "auto") {
            const sc: Scene = st.scene
            st.m = { s: still(sc.s), a: still(sc.a), f: sc.f, last: now }
            st.mode = "manual"
        }
        const m = st.m
        m.last = now
        const s = twVal(m.s, now)
        const a = twVal(m.a, now)
        const open = () => {
            m.s = tween(m.s, 1, dur(A.spreadMs), EASE_SPREAD, now)
        }
        const closeFocus = () => {
            m.a = tween(m.a, 0, dur(A.focusMs), EASE_FOCUS, now)
        }
        const hit = hitAt(x, y)
        if (hit >= 0) {
            // the stack opens on a click; a card in the gallery opens to the lightbox
            if (m.s.to === 0) open()
            else if (m.a.to === 1) closeFocus()
            else if (a < 0.05 && s > 0.95) {
                m.f = hit
                m.a = tween(still(0), 1, dur(A.focusMs), EASE_FOCUS, now)
            }
        } else if (m.a.to === 1) closeFocus()
        else if (m.s.to === 1) {
            // empty space folds the gallery back into the stack
            m.a = still(0)
            m.s = tween(m.s, 0, dur(A.collapseMs), EASE_COLLAPSE, now)
        }
    }

    useEffect(() => {
        const root = rootRef.current
        if (!root) return
        const st = stRef.current

        const rt = RenderTarget.current()
        const isStatic = rt === RenderTarget.thumbnail || rt === (RenderTarget as any).export
        const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
        const setReduced = () => {
            st.reduced = isStatic || !!(mq && mq.matches)
        }
        setReduced()
        mq?.addEventListener?.("change", setReduced)

        const measure = () => {
            const w = root.offsetWidth
            const h = root.offsetHeight
            sizeRef.current = { w, h }
            setBox((b) => (b.w === w && b.h === h ? b : { w, h }))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(root)

        const onUp = () => {
            st.pointer.down = false
        }
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        let raf = 0
        const frame = (now: number) => {
            const dt = st.last ? Math.min(1 / 20, (now - st.last) / 1000) : 0
            st.last = now
            const P = propsRef.current
            const A = { ...ADVANCED_DEFAULTS, ...(P.advanced ?? {}) }
            const W = sizeRef.current.w
            const H = sizeRef.current.h
            if (!W || !H) return
            const u = (Math.min(W / REF_W, H / REF_H) * Math.max(10, num(P.scale, 100))) / 100
            const rate = Math.max(0, num(P.speed, 50)) / 50
            const k = Math.max(0, Math.min(100, A.hover)) / 50
            const T = focusTimes(A)

            let scene: Scene
            if (st.mode === "auto") {
                const cyc = Math.max(1000, A.cycleMs)
                if (P.autoPlay === false) st.autoMs = 0
                else if (st.reduced) st.autoMs = (A.openAtMs + A.spreadMs + A.focusAtMs) / 2
                else st.autoMs = (st.autoMs + dt * 1000 * rate) % cyc
                scene = autoScene(st.autoMs, A)
            } else {
                const m = st.m
                const sP = clamp01((now - m.s.t0) / m.s.dur)
                const moving = sP < 1 && m.s.from !== m.s.to
                scene = {
                    s: twVal(m.s, now),
                    a: twVal(m.a, now),
                    f: m.f,
                    g: moving ? (m.s.to === 1 ? 0.45 : 0.6) * Math.sin(Math.PI * sP) : 0,
                }
                // idle: settle, then hand back to the loop at the matching beat
                if (P.autoPlay !== false && now - m.last > 8000) {
                    if (m.a.to === 1 && twDone(m.a, now)) m.a = tween(m.a, 0, A.focusMs / Math.max(0.1, rate), EASE_FOCUS, now)
                    else if (m.a.to === 0 && twDone(m.a, now) && twDone(m.s, now)) {
                        st.autoMs = m.s.to === 1 ? T.gridRest : 0
                        st.mode = "auto"
                    }
                }
            }
            st.scene = scene
            const { s, a, f, g } = scene

            // pointer
            const pt = st.pointer
            st.overE += ((pt.over ? 1 : 0) - st.overE) * (1 - Math.exp(-dt * 6))
            const nx = W ? (pt.x / W - 0.5) * 2 : 0
            const ny = H ? (pt.y / H - 0.5) * 2 : 0
            const hovered = pt.over && s > 0.9 && a < 0.1 ? hitAt(pt.x, pt.y) : -1

            const tiltK = num(P.tilt, 4) / 4
            const blurP = num(P.blur, 14)
            const roundP = num(P.rounded, 20)
            const lbS = A.lightboxScale / 100
            const stS = A.stackScale / 100
            const cw = CARD_W * u
            const ch = CARD_H * u
            const poses: any[] = []

            for (let i = 0; i < 6; i++) {
                const el = cardRefs.current[i]
                if (!el) continue
                const G = GRID[i]
                const S = STACK[i]
                let x = lerp(A.stackX - CX + S.dx, ((G.x - CX) * A.spreadX) / 100, s)
                let y = lerp(A.stackY - CY + S.dy, ((G.y - CY) * A.spreadY) / 100, s)
                let r = lerp(S.r, G.r, s) * tiltK
                let sc = lerp(stS, 1, s)

                const par = A.parallax * k * st.overE * s * (1 - a) * DEPTH[i]
                x += nx * par
                y += ny * par

                const target = hovered === i ? 1 : 0
                st.hov[i] += (target - st.hov[i]) * (1 - Math.exp(-dt * 12))
                const hv = st.hov[i]
                sc *= 1 + (A.hoverLift / 100) * hv * k
                r *= 1 - Math.min(1, 0.8 * hv * k)

                if (i === f && a > 0) {
                    x = lerp(x, 0, a)
                    y = lerp(y, A.lightboxY - CY, a)
                    r = lerp(r, 0, a)
                    sc = lerp(sc, lbS, a)
                }

                const px = W / 2 + x * u
                const py = H / 2 + y * u
                const vr = (roundP / 100) * (CARD_W / 2) * u * Math.sqrt(Math.max(0.01, sc))
                const bl = (i !== f ? a * blurP : 0) + g * A.collapseBlur
                const op = (i !== f ? 1 - a * (1 - A.dimOpacity / 100) : 1) * (1 - 0.7 * g)
                const z = i === f && a > 0.001 ? 30 : s < 0.5 ? S.z : 10 + i

                el.style.transform = `translate3d(${(px - cw / 2).toFixed(2)}px, ${(py - ch / 2).toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg) scale(${sc.toFixed(4)})`
                el.style.borderRadius = `${(vr / sc).toFixed(2)}px`
                el.style.filter = bl > 0.05 ? `blur(${((bl * u) / sc).toFixed(2)}px)` : "none"
                el.style.opacity = op.toFixed(3)
                el.style.zIndex = String(z)
                poses[i] = { x: px, y: py, hw: (cw * sc) / 2, hh: (ch * sc) / 2, r, z, op }
            }
            st.poses = poses


            // caption
            const cap = captionRef.current
            if (cap) {
                const text = String(P.cardCaptions?.[f] ?? "")
                if (cap.textContent !== text) cap.textContent = text
                const ca = clamp01((a - 0.55) / 0.45)
                cap.style.opacity = ca.toFixed(3)
                cap.style.transform = `translateY(${((1 - ca) * 6 * u).toFixed(2)}px)`
            }

            if (overlayRef.current) {
                const h = pt.over ? hitAt(pt.x, pt.y) : -1
                overlayRef.current.style.cursor = h === -1 && s < 0.5 ? "default" : "pointer"
            }
        }
        const loop = (now: number) => {
            frame(now)
            raf = requestAnimationFrame(loop)
        }
        frame(performance.now())
        st.last = 0
        raf = requestAnimationFrame(loop)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            mq?.removeEventListener?.("change", setReduced)
        }
    }, [])

    const u = (Math.min(box.w / REF_W, box.h / REF_H) * Math.max(10, scale)) / 100
    const fs = parseFloat(font?.fontSize) || 13
    const fontCss: React.CSSProperties = {
        fontFamily: font?.fontFamily ?? "Inter, 'SF Pro Text', system-ui, sans-serif",
        fontWeight: font?.fontWeight ?? 400,
        fontStyle: font?.fontStyle,
        letterSpacing: font?.letterSpacing,
    }
    const mark = (src: string, v: "ok" | "err") => setLoaded((L) => (L[src] === v ? L : { ...L, [src]: v }))

    const lightboxBottom = adv.lightboxY + (CARD_H * adv.lightboxScale) / 100 / 2
    const captionTop = box.h / 2 + (lightboxBottom + 23 - CY) * u

    const pointerXY = (e: React.PointerEvent) => {
        const ne = e.nativeEvent as PointerEvent
        return { x: ne.offsetX, y: ne.offsetY }
    }

    return (
        <div
            ref={rootRef}
            style={{
                minWidth: 1200,
                minHeight: 800,
                width: "100%",
                height: "100%",
                ...style,
                position: "relative",
                overflow: "hidden",
                background,
                isolation: "isolate",
                userSelect: "none",
            }}
        >
            {/* photo cards */}
            {GRID.map((_, i) => {
                const src = cards[i].src
                const ok = !!src && loaded[src] === "ok"
                return (
                    <div
                        key={i}
                        ref={(el) => {
                            cardRefs.current[i] = el
                        }}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: CARD_W * u,
                            height: CARD_H * u,
                            overflow: "hidden",
                            transformOrigin: "50% 50%",
                            opacity: 0,
                            background: ok ? adv.cardFill : "transparent",
                            boxShadow: `0 ${6 * u}px ${20 * u}px rgba(0,0,0,${adv.shadow / 100})`,
                            willChange: "transform, filter, opacity",
                            pointerEvents: "none",
                        }}
                    >
                        <div style={{ position: "absolute", inset: 0, opacity: ok ? 0 : 1 }}>
                            <Art i={i} />
                        </div>
                        {src && loaded[src] !== "err" && (
                            <img
                                src={src}
                                alt=""
                                draggable={false}
                                onLoad={() => mark(src, "ok")}
                                onError={() => mark(src, "err")}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                    opacity: ok ? 1 : 0,
                                }}
                            />
                        )}
                    </div>
                )
            })}

            {/* caption */}
            <div
                ref={captionRef}
                style={{
                    position: "absolute",
                    left: box.w / 2 - 165 * u,
                    top: captionTop,
                    width: 330 * u,
                    textAlign: "center",
                    color: adv.captionColor,
                    ...fontCss,
                    fontSize: fs * 0.8 * u,
                    lineHeight: "1.45em",
                    opacity: 0,
                    zIndex: 40,
                    pointerEvents: "none",
                }}
            />

            {/* grain + vignette */}
            {adv.grain > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 50,
                        pointerEvents: "none",
                        backgroundImage: GRAIN_URI,
                        opacity: (adv.grain / 100) * 0.5,
                        mixBlendMode: "overlay",
                    }}
                />
            )}
            {adv.vignette > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 51,
                        pointerEvents: "none",
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${adv.vignette / 100}) 100%)`,
                    }}
                />
            )}

            {/* pointer layer */}
            <div
                ref={overlayRef}
                style={{ position: "absolute", inset: 0, zIndex: 60 }}
                onPointerMove={(e) => {
                    const p = pointerXY(e)
                    const pt = stRef.current.pointer
                    pt.x = p.x
                    pt.y = p.y
                    pt.over = true
                }}
                onPointerLeave={() => {
                    stRef.current.pointer.over = false
                }}
                onPointerDown={(e) => {
                    const p = pointerXY(e)
                    const pt = stRef.current.pointer
                    pt.x = p.x
                    pt.y = p.y
                    pt.over = true
                    pt.down = true
                    press(p.x, p.y)
                }}
            />
        </div>
    )
}

addPropertyControls(PhotoStackLightbox, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Stage colour behind the cards.",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {"fontFamily":"Inter","variant":"Regular","fontWeight":400,"fontSize":13,"lineHeight":"1.31em","letterSpacing":"0em","textAlign":"left"},
        description: "Caption type; captions draw at 80% of its size.",
    },
    images: {
        defaultValue: DEFAULT_IMAGES,
        type: ControlType.Array,
        title: "Images",
        maxCount: 6,
        control: {
            type: ControlType.Object,
            controls: {
                image: { type: ControlType.ResponsiveImage, title: "Image" },
                caption: {
                    type: ControlType.String,
                    title: "Caption",
                    displayTextArea: true,
                    defaultValue: "",
                    description: "Shown under this photo when it opens.",
                },
            },
        },
        description: "Your photos, each with its own caption. One goes on every card, several go round in turn. Empty shows the built-in photos.",
    },
    autoPlay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        enabledTitle: "On",
        disabledTitle: "Off",
        defaultValue: true,
        description: "On plays the open-and-close loop by itself. Off waits as a stack until it is clicked.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "50 plays at the designed rate, 0 stops.",
    },
    scale: {
        type: ControlType.Number,
        title: "Scale",
        min: 30,
        max: 200,
        step: 1,
        unit: "%",
        defaultValue: 100,
        description: "How big the whole layout draws.",
    },
    tilt: {
        type: ControlType.Number,
        title: "Tilt",
        min: 0,
        max: 10,
        step: 1,
        unit: "°",
        defaultValue: 4,
        description: "How far the scattered cards lean.",
    },
    blur: {
        type: ControlType.Number,
        title: "Blur",
        min: 0,
        max: 30,
        step: 1,
        unit: "px",
        defaultValue: 14,
        description: "Blur on the other cards while one is open.",
    },
    rounded: {
        type: ControlType.Number,
        title: "Rounded",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 20,
        description: "Card corner radius as a share of the largest possible.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Strength of the pointer lift and parallax; 0 is off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening." },
            cycleMs: { type: ControlType.Number, title: "Cycle", min: 6000, max: 20000, step: 10, unit: "ms", defaultValue: 10970, description: "Length of one loop." },
            openAtMs: { type: ControlType.Number, title: "Open At", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 70, description: "When the stack spreads." },
            spreadMs: { type: ControlType.Number, title: "Spread", min: 100, max: 2000, step: 10, unit: "ms", defaultValue: 400, description: "Stack to gallery duration." },
            focusAtMs: { type: ControlType.Number, title: "Focus At", min: 500, max: 8000, step: 10, unit: "ms", defaultValue: 3000, description: "When the first card opens." },
            focusMs: { type: ControlType.Number, title: "Focus", min: 100, max: 1500, step: 10, unit: "ms", defaultValue: 300, description: "Card open / close duration." },
            holdMs: { type: ControlType.Number, title: "Hold", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 470, description: "First card held open." },
            gapMs: { type: ControlType.Number, title: "Gap", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 530, description: "Rest between the two cards." },
            hold2Ms: { type: ControlType.Number, title: "Hold 2", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 300, description: "Second card held open." },
            collapseAtMs: { type: ControlType.Number, title: "Collapse At", min: 2000, max: 19000, step: 10, unit: "ms", defaultValue: 9400, description: "When the gallery folds back." },
            collapseMs: { type: ControlType.Number, title: "Collapse", min: 100, max: 2000, step: 10, unit: "ms", defaultValue: 600, description: "Gallery to stack duration." },
            settleMs: { type: ControlType.Number, title: "Settle", min: 0, max: 2000, step: 10, unit: "ms", defaultValue: 650, description: "Stack blur clearing after the collapse." },
            firstCard: { type: ControlType.Number, title: "First Card", min: 1, max: 6, step: 1, defaultValue: 4, description: "Card opened first." },
            secondCard: { type: ControlType.Number, title: "Second Card", min: 1, max: 6, step: 1, defaultValue: 5, description: "Card opened second." },
            dimOpacity: { type: ControlType.Number, title: "Dim Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 35, description: "Opacity of the other cards while one is open." },
            collapseBlur: { type: ControlType.Number, title: "Collapse Blur", min: 0, max: 40, step: 1, unit: "px", defaultValue: 10, description: "Blur on cards folding into the stack." },
            stackX: { type: ControlType.Number, title: "Stack X", min: 0, max: 1366, step: 1, defaultValue: 683, description: "Stack centre, reference px." },
            stackY: { type: ControlType.Number, title: "Stack Y", min: 0, max: 780, step: 1, defaultValue: 360, description: "Stack centre, reference px." },
            stackScale: { type: ControlType.Number, title: "Stack Scale", min: 10, max: 100, step: 1, unit: "%", defaultValue: 60, description: "Card size in the stack." },
            lightboxY: { type: ControlType.Number, title: "Lightbox Y", min: 100, max: 600, step: 1, defaultValue: 308, description: "Open card centre, reference px." },
            lightboxScale: { type: ControlType.Number, title: "Lightbox Scale", min: 100, max: 300, step: 1, unit: "%", defaultValue: 189, description: "Open card size." },
            spreadX: { type: ControlType.Number, title: "Spread X", min: 50, max: 150, step: 1, unit: "%", defaultValue: 100, description: "Horizontal spread of the gallery." },
            spreadY: { type: ControlType.Number, title: "Spread Y", min: 50, max: 150, step: 1, unit: "%", defaultValue: 100, description: "Vertical spread of the gallery." },
            shadow: { type: ControlType.Number, title: "Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 25, description: "Card shadow strength." },
            hoverLift: { type: ControlType.Number, title: "Hover Lift", min: 0, max: 20, step: 1, unit: "%", defaultValue: 4, description: "Scale-up of the card under the pointer." },
            parallax: { type: ControlType.Number, title: "Parallax", min: 0, max: 40, step: 1, unit: "px", defaultValue: 8, description: "Gallery drift toward the pointer." },
            captionColor: { type: ControlType.Color, title: "Caption", defaultValue: "#9C9584", description: "Caption text colour." },
            cardFill: { type: ControlType.Color, title: "Card Fill", defaultValue: "#1C1D1B", description: "Behind an uploaded photo." },
        },
    },
})

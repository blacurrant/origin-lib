import * as React from "react"
import { useLayoutEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/**
 * Bouncing Dot Tabs
 *
 * A centred row of filter tabs. The dot beside the active tab is thrown in a
 * ballistic arc (linear x, gravity y, height ∝ distance) to the clicked tab,
 * stretching tall while airborne and squashing on take-off and landing, while
 * the inline gap it occupies closes at the old tab and opens at the new one.
 * With no pointer, a demo pointer dot glides between tabs and clicks them.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    hover: 50,
    flightMs: 560,
    stepMs: 1000,
    travelMs: 560,
    startDelay: 1000,
    wordGap: 33,
    dotGap: 9,
    dotLead: 9,
    dotYOffset: 1,
    rowY: 50,
    minArc: 22,
    stretch: 30,
    takeoffSquash: 15,
    landSquash: 20,
    landMs: 220,
    fadeMs: 120,
    lean: 4,
    pointerSize: 19,
    pointerColor: "#FFFFFF",
    pointerBlend: false,
    pressScale: 78,
    wander: 150,
    wobble: 2,
    seed: 7,
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

const DEFAULT_LABELS = ["All", "Design", "Engineering", "Product", "Research"]
// Click order of the demo pointer, read from the reference; ends back on "All".
const DEMO_SEQ = [2, 3, 1, 0, 3, 2, 1, 4, 1, 2, 0]

const GRAIN_URI =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -0.3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

function rnd(k: number, salt: number, seed: number) {
    const x = Math.sin((k + 1) * 127.1 + salt * 311.7 + seed * 74.7) * 43758.5453
    return x - Math.floor(x)
}

const COLOR_CACHE = new Map<string, number[]>()
function parseColor(input: any): number[] {
    const key = String(input ?? "")
    const hit = COLOR_CACHE.get(key)
    if (hit) return hit
    let out = [255, 255, 255, 1]
    const s = key.trim()
    const rgb = s.match(
        /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,\/]+([\d.]+%?))?\s*\)/i
    )
    const hex = s.match(/#([0-9a-f]{3,8})\b/i)
    if (hex && (s.startsWith("#") || !rgb)) {
        let h = hex[1]
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((c) => c + c)
                .join("")
        const r = parseInt(h.slice(0, 2), 16)
        const g = parseInt(h.slice(2, 4), 16)
        const b = parseInt(h.slice(4, 6), 16)
        const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
        if ([r, g, b].every((v) => !isNaN(v))) out = [r, g, b, a]
    } else if (rgb) {
        let a = 1
        if (rgb[4] != null)
            a = rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4])
        out = [parseFloat(rgb[1]), parseFloat(rgb[2]), parseFloat(rgb[3]), a]
    }
    COLOR_CACHE.set(key, out)
    return out
}

function mixColor(a: any, b: any, t: number) {
    const A = parseColor(a)
    const B = parseColor(b)
    const r = Math.round(lerp(A[0], B[0], t))
    const g = Math.round(lerp(A[1], B[1], t))
    const bl = Math.round(lerp(A[2], B[2], t))
    const al = Math.round(lerp(A[3], B[3], t) * 1000) / 1000
    return `rgba(${r},${g},${bl},${al})`
}

export default function BouncingDotTabs(props: any) {
    props = withMovedControls(props)
    const {
        labels = ["All", "Design", "Engineering", "Product", "Research"],
        font = {},
        background = "#000000",
        activeColor = "#FFFFFF",
        inactiveColor = "#767676",
        dotColor = "#FFFFFF",
        size = 19,
        arc = 42,
        speed = 83,
        demo = true,
        style,
    } = props

    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const items: string[] = (
        Array.isArray(labels) && labels.length ? labels : DEFAULT_LABELS
    ).map((l: any) => String(l ?? ""))
    const n = items.length

    const fs = font && (font as any).fontSize
    const fontPx = typeof fs === "number" ? fs : parseFloat(fs) || 32
    const fontStyle = {
        fontFamily: "'Helvetica Neue', Helvetica, Inter, Arial, sans-serif",
        fontWeight: 400,
        fontSize: 32,
        letterSpacing: "-0.01em",
        lineHeight: 1.2,
        ...(font || {}),
    }

    const target = RenderTarget.current()
    const isStatic = target === RenderTarget.thumbnail || target === RenderTarget.export

    const rootRef = useRef<HTMLDivElement>(null)
    const dotRef = useRef<HTMLDivElement>(null)
    const ptrRef = useRef<HTMLDivElement>(null)
    const spacerRefs = useRef<(HTMLSpanElement | null)[]>([])
    const labelRefs = useRef<(HTMLSpanElement | null)[]>([])

    const propsRef = useRef<any>(null)
    propsRef.current = {
        n,
        size,
        arc,
        speed,
        demo,
        activeColor,
        inactiveColor,
        fontPx,
        isStatic,
        advanced: props.advanced,
    }

    const stRef = useRef<any>(null)
    if (!stRef.current) {
        stRef.current = {
            active: 0,
            slots: [] as number[],
            slotFrom: [] as number[],
            lit: [] as number[],
            colors: [] as string[],
            flight: null as any,
            landT: -1e9,
            dotX: NaN,
            dotY: NaN,
            lean: 0,
            simT: 0,
            realOver: false,
            realHover: -1,
            downIdx: -1,
            demoT: 0,
            step: 0,
            prev: null as any,
            target: null as any,
            clicked: false,
            pressT: -1e9,
            ptrAlpha: 0,
            holdUntil: 0,
            demoHover: -1,
            reduced: false,
            select: null as any,
        }
    }

    useLayoutEffect(() => {
        const st = stRef.current
        try {
            st.reduced =
                typeof window !== "undefined" &&
                !!window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
        } catch (e) {
            st.reduced = false
        }

        const geomOf = (i: number) => {
            const el = labelRefs.current[i]
            if (!el) return { l: 0, w: 0, mid: 0, h: 0 }
            return {
                l: el.offsetLeft,
                w: el.offsetWidth,
                mid: el.offsetTop + el.offsetHeight / 2,
                h: el.offsetHeight,
            }
        }

        const select = (i: number) => {
            const P = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(P.advanced ?? {}) }
            if (i < 0 || i >= P.n) return
            if (st.reduced || P.isStatic) {
                st.active = i
                st.flight = null
                return
            }
            if (i === st.active) return
            const slotW = Math.max(0, P.size + a.dotGap + a.dotLead)
            // Where the target label will sit once only its slot is open.
            let before = 0
            for (let j = 0; j <= i; j++) before += (st.slots[j] || 0) * slotW
            const g = geomOf(i)
            const finalL = g.l - before + slotW
            const tx = finalL - a.dotGap - P.size / 2
            const x0 = isFinite(st.dotX) ? st.dotX : tx
            const y0 = isFinite(st.dotY) ? st.dotY : g.mid + a.dotYOffset
            const dist = Math.abs(tx - x0)
            st.slotFrom = st.slots.slice()
            st.flight = {
                t0: st.simT,
                x0,
                y0,
                h: Math.max(a.minArc, (dist * clamp(P.arc, 0, 100)) / 100),
            }
            st.active = i
        }
        st.select = select

        const makeTarget = (k: number, P: any, a: any) => {
            const i = DEMO_SEQ[k % DEMO_SEQ.length] % Math.max(1, P.n)
            return {
                i,
                fx: 0.02 + 0.3 * rnd(k, 1, a.seed),
                dy: P.fontPx * (0.3 + 0.2 * rnd(k, 2, a.seed)),
                wy: (rnd(k, 3, a.seed) * 1.4 - 0.35) * a.wander,
            }
        }

        const tick = (dtReal: number) => {
            const P = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(P.advanced ?? {}) }
            const N = P.n
            if (N <= 0) return

            if (st.slots.length !== N) {
                if (st.active >= N) st.active = 0
                st.slots = Array.from({ length: N }, (_, j) => (j === st.active ? 1 : 0))
                st.slotFrom = st.slots.slice()
                st.lit = Array.from({ length: N }, (_, j) => (j === st.active ? 1 : 0))
                st.colors = Array.from({ length: N }, () => "")
                st.flight = null
                st.target = null
            }

            const sf = Math.max(0, P.speed) / 50
            const dtMs = dtReal * 1000
            st.simT += dtMs * sf
            const hoverF = clamp(a.hover, 0, 100) / 50
            const slotW = Math.max(0, P.size + a.dotGap + a.dotLead)
            const flightDur = Math.max(60, a.flightMs)

            // 1. Demo clock and clicks, before the slots so a click's flight starts now
            const demoOn = P.demo && !P.isStatic && !st.reduced
            const stepLen = Math.max(200, a.stepMs)
            const travel = clamp(a.travelMs, 50, stepLen * 0.95)
            const clickAt = travel + (stepLen - travel) * 0.6
            if (demoOn) {
                if (!st.target) {
                    st.prev = { i: 1 % N, fx: 0.02, dy: P.fontPx * 1.9, wy: 0 }
                    st.step = 0
                    st.target = makeTarget(0, P, a)
                    st.demoT = -Math.max(0, a.startDelay)
                    st.clicked = false
                }
                if (!st.realOver && st.simT >= st.holdUntil) st.demoT += dtMs * sf
                let guard = 0
                while (st.demoT >= stepLen && guard++ < 20) {
                    st.demoT -= stepLen
                    st.prev = st.target
                    st.step = (st.step + 1) % DEMO_SEQ.length
                    st.target = makeTarget(st.step, P, a)
                    st.clicked = false
                }
                if (!st.clicked && st.demoT >= clickAt) {
                    st.clicked = true
                    select(Math.min(st.target.i, N - 1))
                    st.pressT = st.simT
                }
            }

            // 2. Slots (the gap the dot lives in)
            let p = 1
            if (st.flight) p = clamp((st.simT - st.flight.t0) / flightDur, 0, 1)
            const eS = easeInOutCubic(p)
            for (let j = 0; j < N; j++) {
                const tgt = j === st.active ? 1 : 0
                st.slots[j] = st.flight ? lerp(st.slotFrom[j] ?? 0, tgt, eS) : tgt
                const sp = spacerRefs.current[j]
                if (sp) sp.style.width = `${(st.slots[j] * slotW).toFixed(2)}px`
            }

            // 3. Measure
            const geom: ReturnType<typeof geomOf>[] = []
            for (let j = 0; j < N; j++) geom.push(geomOf(j))

            // 4. Demo pointer position
            const ptr = ptrRef.current
            let px = NaN
            let py = NaN
            if (demoOn && st.target) {
                const pt = (s: any) => {
                    const g = geom[Math.min(s.i, N - 1)]
                    return { x: g.l + g.w * s.fx, y: g.mid + s.dy }
                }
                const A = pt(st.prev)
                const C = pt(st.target)
                const M = { x: (A.x + C.x) / 2, y: Math.max(A.y, C.y) + st.target.wy }
                const u = easeInOutSine(clamp(st.demoT / travel, 0, 1))
                const iu = 1 - u
                const t = st.simT / 1000
                px = iu * iu * A.x + 2 * iu * u * M.x + u * u * C.x
                py = iu * iu * A.y + 2 * iu * u * M.y + u * u * C.y
                px += Math.sin(t * 1.3 + a.seed) * a.wobble
                py += Math.sin(t * 1.9 + a.seed * 0.7) * a.wobble * 0.8

                st.demoHover = -1
                for (let j = 0; j < N; j++) {
                    const g = geom[j]
                    const pad = P.fontPx * 0.15
                    if (
                        px >= g.l - pad &&
                        px <= g.l + g.w + pad &&
                        Math.abs(py - g.mid) < P.fontPx * 0.75
                    ) {
                        st.demoHover = j
                        break
                    }
                }
            } else {
                st.demoHover = -1
            }

            const hoverIdx = st.realOver ? st.realHover : demoOn ? st.demoHover : -1

            // 5. Dot
            const ga = geom[Math.min(st.active, N - 1)]
            const tx = ga.l - a.dotGap - P.size / 2
            const ty = ga.mid + a.dotYOffset
            let x = tx
            let y = ty
            let sx = 1
            let sy = 1
            const fl = st.flight
            if (fl && p < 1) {
                x = lerp(fl.x0, tx, p)
                y = lerp(fl.y0, ty, p) - 4 * fl.h * p * (1 - p)
                // Airborne the dot stretches tall, easing in after take-off and out before landing.
                const hopK = clamp(fl.h / Math.max(1, P.size * 3), 0, 1)
                const k = clamp(Math.min(p, 1 - p) / 0.15, 0, 1) * hopK * (a.stretch / 100)
                sx = 1 - 0.7 * k
                sy = 1 + k
                if (p < 0.1) {
                    const q = (a.takeoffSquash / 100) * (1 - p / 0.1)
                    sx *= 1 + q
                    sy *= 1 - q
                }
                st.lean = 0
            } else {
                if (fl) {
                    st.flight = null
                    st.landT = fl.t0 + flightDur
                }
                let leanTarget = 0
                if (hoverIdx >= 0 && hoverIdx !== st.active && hoverIdx < N) {
                    leanTarget = Math.sign(geom[hoverIdx].l - ga.l) * a.lean * hoverF
                }
                st.lean += (leanTarget - st.lean) * (1 - Math.exp(-dtReal / 0.12))
                x = tx + st.lean
                const tl = st.simT - st.landT
                const landMs = Math.max(1, a.landMs)
                if (tl >= 0 && tl < landMs) {
                    const k = tl / landMs
                    const L = (a.landSquash / 100) * (1 - k) * (1 - k) * Math.cos(k * Math.PI * 1.5)
                    sx = 1 + L
                    sy = 1 - L
                }
            }
            st.dotX = x
            st.dotY = y
            const dot = dotRef.current
            if (dot) {
                const r = P.size / 2
                dot.style.transform = `translate(${(x - r).toFixed(2)}px, ${(y - r).toFixed(
                    2
                )}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`
            }

            // 6. Label colours
            const tau = Math.max(1, a.fadeMs) / 1000
            const kf = dtReal > 0 ? 1 - Math.exp((-dtReal * 3) / tau) : 1
            for (let j = 0; j < N; j++) {
                const tgt = j === st.active ? 1 : j === hoverIdx ? Math.min(1, hoverF) : 0
                st.lit[j] = st.reduced ? tgt : lerp(st.lit[j] ?? tgt, tgt, kf)
                const c = mixColor(P.inactiveColor, P.activeColor, clamp(st.lit[j], 0, 1))
                const el = labelRefs.current[j]
                if (el && st.colors[j] !== c) {
                    el.style.color = c
                    st.colors[j] = c
                }
            }

            // 7. Pointer dot
            if (ptr) {
                const want = demoOn && !st.realOver && isFinite(px) ? 1 : 0
                st.ptrAlpha =
                    dtReal > 0 ? lerp(st.ptrAlpha, want, 1 - Math.exp(-dtReal / 0.08)) : want
                ptr.style.opacity = st.ptrAlpha.toFixed(3)
                if (isFinite(px)) {
                    const pr = a.pointerSize / 2
                    const tp = st.simT - st.pressT
                    let sc = 1
                    if (tp >= 0 && tp < 180)
                        sc = 1 - (1 - a.pressScale / 100) * Math.sin((Math.PI * tp) / 180)
                    ptr.style.transform = `translate(${(px - pr).toFixed(2)}px, ${(py - pr).toFixed(
                        2
                    )}px) scale(${sc.toFixed(4)})`
                }
            }
        }

        tick(0)

        let raf = 0
        let last = -1
        const loop = (now: number) => {
            const dt = last < 0 ? 0 : Math.min(1 / 20, (now - last) / 1000)
            last = now
            tick(dt)
            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)

        const onUp = () => {
            if (st.downIdx >= 0) {
                if (st.realHover === st.downIdx) select(st.downIdx)
                st.downIdx = -1
            }
        }
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            st.select = null
        }
    }, [])

    const slotW = Math.max(0, size + adv.dotGap + adv.dotLead)
    const st = stRef.current

    return (
        <div
            ref={rootRef}
            onPointerEnter={() => {
                st.realOver = true
            }}
            onPointerLeave={() => {
                st.realOver = false
                st.realHover = -1
                st.holdUntil = st.simT + 600
            }}
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
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${adv.rowY}%`,
                    height: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    ...fontStyle,
                }}
            >
                {items.map((label, i) => (
                    <React.Fragment key={i}>
                        <span
                            ref={(el) => {
                                spacerRefs.current[i] = el
                            }}
                            style={{
                                display: "inline-block",
                                flex: "none",
                                height: 1,
                                marginLeft: i > 0 ? adv.wordGap : 0,
                                width: i === 0 ? slotW : 0,
                            }}
                        />
                        <span
                            ref={(el) => {
                                labelRefs.current[i] = el
                            }}
                            onPointerEnter={() => {
                                st.realHover = i
                            }}
                            onPointerLeave={() => {
                                if (st.realHover === i) st.realHover = -1
                            }}
                            onPointerDown={() => {
                                st.downIdx = i
                            }}
                            style={{
                                display: "inline-block",
                                flex: "none",
                                cursor: "pointer",
                                color: i === 0 ? activeColor : inactiveColor,
                            }}
                        >
                            {label}
                        </span>
                    </React.Fragment>
                ))}
                <div
                    ref={dotRef}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: size,
                        height: size,
                        borderRadius: "50%",
                        background: dotColor,
                        pointerEvents: "none",
                        willChange: "transform",
                        transformOrigin: "50% 50%",
                    }}
                />
                <div
                    ref={ptrRef}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: adv.pointerSize,
                        height: adv.pointerSize,
                        borderRadius: "50%",
                        background: adv.pointerColor,
                        mixBlendMode: adv.pointerBlend ? "difference" : "normal",
                        pointerEvents: "none",
                        opacity: 0,
                        willChange: "transform, opacity",
                        transformOrigin: "50% 50%",
                    }}
                />
            </div>
            {adv.grain > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        backgroundImage: GRAIN_URI,
                        backgroundSize: "160px 160px",
                        opacity: clamp(adv.grain, 0, 100) / 100,
                        mixBlendMode: "overlay",
                    }}
                />
            )}
            {adv.vignette > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background:
                            "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)",
                        opacity: clamp(adv.vignette, 0, 100) / 100,
                    }}
                />
            )}
        </div>
    )
}

addPropertyControls(BouncingDotTabs, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    activeColor: { type: ControlType.Color, title: "Active", defaultValue: "#FFFFFF" },
    inactiveColor: { type: ControlType.Color, title: "Inactive", defaultValue: "#767676" },
    dotColor: { type: ControlType.Color, title: "Dot", defaultValue: "#FFFFFF" },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 32, letterSpacing: "-0.01em", lineHeight: "1.2em" },
    },
    labels: {
        type: ControlType.Array,
        title: "Tabs",
        control: { type: ControlType.String },
        maxCount: 8,
        defaultValue: ["All", "Design", "Engineering", "Product", "Research"],
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        defaultValue: 19,
        min: 4,
        max: 80,
        step: 1,
        unit: "px",
    },
    arc: {
        type: ControlType.Number,
        title: "Arc",
        defaultValue: 42,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
    },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 83, min: 0, max: 100, step: 1 },
    demo: { type: ControlType.Boolean, title: "Demo", defaultValue: true },
    hover: { type: ControlType.Number, title: "Hover", defaultValue: 50, min: 0, max: 100, step: 1, unit: "%" },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            flightMs: { type: ControlType.Number, title: "Flight", defaultValue: 560, min: 100, max: 2000, step: 10, unit: "ms" },
            stepMs: { type: ControlType.Number, title: "Step", defaultValue: 1000, min: 300, max: 4000, step: 10, unit: "ms" },
            travelMs: { type: ControlType.Number, title: "Travel", defaultValue: 560, min: 50, max: 3000, step: 10, unit: "ms" },
            startDelay: { type: ControlType.Number, title: "Start Delay", defaultValue: 1000, min: 0, max: 3000, step: 10, unit: "ms" },
            wordGap: { type: ControlType.Number, title: "Word Gap", defaultValue: 33, min: 0, max: 200, step: 1, unit: "px" },
            dotGap: { type: ControlType.Number, title: "Dot Gap", defaultValue: 9, min: 0, max: 100, step: 1, unit: "px" },
            dotLead: { type: ControlType.Number, title: "Dot Lead", defaultValue: 9, min: 0, max: 100, step: 1, unit: "px" },
            dotYOffset: { type: ControlType.Number, title: "Dot Y", defaultValue: 1, min: -40, max: 40, step: 1, unit: "px" },
            rowY: { type: ControlType.Number, title: "Row Y", defaultValue: 50, min: 0, max: 100, step: 1, unit: "%" },
            minArc: { type: ControlType.Number, title: "Min Arc", defaultValue: 22, min: 0, max: 200, step: 1, unit: "px" },
            stretch: { type: ControlType.Number, title: "Stretch", defaultValue: 30, min: 0, max: 100, step: 1, unit: "%" },
            takeoffSquash: { type: ControlType.Number, title: "Take-off", defaultValue: 15, min: 0, max: 100, step: 1, unit: "%" },
            landSquash: { type: ControlType.Number, title: "Landing", defaultValue: 20, min: 0, max: 100, step: 1, unit: "%" },
            landMs: { type: ControlType.Number, title: "Land Time", defaultValue: 220, min: 0, max: 1000, step: 10, unit: "ms" },
            fadeMs: { type: ControlType.Number, title: "Fade", defaultValue: 120, min: 1, max: 1000, step: 1, unit: "ms" },
            lean: { type: ControlType.Number, title: "Lean", defaultValue: 4, min: 0, max: 40, step: 1, unit: "px" },
            pointerSize: { type: ControlType.Number, title: "Pointer", defaultValue: 19, min: 2, max: 80, step: 1, unit: "px" },
            pointerColor: { type: ControlType.Color, title: "Pointer Color", defaultValue: "#FFFFFF" },
            pointerBlend: { type: ControlType.Boolean, title: "Pointer Blend", defaultValue: false },
            pressScale: { type: ControlType.Number, title: "Press", defaultValue: 78, min: 10, max: 100, step: 1, unit: "%" },
            wander: { type: ControlType.Number, title: "Wander", defaultValue: 150, min: 0, max: 400, step: 1, unit: "px" },
            wobble: { type: ControlType.Number, title: "Wobble", defaultValue: 2, min: 0, max: 40, step: 1, unit: "px" },
            seed: { type: ControlType.Number, title: "Seed", defaultValue: 7, min: 0, max: 100, step: 1 },
            grain: { type: ControlType.Number, title: "Grain", defaultValue: 0, min: 0, max: 100, step: 1, unit: "%" },
            vignette: { type: ControlType.Number, title: "Vignette", defaultValue: 0, min: 0, max: 100, step: 1, unit: "%" },
        },
    },
})

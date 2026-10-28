import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    trackHeight: 45,
    knobWidth: 57,
    knobInset: 38,
    travelMs: 200,
    colorMs: 300,
    segmentMs: 200,
    stretchLead: 70,
    knobEdgeOn: "#466EB0",
    knobEdgeOff: "#9EA3AA",
    edgeWidth: 2,
    trackShadow: 9,
    knobShadow: 15,
    innerShade: 14,
    segmentGap: 34,
    segmentWidth: 91,
    segmentHeight: 21,
    segmentColor: "#F0F0F0",
    thumbColor: "#FFFFFF",
    thumbBorder: "#DCDDDF",
    labelOn: "#1C1C1E",
    labelOff: "#5E6066",
    labelSize: 64,
    loopMs: 9140,
    resumeMs: 2500,
    offsetY: 8,
    grain: 0,
    vignette: 0,
}


// Autoplay schedule, read from the reference clip (seconds within a 9.14 s loop).
const REF_LOOP = 9.14
const SCHEDULE: [number, string][] = [
    [0.27, "off"],
    [0.87, "on"],
    [1.47, "off"],
    [2.67, "on"],
    [3.8, "off"],
    [4.45, "alt"],
    [5.8, "on"],
    [6.38, "off"],
    [6.95, "on"],
    [7.45, "off"],
    [8.38, "home"],
    [8.85, "on"],
]

const GRAIN_URL = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const px = (n: number) => `${n}px`

function makeBezier(x1: number, y1: number, x2: number, y2: number) {
    const sample = (u: number, a: number, b: number) =>
        3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u
    const deriv = (u: number, a: number, b: number) =>
        3 * a * (1 - u) * (1 - u) + 6 * (b - a) * u * (1 - u) + 3 * (1 - b) * u * u
    return (t: number) => {
        if (t <= 0) return 0
        if (t >= 1) return 1
        let u = t
        for (let i = 0; i < 8; i++) {
            const d = deriv(u, x1, x2)
            if (Math.abs(d) < 1e-6) break
            u = clamp01(u - (sample(u, x1, x2) - t) / d)
        }
        return sample(u, y1, y2)
    }
}
const EASE = makeBezier(0.45, 0, 0.55, 1)

const colorCache = new Map<string, number[]>()
function parseColor(input: any): number[] {
    const key = String(input ?? "")
    const hit = colorCache.get(key)
    if (hit) return hit
    let s = key.trim()
    const v = s.match(/^var\([^,]+,\s*(.+)\)$/)
    if (v) s = v[1].trim()
    let out = [0, 0, 0, 1]
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4) h = h.split("").map((ch) => ch + ch).join("")
        const n = parseInt(h.slice(0, 6), 16) || 0
        const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
        out = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
    } else {
        const m = s.match(/rgba?\(([^)]+)\)/)
        if (m) {
            const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat)
            out = [p[0] || 0, p[1] || 0, p[2] || 0, p[3] ?? 1]
        }
    }
    if (colorCache.size > 200) colorCache.clear()
    colorCache.set(key, out)
    return out
}
function mixColor(a: any, b: any, t: number) {
    const A = parseColor(a)
    const B = parseColor(b)
    const k = clamp01(t)
    const r = Math.round(A[0] + (B[0] - A[0]) * k)
    const g = Math.round(A[1] + (B[1] - A[1]) * k)
    const bl = Math.round(A[2] + (B[2] - A[2]) * k)
    const al = A[3] + (B[3] - A[3]) * k
    return `rgba(${r},${g},${bl},${al.toFixed(3)})`
}
function rgbaOf(c: any, alpha: number) {
    const C = parseColor(c)
    return `rgba(${C[0]},${C[1]},${C[2]},${(C[3] * alpha).toFixed(3)})`
}

function evalTween(tw: any, now: number) {
    if (tw.dur <= 0) return tw.to
    const t = clamp01((now - tw.start) / tw.dur)
    return tw.from + (tw.to - tw.from) * EASE(t)
}

// Knob edges: plain = both edges on one ease-in-out; stretch = leading edge
// runs ahead (ease-out), trailing edge follows late (ease-in).
function evalMove(m: any, now: number, stretch: number, leadFrac: number) {
    const t = m.dur <= 0 ? 1 : clamp01((now - m.start) / m.dur)
    const e = EASE(t)
    const k = m.stretchy ? clamp01(stretch) : 0
    const a = Math.min(1, Math.max(0.3, leadFrac))
    const uL = clamp01(t / a)
    const lead = 1 - (1 - uL) * (1 - uL)
    const uT = clamp01((t - (1 - a)) / a)
    const trail = uT * uT
    const lw = e + (lead - e) * k
    const tw = e + (trail - e) * k
    const d = m.to - m.from
    if (d >= 0) return { pL: m.from + d * tw, pR: m.from + d * lw }
    return { pL: m.from + d * lw, pR: m.from + d * tw }
}

function makeState(stretchy: boolean) {
    const segPos = stretchy ? 1 : 0
    return {
        on: true,
        stretchy,
        home: stretchy,
        move: { from: 1, to: 1, start: 0, dur: 0, stretchy: false },
        col: { from: 1, to: 1, start: 0, dur: 0 },
        seg: { from: segPos, to: segPos, start: 0, dur: 0 },
        clock: 0,
        pausedUntil: 0,
        last: { pL: 1, pR: 1, c: 1, seg: segPos },
    }
}

function durations(live: any, reduced: boolean) {
    if (reduced) return { travel: 0, color: 0, seg: 0 }
    const rate = Math.max(0, live.speed) / 50
    const tr = rate > 0 ? Math.max(0.2, rate) : 1
    const adv = live.adv
    return {
        travel: Math.max(0, adv.travelMs) / tr,
        color: Math.max(0, adv.colorMs) / tr,
        seg: Math.max(0, adv.segmentMs) / tr,
    }
}

function doToggle(s: any, on: boolean, now: number, d: any) {
    if (s.on === on) return
    s.on = on
    const cur = (s.last.pL + s.last.pR) / 2
    s.move = { from: cur, to: on ? 1 : 0, start: now, dur: d.travel, stretchy: s.stretchy }
    s.col = { from: s.last.c, to: on ? 1 : 0, start: now, dur: d.color }
}

function doMode(s: any, stretchy: boolean, now: number, d: any) {
    if (s.stretchy === stretchy) return
    s.stretchy = stretchy
    s.seg = { from: s.last.seg, to: stretchy ? 1 : 0, start: now, dur: d.seg }
}


function geometry(W: number, adv: any) {
    const H = (W * adv.trackHeight) / 100
    const inset = (W * adv.knobInset) / 1000
    const kw = Math.min(W - 2 * inset, (W * adv.knobWidth) / 100)
    const kh = Math.max(4, H - 2 * inset)
    const travel = Math.max(0, W - 2 * inset - kw)
    return { H, inset, kw, kh, travel }
}

function layout(W: number, adv: any, live: any, v: any) {
    const { H, inset, kw, kh, travel } = geometry(W, adv)
    let L = inset + travel * v.pL
    let R = inset + kw + travel * v.pR
    const lo = inset * 0.35
    const hi = W - inset * 0.35
    L = Math.max(lo, L)
    R = Math.min(hi, R)
    if (R - L < kh) R = L + kh
    const gap = (W * adv.segmentGap) / 100
    const sw = (W * adv.segmentWidth) / 100
    const sh = (W * adv.segmentHeight) / 100
    const si = sh * 0.095
    const tw = sw / 2 - si
    const th = sh - 2 * si
    const c = v.c
    const sc = W / 600
    const edge = Math.max(1, adv.edgeWidth * sc)
    return {
        stage: {
            position: "relative",
            width: px(W),
            height: px(H + gap + sh),
            flexShrink: 0,
            transform: `translateY(${(W * adv.offsetY) / 100}px)`,
        },
        track: {
            position: "absolute",
            left: "0px",
            top: "0px",
            width: px(W),
            height: px(H),
            borderRadius: px(H / 2),
            background: mixColor(live.offColor, live.onColor, c),
            boxShadow: [
                `0 ${0.043 * W}px ${0.087 * W}px rgba(0,0,0,${(adv.trackShadow / 100).toFixed(3)})`,
                `inset ${0.012 * W}px ${0.014 * W}px ${0.026 * W}px rgba(0,0,0,${((adv.innerShade / 100) * (1 - c)).toFixed(3)})`,
                `inset 0 0 0 ${edge}px ${rgbaOf(adv.knobEdgeOn, 0.5 * c)}`,
            ].join(", "),
            cursor: "pointer",
        },
        knob: {
            position: "absolute",
            left: px(L),
            top: px(inset),
            width: px(R - L),
            height: px(kh),
            borderRadius: px(kh / 2),
            boxSizing: "border-box",
            background: live.knobColor,
            border: `${edge}px solid ${mixColor(adv.knobEdgeOff, adv.knobEdgeOn, c)}`,
            boxShadow: `${-0.006 * W}px ${0.009 * W}px ${0.023 * W}px rgba(0,0,0,${(adv.knobShadow / 100).toFixed(3)})`,
            pointerEvents: "none",
        },
        segment: {
            position: "absolute",
            left: px((W - sw) / 2),
            top: px(H + gap),
            width: px(sw),
            height: px(sh),
            borderRadius: px(sh / 2),
            background: adv.segmentColor,
            boxShadow: `inset 0 ${0.003 * W}px ${0.008 * W}px rgba(0,0,0,0.06), 0 ${0.014 * W}px ${0.043 * W}px rgba(0,0,0,0.05)`,
        },
        thumb: {
            position: "absolute",
            left: px(si + v.seg * tw),
            top: px(si),
            width: px(tw),
            height: px(th),
            borderRadius: px(th / 2),
            boxSizing: "border-box",
            background: adv.thumbColor,
            border: `${Math.max(1, sc)}px solid ${adv.thumbBorder}`,
            boxShadow: `0 ${0.006 * W}px ${0.017 * W}px rgba(0,0,0,0.1)`,
            pointerEvents: "none",
        },
        labelA: {
            position: "absolute",
            left: px(si),
            top: px(si),
            width: px(tw),
            height: px(th),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: mixColor(adv.labelOn, adv.labelOff, v.seg),
            pointerEvents: "none",
        },
        labelB: {
            position: "absolute",
            left: px(si + tw),
            top: px(si),
            width: px(tw),
            height: px(th),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: mixColor(adv.labelOff, adv.labelOn, v.seg),
            pointerEvents: "none",
        },
        halfA: { position: "absolute", left: "0px", top: "0px", width: px(sw / 2), height: px(sh), cursor: "pointer" },
        halfB: { position: "absolute", left: px(sw / 2), top: "0px", width: px(sw / 2), height: px(sh), cursor: "pointer" },
    }
}

/**
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function StretchPillToggle(props: any) {
    const {
        background = "#000000",
        onColor = "#2B76F0",
        offColor = "#CFCFCF",
        knobColor = "#FCFCFC",
        font,
        plainLabel = "Plain",
        stretchLabel = "Stretch",
        mode = "stretch",
        autoplay = true,
        speed = 34,
        stretch = 25,
        size = 600,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }
    const live = { onColor, offColor, knobColor, mode, autoplay, speed, stretch, size, adv }
    const liveRef = useRef(live)
    liveRef.current = live

    const st = useRef<any>(null)
    if (!st.current) st.current = makeState(mode !== "plain")
    const reducedRef = useRef(false)

    const rootRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)
    const knobRef = useRef<HTMLDivElement>(null)
    const segRef = useRef<HTMLDivElement>(null)
    const thumbRef = useRef<HTMLDivElement>(null)
    const labelARef = useRef<HTMLDivElement>(null)
    const labelBRef = useRef<HTMLDivElement>(null)
    const halfARef = useRef<HTMLDivElement>(null)
    const halfBRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const s = st.current
        let mq: MediaQueryList | null = null
        try {
            mq = window.matchMedia("(prefers-reduced-motion: reduce)")
            reducedRef.current = !!mq.matches
        } catch (e) {}
        const onMq = () => {
            reducedRef.current = !!mq?.matches
        }
        mq?.addEventListener?.("change", onMq)

        let raf = 0
        let last = -1
        const tick = (now: number) => {
            const L = liveRef.current
            const A = L.adv
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            last = now
            const reduced = reducedRef.current
            const d = durations(L, reduced)
            const rate = Math.max(0, L.speed) / 50

            const home = L.mode !== "plain"
            if (home !== s.home) {
                s.home = home
                doMode(s, home, now, d)
            }

            if (L.autoplay && !reduced && rate > 0 && now >= s.pausedUntil) {
                const loop = Math.max(2, A.loopMs / 1000)
                const k = loop / REF_LOOP
                const fire = (kind: string) => {
                    if (kind === "on") doToggle(s, true, now, d)
                    else if (kind === "off") doToggle(s, false, now, d)
                    else if (kind === "alt") doMode(s, !s.home, now, d)
                    else if (kind === "home") doMode(s, s.home, now, d)
                }
                const run = (a: number, b: number) => {
                    for (const [t, kind] of SCHEDULE) {
                        const tt = t * k
                        if (tt > a && tt <= b) fire(kind)
                    }
                }
                const prev = s.clock
                let next = prev + dt * rate
                if (next >= loop) {
                    run(prev, loop)
                    next -= loop
                    run(-1, next)
                } else run(prev, next)
                s.clock = next
            }

            const mv = evalMove(s.move, now, L.stretch / 100, A.stretchLead / 100)
            const c = evalTween(s.col, now)
            const seg = evalTween(s.seg, now)
            s.last = { pL: mv.pL, pR: mv.pR, c, seg }

            const W = Math.max(200, L.size)
            const Ls: any = layout(W, A, L, s.last)
            if (stageRef.current) Object.assign(stageRef.current.style, Ls.stage)
            if (trackRef.current) Object.assign(trackRef.current.style, Ls.track)
            if (knobRef.current) Object.assign(knobRef.current.style, Ls.knob)
            if (segRef.current) Object.assign(segRef.current.style, Ls.segment)
            if (thumbRef.current) Object.assign(thumbRef.current.style, Ls.thumb)
            if (labelARef.current) Object.assign(labelARef.current.style, Ls.labelA)
            if (labelBRef.current) Object.assign(labelBRef.current.style, Ls.labelB)
            if (halfARef.current) Object.assign(halfARef.current.style, Ls.halfA)
            if (halfBRef.current) Object.assign(halfBRef.current.style, Ls.halfB)

            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)

        return () => {
            cancelAnimationFrame(raf)
            mq?.removeEventListener?.("change", onMq)
        }
    }, [])

    const pause = () => {
        st.current.pausedUntil = performance.now() + Math.max(0, liveRef.current.adv.resumeMs)
    }
    const onTrackClick = () => {
        const s = st.current
        doToggle(s, !s.on, performance.now(), durations(liveRef.current, reducedRef.current))
        pause()
    }
    const chooseMode = (stretchy: boolean) => {
        doMode(st.current, stretchy, performance.now(), durations(liveRef.current, reducedRef.current))
        pause()
    }

    const W = Math.max(200, size)
    const Ls: any = layout(W, adv, live, st.current.last)
    const fontStyle: any = {
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        fontWeight: 500,
        letterSpacing: 0,
        ...(font || {}),
        fontSize: px((W * adv.labelSize) / 1000),
        lineHeight: 1,
        whiteSpace: "nowrap",
    }

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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none",
                WebkitUserSelect: "none",
                touchAction: "manipulation",
            }}
        >
            <div ref={stageRef} style={Ls.stage}>
                <div ref={trackRef} style={Ls.track} onClick={onTrackClick} />
                <div ref={knobRef} style={Ls.knob} />
                <div ref={segRef} style={Ls.segment}>
                    <div ref={thumbRef} style={Ls.thumb} />
                    <div ref={labelARef} style={{ ...Ls.labelA, ...fontStyle }}>
                        {plainLabel}
                    </div>
                    <div ref={labelBRef} style={{ ...Ls.labelB, ...fontStyle }}>
                        {stretchLabel}
                    </div>
                    <div ref={halfARef} style={Ls.halfA} onClick={() => chooseMode(false)} />
                    <div ref={halfBRef} style={Ls.halfB} onClick={() => chooseMode(true)} />
                </div>
            </div>
            {adv.grain > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        backgroundImage: GRAIN_URL,
                        backgroundSize: "160px 160px",
                        opacity: (adv.grain / 100) * 0.35,
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
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${(adv.vignette / 100) * 0.85}) 100%)`,
                    }}
                />
            )}
        </div>
    )
}

addPropertyControls(StretchPillToggle, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Colour behind the toggle.",
    },
    onColor: {
        type: ControlType.Color,
        title: "On",
        defaultValue: "#2B76F0",
        description: "Track colour when the toggle is on.",
    },
    offColor: {
        type: ControlType.Color,
        title: "Off",
        defaultValue: "#CFCFCF",
        description: "Track colour when the toggle is off.",
    },
    knobColor: {
        type: ControlType.Color,
        title: "Knob",
        defaultValue: "#FCFCFC",
        description: "Fill of the sliding pill knob.",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        description: "Typeface of the Plain / Stretch labels. Size follows the Size control.",
    },
    plainLabel: {
        type: ControlType.String,
        title: "Plain Label",
        defaultValue: "Plain",
        description: "Text of the left option (rigid slide).",
    },
    stretchLabel: {
        type: ControlType.String,
        title: "Stretch Label",
        defaultValue: "Stretch",
        description: "Text of the right option (knob stretches as it travels).",
    },
    mode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["stretch", "plain"],
        optionTitles: ["Stretch", "Plain"],
        defaultValue: "stretch",
        displaySegmentedControl: true,
        description: "Starting mode: the knob slides rigidly (Plain) or stretches toward where it is going (Stretch).",
    },
    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: true,
        description: "Plays the demo sequence of clicks. A real click pauses it briefly.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 34,
        description: "50 is the shipped rate, 0 stops the demo sequence.",
    },
    stretch: {
        type: ControlType.Number,
        title: "Stretch",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 25,
        description: "How far the knob stretches mid-move in Stretch mode.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 300,
        max: 900,
        step: 1,
        unit: "px",
        defaultValue: 600,
        description: "Width of the toggle track; everything else scales with it.",
    },

    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            trackHeight: { type: ControlType.Number, title: "Track Height", min: 20, max: 80, step: 1, unit: "%", defaultValue: 45, description: "Track height as % of its width." },
            knobWidth: { type: ControlType.Number, title: "Knob Width", min: 30, max: 90, step: 1, unit: "%", defaultValue: 57, description: "Knob width as % of the track width." },
            knobInset: { type: ControlType.Number, title: "Knob Inset", min: 0, max: 100, step: 1, defaultValue: 38, description: "Gap around the knob, in thousandths of the track width." },
            travelMs: { type: ControlType.Number, title: "Travel", min: 50, max: 1000, step: 10, unit: "ms", defaultValue: 200, description: "Time the knob takes to cross." },
            colorMs: { type: ControlType.Number, title: "Colour Fade", min: 50, max: 1500, step: 10, unit: "ms", defaultValue: 300, description: "Time the track colour takes to fade." },
            segmentMs: { type: ControlType.Number, title: "Segment Slide", min: 50, max: 1000, step: 10, unit: "ms", defaultValue: 200, description: "Time the segment thumb takes to slide." },
            stretchLead: { type: ControlType.Number, title: "Stretch Lead", min: 30, max: 100, step: 1, unit: "%", defaultValue: 70, description: "Share of the move the leading edge takes in Stretch mode." },
            knobEdgeOn: { type: ControlType.Color, title: "Edge On", defaultValue: "#466EB0", description: "Knob edge and track rim when on." },
            knobEdgeOff: { type: ControlType.Color, title: "Edge Off", defaultValue: "#9EA3AA", description: "Knob edge when off." },
            edgeWidth: { type: ControlType.Number, title: "Edge Width", min: 0, max: 8, step: 1, unit: "px", defaultValue: 2, description: "Knob edge width at 600 px size." },
            trackShadow: { type: ControlType.Number, title: "Track Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 9, description: "Opacity of the shadow under the track." },
            knobShadow: { type: ControlType.Number, title: "Knob Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 15, description: "Opacity of the knob's drop shadow." },
            innerShade: { type: ControlType.Number, title: "Inner Shade", min: 0, max: 100, step: 1, unit: "%", defaultValue: 14, description: "Inset shadow in the off track." },
            segmentGap: { type: ControlType.Number, title: "Segment Gap", min: 0, max: 100, step: 1, unit: "%", defaultValue: 34, description: "Gap between track and segmented control, % of track width." },
            segmentWidth: { type: ControlType.Number, title: "Segment Width", min: 40, max: 120, step: 1, unit: "%", defaultValue: 91, description: "Segmented control width, % of track width." },
            segmentHeight: { type: ControlType.Number, title: "Segment Height", min: 10, max: 40, step: 1, unit: "%", defaultValue: 21, description: "Segmented control height, % of track width." },
            segmentColor: { type: ControlType.Color, title: "Segment", defaultValue: "#F0F0F0", description: "Segmented control background." },
            thumbColor: { type: ControlType.Color, title: "Thumb", defaultValue: "#FFFFFF", description: "Selected segment pill." },
            thumbBorder: { type: ControlType.Color, title: "Thumb Border", defaultValue: "#DCDDDF", description: "Selected segment pill outline." },
            labelOn: { type: ControlType.Color, title: "Label On", defaultValue: "#1C1C1E", description: "Selected label colour." },
            labelOff: { type: ControlType.Color, title: "Label Off", defaultValue: "#5E6066", description: "Unselected label colour." },
            labelSize: { type: ControlType.Number, title: "Label Size", min: 20, max: 120, step: 1, defaultValue: 64, description: "Label size in thousandths of the track width." },
            loopMs: { type: ControlType.Number, title: "Loop", min: 2000, max: 30000, step: 10, unit: "ms", defaultValue: 9140, description: "Length of the demo sequence." },
            resumeMs: { type: ControlType.Number, title: "Resume After", min: 0, max: 10000, step: 100, unit: "ms", defaultValue: 2500, description: "Pause of the demo after a real click." },
            offsetY: { type: ControlType.Number, title: "Offset Y", min: -50, max: 50, step: 1, unit: "%", defaultValue: 8, description: "Vertical shift of the whole group, % of track width." },

            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over the whole component." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening over the whole component." },
        },
    },
})

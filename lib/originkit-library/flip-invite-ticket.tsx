import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    rimWidth: 22,
    innerFill: "#F2F2F2",
    codeColor: "#1A1A1A",
    dotColor: "#D3D5D4",
    dotSize: 13,
    dotGap: 31,
    dotInset: 30,
    headerFill: "#F1F1F1",
    headerTextColor: "#868686",
    headerWidth: 100,
    headerHeight: 100,
    headerGap: 0,
    headerRim: 22,
    headerTextSize: 66,
    headerTilt: 180,
    labelSize: 66,
    codeSize: 76,
    copySize: 52,
    buttonDiameter: 184,
    buttonInset: 23,
    copyWidth: 280,
    copyHeight: 146,
    copyInset: 57,
    textInset: 106,
    centerY: 53,
    pressMs: 100,
    tiltMs: 70,
    pressScale: 103,
    tiltStiffness: 400,
    tiltDamping: 22,
    hingeStiffness: 220,
    perspective: 800,
    shadowBlur: 20,
    shadowY: 6,
    shadowOpacity: 8,
    hoverTilt: 6,
    startDelay: 0,
    grain: 0,
    vignette: 0,
    hover: 50,
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

const CARD_W = 1040
const CARD_H = 264

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const num = (v: any, d: number) => (typeof v === "number" && isFinite(v) ? v : d)

const GRAIN_URL =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function FlipInviteTicket(props: any) {
    props = withMovedControls(props)
    const {
        background = "#0B1020",
        accentColor = "#5B5BF0",
        pillColor = "#F7F5FF",
        textColor = "#1E1B3A",
        readyText = "You're On The List",
        codeLabel = "Your Access Code",
        codeText = "ORIGIN-2026",
        copyText = "COPY",
        font,
        size = 912,
        speed = 36,
        tilt = 30,
        bounce = 78,
        autoPlay = true,
        interval = 1150,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const propsRef = useRef(props)
    propsRef.current = props

    const rootRef = useRef<HTMLDivElement>(null)
    const rigRef = useRef<HTMLDivElement>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const readyRef = useRef<HTMLDivElement>(null)
    const codeRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
    const btnRef = useRef<HTMLDivElement>(null)
    const copyRef = useRef<HTMLDivElement>(null)

    const sim = useRef({
        open: false,
        want: false,
        phase: "idle" as "idle" | "press" | "tilt" | "swap" | "spring",
        phaseT: 0,
        theta: 0,
        thetaV: 0,
        scale: 1,
        scaleV: 0,
        hs: 0,
        hsV: 0,
        mix: 0,
        settled: true,
        autoT: null as number | null,
        request: false,
        px: 0.5,
        py: 0.5,
        tpx: 0.5,
        tpy: 0.5,
        over: 0,
        overT: 0,
        down: false,
        dn: 0,
    })

    const [box, setBox] = useState({ w: 1200, h: 800 })

    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const measure = () => {
            const w = el.offsetWidth || 1200
            const h = el.offsetHeight || 800
            setBox((b) => (b.w === w && b.h === h ? b : { w, h }))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // External play prop toggles the state
    const firstPlay = useRef(true)
    useEffect(() => {
        if (firstPlay.current) {
            firstPlay.current = false
            return
        }
        sim.current.request = true
        sim.current.autoT = 0
    }, [props.play])

    useEffect(() => {
        const up = () => {
            sim.current.down = false
        }
        window.addEventListener("pointerup", up)
        window.addEventListener("pointercancel", up)
        return () => {
            window.removeEventListener("pointerup", up)
            window.removeEventListener("pointercancel", up)
        }
    }, [])

    useEffect(() => {
        const s = sim.current
        let raf = 0
        let last = -1
        const reduced =
            typeof window !== "undefined" &&
            !!window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            last = now
            const p = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const ts = Math.max(0, num(p.speed, 50)) / 50
            const sdt = dt * ts
            const tiltDeg = num(p.tilt, 30)
            const bnc = num(p.bounce, 78)
            const ivl = Math.max(100, num(p.interval, 1150))

            // Auto toggle
            if (s.autoT === null) s.autoT = ivl - a.startDelay
            if (p.autoPlay ?? true) {
                s.autoT += sdt * 1000
                if (s.autoT >= ivl) {
                    s.autoT = 0
                    s.request = true
                }
            }
            if (s.request) {
                s.request = false
                if (s.phase !== "press" && s.phase !== "tilt") {
                    s.want = !s.open
                    s.phase = reduced ? "swap" : "press"
                    s.phaseT = 0
                }
            }

            // Press → tilt → swap
            if (s.phase === "press") {
                s.phaseT += sdt * 1000
                const q = clamp01(s.phaseT / Math.max(1, a.pressMs))
                s.scale = 1 + (a.pressScale / 100 - 1) * (1 - (1 - q) * (1 - q))
                s.scaleV = 0
                if (q >= 1) {
                    s.phase = "tilt"
                    s.phaseT = 0
                }
            } else if (s.phase === "tilt") {
                s.phaseT += sdt * 1000
                const q = clamp01(s.phaseT / Math.max(1, a.tiltMs))
                s.theta = tiltDeg * q * q
                s.thetaV = 0
                if (q >= 1) s.phase = "swap"
            }
            if (s.phase === "swap") {
                s.open = s.want
                s.phase = "spring"
                s.thetaV = 0
                s.settled = false
            }

            if (reduced) {
                s.theta = 0
                s.thetaV = 0
                s.scale = 1
                s.hs = s.open ? 1 : 0
                s.hsV = 0
            } else {
                const kt = a.tiltStiffness
                const ct = a.tiltDamping
                const kh = Math.max(1, a.hingeStiffness)
                const zeta = Math.max(0.3, 0.95 - (0.6 * bnc) / 100)
                const ch = 2 * zeta * Math.sqrt(kh)
                const n = 6
                const h = sdt / n
                for (let i = 0; i < n; i++) {
                    if (s.phase === "spring") {
                        s.thetaV += (-kt * s.theta - ct * s.thetaV) * h
                        s.theta += s.thetaV * h
                        s.scaleV += (-kt * (s.scale - 1) - ct * s.scaleV) * h
                        s.scale += s.scaleV * h
                    }
                    // The header springs both ways, so it folds back down as smoothly as it flips up.
                    const target = s.open ? 1 : 0
                    s.hsV += (-kh * (s.hs - target) - ch * s.hsV) * h
                    s.hs += s.hsV * h
                }
            }

            if (
                s.phase === "spring" &&
                !s.settled &&
                Math.abs(s.theta) < 0.05 &&
                Math.abs(s.thetaV) < 0.5 &&
                Math.abs(s.hs - (s.open ? 1 : 0)) < 0.004 &&
                Math.abs(s.hsV) < 0.05
            ) {
                s.settled = true
                s.phase = "idle"
                if (typeof p.onComplete === "function") p.onComplete()
            }

            // Pointer (real time, not speed-scaled)
            const ke = 1 - Math.exp(-dt * 6)
            s.over += (s.overT - s.over) * ke
            s.px += (s.tpx - s.px) * ke
            s.py += (s.tpy - s.py) * ke
            s.dn += ((s.down ? 1 : 0) - s.dn) * (1 - Math.exp(-dt * 14))
            const hk = a.hover / 50
            const rx = -(s.py - 0.5) * 2 * a.hoverTilt * hk * s.over
            const ry = (s.px - 0.5) * 2 * a.hoverTilt * hk * s.over
            const ps = 1 - 0.02 * s.dn * hk

            if (rigRef.current)
                rigRef.current.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(${ps})`
            if (cardRef.current) {
                const e = Math.min(
                    1.5,
                    Math.abs(s.theta) / Math.max(1, tiltDeg) + Math.max(0, s.scale - 1) * 20
                )
                cardRef.current.style.transform = `translateZ(2px) scale(${s.scale}) rotateX(${s.theta}deg)`
                cardRef.current.style.boxShadow = `0 ${a.shadowY * (1 + e)}px ${
                    a.shadowBlur * (1 + 1.5 * e)
                }px rgba(0,0,0,${(a.shadowOpacity / 100) * (1 + 0.75 * e)})`
            }
            // Ready / code faces cross-fade instead of cutting (real time, so speed never makes it pop).
            s.mix += ((s.open ? 1 : 0) - s.mix) * (1 - Math.exp(-dt * 22))
            if (Math.abs(s.mix - (s.open ? 1 : 0)) < 0.002) s.mix = s.open ? 1 : 0
            const mx = s.mix * s.mix * (3 - 2 * s.mix)
            if (readyRef.current) readyRef.current.style.opacity = String(1 - mx)
            if (codeRef.current) codeRef.current.style.opacity = String(mx)
            if (headerRef.current) {
                // Folded face-down over the capsule, flips up on its bottom hinge;
                // spring overshoot (hs > 1) swings it just past upright and back.
                const ang = -a.headerTilt * (1 - s.hs)
                headerRef.current.style.transform = `translateZ(4px) rotateX(${ang}deg)`
                const fade = clamp01(s.hs * 2.5)
                headerRef.current.style.opacity = String(fade * fade * (3 - 2 * fade))
            }
            const bright = `brightness(${1 + 0.08 * s.over * hk})`
            if (btnRef.current) btnRef.current.style.filter = bright
            if (copyRef.current) copyRef.current.style.filter = bright
        }
        raf = requestAnimationFrame(frame)
        return () => cancelAnimationFrame(raf)
    }, [])

    const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = rootRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const s = sim.current
        s.tpx = r.width > 0 ? clamp01((e.clientX - r.left) / r.width) : 0.5
        s.tpy = r.height > 0 ? clamp01((e.clientY - r.top) / r.height) : 0.5
        s.overT = 1
    }
    const onLeave = () => {
        const s = sim.current
        s.overT = 0
        s.tpx = 0.5
        s.tpy = 0.5
    }
    const onDown = () => {
        const s = sim.current
        s.down = true
        s.request = true
        s.autoT = 0
    }

    // Layout: capsule fixed at centerY, header rises above it
    const { w, h } = box
    const hw = (CARD_W * adv.headerWidth) / 100
    const hh = (CARD_H * adv.headerHeight) / 100
    const gap = adv.headerGap
    const cy = (h * adv.centerY) / 100
    const above = CARD_H / 2 + hh + gap
    const u = Math.max(
        0.05,
        Math.min(
            ((size / CARD_W) * w) / 1200,
            (w * 0.96) / CARD_W,
            Math.max(1, cy - h * 0.04) / above,
            Math.max(1, h * 0.96 - cy) / (CARD_H / 2)
        )
    )
    const rim = adv.rimWidth
    const headerRim = adv.headerRim
    const fontFamily =
        (font && font.fontFamily) || "Inter, 'SF Pro Display', -apple-system, system-ui, sans-serif"
    const fontStyle = (font && font.fontStyle) || "normal"
    const d = adv.buttonDiameter
    const di = adv.dotInset

    return (
        <div
            ref={rootRef}
            onPointerMove={onMove}
            onPointerEnter={onMove}
            onPointerLeave={onLeave}
            onPointerDown={onDown}
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
                fontFamily,
                fontStyle,
                cursor: "pointer",
                userSelect: "none",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: w / 2,
                    top: cy,
                    width: CARD_W,
                    height: CARD_H,
                    transform: `translate(-50%, -50%) scale(${u})`,
                    perspective: adv.perspective,
                }}
            >
                <div
                    ref={rigRef}
                    style={{
                        position: "absolute",
                        inset: 0,
                        transformStyle: "preserve-3d",
                    }}
                >
                    {/* Header label pill, flips up from lying over the capsule on its bottom hinge */}
                    <div
                        ref={headerRef}
                        style={{
                            position: "absolute",
                            left: (CARD_W - hw) / 2,
                            top: -(hh + gap),
                            width: hw,
                            height: hh,
                            transformOrigin: "50% 100%",
                            transformStyle: "preserve-3d",
                            transform: `translateZ(4px) rotateX(${-adv.headerTilt}deg)`,
                            opacity: 0,
                        }}
                    >
                        {/* Back face, seen while the pill is still folded down */}
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: hh / 2,
                                background: pillColor,
                                transform: "rotateX(180deg)",
                                backfaceVisibility: "hidden",
                                WebkitBackfaceVisibility: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    inset: headerRim,
                                    borderRadius: Math.max(0, (hh - 2 * headerRim) / 2),
                                    background: adv.innerFill,
                                }}
                            />
                        </div>
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: hh / 2,
                                background: pillColor,
                                backfaceVisibility: "hidden",
                                WebkitBackfaceVisibility: "hidden",
                            }}
                        >
                        <div
                            style={{
                                position: "absolute",
                                inset: headerRim,
                                borderRadius: Math.max(0, (hh - 2 * headerRim) / 2),
                                background: adv.headerFill,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: adv.headerTextSize,
                                    fontWeight: 700,
                                    color: adv.headerTextColor,
                                    letterSpacing: "-0.01em",
                                    whiteSpace: "nowrap",
                                    lineHeight: 1,
                                }}
                            >
                                {codeLabel}
                            </span>
                        </div>
                        </div>
                    </div>

                    {/* Main capsule */}
                    <div
                        ref={cardRef}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: CARD_W,
                            height: CARD_H,
                            borderRadius: CARD_H / 2,
                            background: pillColor,
                            transformOrigin: "50% 100%",
                            transform: "translateZ(2px)",
                        }}
                    >
                        {/* Ready face */}
                        <div ref={readyRef} style={{ position: "absolute", inset: 0 }}>
                            <div
                                style={{
                                    position: "absolute",
                                    inset: rim,
                                    borderRadius: (CARD_H - 2 * rim) / 2,
                                    background: adv.innerFill,
                                }}
                            />
                            <span
                                style={{
                                    position: "absolute",
                                    left: adv.textInset,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    fontSize: adv.labelSize,
                                    fontWeight: 600,
                                    letterSpacing: "-0.008em",
                                    color: textColor,
                                    whiteSpace: "nowrap",
                                    lineHeight: 1,
                                }}
                            >
                                {readyText}
                            </span>
                            <div
                                ref={btnRef}
                                style={{
                                    position: "absolute",
                                    right: rim + adv.buttonInset,
                                    top: (CARD_H - d) / 2,
                                    width: d,
                                    height: d,
                                    borderRadius: "50%",
                                    background: accentColor,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg
                                    width={d * 0.29}
                                    height={d * 0.32}
                                    viewBox="-2 -2 54 60"
                                    style={{ overflow: "visible" }}
                                >
                                    <path
                                        d="M25 3 V50 M6 31 L25 50 L44 31"
                                        fill="none"
                                        stroke="#FDFDFD"
                                        strokeWidth={11}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                        </div>

                        {/* Code face */}
                        <div ref={codeRef} style={{ position: "absolute", inset: 0, opacity: 0 }}>
                            <svg
                                width={CARD_W}
                                height={CARD_H}
                                viewBox={`0 0 ${CARD_W} ${CARD_H}`}
                                style={{ position: "absolute", left: 0, top: 0 }}
                            >
                                <rect
                                    x={di}
                                    y={di}
                                    width={CARD_W - 2 * di}
                                    height={CARD_H - 2 * di}
                                    rx={(CARD_H - 2 * di) / 2}
                                    ry={(CARD_H - 2 * di) / 2}
                                    fill="none"
                                    stroke={adv.dotColor}
                                    strokeWidth={adv.dotSize}
                                    strokeLinecap="round"
                                    strokeDasharray={`0 ${Math.max(adv.dotSize + 1, adv.dotGap)}`}
                                />
                            </svg>
                            <span
                                style={{
                                    position: "absolute",
                                    left: adv.textInset,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    fontSize: adv.codeSize,
                                    fontWeight: 700,
                                    letterSpacing: "-0.013em",
                                    color: adv.codeColor,
                                    whiteSpace: "nowrap",
                                    lineHeight: 1,
                                }}
                            >
                                {codeText}
                            </span>
                            <div
                                ref={copyRef}
                                style={{
                                    position: "absolute",
                                    right: adv.copyInset,
                                    top: (CARD_H - adv.copyHeight) / 2,
                                    width: adv.copyWidth,
                                    height: adv.copyHeight,
                                    borderRadius: adv.copyHeight / 2,
                                    background: accentColor,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: adv.copySize,
                                        fontWeight: 700,
                                        color: "#F7F5FF",
                                        letterSpacing: "0.01em",
                                        whiteSpace: "nowrap",
                                        lineHeight: 1,
                                    }}
                                >
                                    {copyText}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {adv.grain > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        backgroundImage: GRAIN_URL,
                        opacity: adv.grain / 100,
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
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${
                            adv.vignette / 100
                        }) 100%)`,
                    }}
                />
            )}
        </div>
    )
}

addPropertyControls(FlipInviteTicket, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#0B1020" },
    accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#5B5BF0" },
    pillColor: { type: ControlType.Color, title: "Pill", defaultValue: "#F7F5FF" },
    textColor: { type: ControlType.Color, title: "Text", defaultValue: "#1E1B3A" },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    readyText: { type: ControlType.String, title: "Ready Text", defaultValue: "You're On The List" },
    codeLabel: { type: ControlType.String, title: "Label", defaultValue: "Your Access Code" },
    codeText: { type: ControlType.String, title: "Code", defaultValue: "ORIGIN-2026" },
    copyText: { type: ControlType.String, title: "Copy Text", defaultValue: "COPY" },
    size: {
        type: ControlType.Number,
        title: "Size",
        defaultValue: 912,
        min: 200,
        max: 1600,
        step: 1,
        unit: "px",
    },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 36, min: 0, max: 100, step: 1 },
    tilt: {
        type: ControlType.Number,
        title: "Tilt",
        defaultValue: 30,
        min: 0,
        max: 60,
        step: 1,
        unit: "°",
    },
    bounce: { type: ControlType.Number, title: "Bounce", defaultValue: 78, min: 0, max: 100, step: 1 },
    autoPlay: { type: ControlType.Boolean, title: "Auto Play", defaultValue: true },
    interval: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 1150,
        min: 100,
        max: 5000,
        step: 10,
        unit: "ms",
        hidden: (p: any) => !p.autoPlay,
    },
    hover: { type: ControlType.Number, title: "Hover", defaultValue: 50, min: 0, max: 100, step: 1, unit: "%" },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            rimWidth: { type: ControlType.Number, title: "Rim", defaultValue: 22, min: 0, max: 60, step: 1 },
            innerFill: { type: ControlType.Color, title: "Inner Fill", defaultValue: "#F2F2F2" },
            codeColor: { type: ControlType.Color, title: "Code Color", defaultValue: "#1A1A1A" },
            dotColor: { type: ControlType.Color, title: "Dot Color", defaultValue: "#D3D5D4" },
            dotSize: { type: ControlType.Number, title: "Dot Size", defaultValue: 13, min: 1, max: 40, step: 1 },
            dotGap: { type: ControlType.Number, title: "Dot Gap", defaultValue: 31, min: 2, max: 100, step: 1 },
            dotInset: { type: ControlType.Number, title: "Dot Inset", defaultValue: 30, min: 0, max: 100, step: 1 },
            headerFill: { type: ControlType.Color, title: "Header Fill", defaultValue: "#F1F1F1" },
            headerTextColor: { type: ControlType.Color, title: "Header Text", defaultValue: "#868686" },
            headerWidth: { type: ControlType.Number, title: "Header W", defaultValue: 100, min: 20, max: 100, step: 1, unit: "%" },
            headerHeight: { type: ControlType.Number, title: "Header H", defaultValue: 100, min: 10, max: 100, step: 1, unit: "%" },
            headerGap: { type: ControlType.Number, title: "Header Gap", defaultValue: 0, min: 0, max: 100, step: 1 },
            headerRim: { type: ControlType.Number, title: "Header Rim", defaultValue: 22, min: 0, max: 60, step: 1 },
            headerTextSize: { type: ControlType.Number, title: "Header Size", defaultValue: 66, min: 10, max: 140, step: 1 },
            headerTilt: { type: ControlType.Number, title: "Header Tilt", defaultValue: 180, min: 0, max: 180, step: 1, unit: "°" },
            labelSize: { type: ControlType.Number, title: "Label Size", defaultValue: 66, min: 10, max: 140, step: 1 },
            codeSize: { type: ControlType.Number, title: "Code Size", defaultValue: 76, min: 10, max: 140, step: 1 },
            copySize: { type: ControlType.Number, title: "Copy Size", defaultValue: 52, min: 10, max: 120, step: 1 },
            buttonDiameter: { type: ControlType.Number, title: "Button", defaultValue: 184, min: 40, max: 260, step: 1 },
            buttonInset: { type: ControlType.Number, title: "Button Inset", defaultValue: 23, min: 0, max: 100, step: 1 },
            copyWidth: { type: ControlType.Number, title: "Copy W", defaultValue: 280, min: 60, max: 500, step: 1 },
            copyHeight: { type: ControlType.Number, title: "Copy H", defaultValue: 146, min: 40, max: 260, step: 1 },
            copyInset: { type: ControlType.Number, title: "Copy Inset", defaultValue: 57, min: 0, max: 200, step: 1 },
            textInset: { type: ControlType.Number, title: "Text Inset", defaultValue: 106, min: 0, max: 300, step: 1 },
            centerY: { type: ControlType.Number, title: "Center Y", defaultValue: 53, min: 20, max: 80, step: 1, unit: "%" },
            pressMs: { type: ControlType.Number, title: "Press", defaultValue: 100, min: 0, max: 1000, step: 1, unit: "ms" },
            tiltMs: { type: ControlType.Number, title: "Tilt Time", defaultValue: 70, min: 0, max: 1000, step: 1, unit: "ms" },
            pressScale: { type: ControlType.Number, title: "Press Scale", defaultValue: 103, min: 90, max: 120, step: 1, unit: "%" },
            tiltStiffness: { type: ControlType.Number, title: "Tilt Stiff", defaultValue: 400, min: 10, max: 2000, step: 1 },
            tiltDamping: { type: ControlType.Number, title: "Tilt Damping", defaultValue: 22, min: 1, max: 100, step: 1 },
            hingeStiffness: { type: ControlType.Number, title: "Header Stiff", defaultValue: 220, min: 10, max: 2000, step: 1 },
            perspective: { type: ControlType.Number, title: "Perspective", defaultValue: 800, min: 100, max: 4000, step: 1 },
            shadowBlur: { type: ControlType.Number, title: "Shadow Blur", defaultValue: 20, min: 0, max: 100, step: 1 },
            shadowY: { type: ControlType.Number, title: "Shadow Y", defaultValue: 6, min: 0, max: 60, step: 1 },
            shadowOpacity: { type: ControlType.Number, title: "Shadow", defaultValue: 8, min: 0, max: 100, step: 1, unit: "%" },
            hoverTilt: { type: ControlType.Number, title: "Hover Tilt", defaultValue: 6, min: 0, max: 30, step: 1, unit: "°" },
            startDelay: { type: ControlType.Number, title: "Start Delay", defaultValue: 0, min: 0, max: 5000, step: 1, unit: "ms" },
            grain: { type: ControlType.Number, title: "Grain", defaultValue: 0, min: 0, max: 100, step: 1, unit: "%" },
            vignette: { type: ControlType.Number, title: "Vignette", defaultValue: 0, min: 0, max: 100, step: 1, unit: "%" },
        },
    },
})

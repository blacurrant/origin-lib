import * as React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/**
 * Button Morph Card
 *
 * A trigger pill that grows into a card and shrinks back: one container
 * interpolates its box (position, width, height, radius, fill) between the
 * pill and the card, the label glides from the pill's centre to the card's
 * title slot at a constant size, and the card body is clipped inside the box
 * and fades in/out with a blur. Connect any card to the Card slot; empty, a
 * built-in flight card or confirm dialog is drawn.
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
    startDelay: 330,
    holdMs: 2600,
    closeMs: 200,
    restMs: 1300,
    openX1: 22,
    openY1: 100,
    openX2: 36,
    openY2: 100,
    closeX1: 65,
    closeY1: 0,
    closeX2: 35,
    closeY2: 100,
    bodyStart: 35,
    blurPx: 6,
    bodyScale: 92,
    labelLead: 50,
    pillHeight: 46,
    pillPadX: 19,
    centerY: 49,
    cardPad: 35,
    titleY: 48,
    routeProgress: 47,
    rollMs: 600,
    tiltDeg: 3,
    magnet: 8,
    glow: 7,
    borderColor: "#2C3038",
    borderWidth: 1,
    mutedColor: "#998989",
    dashColor: "#7A6A69",
    closeFill: "#45484B",
    closeIcon: "#B9B5B5",
    statusColor: "#3CC65A",
    dangerColor: "#B94C49",
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

const FLIGHT = { w: 587, h: 403 }
const CONFIRM = { w: 565, h: 272 }
const ROUTE = { ax: 172, ay: 216, cx: 295, cy: 156, bx: 418, by: 216 }
const ROUTE_D = `M${ROUTE.ax} ${ROUTE.ay} Q${ROUTE.cx} ${ROUTE.cy} ${ROUTE.bx} ${ROUTE.by}`
const DIGITS = [2, 4]
const COLUMN = Array.from({ length: 20 }, (_, i) => i)
const REF_SIZE = 516
const GRAIN_URL = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function smoothstep(a: number, b: number, x: number) {
    if (a === b) return x >= b ? 1 : 0
    const t = clamp((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
}
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
    x1 = clamp(x1, 0, 1)
    x2 = clamp(x2, 0, 1)
    const cx = 3 * x1,
        bx = 3 * (x2 - x1) - cx,
        ax = 1 - cx - bx
    const cy = 3 * y1,
        by = 3 * (y2 - y1) - cy,
        ay = 1 - cy - by
    const sx = (t: number) => ((ax * t + bx) * t + cx) * t
    const sy = (t: number) => ((ay * t + by) * t + cy) * t
    const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let t = x
        for (let i = 0; i < 8; i++) {
            const err = sx(t) - x
            if (Math.abs(err) < 1e-5 && t >= 0 && t <= 1) return sy(t)
            const d = dx(t)
            if (Math.abs(d) < 1e-6) break
            t -= err / d
        }
        let lo = 0,
            hi = 1
        t = x
        for (let i = 0; i < 40; i++) {
            const v = sx(t)
            if (Math.abs(v - x) < 1e-5) break
            if (v < x) lo = t
            else hi = t
            t = (lo + hi) / 2
        }
        return sy(t)
    }
}

const COLOR_CACHE = new Map<string, number[]>()
function parseColor(c: string): number[] {
    const key = String(c || "")
    const hit = COLOR_CACHE.get(key)
    if (hit) return hit
    let out = [0, 0, 0, 1]
    const s = key.trim()
    if (s.startsWith("#")) {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4) h = h.split("").map((ch) => ch + ch).join("")
        const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
        if (h.length >= 6) out = [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
    } else {
        const m = s.match(/[\d.]+/g)
        if (m && m.length >= 3) out = [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1]
    }
    COLOR_CACHE.set(key, out)
    return out
}
function mixColor(a: string, b: string, t: number) {
    const A = parseColor(a),
        B = parseColor(b)
    return `rgba(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))},${lerp(A[3], B[3], t).toFixed(3)})`
}

function localPoint(e: any, root: HTMLElement | null) {
    let x = e.nativeEvent.offsetX
    let y = e.nativeEvent.offsetY
    let el: any = e.target
    while (el && el !== root) {
        if (el instanceof HTMLElement) {
            x += el.offsetLeft
            y += el.offsetTop
            el = el.offsetParent
        } else {
            el = el.parentElement
        }
    }
    return { x, y }
}

const IMG_STATE = new Map<string, "ok" | "err">()
function useLoaded(src?: string) {
    const [, force] = useState(0)
    useEffect(() => {
        if (!src || IMG_STATE.has(src)) return
        let live = true
        const im = new Image()
        im.onload = () => {
            IMG_STATE.set(src, "ok")
            if (live) force((n) => n + 1)
        }
        im.onerror = () => {
            IMG_STATE.set(src, "err")
            if (live) force((n) => n + 1)
        }
        im.src = src
        return () => {
            live = false
        }
    }, [src])
    return !!src && IMG_STATE.get(src) === "ok"
}

function Pic(props: any) {
    const { src, tint, color, w, h, children } = props
    const ok = useLoaded(src)
    if (src && ok) {
        if (tint) {
            const url = `url("${src}")`
            return (
                <div
                    style={{
                        width: w,
                        height: h,
                        backgroundColor: color,
                        WebkitMaskImage: url,
                        maskImage: url,
                        WebkitMaskSize: "contain",
                        maskSize: "contain",
                        WebkitMaskRepeat: "no-repeat",
                        maskRepeat: "no-repeat",
                        WebkitMaskPosition: "center",
                        maskPosition: "center",
                    }}
                />
            )
        }
        return <img src={src} alt="" draggable={false} style={{ width: w, height: h, objectFit: "contain", display: "block" }} />
    }
    return <>{children}</>
}

function CloseGlyph({ size, color }: any) {
    return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ display: "block" }}>
            <path d="M2 2L12 12M12 2L2 12" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        </svg>
    )
}

function Txt(props: any) {
    const { x, y, u, align = "left", size, weight = 400, color, tracking = 0, ff, children } = props
    const tx = align === "center" ? "-50%" : align === "right" ? "-100%" : "0"
    return (
        <div
            style={{
                position: "absolute",
                left: x * u,
                top: y * u,
                transform: `translate(${tx}, -50%)`,
                fontFamily: ff,
                fontSize: size * u,
                fontWeight: weight,
                color,
                letterSpacing: `${tracking}em`,
                lineHeight: 1,
                whiteSpace: "nowrap",
            }}
        >
            {children}
        </div>
    )
}

const BUTTON_RESET: React.CSSProperties = {
    border: "none",
    padding: 0,
    margin: 0,
    background: "transparent",
    appearance: "none",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    position: "absolute",
}

function details(rollP: number, adv: any) {
    const r = easeOutCubic(clamp(rollP, 0, 1))
    const digits = DIGITS.map((d, i) => d + 10 * (1 - easeOutCubic(clamp(rollP * 1.2 - i * 0.2, 0, 1))))
    const prog = clamp(adv.routeProgress, 0, 100) * r
    const t = prog / 100
    const x = (1 - t) * (1 - t) * ROUTE.ax + 2 * (1 - t) * t * ROUTE.cx + t * t * ROUTE.bx
    const y = (1 - t) * (1 - t) * ROUTE.ay + 2 * (1 - t) * t * ROUTE.cy + t * t * ROUTE.by
    const dx = 2 * (1 - t) * (ROUTE.cx - ROUTE.ax) + 2 * t * (ROUTE.bx - ROUTE.cx)
    const dy = 2 * (1 - t) * (ROUTE.cy - ROUTE.ay) + 2 * t * (ROUTE.by - ROUTE.cy)
    return { digits, prog, x, y, ang: Math.atan2(dy, dx) }
}

function FlightBody(props: any) {
    const { u, ff, c, adv, pic, tint, init, digitRefs, solidRef, planeRef, onClose } = props
    return (
        <>
            <svg
                width={FLIGHT.w * u}
                height={FLIGHT.h * u}
                viewBox={`0 0 ${FLIGHT.w} ${FLIGHT.h}`}
                style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
            >
                <path d={ROUTE_D} fill="none" stroke={adv.dashColor} strokeWidth={3} strokeDasharray="8 6" />
                <path ref={solidRef} d={ROUTE_D} fill="none" stroke={c.text} strokeWidth={3} pathLength={100} strokeDasharray={`${init.prog} 100`} />
                <circle cx={ROUTE.ax} cy={ROUTE.ay} r={5} fill={c.text} />
                <circle cx={ROUTE.bx} cy={ROUTE.by} r={6} fill={c.card} stroke={c.text} strokeWidth={2.5} />
            </svg>
            <button
                aria-label="Close"
                onClick={onClose}
                style={{
                    ...BUTTON_RESET,
                    left: (542 - 21.5) * u,
                    top: (44 - 21.5) * u,
                    width: 43 * u,
                    height: 43 * u,
                    borderRadius: "50%",
                    background: adv.closeFill,
                }}
            >
                <Pic src={pic(2)} tint={tint} color={adv.closeIcon} w={14 * u} h={14 * u}>
                    <CloseGlyph size={14 * u} color={adv.closeIcon} />
                </Pic>
            </button>
            <Txt x={35} y={104} u={u} ff={ff} size={19} weight={500} color={adv.mutedColor} tracking={0.08}>MI765</Txt>
            <Txt x={287} y={104} u={u} ff={ff} size={19} weight={500} color={adv.mutedColor} align="center">Sky Wing</Txt>
            <Txt x={552} y={104} u={u} ff={ff} size={19} weight={500} color={adv.mutedColor} tracking={0.08} align="right">SKYFLY</Txt>
            <Txt x={35} y={193} u={u} ff={ff} size={54} weight={700} color={c.text} tracking={-0.03}>NYC</Txt>
            <Txt x={552} y={193} u={u} ff={ff} size={54} weight={700} color={c.text} tracking={-0.03} align="right">LON</Txt>
            <Txt x={35} y={238} u={u} ff={ff} size={21} color={adv.mutedColor}>3.30 pm</Txt>
            <Txt x={552} y={238} u={u} ff={ff} size={21} color={adv.mutedColor} align="right">5.00 pm</Txt>
            <div
                ref={planeRef}
                style={{
                    position: "absolute",
                    left: init.x * u,
                    top: init.y * u,
                    width: 26 * u,
                    height: 26 * u,
                    transform: `translate(-50%, -50%) rotate(${init.ang}rad)`,
                    pointerEvents: "none",
                }}
            >
                <Pic src={pic(0)} tint={tint} color={c.text} w={26 * u} h={26 * u}>
                    <svg width={26 * u} height={26 * u} viewBox="0 0 24 24" style={{ display: "block" }}>
                        <path
                            fill={c.text}
                            d="M22 12c0-.8-.7-1.3-1.5-1.3H15L10 3H8l2.5 7.7H5.2L3.5 8.5H2l1 3.5-1 3.5h1.5l1.7-2.2h5.3L8 21h2l5-7.7h5.5c.8 0 1.5-.5 1.5-1.3z"
                        />
                    </svg>
                </Pic>
            </div>
            <Txt x={296} y={252} u={u} ff={ff} size={19} color={adv.mutedColor} align="center">Direct Flight</Txt>
            <div
                style={{
                    position: "absolute",
                    left: 35 * u,
                    top: 311 * u - 4 * u,
                    width: 8 * u,
                    height: 8 * u,
                    borderRadius: "50%",
                    background: adv.statusColor,
                }}
            />
            <Txt x={49} y={311} u={u} ff={ff} size={19} weight={600} color={adv.statusColor}>On Time</Txt>
            <div
                style={{
                    position: "absolute",
                    left: 35 * u,
                    top: 351 * u,
                    transform: "translateY(-50%)",
                    fontFamily: ff,
                    fontSize: 25 * u,
                    fontWeight: 600,
                    color: c.text,
                    lineHeight: "1.15em",
                    whiteSpace: "nowrap",
                    display: "flex",
                }}
            >
                <span>Landing in&nbsp;</span>
                {DIGITS.map((_, i) => (
                    <span key={i} style={{ display: "inline-block", height: "1.15em", overflow: "hidden" }}>
                        <span
                            ref={(el) => {
                                digitRefs.current[i] = el
                            }}
                            style={{ display: "block", transform: `translateY(${-init.digits[i] * 1.15}em)` }}
                        >
                            {COLUMN.map((n) => (
                                <span key={n} style={{ display: "block", height: "1.15em" }}>
                                    {n % 10}
                                </span>
                            ))}
                        </span>
                    </span>
                ))}
                <span>&nbsp;min</span>
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 552 * u,
                    top: 320 * u,
                    transform: "translate(-100%, -50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6 * u,
                    color: adv.mutedColor,
                    fontFamily: ff,
                    fontSize: 19 * u,
                    fontWeight: 500,
                    lineHeight: 1,
                }}
            >
                <Pic src={pic(1)} tint={tint} color={adv.mutedColor} w={18 * u} h={16 * u}>
                    <svg width={18 * u} height={16 * u} viewBox="0 0 18 16" fill="none" stroke={adv.mutedColor} strokeWidth={1.5} style={{ display: "block" }}>
                        <rect x="1" y="4" width="16" height="11" rx="2" />
                        <path d="M6 4V2.5C6 1.7 6.7 1 7.5 1h3c.8 0 1.5.7 1.5 1.5V4" />
                    </svg>
                </Pic>
                <span>4</span>
            </div>
            <Txt x={552} y={356} u={u} ff={ff} size={27} weight={700} color={c.text} align="right">1h 30min</Txt>
        </>
    )
}

function ConfirmBody(props: any) {
    const { u, ff, c, adv, pic, tint, onClose } = props
    return (
        <>
            <button aria-label="Close" onClick={onClose} style={{ ...BUTTON_RESET, left: (520 - 17) * u, top: (44 - 17) * u, width: 34 * u, height: 34 * u }}>
                <Pic src={pic(2)} tint={tint} color={adv.mutedColor} w={15 * u} h={15 * u}>
                    <CloseGlyph size={15 * u} color={adv.mutedColor} />
                </Pic>
            </button>
            <Txt x={33} y={105} u={u} ff={ff} size={22} color={adv.mutedColor}>Every deployment and preview URL goes with</Txt>
            <Txt x={33} y={139} u={u} ff={ff} size={22} color={adv.mutedColor}>it. This cannot be undone.</Txt>
            <button
                onClick={onClose}
                style={{
                    ...BUTTON_RESET,
                    left: 33 * u,
                    top: 187 * u,
                    width: 244 * u,
                    height: 53 * u,
                    fontFamily: ff,
                    fontSize: 22 * u,
                    fontWeight: 500,
                    color: c.text,
                }}
            >
                Keep it
            </button>
            <button
                onClick={onClose}
                style={{
                    ...BUTTON_RESET,
                    left: 289 * u,
                    top: 187 * u,
                    width: 243 * u,
                    height: 53 * u,
                    borderRadius: 26.5 * u,
                    background: adv.dangerColor,
                    fontFamily: ff,
                    fontSize: 22 * u,
                    color: "#F4F1EE",
                }}
            >
                Delete
            </button>
        </>
    )
}

function geometry(P: any, W: number, H: number, slotW: number, slotH: number) {
    const kind = P.hasSlot ? "slot" : P.preset === "confirm" ? "confirm" : "flight"
    const ref = kind === "confirm" ? CONFIRM : FLIGHT
    const aspect = ref.w / ref.h
    const s = Math.max(160, Math.min(P.size, W * 0.9, H * 0.86 * aspect))
    const k = s / REF_SIZE
    const unit = s / ref.w
    let cw = s,
        ch = s / aspect
    if (kind === "slot" && slotW > 4 && slotH > 4) {
        cw = slotW
        ch = slotH
    }
    return { kind, s, k, unit, cw, ch, W, H }
}

function frame(e: number, g: any, P: any, st: any) {
    const adv = P.adv
    const ph = adv.pillHeight * g.k
    const pw = st.lw + 2 * adv.pillPadX * g.k
    const bw = lerp(pw, g.cw, e)
    const bh = lerp(ph, g.ch, e)
    const rc = ((clamp(P.rounded, 0, 100) / 100) * Math.min(g.cw, g.ch)) / 2
    const r = Math.max(0, Math.min(lerp(rc, bh / 2, smoothstep(ph * 1.6, ph, bh)), bw / 2, bh / 2))
    const cx = g.W / 2
    const cy = (g.H * clamp(adv.centerY, 0, 100)) / 100
    const hk = Math.max(0, adv.hover) / 50
    const ov = st.ov * hk
    const nx = clamp((st.sx - cx) / Math.max(1, g.cw / 2), -1, 1)
    const ny = clamp((st.sy - cy) / Math.max(1, g.ch / 2), -1, 1)
    const reach = adv.magnet * g.k * (1 - e) * ov
    const mx = nx * reach
    const my = ny * reach
    const tilt = adv.tiltDeg * ov * e
    const sc = 1 + 0.04 * ov * (1 - e) - 0.03 * st.press * hk * (1 - e * 0.7)
    const left = cx - bw / 2
    const top = cy - bh / 2

    const b = smoothstep(clamp(adv.bodyStart, 0, 99) / 100, 1, e)
    const bs = clamp(adv.bodyScale, 10, 100) / 100

    const lead = clamp(adv.labelLead / 100, 0.1, 1)
    const el = P.labelInCard ? smoothstep(0.08, lead, e) : 0
    const lx = lerp((bw - st.lw) / 2, adv.cardPad * g.unit, el)
    const ly = lerp((bh - st.lh) / 2, adv.titleY * g.unit - st.lh / 2, el)
    const lo = P.labelInCard ? 1 : 1 - smoothstep(0.1, 0.4, e)

    const hx = st.sx - (left + mx)
    const hy = st.sy - (top + my)
    const R = Math.max(bw, bh) * 0.6

    return {
        b,
        box: {
            left: `${left}px`,
            top: `${top}px`,
            width: `${bw}px`,
            height: `${bh}px`,
            borderRadius: `${r}px`,
            background: mixColor(P.colors.button, P.colors.card, e),
            boxShadow: adv.borderWidth > 0 ? `inset 0 0 0 ${adv.borderWidth}px ${adv.borderColor}` : "none",
            transform: `translate(${mx}px, ${my}px) perspective(1400px) rotateX(${-ny * tilt}deg) rotateY(${nx * tilt}deg) scale(${sc})`,
            cursor: e < 0.5 ? "pointer" : "default",
        },
        body: {
            left: `${(bw - g.cw) / 2}px`,
            top: `${(bh - g.ch) / 2}px`,
            width: `${g.cw}px`,
            height: `${g.ch}px`,
            opacity: `${b}`,
            filter: `blur(${(adv.blurPx * g.k * (1 - b)).toFixed(2)}px)`,
            transform: `scale(${lerp(bs, 1, b)})`,
            pointerEvents: b > 0.6 ? "auto" : "none",
        },
        label: {
            transform: `translate(${lx}px, ${ly}px)`,
            opacity: `${lo}`,
        },
        hl: {
            background: `radial-gradient(${R}px circle at ${hx}px ${hy}px, rgba(255,255,255,${((adv.glow / 100) * ov).toFixed(3)}), rgba(255,255,255,0))`,
        },
    }
}

export default function ButtonMorphCard(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        size = 516,
        label = "Track my flight",
        font = { fontFamily: "Inter", fontWeight: 500, fontSize: 20, letterSpacing: "-0.01em", lineHeight: "1.2em" },
        colors = {},
        card,
        preset = "flight",
        labelInCard = true,
        duration = 340,
        rounded = 16,
        autoplay = true,
        images,
        tint = true,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }
    const c = {
        button: colors.button ?? "#1A1D23",
        text: colors.text ?? "#D9D8D6",
        card: colors.card ?? "#1A1D23",
    }
    const slot: any = Array.isArray(card) ? card[0] : card
    const hasSlot = React.isValidElement(slot)
    const ff = font?.fontFamily ?? "Inter"
    const fs = parseFloat(String(font?.fontSize ?? 20)) || 20

    const picList: string[] = (Array.isArray(images) ? images : [])
        .map((v: any) => (typeof v === "string" ? v : v?.src))
        .filter(Boolean)
    const pic = (i: number) => (picList.length ? picList[i % picList.length] : undefined)

    const rt = RenderTarget.current()
    const isStatic = rt === RenderTarget.export || rt === RenderTarget.thumbnail
    const isCanvas = rt === RenderTarget.canvas
    const reduced =
        typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const P = { size, preset, hasSlot, rounded, duration, autoplay, labelInCard, adv, colors: c }
    const propsRef = useRef<any>(P)
    propsRef.current = P

    const [stage, setStage] = useState<[number, number]>([1200, 800])
    const [slotSize, setSlotSize] = useState<[number, number]>([0, 0])

    const stRef = useRef<any>(null)
    if (!stRef.current) {
        const still = isStatic || reduced
        stRef.current = {
            u: still ? 1 : 0,
            dir: 1,
            e: still ? 1 : 0,
            open: reduced,
            manual: false,
            loopT: -adv.startDelay,
            rollP: still ? 1 : 0,
            W: 1200,
            H: 800,
            slotW: 0,
            slotH: 0,
            lw: label.length * fs * 0.5,
            lh: fs * 1.2,
            px: 600,
            py: 400,
            sx: 600,
            sy: 400,
            ov: 0,
            overT: 0,
            press: 0,
            pressT: 0,
            reduced,
        }
    }
    const st = stRef.current

    const rootRef = useRef<HTMLDivElement>(null)
    const boxRef = useRef<HTMLDivElement>(null)
    const bodyRef = useRef<HTMLDivElement>(null)
    const labelRef = useRef<HTMLDivElement>(null)
    const hlRef = useRef<HTMLDivElement>(null)
    const measureRef = useRef<HTMLDivElement>(null)
    const digitRefs = useRef<(HTMLSpanElement | null)[]>([])
    const solidRef = useRef<SVGPathElement>(null)
    const planeRef = useRef<HTMLDivElement>(null)

    const openCard = () => {
        if (isCanvas) return
        st.manual = true
        st.open = true
    }
    const closeCard = () => {
        if (isCanvas) return
        st.manual = true
        st.open = false
    }
    const onClose = (e: any) => {
        e.stopPropagation()
        closeCard()
    }

    // Stage size
    useLayoutEffect(() => {
        const el = rootRef.current
        if (!el) return
        const measure = () => {
            const w = el.offsetWidth || 1200
            const h = el.offsetHeight || 800
            st.W = w
            st.H = h
            setStage((s) => (s[0] === w && s[1] === h ? s : [w, h]))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Label size
    useLayoutEffect(() => {
        const el = labelRef.current
        if (!el) return
        const measure = () => {
            st.lw = el.offsetWidth
            st.lh = el.offsetHeight
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Connected card's natural size
    useLayoutEffect(() => {
        const el = measureRef.current
        if (!hasSlot || !el) {
            st.slotW = 0
            st.slotH = 0
            return
        }
        const measure = () => {
            const w = el.offsetWidth
            const h = el.offsetHeight
            st.slotW = w
            st.slotH = h
            setSlotSize((s) => (s[0] === w && s[1] === h ? s : [w, h]))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [hasSlot])

    // Release + Esc on window
    useEffect(() => {
        const up = () => {
            st.pressT = 0
        }
        const key = (e: KeyboardEvent) => {
            if (e.key === "Escape" && st.e > 0.5) closeCard()
        }
        window.addEventListener("pointerup", up)
        window.addEventListener("pointercancel", up)
        window.addEventListener("keydown", key)
        return () => {
            window.removeEventListener("pointerup", up)
            window.removeEventListener("pointercancel", up)
            window.removeEventListener("keydown", key)
        }
    }, [])

    // Frame loop
    useEffect(() => {
        if (isStatic) return
        let raf = 0
        let last = -1
        const step = (dt: number) => {
            const p = propsRef.current
            const a = p.adv
            const ms = dt * 1000
            const openMs = Math.max(1, p.duration)
            const closeMs = Math.max(1, a.closeMs)
            const auto = (p.autoplay || isCanvas) && !st.manual && !st.reduced

            if (st.reduced) {
                st.u = st.open ? 1 : 0
                st.dir = st.open ? 1 : -1
            } else if (auto) {
                st.loopT += ms
                const hold = Math.max(0, a.holdMs)
                const rest = Math.max(0, a.restMs)
                const L = openMs + hold + closeMs + rest
                if (st.loopT < 0) {
                    st.u = 0
                    st.dir = 1
                } else {
                    const tau = st.loopT % L
                    if (tau < openMs) {
                        st.dir = 1
                        st.u = tau / openMs
                    } else if (tau < openMs + hold) {
                        st.dir = 1
                        st.u = 1
                    } else if (tau < openMs + hold + closeMs) {
                        st.dir = -1
                        st.u = 1 - (tau - openMs - hold) / closeMs
                    } else {
                        st.dir = -1
                        st.u = 0
                    }
                }
                st.open = st.dir > 0 && st.u > 0
            } else {
                const target = st.open ? 1 : 0
                if (target > st.u) {
                    st.dir = 1
                    st.u = Math.min(1, st.u + ms / openMs)
                } else if (target < st.u) {
                    st.dir = -1
                    st.u = Math.max(0, st.u - ms / closeMs)
                }
            }

            const e =
                st.dir > 0
                    ? cubicBezier(a.openX1 / 100, a.openY1 / 100, a.openX2 / 100, a.openY2 / 100)(st.u)
                    : 1 - cubicBezier(a.closeX1 / 100, a.closeY1 / 100, a.closeX2 / 100, a.closeY2 / 100)(1 - st.u)
            st.e = e

            if (st.reduced) st.rollP = st.open ? 1 : 0
            else {
                const rollTarget = st.dir > 0 && e > 0.5 ? 1 : 0
                const rate = ms / Math.max(1, a.rollMs)
                st.rollP = rollTarget > st.rollP ? Math.min(1, st.rollP + rate) : Math.max(0, st.rollP - rate * 2)
            }

            const kOver = 1 - Math.exp(-dt * 8)
            st.ov += (st.overT - st.ov) * kOver
            st.press += (st.pressT - st.press) * (1 - Math.exp(-dt * 14))
            const kPos = 1 - Math.exp(-dt * 10)
            st.sx += (st.px - st.sx) * kPos
            st.sy += (st.py - st.sy) * kPos

            const g = geometry(p, st.W, st.H, st.slotW, st.slotH)
            const f = frame(e, g, p, st)
            if (boxRef.current) Object.assign(boxRef.current.style, f.box)
            if (bodyRef.current) Object.assign(bodyRef.current.style, f.body)
            if (labelRef.current) Object.assign(labelRef.current.style, f.label)
            if (hlRef.current) Object.assign(hlRef.current.style, f.hl)

            const d = details(st.rollP, a)
            digitRefs.current.forEach((el, i) => {
                if (el) el.style.transform = `translateY(${-d.digits[i] * 1.15}em)`
            })
            if (solidRef.current) solidRef.current.setAttribute("stroke-dasharray", `${d.prog} 100`)
            if (planeRef.current) {
                planeRef.current.style.left = `${d.x * g.unit}px`
                planeRef.current.style.top = `${d.y * g.unit}px`
                planeRef.current.style.transform = `translate(-50%, -50%) rotate(${d.ang}rad)`
            }
        }
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop)
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            last = now
            step(dt)
        }
        raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
    }, [])

    const g = geometry(P, stage[0], stage[1], slotSize[0], slotSize[1])
    const f = frame(st.e, g, P, st)
    const init = details(st.rollP, adv)

    const onPointer = (e: any) => {
        const pt = localPoint(e, rootRef.current)
        st.px = pt.x
        st.py = pt.y
        if (st.overT === 0 && st.ov < 0.02) {
            st.sx = pt.x
            st.sy = pt.y
        }
        st.overT = 1
    }

    let content: React.ReactNode = null
    if (hasSlot) {
        const el = slot as React.ReactElement<any>
        content = React.cloneElement(el, {
            style: { ...((el.props && el.props.style) || {}), width: "100%", height: "100%" },
        })
    } else if (g.kind === "confirm") {
        content = <ConfirmBody u={g.unit} ff={ff} c={c} adv={adv} pic={pic} tint={tint} onClose={onClose} />
    } else {
        content = (
            <FlightBody
                u={g.unit}
                ff={ff}
                c={c}
                adv={adv}
                pic={pic}
                tint={tint}
                init={init}
                digitRefs={digitRefs}
                solidRef={solidRef}
                planeRef={planeRef}
                onClose={onClose}
            />
        )
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
                background,
                overflow: "hidden",
                isolation: "isolate",
                userSelect: "none",
                touchAction: "manipulation",
            }}
            onPointerEnter={onPointer}
            onPointerMove={onPointer}
            onPointerLeave={() => {
                st.overT = 0
            }}
            onPointerDown={() => {
                st.pressT = 1
            }}
            onClick={() => {
                if (st.e > 0.5) closeCard()
            }}
        >
            {hasSlot && (
                <div
                    ref={measureRef}
                    aria-hidden
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: "max-content",
                        visibility: "hidden",
                        pointerEvents: "none",
                        zIndex: -1,
                    }}
                >
                    {slot}
                </div>
            )}
            <div
                ref={boxRef}
                role="button"
                tabIndex={0}
                aria-label={label}
                onClick={(e) => {
                    e.stopPropagation()
                    if (st.e < 0.5) openCard()
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        if (st.e < 0.5) openCard()
                        else closeCard()
                    }
                }}
                style={{
                    position: "absolute",
                    overflow: "hidden",
                    transformOrigin: "50% 50%",
                    willChange: "transform",
                    outline: "none",
                    ...f.box,
                }}
            >
                <div ref={bodyRef} style={{ position: "absolute", transformOrigin: "50% 50%", ...(f.body as any) }}>
                    {content}
                </div>
                <div ref={hlRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", ...f.hl }} />
                <div
                    ref={labelRef}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        fontFamily: ff,
                        fontWeight: font?.fontWeight ?? 500,
                        fontStyle: font?.fontStyle,
                        letterSpacing: font?.letterSpacing ?? "-0.01em",
                        lineHeight: font?.lineHeight ?? "1.2em",
                        fontSize: fs * g.k,
                        color: c.text,
                        ...f.label,
                    }}
                >
                    {label}
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
                        pointerEvents: "none",
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${(adv.vignette / 100) * 0.85}) 100%)`,
                    }}
                />
            )}
        </div>
    )
}

addPropertyControls(ButtonMorphCard, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Stage colour behind the button and card.",
    },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        description: "Pill, text and card fills.",
        controls: {
            button: { type: ControlType.Color, title: "Button", defaultValue: "#1A1D23", description: "Pill fill; blends into the card fill as it opens." },
            text: { type: ControlType.Color, title: "Text", defaultValue: "#D9D8D6", description: "Label and main card text." },
            card: { type: ControlType.Color, title: "Card", defaultValue: "#1A1D23", description: "Open card fill." },
        },
    },
    label: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "Track my flight",
        description: "Button text. It glides into the card's title slot.",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontFamily: "Inter", fontWeight: 500, fontSize: 20, letterSpacing: "-0.01em", lineHeight: "1.2em" },
        description: "Label font. Its size is the label size at the default Size.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 240,
        max: 1000,
        step: 1,
        unit: "px",
        defaultValue: 516,
        description: "Width of the open built-in card; the pill and label scale with it. A connected card keeps its own size.",
    },
    card: {
        type: ControlType.ComponentInstance,
        title: "Card",
        description: "Connect any card to open into. Empty draws the built-in card.",
    },
    preset: {
        type: ControlType.Enum,
        title: "Built-in",
        options: ["flight", "confirm"],
        optionTitles: ["Flight", "Confirm"],
        defaultValue: "flight",
        displaySegmentedControl: true,
        description: "Built-in card shown when no card is connected.",
    },
    labelInCard: {
        type: ControlType.Boolean,
        title: "Title in Card",
        defaultValue: true,
        enabledTitle: "Yes",
        disabledTitle: "No",
        description: "The label becomes the card's title. Off fades it out, for cards with their own title.",
    },
    duration: {
        type: ControlType.Number,
        title: "Open",
        min: 200,
        max: 800,
        step: 10,
        unit: "ms",
        defaultValue: 340,
        description: "How long the pill takes to grow into the card.",
    },
    rounded: {
        type: ControlType.Number,
        title: "Rounded",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 16,
        description: "Card corner radius as a % of half its short side. The pill is always fully round.",
    },
    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Loops open, hold and close until someone clicks. Always loops on the canvas.",
    },
    images: {
        type: ControlType.Array,
        title: "Icons",
        maxCount: 3,
        control: { type: ControlType.ResponsiveImage },
        description: "Your own icons for the plane, luggage and close marks, in turn. One upload goes on all. Empty draws the built-in ones.",
    },
    tint: {
        type: ControlType.Boolean,
        title: "Tint Icons",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Draw uploaded icons as silhouettes in the card's colours.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Pointer response strength: magnetic pill, card tilt and light." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain overlay." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening overlay." },
            startDelay: { type: ControlType.Number, title: "Start Delay", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 330, description: "Pill rest before the first open." },
            holdMs: { type: ControlType.Number, title: "Hold", min: 0, max: 8000, step: 10, unit: "ms", defaultValue: 2600, description: "Time the card stays open in the loop." },
            closeMs: { type: ControlType.Number, title: "Close", min: 60, max: 1000, step: 10, unit: "ms", defaultValue: 200, description: "How long the card takes to shrink back." },
            restMs: { type: ControlType.Number, title: "Rest", min: 0, max: 8000, step: 10, unit: "ms", defaultValue: 1300, description: "Time the pill rests before reopening." },
            openX1: { type: ControlType.Number, title: "Open X1", min: 0, max: 100, step: 1, defaultValue: 22, description: "Open easing bezier x1 (×100)." },
            openY1: { type: ControlType.Number, title: "Open Y1", min: -50, max: 150, step: 1, defaultValue: 100, description: "Open easing bezier y1 (×100)." },
            openX2: { type: ControlType.Number, title: "Open X2", min: 0, max: 100, step: 1, defaultValue: 36, description: "Open easing bezier x2 (×100)." },
            openY2: { type: ControlType.Number, title: "Open Y2", min: -50, max: 150, step: 1, defaultValue: 100, description: "Open easing bezier y2 (×100)." },
            closeX1: { type: ControlType.Number, title: "Close X1", min: 0, max: 100, step: 1, defaultValue: 65, description: "Close easing bezier x1 (×100)." },
            closeY1: { type: ControlType.Number, title: "Close Y1", min: -50, max: 150, step: 1, defaultValue: 0, description: "Close easing bezier y1 (×100)." },
            closeX2: { type: ControlType.Number, title: "Close X2", min: 0, max: 100, step: 1, defaultValue: 35, description: "Close easing bezier x2 (×100)." },
            closeY2: { type: ControlType.Number, title: "Close Y2", min: -50, max: 150, step: 1, defaultValue: 100, description: "Close easing bezier y2 (×100)." },
            bodyStart: { type: ControlType.Number, title: "Body Start", min: 0, max: 95, step: 1, unit: "%", defaultValue: 35, description: "How far into the morph the card body starts to appear." },
            blurPx: { type: ControlType.Number, title: "Body Blur", min: 0, max: 30, step: 1, unit: "px", defaultValue: 6, description: "Blur on the card body while it fades." },
            bodyScale: { type: ControlType.Number, title: "Body Scale", min: 50, max: 100, step: 1, unit: "%", defaultValue: 92, description: "Body scale at the start of its fade." },
            labelLead: { type: ControlType.Number, title: "Label Lead", min: 10, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Morph progress at which the label reaches the title slot." },
            pillHeight: { type: ControlType.Number, title: "Pill Height", min: 20, max: 120, step: 1, unit: "px", defaultValue: 46, description: "Button height at the default Size." },
            pillPadX: { type: ControlType.Number, title: "Pill Padding", min: 0, max: 60, step: 1, unit: "px", defaultValue: 19, description: "Horizontal padding around the label." },
            centerY: { type: ControlType.Number, title: "Center Y", min: 20, max: 80, step: 1, unit: "%", defaultValue: 49, description: "Vertical centre of the pill and card." },
            cardPad: { type: ControlType.Number, title: "Title X", min: 0, max: 100, step: 1, unit: "px", defaultValue: 35, description: "Title inset from the card's left edge (design px)." },
            titleY: { type: ControlType.Number, title: "Title Y", min: 0, max: 150, step: 1, unit: "px", defaultValue: 48, description: "Title centre from the card's top (design px)." },
            routeProgress: { type: ControlType.Number, title: "Route", min: 0, max: 100, step: 1, unit: "%", defaultValue: 47, description: "How far along the arc the plane sits." },
            rollMs: { type: ControlType.Number, title: "Roll", min: 100, max: 2000, step: 10, unit: "ms", defaultValue: 600, description: "Digit roll and route draw time." },
            tiltDeg: { type: ControlType.Number, title: "Tilt", min: 0, max: 15, step: 1, unit: "°", defaultValue: 3, description: "Card tilt toward the pointer." },
            magnet: { type: ControlType.Number, title: "Magnet", min: 0, max: 30, step: 1, unit: "px", defaultValue: 8, description: "How far the pill leans toward the pointer." },
            glow: { type: ControlType.Number, title: "Glow", min: 0, max: 40, step: 1, unit: "%", defaultValue: 7, description: "Light that follows the pointer over the surface." },
            borderColor: { type: ControlType.Color, title: "Border", defaultValue: "#2C3038", description: "Hairline round the pill and card." },
            borderWidth: { type: ControlType.Number, title: "Border Width", min: 0, max: 4, step: 1, unit: "px", defaultValue: 1, description: "Hairline width; 0 removes it." },
            mutedColor: { type: ControlType.Color, title: "Muted", defaultValue: "#998989", description: "Secondary text and icons." },
            dashColor: { type: ControlType.Color, title: "Dashes", defaultValue: "#7A6A69", description: "Unflown part of the route." },
            closeFill: { type: ControlType.Color, title: "Close Fill", defaultValue: "#45484B", description: "Close button circle." },
            closeIcon: { type: ControlType.Color, title: "Close Icon", defaultValue: "#B9B5B5", description: "Close button cross." },
            statusColor: { type: ControlType.Color, title: "Status", defaultValue: "#3CC65A", description: "On Time dot and text." },
            dangerColor: { type: ControlType.Color, title: "Danger", defaultValue: "#B94C49", description: "Delete button fill in the confirm card." },
        },
    },
})

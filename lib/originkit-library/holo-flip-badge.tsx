import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    hover: 50,
    grain: 0,
    vignette: 0,
    autoPlay: true,
    cycleMs: 6000,
    holdMs: 1600,
    flipStiffness: 60,
    flipDamping: 16,
    swingStiffness: 48,
    swingDamping: 20,
    swingKick: 70,
    idleSway: 25,
    restAngle: 1,
    tiltMax: 12,
    tiltStiffness: 170,
    tiltDamping: 22,
    perspective: 1000,
    sheenOpacity: 45,
    glare: 35,
    lineY: 27,
    lineWidth: 70,
    lineSag: 14,
    stringLength: 60,
    wireColor: "#9A9DA0",
    cardRadius: 18,
    shadowOpacity: 8,
    photoTop: "#E4DEEF",
    photoColor: "#C9C4D6",
    textColor: "#231C1C",
    mutedColor: "#5D6263",
    holoMint: "#CFF1E3",
    holoBlue: "#C6DDF6",
    holoPink: "#EFC6E9",
    holoYellow: "#F1EEC0",
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

const FONT = `"Inter", "Inter Display", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`

const GRAIN_URL = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>")`

/** The Image control's default, also used when no image prop is passed (outside Framer). */
const DEFAULT_IMAGE = {"src":"https://images.unsplash.com/photo-1792676818211-6ab6ccfd86c4?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""}

const TAU = Math.PI * 2

function hashString(s: string) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}

function qrPath(seed: number) {
    const n = 21
    let s = seed || 1
    const rnd = () => {
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const corners = [
        [0, 0],
        [14, 0],
        [0, 14],
    ]
    let d = ""
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            let on = false
            let handled = false
            for (const [fx, fy] of corners) {
                if (x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7) {
                    handled = true
                    const lx = x - fx
                    const ly = y - fy
                    if (lx >= 0 && lx < 7 && ly >= 0 && ly < 7) {
                        const ring = Math.max(Math.abs(lx - 3), Math.abs(ly - 3))
                        on = ring === 3 || ring <= 1
                    }
                }
            }
            if (!handled) on = rnd() < 0.5
            if (on) d += `M${x} ${y}h1v1h-1z`
        }
    }
    return d
}

function DefaultAvatar({ id }: { id: string }) {
    return (
        <svg
            viewBox="0 0 224 198"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMax slice"
            style={{ display: "block", position: "absolute", inset: 0 }}
        >
            <defs>
                <radialGradient id={`${id}skin`} cx="0.38" cy="0.32" r="0.8">
                    <stop offset="0" stopColor="#F9C6A6" />
                    <stop offset="0.55" stopColor="#EE9F7D" />
                    <stop offset="1" stopColor="#C46A55" />
                </radialGradient>
                <radialGradient id={`${id}shirt`} cx="0.4" cy="0.15" r="0.95">
                    <stop offset="0" stopColor="#7E5C4C" />
                    <stop offset="1" stopColor="#432C24" />
                </radialGradient>
                <radialGradient id={`${id}hair`} cx="0.35" cy="0.25" r="0.85">
                    <stop offset="0" stopColor="#45403F" />
                    <stop offset="0.5" stopColor="#1E1919" />
                    <stop offset="1" stopColor="#0E0B0B" />
                </radialGradient>
                <linearGradient id={`${id}neck`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#C9725A" />
                    <stop offset="1" stopColor="#E59478" />
                </linearGradient>
            </defs>
            <path d="M18 198 C26 164 62 150 112 148 C162 150 198 164 206 198 Z" fill={`url(#${id}shirt)`} />
            <path d="M95 124 L129 124 L131 156 C122 164 102 164 93 156 Z" fill={`url(#${id}neck)`} />
            <ellipse cx="73" cy="100" rx="7" ry="11" fill="#E0886A" />
            <ellipse cx="151" cy="100" rx="7" ry="11" fill="#D27C62" />
            <ellipse cx="112" cy="94" rx="40" ry="47" fill={`url(#${id}skin)`} />
            <path d="M88 84 Q96 79 104 83" stroke="#2A1C1A" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M120 83 Q128 79 136 84" stroke="#2A1C1A" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="97" cy="95" rx="3.4" ry="4.4" fill="#22171A" />
            <ellipse cx="127" cy="95" rx="3.4" ry="4.4" fill="#22171A" />
            <ellipse cx="111" cy="108" rx="7.5" ry="6.5" fill="#E58A6B" />
            <ellipse cx="109" cy="106" rx="3" ry="2" fill="#FBD0B6" opacity="0.7" />
            <path d="M101 123 Q112 129 123 123" stroke="#A84E3E" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path
                d="M72 98 C64 62 80 38 112 36 C132 34 152 24 174 32 C188 37 186 52 172 56 C162 59 154 58 151 66 C146 58 132 56 118 60 C100 65 86 72 80 102 Z"
                fill={`url(#${id}hair)`}
            />
            <path d="M118 42 C138 36 158 32 172 38" stroke="#6A6262" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.55" />
        </svg>
    )
}

/**
 * Holo Flip Badge
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function HoloFlipBadge(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        cardColor = "#F2F2F3",
        holoTint = "#D8CBF3",
        image = DEFAULT_IMAGE,
        imageFit = "cover",
        offsetX = 0,
        offsetY = -31,
        personName = "Leo Carter",
        personRole = "Motion Designer",
        size = 220,
        speed = 50,
        swing = 50,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const propsRef = useRef(props)
    propsRef.current = props

    const rootRef = useRef<HTMLDivElement>(null)
    const swingRef = useRef<HTMLDivElement>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const sheenRef = useRef<HTMLDivElement>(null)
    const glareFrontRef = useRef<HTMLDivElement>(null)
    const holoRef = useRef<HTMLDivElement>(null)
    const glareBackRef = useRef<HTMLDivElement>(null)

    const [box, setBox] = useState({ w: 1200, h: 800 })

    const rawId = (React as any).useId ? (React as any).useId() : "hfb"
    const uid = String(rawId).replace(/[^a-zA-Z0-9]/g, "")

    const imgSrc: string | undefined =
        typeof image === "string" ? image || undefined : image?.src || undefined
    const [imgOk, setImgOk] = useState(false)
    useEffect(() => {
        setImgOk(false)
    }, [imgSrc])

    const rt = RenderTarget.current()
    const isStatic = rt === RenderTarget.thumbnail || rt === (RenderTarget as any).export

    // Layout (design units: a 260 × 390 card)
    const k = Math.max(40, size) / 260
    const px = (v: number) => v * k
    const Wc = px(260)
    const Hc = px(390)
    const cx = box.w / 2
    const lineY = (box.h * adv.lineY) / 100
    const sag = adv.lineSag
    const beadY = lineY + sag
    const stringLen = px(adv.stringLength)
    const cardOffset = stringLen + px(6)
    const lineHalf = (box.w * adv.lineWidth) / 200

    const layoutRef = useRef({ left: 0, top: 0, w: 0, h: 0 })
    layoutRef.current = { left: cx - Wc / 2, top: beadY + cardOffset, w: Wc, h: Hc }

    const stRef = useRef({
        flip: 0,
        flipV: 0,
        flipT: 0,
        sw: 0,
        swV: 0,
        tx: 0,
        txV: 0,
        ty: 0,
        tyV: 0,
        over: 0,
        autoT: 0,
        idleT: 0,
        wasAuto: false,
        wasOver: false,
        last: -1,
        cursor: "",
    })
    const ptrRef = useRef({ x: -9999, y: -9999, vx: 0, inside: false, down: false, lastMove: -1e9 })

    // Size
    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const measure = () => {
            const w = el.offsetWidth
            const h = el.offsetHeight
            if (w > 0 && h > 0) setBox((b) => (b.w === w && b.h === h ? b : { w, h }))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Pointer + frame loop
    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const st = stRef.current
        const ptr = ptrRef.current
        const mq =
            typeof window !== "undefined" && window.matchMedia
                ? window.matchMedia("(prefers-reduced-motion: reduce)")
                : null

        const inCard = (x: number, y: number, pad = 0) => {
            const L = layoutRef.current
            return x >= L.left - pad && x <= L.left + L.w + pad && y >= L.top - pad && y <= L.top + L.h + pad
        }
        const getAdv = () => ({ ...ADVANCED_DEFAULTS, ...(propsRef.current.advanced ?? {}) })

        // Pointer in the root's own (unzoomed) pixels, whichever child it lands on
        const local = (e: PointerEvent) => {
            const r = el.getBoundingClientRect()
            const sx = r.width > 0 ? el.offsetWidth / r.width : 1
            const sy = r.height > 0 ? el.offsetHeight / r.height : 1
            return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
        }
        const onMove = (e: PointerEvent) => {
            const p = local(e)
            ptr.vx = p.x - ptr.x
            ptr.x = p.x
            ptr.y = p.y
            ptr.inside = true
            ptr.lastMove = performance.now()
        }
        const onDown = (e: PointerEvent) => {
            onMove(e)
            ptr.down = true
            if (inCard(ptr.x, ptr.y)) {
                const a = getAdv()
                const p = propsRef.current
                st.flipT = st.flipT > 90 ? 0 : 180
                const L = layoutRef.current
                const sign = ptr.x >= L.left + L.w / 2 ? 1 : -1
                st.swV += a.swingKick * ((p.swing ?? 50) / 50) * sign
                if (mq?.matches) {
                    st.flip = st.flipT
                    st.flipV = 0
                }
            }
        }
        const onLeave = () => {
            ptr.inside = false
            ptr.down = false
        }
        const onUp = () => {
            ptr.down = false
        }
        el.addEventListener("pointermove", onMove)
        el.addEventListener("pointerdown", onDown)
        el.addEventListener("pointerleave", onLeave)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        let raf = 0
        const tick = (now: number) => {
            raf = requestAnimationFrame(tick)
            const p = propsRef.current
            const a = getAdv()
            let dt = st.last < 0 ? 0 : (now - st.last) / 1000
            st.last = now
            dt = Math.min(Math.max(dt, 0), 1 / 20)
            const sp = Math.max(0, p.speed ?? 50) / 50
            const sdt = dt * sp
            const hov = Math.max(0, a.hover) / 50
            const swAmt = Math.max(0, p.swing ?? 50) / 50
            const reduced = !!mq?.matches
            const L = layoutRef.current
            const ccx = L.left + L.w / 2
            const ccy = L.top + L.h / 2

            st.idleT += sdt

            const pointerOverCard = ptr.inside && inCard(ptr.x, ptr.y, L.w * 0.04)
            const userActive = ptr.inside && (now - ptr.lastMove < 2500 || pointerOverCard || ptr.down)
            const auto = !userActive && a.autoPlay

            let overT = 0
            let u = 0
            let v = 0

            if (auto) {
                if (!st.wasAuto) st.autoT = 0
                const hold = Math.max(0.2, a.holdMs / 1000)
                const e1 = 1.0
                const e2 = e1 + 0.7 + hold
                const T = Math.max(a.cycleMs / 1000, e2 + 1.4)
                let prev = st.autoT
                st.autoT += sdt
                if (st.autoT >= T) {
                    st.autoT -= T
                    prev -= T
                }
                const cross = (t: number) => prev < t && st.autoT >= t
                if (cross(e1)) {
                    if (st.flipT !== 180) st.swV += a.swingKick * swAmt
                    st.flipT = 180
                }
                if (cross(e2)) {
                    if (st.flipT !== 0) st.swV -= a.swingKick * swAmt
                    st.flipT = 0
                }
                // A pointer-free hover: shimmer sweeps across the back while it shows
                const s0 = e1 + 0.45
                const s1 = e2 - 0.05
                if (st.autoT > s0 && st.autoT < s1) {
                    const f = (st.autoT - s0) / (s1 - s0)
                    overT = Math.sin(Math.PI * f)
                    u = -0.7 + 1.4 * f
                    v = -0.3 + 0.4 * Math.sin(Math.PI * f)
                }
            } else if (userActive && pointerOverCard) {
                overT = 1
                u = Math.max(-1, Math.min(1, (ptr.x - ccx) / (L.w / 2)))
                v = Math.max(-1, Math.min(1, (ptr.y - ccy) / (L.h / 2)))
                if (!st.wasOver) {
                    const sign = ptr.vx !== 0 ? Math.sign(ptr.vx) : Math.sign(u) || 1
                    st.swV += a.swingKick * 0.4 * hov * swAmt * sign
                }
            }
            st.wasAuto = auto
            st.wasOver = overT > 0.5

            overT *= Math.min(1, hov)

            // Idle sway: never quite still, never a short repeat
            const idle = Math.max(0, a.idleSway) / 10
            const t = st.idleT
            const swayT =
                a.restAngle + idle * swAmt * (0.65 * Math.sin((t * TAU) / 3.3) + 0.35 * Math.sin((t * TAU) / 5.1 + 1.3))
            const yawI = idle * 1.6 * Math.sin((t * TAU) / 4.3 + 0.7)
            const pitchI = idle * 0.5 * Math.sin((t * TAU) / 3.7 + 2.1)
            const tyT = yawI + u * a.tiltMax * hov * overT
            const txT = pitchI - v * a.tiltMax * hov * overT

            if (reduced) {
                st.flip = st.flipT
                st.flipV = 0
                st.sw = a.restAngle
                st.swV = 0
                st.tx = 0
                st.ty = 0
                st.over += (overT - st.over) * (1 - Math.exp(-dt * 8))
            } else {
                const n = Math.max(1, Math.ceil(sdt / (1 / 240)))
                const h = sdt / n
                const fk = a.flipStiffness
                const fc = a.flipDamping
                const sk = a.swingStiffness
                const sc = a.swingDamping / 10
                const tk = a.tiltStiffness
                const tc = a.tiltDamping
                for (let i = 0; i < n; i++) {
                    st.flipV += (-fk * (st.flip - st.flipT) - fc * st.flipV) * h
                    st.flip += st.flipV * h
                    st.swV += (-sk * (st.sw - swayT) - sc * st.swV) * h
                    st.sw += st.swV * h
                    st.txV += (-tk * (st.tx - txT) - tc * st.txV) * h
                    st.tx += st.txV * h
                    st.tyV += (-tk * (st.ty - tyT) - tc * st.tyV) * h
                    st.ty += st.tyV * h
                }
                st.over += (overT - st.over) * (1 - Math.exp(-sdt * 8))
            }

            if (swingRef.current) swingRef.current.style.transform = `rotate(${st.sw.toFixed(3)}deg)`
            if (cardRef.current)
                cardRef.current.style.transform = `rotateX(${st.tx.toFixed(3)}deg) rotateY(${(st.flip + st.ty).toFixed(3)}deg)`

            const nu = a.tiltMax > 0 ? st.ty / a.tiltMax : 0
            const nv = a.tiltMax > 0 ? st.tx / a.tiltMax : 0
            const fs = Math.sin((st.flip * Math.PI) / 180)
            const drift = 10 * Math.sin(t * 0.9) + 6 * Math.sin(t * 0.53 + 1.1)
            const pos = Math.max(0, Math.min(100, 50 + nu * 35 + fs * 30 + drift))
            const posY = Math.max(0, Math.min(100, 50 - nv * 25 + drift * 0.5))
            const gpos = Math.max(0, Math.min(100, 50 + nu * 45 + fs * 40))

            if (sheenRef.current) {
                sheenRef.current.style.opacity = String((st.over * a.sheenOpacity) / 100)
                sheenRef.current.style.backgroundPosition = `${pos}% ${posY}%`
            }
            if (glareFrontRef.current) {
                glareFrontRef.current.style.opacity = String((st.over * a.glare) / 100)
                glareFrontRef.current.style.backgroundPosition = `${gpos}% ${posY}%`
            }
            if (holoRef.current) holoRef.current.style.backgroundPosition = `${pos}% ${posY}%`
            if (glareBackRef.current) {
                glareBackRef.current.style.opacity = String(((0.35 + 0.65 * st.over) * a.glare) / 100)
                glareBackRef.current.style.backgroundPosition = `${100 - gpos}% ${posY}%`
            }

            const cur = ptr.inside && inCard(ptr.x, ptr.y) ? "pointer" : "default"
            if (cur !== st.cursor) {
                st.cursor = cur
                el.style.cursor = cur
            }
        }
        if (!isStatic) raf = requestAnimationFrame(tick)

        return () => {
            cancelAnimationFrame(raf)
            el.removeEventListener("pointermove", onMove)
            el.removeEventListener("pointerdown", onDown)
            el.removeEventListener("pointerleave", onLeave)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
        }
    }, [isStatic])

    const qr = useMemo(() => qrPath(hashString(personName || "badge")), [personName])
    const email = `${(personName || "hello").trim().split(/\s+/)[0].toLowerCase()}@example.com`

    const txt = (fs: number, color: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
        position: "absolute",
        fontFamily: FONT,
        fontSize: px(fs),
        lineHeight: 1.15,
        color,
        whiteSpace: "nowrap",
        margin: 0,
        ...extra,
    })
    const caps: React.CSSProperties = { textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }

    const holoGradient = `linear-gradient(125deg, ${adv.holoPink} 0%, ${adv.holoBlue} 18%, ${adv.holoMint} 34%, #FFFFFF 48%, ${adv.holoYellow} 60%, ${holoTint} 78%, ${adv.holoPink} 100%)`
    const glareGradient = `linear-gradient(115deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 62%)`
    const radius = px(adv.cardRadius)
    const shadow = `0 ${px(12)}px ${px(30)}px rgba(0,0,0,${adv.shadowOpacity / 100}), inset 0 0 0 1px rgba(255,255,255,0.55)`

    const faceBase: React.CSSProperties = {
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        overflow: "hidden",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        boxShadow: shadow,
    }
    const rule = (top: number): React.CSSProperties => ({
        position: "absolute",
        left: px(16),
        right: px(16),
        top: px(top),
        height: 1,
        background: "rgba(0,0,0,0.1)",
    })

    const picture = (round: boolean, idSuffix: string) => (
        <div
            style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, ${adv.photoTop} 0%, ${adv.photoColor} 100%)`,
                borderRadius: round ? "50%" : px(12),
                overflow: "hidden",
            }}
        >
            {!(imgSrc && imgOk) && <DefaultAvatar id={`${uid}${idSuffix}`} />}
            {imgSrc && (
                <img
                    src={imgSrc}
                    alt=""
                    draggable={false}
                    onLoad={() => setImgOk(true)}
                    onError={() => setImgOk(false)}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: imageFit === "cover" ? "cover" : "contain",
                        objectPosition:
                            imageFit === "cover"
                                ? `${50 + Math.max(-50, Math.min(50, offsetX))}% ${50 + Math.max(-50, Math.min(50, offsetY))}%`
                                : "50% 50%",
                        opacity: imgOk ? 1 : 0,
                        display: "block",
                    }}
                />
            )}
        </div>
    )

    const x0 = cx - lineHalf
    const x1 = cx + lineHalf
    const cordPath = `M ${x0} ${lineY} Q ${(x0 + cx) / 2} ${lineY + sag * 0.75} ${cx} ${beadY} Q ${(cx + x1) / 2} ${lineY + sag * 0.75} ${x1} ${lineY}`

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
                touchAction: "manipulation",
            }}
        >
            {/* Cord across the top with one centre bead */}
            <svg
                width={box.w}
                height={box.h}
                style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
            >
                <path d={cordPath} stroke={adv.wireColor} strokeWidth={1.4} fill="none" strokeLinecap="round" />
                <circle cx={x0} cy={lineY} r={2.5} fill={adv.wireColor} />
                <circle cx={x1} cy={lineY} r={2.5} fill={adv.wireColor} />
                <circle cx={cx} cy={beadY} r={3.2} fill={adv.wireColor} />
            </svg>

            {/* Swings from the bead: string, clip and card */}
            <div
                ref={swingRef}
                style={{
                    position: "absolute",
                    left: cx,
                    top: beadY,
                    width: 0,
                    height: 0,
                    transformOrigin: "0 0",
                    transform: `rotate(${adv.restAngle}deg)`,
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: -0.7,
                        top: 0,
                        width: 1.4,
                        height: cardOffset - px(6),
                        background: adv.wireColor,
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        left: -Wc / 2,
                        top: cardOffset,
                        width: Wc,
                        height: Hc,
                        perspective: adv.perspective,
                    }}
                >
                    <div
                        ref={cardRef}
                        style={{
                            position: "absolute",
                            inset: 0,
                            transformStyle: "preserve-3d",
                            transformOrigin: "50% 50%",
                        }}
                    >
                        {/* Front: the avatar card (rest face) */}
                        <div style={{ ...faceBase, background: cardColor }}>
                            <div style={txt(7.5, adv.mutedColor, { left: px(16), top: px(14), ...caps })}>
                                People · Studio
                            </div>
                            <div style={txt(7.5, adv.mutedColor, { right: px(16), top: px(14), ...caps })}>#02</div>
                            <div
                                style={{
                                    position: "absolute",
                                    left: px(14),
                                    top: px(32),
                                    width: px(232),
                                    height: px(222),
                                }}
                            >
                                {picture(false, "f")}
                            </div>
                            <div
                                style={txt(22, adv.textColor, {
                                    left: px(16),
                                    top: px(266),
                                    fontWeight: 400,
                                    letterSpacing: "-0.01em",
                                })}
                            >
                                {personName}
                            </div>
                            <div style={txt(12, adv.mutedColor, { left: px(16), top: px(297) })}>{personRole}</div>
                            <div style={rule(338)} />
                            <div style={txt(7.5, adv.textColor, { left: px(16), top: px(359), ...caps, fontWeight: 600 })}>
                                View profile
                            </div>
                            <div
                                style={{
                                    position: "absolute",
                                    right: px(14),
                                    top: px(352),
                                    width: px(22),
                                    height: px(22),
                                    borderRadius: "50%",
                                    background: "#1C1C1E",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg viewBox="0 0 12 12" width={px(10)} height={px(10)}>
                                    <path
                                        d="M3 9 L9 3 M4.5 3 H9 V7.5"
                                        stroke="#FFFFFF"
                                        strokeWidth="1.4"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                            <div
                                ref={sheenRef}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: holoGradient,
                                    backgroundSize: "250% 250%",
                                    mixBlendMode: "multiply",
                                    opacity: 0,
                                    pointerEvents: "none",
                                }}
                            />
                            <div
                                ref={glareFrontRef}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: glareGradient,
                                    backgroundSize: "250% 250%",
                                    opacity: 0,
                                    pointerEvents: "none",
                                }}
                            />
                        </div>

                        {/* Back: the holographic profile */}
                        <div style={{ ...faceBase, transform: "rotateY(180deg)", background: adv.holoMint }}>
                            <div
                                ref={holoRef}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: holoGradient,
                                    backgroundSize: "250% 250%",
                                    backgroundPosition: "50% 50%",
                                }}
                            />
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background:
                                        "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.06) 100%)",
                                }}
                            />
                            <div style={txt(7.5, adv.mutedColor, { left: px(16), top: px(16), ...caps })}>
                                Profile / 02
                            </div>
                            <div
                                style={{
                                    position: "absolute",
                                    right: px(14),
                                    top: px(12),
                                    width: px(22),
                                    height: px(22),
                                    borderRadius: "50%",
                                    background: "rgba(0,0,0,0.12)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg viewBox="0 0 12 12" width={px(11)} height={px(11)}>
                                    <path
                                        d="M9.5 6 A3.5 3.5 0 1 1 8 3.1 M8.3 1.2 V3.4 H6.1"
                                        stroke={adv.textColor}
                                        strokeWidth="1.2"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                            <div
                                style={{
                                    position: "absolute",
                                    left: px(16),
                                    top: px(44),
                                    width: px(30),
                                    height: px(30),
                                }}
                            >
                                {picture(true, "b")}
                            </div>
                            <div style={txt(15, adv.textColor, { left: px(54), top: px(44), fontWeight: 500 })}>
                                {personName}
                            </div>
                            <div style={txt(9, adv.mutedColor, { left: px(54), top: px(63) })}>{personRole}</div>
                            <div style={txt(8.5, adv.mutedColor, { left: px(16), top: px(88) })}>• Berlin, DE</div>
                            <div
                                style={txt(9.5, adv.textColor, {
                                    left: px(16),
                                    top: px(106),
                                    width: px(228),
                                    whiteSpace: "normal",
                                    lineHeight: 1.4,
                                })}
                            >
                                Making motion that feels inevitable, one small detail at a time.
                            </div>
                            <div style={txt(7, adv.mutedColor, { left: px(16), top: px(148), ...caps })}>
                                Selected projects
                            </div>
                            <div style={txt(9.5, adv.textColor, { left: px(16), top: px(164) })}>Motion / Orbit</div>
                            <div style={rule(182)} />
                            <div style={txt(9.5, adv.textColor, { left: px(16), top: px(190) })}>Launch / Loop</div>
                            <div style={rule(208)} />
                            <div style={txt(7, adv.mutedColor, { left: px(16), top: px(330), ...caps })}>
                                Let's connect
                            </div>
                            <div style={txt(9, adv.textColor, { left: px(16), top: px(345) })}>{email}</div>
                            <svg
                                viewBox="0 0 21 21"
                                width={px(50)}
                                height={px(50)}
                                shapeRendering="crispEdges"
                                style={{ position: "absolute", right: px(18), top: px(302) }}
                            >
                                <path d={qr} fill={adv.textColor} />
                            </svg>
                            <div
                                style={txt(6.5, adv.textColor, {
                                    right: px(18),
                                    top: px(358),
                                    width: px(50),
                                    textAlign: "center",
                                    ...caps,
                                    fontWeight: 600,
                                })}
                            >
                                Scan me
                            </div>
                            <div
                                ref={glareBackRef}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: glareGradient,
                                    backgroundSize: "250% 250%",
                                    opacity: (0.35 * adv.glare) / 100,
                                    pointerEvents: "none",
                                }}
                            />
                        </div>
                    </div>
                </div>
                {/* Metal clip at the card's top edge */}
                <div
                    style={{
                        position: "absolute",
                        left: -px(9),
                        top: cardOffset - px(9),
                        width: px(18),
                        height: px(14),
                        borderRadius: `${px(9)}px ${px(9)}px ${px(3)}px ${px(3)}px`,
                        background: "linear-gradient(180deg, #D9DCDF 0%, #9EA3A8 100%)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
                        zIndex: 2,
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: px(4),
                            width: px(5),
                            height: px(5),
                            marginLeft: -px(2.5),
                            borderRadius: "50%",
                            background: "#7C8186",
                        }}
                    />
                </div>
            </div>

            {adv.grain > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: GRAIN_URL,
                        opacity: (adv.grain / 100) * 0.5,
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
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${adv.vignette / 100}) 100%)`,
                        pointerEvents: "none",
                    }}
                />
            )}
        </div>
    )
}

addPropertyControls(HoloFlipBadge, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    cardColor: { type: ControlType.Color, title: "Card", defaultValue: "#F2F2F3" },
    holoTint: { type: ControlType.Color, title: "Holo Tint", defaultValue: "#D8CBF3" },
    personName: { type: ControlType.String, title: "Name", defaultValue: "Leo Carter" },
    personRole: { type: ControlType.String, title: "Role", defaultValue: "Motion Designer" },
    image: {
        defaultValue: DEFAULT_IMAGE, type: ControlType.ResponsiveImage, title: "Image" },
    imageFit: {
        type: ControlType.Enum,
        title: "Fit",
        options: ["contain", "cover"],
        optionTitles: ["Contain", "Cover"],
        defaultValue: "cover",
        displaySegmentedControl: true,
        hidden: (p: any) => !p.image,
    },
    offsetX: {
        type: ControlType.Number,
        title: "Offset X",
        defaultValue: 0,
        min: -50,
        max: 50,
        step: 1,
        unit: "%",
        hidden: (p: any) => !p.image || p.imageFit !== "cover",
    },
    offsetY: {
        type: ControlType.Number,
        title: "Offset Y",
        defaultValue: -31,
        min: -50,
        max: 50,
        step: 1,
        unit: "%",
        hidden: (p: any) => !p.image || p.imageFit !== "cover",
    },
    size: { type: ControlType.Number, title: "Size", defaultValue: 220, min: 120, max: 480, step: 1, unit: "px" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 50, min: 0, max: 100, step: 1 },
    swing: { type: ControlType.Number, title: "Swing", defaultValue: 50, min: 0, max: 100, step: 1, unit: "%" },
    hover: { type: ControlType.Number, title: "Hover", defaultValue: 50, min: 0, max: 100, step: 1, unit: "%" },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", defaultValue: 0, min: 0, max: 100, step: 1, unit: "%" },
            vignette: { type: ControlType.Number, title: "Vignette", defaultValue: 0, min: 0, max: 100, step: 1, unit: "%" },
            autoPlay: { type: ControlType.Boolean, title: "Auto Play", defaultValue: true },
            cycleMs: { type: ControlType.Number, title: "Cycle", defaultValue: 6000, min: 2000, max: 15000, step: 100, unit: "ms" },
            holdMs: { type: ControlType.Number, title: "Hold", defaultValue: 1600, min: 200, max: 6000, step: 100, unit: "ms" },
            flipStiffness: { type: ControlType.Number, title: "Flip Stiffness", defaultValue: 60, min: 10, max: 400, step: 1 },
            flipDamping: { type: ControlType.Number, title: "Flip Damping", defaultValue: 16, min: 1, max: 60, step: 1 },
            swingStiffness: { type: ControlType.Number, title: "Swing Stiffness", defaultValue: 48, min: 5, max: 300, step: 1 },
            swingDamping: { type: ControlType.Number, title: "Swing Damping", defaultValue: 20, min: 1, max: 200, step: 1 },
            swingKick: { type: ControlType.Number, title: "Swing Kick", defaultValue: 70, min: 0, max: 300, step: 1 },
            idleSway: { type: ControlType.Number, title: "Idle Sway", defaultValue: 25, min: 0, max: 100, step: 1 },
            restAngle: { type: ControlType.Number, title: "Rest Angle", defaultValue: 1, min: -10, max: 10, step: 1, unit: "°" },
            tiltMax: { type: ControlType.Number, title: "Tilt", defaultValue: 12, min: 0, max: 40, step: 1, unit: "°" },
            tiltStiffness: { type: ControlType.Number, title: "Tilt Stiffness", defaultValue: 170, min: 10, max: 600, step: 1 },
            tiltDamping: { type: ControlType.Number, title: "Tilt Damping", defaultValue: 22, min: 1, max: 80, step: 1 },
            perspective: { type: ControlType.Number, title: "Perspective", defaultValue: 1000, min: 200, max: 4000, step: 10, unit: "px" },
            sheenOpacity: { type: ControlType.Number, title: "Sheen", defaultValue: 45, min: 0, max: 100, step: 1, unit: "%" },
            glare: { type: ControlType.Number, title: "Glare", defaultValue: 35, min: 0, max: 100, step: 1, unit: "%" },
            lineY: { type: ControlType.Number, title: "Line Y", defaultValue: 27, min: 0, max: 80, step: 1, unit: "%" },
            lineWidth: { type: ControlType.Number, title: "Line Width", defaultValue: 70, min: 10, max: 100, step: 1, unit: "%" },
            lineSag: { type: ControlType.Number, title: "Line Sag", defaultValue: 14, min: 0, max: 80, step: 1, unit: "px" },
            stringLength: { type: ControlType.Number, title: "String", defaultValue: 60, min: 0, max: 300, step: 1, unit: "px" },
            wireColor: { type: ControlType.Color, title: "Wire", defaultValue: "#9A9DA0" },
            cardRadius: { type: ControlType.Number, title: "Card Radius", defaultValue: 18, min: 0, max: 60, step: 1, unit: "px" },
            shadowOpacity: { type: ControlType.Number, title: "Shadow", defaultValue: 8, min: 0, max: 100, step: 1, unit: "%" },
            photoTop: { type: ControlType.Color, title: "Photo Top", defaultValue: "#E4DEEF" },
            photoColor: { type: ControlType.Color, title: "Photo", defaultValue: "#C9C4D6" },
            textColor: { type: ControlType.Color, title: "Text", defaultValue: "#231C1C" },
            mutedColor: { type: ControlType.Color, title: "Muted", defaultValue: "#5D6263" },
            holoMint: { type: ControlType.Color, title: "Holo Mint", defaultValue: "#CFF1E3" },
            holoBlue: { type: ControlType.Color, title: "Holo Blue", defaultValue: "#C6DDF6" },
            holoPink: { type: ControlType.Color, title: "Holo Pink", defaultValue: "#EFC6E9" },
            holoYellow: { type: ControlType.Color, title: "Holo Yellow", defaultValue: "#F1EEC0" },
        },
    },
})

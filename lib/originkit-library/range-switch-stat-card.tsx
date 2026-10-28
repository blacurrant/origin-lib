import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    hover: 50,
    grain: 0,
    vignette: 0,
    cardHeight: 68,
    cardRadius: 48,
    cardShadow: 6,
    lineWeight: 250,
    areaOpacity: 35,
    dotRadius: 6,
    glowSize: 6,
    haloScale: 180,
    haloOpacity: 25,
    pulseMs: 1600,
    thumbMs: 500,
    morphMs: 600,
    morphDelayMs: 100,
    staggerMs: 12,
    countMs: 900,
    holdMs: 4000,
    firstSwitchMs: 3000,
    tiltDeg: 4,
    buttonLift: 3,
    tipIndex: 17,
    trackColor: "#24242B",
    thumbColor: "#3A3A46",
    mutedColor: "#8A8A98",
    labelColor: "#6E6E7C",
    guideColor: "#3A3A46",
    badgeAlpha: 14,
    buttonColor: "#24242B",
    iconColor: "#6E6E7C",
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

/* ---- Sound ---------------------------------------------------------------
 * Tiny synthesized cues, no files and no network. Silent unless the `sound`
 * prop is on, and only ever played from a real user action (pointer or key),
 * never from autoplay, timers or demo cursors. One shared AudioContext lives
 * on window so many components do not each open their own. */
type Cue = "tick" | "click" | "pop" | "on" | "off" | "whoosh" | "drop" | "success" | "error" | "type"
const cueAt: Record<string, number> = {}

function playCue(cue: Cue, volume = 0.5, minGap = 45, pitch = 1) {
    if (typeof window === "undefined" || volume <= 0) return
    const stamp = Date.now()
    if (stamp - (cueAt[cue] || 0) < minGap) return
    cueAt[cue] = stamp
    try {
        const w = window as any
        const AC = w.AudioContext || w.webkitAudioContext
        if (!AC) return
        const ctx: AudioContext = (w.__okAudio = w.__okAudio || new AC())
        if (ctx.state === "suspended") ctx.resume()
        const t0 = ctx.currentTime
        const out = ctx.createGain()
        out.gain.value = Math.min(1, volume) * 0.4
        out.connect(ctx.destination)
        const tone = (type: OscillatorType, f0: number, f1: number, dur: number, gain = 1, delay = 0) => {
            const o = ctx.createOscillator()
            const g = ctx.createGain()
            const s = t0 + delay
            o.type = type
            o.frequency.setValueAtTime(f0 * pitch, s)
            o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), s + dur)
            g.gain.setValueAtTime(0.0001, s)
            g.gain.exponentialRampToValueAtTime(gain, s + 0.006)
            g.gain.exponentialRampToValueAtTime(0.0001, s + dur)
            o.connect(g)
            g.connect(out)
            o.start(s)
            o.stop(s + dur + 0.02)
        }
        const noise = (dur: number, f0: number, f1: number, gain = 1, delay = 0) => {
            const n = Math.max(1, Math.floor(ctx.sampleRate * dur))
            const buf = ctx.createBuffer(1, n, ctx.sampleRate)
            const d = buf.getChannelData(0)
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
            const src = ctx.createBufferSource()
            const f = ctx.createBiquadFilter()
            const g = ctx.createGain()
            const s = t0 + delay
            src.buffer = buf
            f.type = "bandpass"
            f.Q.value = 0.9
            f.frequency.setValueAtTime(f0 * pitch, s)
            f.frequency.exponentialRampToValueAtTime(Math.max(40, f1 * pitch), s + dur)
            g.gain.setValueAtTime(0.0001, s)
            g.gain.exponentialRampToValueAtTime(gain, s + 0.01)
            g.gain.exponentialRampToValueAtTime(0.0001, s + dur)
            src.connect(f)
            f.connect(g)
            g.connect(out)
            src.start(s)
        }
        if (cue === "tick") tone("triangle", 2300, 1900, 0.035, 0.55)
        else if (cue === "click") {
            noise(0.025, 3200, 2400, 0.7)
            tone("sine", 190, 120, 0.04, 0.5)
        } else if (cue === "pop") tone("sine", 540, 190, 0.12, 0.9)
        else if (cue === "on") {
            tone("sine", 520, 520, 0.09, 0.6)
            tone("sine", 780, 780, 0.12, 0.6, 0.07)
        } else if (cue === "off") {
            tone("sine", 650, 650, 0.09, 0.5)
            tone("sine", 420, 420, 0.12, 0.5, 0.07)
        } else if (cue === "whoosh") noise(0.24, 500, 2600, 0.8)
        else if (cue === "drop") {
            tone("sine", 170, 55, 0.16, 0.95)
            noise(0.05, 900, 400, 0.4)
        } else if (cue === "success") {
            tone("triangle", 523, 523, 0.11, 0.55)
            tone("triangle", 659, 659, 0.11, 0.55, 0.075)
            tone("triangle", 784, 784, 0.18, 0.6, 0.15)
        } else if (cue === "error") {
            tone("square", 160, 120, 0.13, 0.35)
            tone("square", 150, 110, 0.15, 0.35, 0.16)
        } else if (cue === "type") {
            noise(0.014, 3800, 3000, 0.55)
            tone("square", 1500 + Math.random() * 300, 1100, 0.02, 0.18)
        }
    } catch {
        /* audio blocked or unsupported: stay silent */
    }
}
/* ---- end Sound ---------------------------------------------------------- */

// Card design space (the reference card, 512 × 598)
const CW = 512
const CH = 598
const TRACK_L = 40
const TRACK_W = 431
const THIRD = TRACK_W / 3
const THUMB_W = 135
const BASE_Y = 348

const XS = [39, 57, 70, 88, 104, 124, 140, 164, 181, 199, 213, 240, 257, 278, 294, 308, 324, 341, 366, 377, 400, 422, 439, 444, 460, 471]
const RANGES = [
    {
        label: "7d",
        days: 7,
        ys: [300, 292, 306, 284, 296, 310, 288, 276, 298, 286, 304, 316, 296, 282, 300, 290, 272, 288, 306, 294, 278, 290, 300, 280, 284, 262],
        total: 8120,
        change: "4.1%",
        users: 214,
        bounce: 3.8,
    },
    {
        label: "12d",
        days: 12,
        ys: [318, 321, 286, 293, 267, 282, 261, 292, 282, 293, 267, 322, 314, 328, 303, 284, 300, 267, 295, 261, 278, 288, 293, 274, 276, 249],
        total: 12480,
        change: "12.5%",
        users: 342,
        bounce: 3.1,
    },
    {
        label: "30d",
        days: 30,
        ys: [324, 312, 318, 298, 306, 290, 302, 284, 296, 276, 292, 280, 270, 286, 264, 278, 258, 272, 262, 250, 268, 254, 246, 262, 250, 240],
        total: 39060,
        change: "18.2%",
        users: 1096,
        bounce: 2.4,
    },
]
// 12d → 30d → 7d → 12d
const NEXT = [1, 2, 0]

const MONO = `"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace`
const SANS = `"Inter", "Inter Placeholder", system-ui, -apple-system, sans-serif`

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -0.2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
    const bz = (u: number, a: number, b: number) => {
        const v = 1 - u
        return 3 * v * v * u * a + 3 * v * u * u * b + u * u * u
    }
    return (t: number) => {
        if (t <= 0) return 0
        if (t >= 1) return 1
        let lo = 0
        let hi = 1
        let u = t
        for (let i = 0; i < 22; i++) {
            u = (lo + hi) / 2
            if (bz(u, x1, x2) < t) lo = u
            else hi = u
        }
        return bz(u, y1, y2)
    }
}
const EASE_IO = cubicBezier(0.65, 0, 0.35, 1)
const EASE_OUT = cubicBezier(0.33, 1, 0.68, 1)

function parseColor(c: any): number[] | null {
    if (typeof c !== "string") return null
    const s = c.trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("")
        if (h.length >= 6) {
            const n = parseInt(h.slice(0, 6), 16)
            if (isNaN(n)) return null
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
        }
        return null
    }
    const m = s.match(/rgba?\(([^)]+)\)/i)
    if (m) {
        const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat)
        if (p.length >= 3) return [p[0], p[1], p[2]]
    }
    return null
}

function mixColor(a: string, b: string, t: number) {
    const ca = parseColor(a)
    const cb = parseColor(b)
    if (!ca || !cb) return t > 0.5 ? b : a
    const r = Math.round(lerp(ca[0], cb[0], t))
    const g = Math.round(lerp(ca[1], cb[1], t))
    const bl = Math.round(lerp(ca[2], cb[2], t))
    return `rgb(${r}, ${g}, ${bl})`
}

function withAlpha(c: string, a: number) {
    const p = parseColor(c)
    if (!p) return c
    return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${clamp01(a).toFixed(3)})`
}

const thumbX = (f: number) => TRACK_L + THIRD * f + (THIRD - THUMB_W) / 2

function linePath(ys: number[]) {
    let d = `M${XS[0]},${ys[0].toFixed(2)}`
    for (let i = 1; i < XS.length; i++) d += `L${XS[i]},${ys[i].toFixed(2)}`
    return d
}
function areaPath(ys: number[]) {
    return `${linePath(ys)}L${XS[XS.length - 1]},${BASE_Y}L${XS[0]},${BASE_Y}Z`
}
const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US")
const fmtMoney = (v: number) => `$${fmtInt(v)}`
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const midDay = (days: number) => Math.floor((days + 1) / 2)

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function RangeSwitchStatCard(props: any) {
    props = withMovedControls(props)
    const {
        background = "#0A0A0D",
        accent = "#8B7CFF",
        cardColor = "#16161B",
        inkColor = "#F2F2F6",
        title = "Revenue",
        speed = 50,
        scale = 100,
        autoCycle = true,
        font = {},
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const propsRef = useRef<any>(props)
    propsRef.current = props

    const rootRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const thumbRef = useRef<HTMLDivElement>(null)
    const segRefs = useRef<(HTMLDivElement | null)[]>([])
    const numRef = useRef<HTMLDivElement>(null)
    const badgeTextRef = useRef<HTMLSpanElement>(null)
    const lineRef = useRef<SVGPathElement>(null)
    const areaRef = useRef<SVGPathElement>(null)
    const hGuideRef = useRef<SVGLineElement>(null)
    const vGuideRef = useRef<SVGLineElement>(null)
    const dotRef = useRef<SVGCircleElement>(null)
    const glowRef = useRef<SVGCircleElement>(null)
    const haloRef = useRef<SVGCircleElement>(null)
    const hoverDotRef = useRef<SVGCircleElement>(null)
    const tipRef = useRef<HTMLDivElement>(null)
    const tipTextRef = useRef<HTMLSpanElement>(null)
    const axisRefs = useRef<(HTMLDivElement | null)[]>([])
    const usersRef = useRef<HTMLDivElement>(null)
    const bounceRef = useRef<HTMLDivElement>(null)
    const btnRef = useRef<HTMLDivElement>(null)
    const gradId = useRef(`okg${Math.random().toString(36).slice(2, 9)}`).current

    useEffect(() => {
        const root = rootRef.current
        const overlay = overlayRef.current
        if (!root || !overlay) return

        const size = { W: root.offsetWidth || 1200, H: root.offsetHeight || 800 }
        const ro = new ResizeObserver(() => {
            size.W = root.offsetWidth
            size.H = root.offsetHeight
        })
        ro.observe(root)

        const reduced =
            typeof window !== "undefined" &&
            !!window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches

        const init = RANGES[1]
        const st: any = {
            clock: 0,
            anchor: 0,
            fired: 0,
            range: 1,
            fromRange: 1,
            trStart: -1000,
            thumb: 1,
            fromThumb: 1,
            ys: init.ys.slice(),
            fromYs: init.ys.slice(),
            vals: [init.total, init.users, init.bounce],
            fromVals: [init.total, init.users, init.bounce],
            tipIdx: ADVANCED_DEFAULTS.tipIndex,
            overE: 0,
            tiltX: 0,
            tiltY: 0,
            btnE: 0,
            pressE: 0,
            s: 1,
            ptr: { x: 0, y: 0, inside: false, down: false },
            txt: {} as Record<string, string>,
            cursor: "",
        }

        const setText = (el: HTMLElement | null, key: string, v: string) => {
            if (!el || st.txt[key] === v) return
            st.txt[key] = v
            el.textContent = v
        }

        const start = (to: number) => {
            st.fromThumb = st.thumb
            st.fromYs = st.ys.slice()
            st.fromVals = st.vals.slice()
            st.fromRange = st.range
            st.range = to
            st.trStart = st.clock
        }

        const toLocal = () => {
            const s = st.s || 1
            return {
                lx: (st.ptr.x - size.W / 2) / s + CW / 2,
                ly: (st.ptr.y - size.H / 2) / s + CH / 2,
            }
        }

        const onMove = (ev: PointerEvent) => {
            st.ptr.x = ev.offsetX
            st.ptr.y = ev.offsetY
            st.ptr.inside = true
        }
        const onLeave = () => {
            st.ptr.inside = false
            st.ptr.down = false
        }
        const onDown = (ev: PointerEvent) => {
            onMove(ev)
            const { lx, ly } = toLocal()
            const p0 = propsRef.current
            const adv0 = { ...ADVANCED_DEFAULTS, ...(p0.advanced ?? {}) }
            const vol = p0.sound ? p0.soundVolume ?? 0.5 : 0
            if (lx >= TRACK_L && lx <= TRACK_L + TRACK_W && ly >= 83 && ly <= 128) {
                const i = Math.max(0, Math.min(2, Math.floor((lx - TRACK_L) / THIRD)))
                if (i !== st.range) {
                    start(i)
                    playCue("click", vol, 60, 0.9 + i * 0.12)
                }
                // restart the auto cycle from here
                st.anchor = st.clock + Math.max(0.5, adv0.holdMs / 1000) - adv0.firstSwitchMs / 1000
                st.fired = 0
            }
            if (lx >= 40 && lx <= 471 && ly >= 502 && ly <= 558) {
                st.ptr.down = true
                playCue("pop", vol, 80)
            }
        }
        const onUp = () => {
            st.ptr.down = false
        }
        overlay.addEventListener("pointermove", onMove)
        overlay.addEventListener("pointerenter", onMove)
        overlay.addEventListener("pointerleave", onLeave)
        overlay.addEventListener("pointerdown", onDown)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        let raf = 0
        let last = -1
        const tick = (now: number) => {
            raf = requestAnimationFrame(tick)
            let dt = last < 0 ? 0 : (now - last) / 1000
            last = now
            if (dt > 1 / 20) dt = 1 / 20
            if (dt < 0) dt = 0

            const p = propsRef.current
            const adv = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const ink = p.inkColor ?? "#F2F2F6"
            const W = size.W || 1200
            const H = size.H || 800

            const s = Math.max(
                0.05,
                Math.min((H * adv.cardHeight) / 100 / CH, (W * 0.96) / CW) * ((p.scale ?? 100) / 100)
            )
            st.s = s

            // ── clock + auto cycle ──
            const k = Math.max(0, (p.speed ?? 50) / 50)
            if (!reduced) st.clock += dt * k
            const hold = Math.max(0.5, adv.holdMs / 1000)
            if (!reduced && p.autoCycle !== false && k > 0) {
                const due = st.anchor + adv.firstSwitchMs / 1000 + st.fired * hold
                if (st.clock >= due) {
                    start(NEXT[st.range])
                    st.fired++
                    if (st.anchor + adv.firstSwitchMs / 1000 + st.fired * hold <= st.clock) {
                        st.anchor = st.clock + hold - adv.firstSwitchMs / 1000
                        st.fired = 0
                    }
                }
            }

            const e = reduced ? 1e6 : st.clock - st.trStart
            const R = RANGES[st.range]
            const F = RANGES[st.fromRange]

            // thumb
            const tp = EASE_IO(clamp01(e / Math.max(0.01, adv.thumbMs / 1000)))
            st.thumb = lerp(st.fromThumb, st.range, tp)

            // series, staggered left → right
            const delay = adv.morphDelayMs / 1000
            const stag = adv.staggerMs / 1000
            const morph = Math.max(0.01, adv.morphMs / 1000)
            for (let i = 0; i < XS.length; i++) {
                const q = EASE_OUT(clamp01((e - delay - i * stag) / morph))
                st.ys[i] = lerp(st.fromYs[i], R.ys[i], q)
            }
            const cq = EASE_OUT(clamp01((e - delay) / Math.max(0.01, adv.countMs / 1000)))
            st.vals[0] = lerp(st.fromVals[0], R.total, cq)
            st.vals[1] = lerp(st.fromVals[1], R.users, cq)
            st.vals[2] = lerp(st.fromVals[2], R.bounce, cq)

            // ── pointer ──
            const ptr = st.ptr
            const { lx, ly } = toLocal()
            const kH = Math.max(0, adv.hover / 50)
            const live = ptr.inside && kH > 0
            const overChart = live && lx >= 30 && lx <= 480 && ly >= 190 && ly <= 365
            const overTrack = ptr.inside && lx >= TRACK_L && lx <= TRACK_L + TRACK_W && ly >= 83 && ly <= 128
            const overBtn = ptr.inside && lx >= 40 && lx <= 471 && ly >= 502 && ly <= 558
            let nearest = 0
            let bd = 1e9
            for (let i = 0; i < XS.length; i++) {
                const d = Math.abs(XS[i] - lx)
                if (d < bd) {
                    bd = d
                    nearest = i
                }
            }
            const a15 = 1 - Math.exp(-dt / 0.15)
            const a25 = 1 - Math.exp(-dt / 0.25)
            const a40 = 1 - Math.exp(-dt / 0.4)
            const restIdx = Math.max(0, Math.min(XS.length - 1, adv.tipIndex))
            const tipTarget = overChart ? nearest : restIdx
            st.tipIdx += (tipTarget - st.tipIdx) * (overChart ? a15 : a40)
            st.overE += ((overChart ? 1 : 0) - st.overE) * (overChart ? a15 : a40)
            const nx = Math.max(-1, Math.min(1, (lx - CW / 2) / (CW / 2)))
            const ny = Math.max(-1, Math.min(1, (ly - CH / 2) / (CH / 2)))
            const tTX = live ? -ny * adv.tiltDeg * Math.min(kH, 2) : 0
            const tTY = live ? nx * adv.tiltDeg * Math.min(kH, 2) : 0
            st.tiltX += (tTX - st.tiltX) * a25
            st.tiltY += (tTY - st.tiltY) * a25
            st.btnE += ((overBtn && kH > 0 ? 1 : 0) - st.btnE) * a15
            st.pressE += ((overBtn && ptr.down ? 1 : 0) - st.pressE) * (1 - Math.exp(-dt / 0.08))

            const cursor = overTrack || overBtn ? "pointer" : "default"
            if (cursor !== st.cursor) {
                st.cursor = cursor
                overlay.style.cursor = cursor
            }

            // ── write ──
            const wrap = wrapRef.current
            if (wrap)
                wrap.style.transform = `translate(-50%, -50%) perspective(1600px) rotateX(${st.tiltX.toFixed(3)}deg) rotateY(${st.tiltY.toFixed(3)}deg) scale(${s})`

            if (thumbRef.current) thumbRef.current.style.transform = `translateX(${thumbX(st.thumb).toFixed(2)}px)`
            for (let i = 0; i < 3; i++) {
                const el = segRefs.current[i]
                if (el) el.style.color = mixColor(adv.mutedColor, ink, clamp01(1 - Math.abs(st.thumb - i)))
            }

            if (lineRef.current) lineRef.current.setAttribute("d", linePath(st.ys))
            if (areaRef.current) areaRef.current.setAttribute("d", areaPath(st.ys))

            const endX = XS[XS.length - 1]
            const endY = st.ys[XS.length - 1]
            if (hGuideRef.current) {
                hGuideRef.current.setAttribute("y1", endY.toFixed(2))
                hGuideRef.current.setAttribute("y2", endY.toFixed(2))
            }
            const dotR = Math.max(1, adv.dotRadius)
            if (dotRef.current) {
                dotRef.current.setAttribute("cx", String(endX))
                dotRef.current.setAttribute("cy", endY.toFixed(2))
                dotRef.current.setAttribute("r", String(dotR))
            }
            if (glowRef.current) {
                glowRef.current.setAttribute("cx", String(endX))
                glowRef.current.setAttribute("cy", endY.toFixed(2))
                glowRef.current.setAttribute("r", String(dotR + adv.glowSize))
            }
            if (haloRef.current) {
                const period = Math.max(0.2, adv.pulseMs / 1000)
                const ph = reduced ? 1 : (st.clock % period) / period
                const eo = 1 - Math.pow(1 - ph, 3)
                const r = dotR * (1 + (adv.haloScale / 100) * eo)
                haloRef.current.setAttribute("cx", String(endX))
                haloRef.current.setAttribute("cy", endY.toFixed(2))
                haloRef.current.setAttribute("r", r.toFixed(2))
                haloRef.current.setAttribute("fill-opacity", reduced ? "0" : ((adv.haloOpacity / 100) * (1 - eo)).toFixed(3))
            }

            // tooltip anchor
            const ti = Math.max(0, Math.min(XS.length - 1, st.tipIdx))
            const i0 = Math.floor(ti)
            const i1 = Math.min(XS.length - 1, i0 + 1)
            const f = ti - i0
            const tx = lerp(XS[i0], XS[i1], f)
            const ty = lerp(st.ys[i0], st.ys[i1], f)
            if (tipRef.current) tipRef.current.style.transform = `translate(${(tx - 40).toFixed(2)}px, ${(ty - 62).toFixed(2)}px)`
            if (vGuideRef.current) {
                vGuideRef.current.setAttribute("x1", tx.toFixed(2))
                vGuideRef.current.setAttribute("x2", tx.toFixed(2))
                vGuideRef.current.setAttribute("y1", (ty - 32).toFixed(2))
                vGuideRef.current.setAttribute("y2", ty.toFixed(2))
            }
            if (hoverDotRef.current) {
                hoverDotRef.current.setAttribute("cx", tx.toFixed(2))
                hoverDotRef.current.setAttribute("cy", ty.toFixed(2))
                hoverDotRef.current.setAttribute("opacity", st.overE.toFixed(3))
            }

            // text swaps: out 0–0.15 s, in 0.15–0.4 s
            let fadeO = 1
            let fadeY = 0
            let swapR = R
            if (e < 0.15) {
                const q = e / 0.15
                fadeO = 1 - q
                fadeY = -4 * q
                swapR = F
            } else if (e < 0.4) {
                const q = (e - 0.15) / 0.25
                fadeO = q
                fadeY = 4 * (1 - q)
            }
            let axO = 1
            let axR = R
            if (e < 0.15) {
                axO = 1 - e / 0.15
                axR = F
            } else if (e < 0.3) axO = (e - 0.15) / 0.15

            if (badgeTextRef.current) {
                setText(badgeTextRef.current, "badge", `↑ ${swapR.change}`)
                badgeTextRef.current.style.opacity = fadeO.toFixed(3)
                badgeTextRef.current.style.transform = `translateY(${fadeY.toFixed(2)}px)`
            }

            const hovering = overChart && st.overE > 0.5
            if (tipTextRef.current) {
                if (hovering) {
                    const day = 1 + Math.round((nearest / (XS.length - 1)) * (R.days - 1))
                    setText(tipTextRef.current, "tip", `Mar ${day}`)
                    tipTextRef.current.style.opacity = "1"
                } else {
                    setText(tipTextRef.current, "tip", `Mar ${axR.days}`)
                    tipTextRef.current.style.opacity = axO.toFixed(3)
                }
            }

            const axis = [`Mar 1`, `Mar ${midDay(axR.days)}`, `Mar ${axR.days}`]
            for (let i = 0; i < 3; i++) {
                const el = axisRefs.current[i]
                if (!el) continue
                setText(el, `ax${i}`, axis[i])
                el.style.opacity = axO.toFixed(3)
            }

            setText(numRef.current, "num", fmtMoney(st.vals[0]))
            setText(usersRef.current, "users", fmtInt(st.vals[1]))
            setText(bounceRef.current, "bounce", fmtPct(st.vals[2]))

            if (btnRef.current) {
                const b = st.btnE
                btnRef.current.style.transform = `translateY(${(-adv.buttonLift * b * Math.min(kH, 2)).toFixed(2)}px) scale(${(1 - 0.02 * st.pressE).toFixed(4)})`
                btnRef.current.style.boxShadow = `0 ${(2 + 6 * b).toFixed(1)}px ${(8 + 14 * b).toFixed(1)}px rgba(0,0,0,${(0.05 + 0.06 * b).toFixed(3)})`
            }
        }
        raf = requestAnimationFrame(tick)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            overlay.removeEventListener("pointermove", onMove)
            overlay.removeEventListener("pointerenter", onMove)
            overlay.removeEventListener("pointerleave", onLeave)
            overlay.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
        }
    }, [])

    // first paint (before the loop runs, and on static renders)
    const init = RANGES[1]
    const initS = Math.min((800 * adv.cardHeight) / 100 / CH, (1200 * 0.96) / CW) * (scale / 100)
    const endX = XS[XS.length - 1]
    const endY = init.ys[XS.length - 1]
    const restIdx = Math.max(0, Math.min(XS.length - 1, adv.tipIndex))
    const tipX = XS[restIdx]
    const tipY = init.ys[restIdx]
    const dotR = Math.max(1, adv.dotRadius)
    const sh = Math.max(0, adv.cardShadow)
    const fontFamily = (font && font.fontFamily) || SANS
    const abs: React.CSSProperties = { position: "absolute" }

    return (
        <div
            ref={rootRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background,
                minWidth: 1200,
                minHeight: 800,
                ...style,
            }}
        >
            <div
                ref={wrapRef}
                style={{
                    ...abs,
                    left: "50%",
                    top: "50%",
                    width: CW,
                    height: CH,
                    transformOrigin: "50% 50%",
                    transform: `translate(-50%, -50%) scale(${initS})`,
                    background: cardColor,
                    borderRadius: adv.cardRadius,
                    boxShadow: `0 ${sh * 4}px ${sh * 10}px rgba(0,0,0,${(sh / 100).toFixed(3)}), 0 1px 2px rgba(0,0,0,0.04)`,
                    fontFamily,
                    fontFeatureSettings: '"zero" 1',
                    color: inkColor,
                    userSelect: "none",
                    willChange: "transform",
                }}
            >
                {/* title */}
                <div
                    style={{
                        ...abs,
                        left: 40,
                        top: 42,
                        lineHeight: "16px",
                        fontSize: 12,
                        fontWeight: 500,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: adv.labelColor,
                    }}
                >
                    {title}
                </div>

                {/* range switch */}
                <div
                    style={{
                        ...abs,
                        left: TRACK_L,
                        top: 83,
                        width: TRACK_W,
                        height: 45,
                        borderRadius: 22.5,
                        background: adv.trackColor,
                        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                    }}
                />
                <div
                    ref={thumbRef}
                    style={{
                        ...abs,
                        left: 0,
                        top: 86,
                        width: THUMB_W,
                        height: 39,
                        borderRadius: 19.5,
                        background: adv.thumbColor,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.04)",
                        transform: `translateX(${thumbX(1)}px)`,
                    }}
                />
                {RANGES.map((r, i) => (
                    <div
                        key={r.label}
                        ref={(el) => {
                            segRefs.current[i] = el
                        }}
                        style={{
                            ...abs,
                            left: TRACK_L + THIRD * i,
                            top: 83,
                            width: THIRD,
                            height: 45,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 15,
                            fontWeight: 600,
                            color: i === 1 ? inkColor : adv.mutedColor,
                        }}
                    >
                        {r.label}
                    </div>
                ))}

                {/* headline number + badge */}
                <div
                    ref={numRef}
                    style={{
                        ...abs,
                        left: 37,
                        top: 160,
                        lineHeight: "68px",
                        fontSize: 60,
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        fontFeatureSettings: '"zero" 1, "tnum" 1',
                        whiteSpace: "nowrap",
                    }}
                >
                    {fmtMoney(init.total)}
                </div>
                <div
                    style={{
                        ...abs,
                        left: 268,
                        top: 168,
                        height: 24,
                        padding: "0 8px",
                        borderRadius: 6,
                        background: withAlpha(accent, adv.badgeAlpha / 100),
                        color: accent,
                        fontSize: 15,
                        fontWeight: 600,
                        lineHeight: "24px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                    }}
                >
                    <span ref={badgeTextRef} style={{ display: "inline-block" }}>
                        {`↑ ${init.change}`}
                    </span>
                </div>

                {/* chart */}
                <svg
                    width={CW}
                    height={CH}
                    viewBox={`0 0 ${CW} ${CH}`}
                    style={{ ...abs, left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
                >
                    <defs>
                        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="240" x2="0" y2={BASE_Y}>
                            <stop offset="0" stopColor={accent} stopOpacity={adv.areaOpacity / 100} />
                            <stop offset="1" stopColor={accent} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <path ref={areaRef} d={areaPath(init.ys)} fill={`url(#${gradId})`} />
                    <line
                        ref={hGuideRef}
                        x1={XS[0]}
                        x2={endX}
                        y1={endY}
                        y2={endY}
                        stroke={adv.guideColor}
                        strokeWidth={1}
                        strokeDasharray="4 4"
                    />
                    <line
                        ref={vGuideRef}
                        x1={tipX}
                        x2={tipX}
                        y1={tipY - 32}
                        y2={tipY}
                        stroke={adv.guideColor}
                        strokeWidth={1}
                        strokeDasharray="3 3"
                    />
                    <path
                        ref={lineRef}
                        d={linePath(init.ys)}
                        fill="none"
                        stroke={accent}
                        strokeWidth={adv.lineWeight / 100}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    <circle ref={haloRef} cx={endX} cy={endY} r={dotR} fill={accent} fillOpacity={0} />
                    <circle ref={glowRef} cx={endX} cy={endY} r={dotR + adv.glowSize} fill={accent} fillOpacity={0.22} />
                    <circle ref={dotRef} cx={endX} cy={endY} r={dotR} fill={accent} />
                    <circle ref={hoverDotRef} cx={tipX} cy={tipY} r={4} fill={accent} stroke={cardColor} strokeWidth={2} opacity={0} />
                </svg>

                {/* tooltip */}
                <div
                    ref={tipRef}
                    style={{
                        ...abs,
                        left: 0,
                        top: 0,
                        width: 80,
                        height: 28,
                        transform: `translate(${tipX - 40}px, ${tipY - 62}px)`,
                        pointerEvents: "none",
                    }}
                >
                    <div
                        style={{
                            ...abs,
                            left: 36,
                            bottom: -4,
                            width: 8,
                            height: 8,
                            background: adv.thumbColor,
                            transform: "rotate(45deg)",
                        }}
                    />
                    <div
                        style={{
                            ...abs,
                            inset: 0,
                            borderRadius: 6,
                            background: adv.thumbColor,
                            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 500,
                            color: inkColor,
                            whiteSpace: "nowrap",
                        }}
                    >
                        <span ref={tipTextRef}>{`Mar ${init.days}`}</span>
                    </div>
                </div>

                {/* axis */}
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        ref={(el) => {
                            axisRefs.current[i] = el
                        }}
                        style={{
                            ...abs,
                            top: 346,
                            lineHeight: "16px",
                            fontFamily: MONO,
                            fontSize: 12,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: adv.labelColor,
                            whiteSpace: "nowrap",
                            ...(i === 0
                                ? { left: 40 }
                                : i === 1
                                  ? { left: 0, width: CW, textAlign: "center" as const }
                                  : { right: CW - 471 - 2 }),
                        }}
                    >
                        {i === 0 ? "Mar 1" : i === 1 ? `Mar ${midDay(init.days)}` : `Mar ${init.days}`}
                    </div>
                ))}

                {/* stats */}
                {[0, 1].map((row) => (
                    <div
                        key={row}
                        style={{
                            ...abs,
                            left: 40,
                            top: (row === 0 ? 409 : 448) - 14,
                            width: TRACK_W,
                            height: 28,
                            display: "flex",
                            alignItems: "center",
                            fontSize: 18,
                        }}
                    >
                        <div style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {row === 0 ? (
                                <svg width="22" height="24" viewBox="0 0 22 24">
                                    <circle cx="11" cy="6.5" r="5" fill={adv.iconColor} />
                                    <path d="M1.5 23 C1.5 16.5 5.5 13.5 11 13.5 C16.5 13.5 20.5 16.5 20.5 23 Z" fill={adv.iconColor} />
                                </svg>
                            ) : (
                                <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                                    <path
                                        d="M10 2 V21 M3 14 L10 21 L17 14"
                                        stroke={adv.iconColor}
                                        strokeWidth={2.2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            )}
                        </div>
                        <div style={{ marginLeft: 11, color: inkColor, opacity: 0.92, whiteSpace: "nowrap" }}>
                            {row === 0 ? "New orders" : "Refund rate"}
                        </div>
                        <div
                            ref={row === 0 ? usersRef : bounceRef}
                            style={{
                                marginLeft: "auto",
                                fontWeight: 600,
                                fontFeatureSettings: '"zero" 1, "tnum" 1',
                                whiteSpace: "nowrap",
                            }}
                        >
                            {row === 0 ? fmtInt(init.users) : fmtPct(init.bounce)}
                        </div>
                    </div>
                ))}

                {/* button */}
                <div
                    ref={btnRef}
                    style={{
                        ...abs,
                        left: 40,
                        top: 502,
                        width: TRACK_W,
                        height: 56,
                        borderRadius: 28,
                        background: adv.buttonColor,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        fontSize: 17,
                        fontWeight: 600,
                        color: inkColor,
                    }}
                >
                    <span>View report</span>
                    <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
                        <path
                            d="M1.5 8 H20 M13.5 1.5 L20 8 L13.5 14.5"
                            stroke={inkColor}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </div>

            {adv.grain > 0 && (
                <div
                    style={{
                        ...abs,
                        inset: 0,
                        backgroundImage: GRAIN,
                        opacity: adv.grain / 100,
                        mixBlendMode: "overlay",
                        pointerEvents: "none",
                    }}
                />
            )}
            {adv.vignette > 0 && (
                <div
                    style={{
                        ...abs,
                        inset: 0,
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${(adv.vignette / 100).toFixed(3)}) 100%)`,
                        pointerEvents: "none",
                    }}
                />
            )}
            <div ref={overlayRef} style={{ ...abs, inset: 0, zIndex: 3, touchAction: "manipulation" }} />
        </div>
    )
}

addPropertyControls(RangeSwitchStatCard, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#0A0A0D" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#8B7CFF" },
    cardColor: { type: ControlType.Color, title: "Card", defaultValue: "#16161B" },
    inkColor: { type: ControlType.Color, title: "Ink", defaultValue: "#F2F2F6" },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    title: { type: ControlType.String, title: "Title", defaultValue: "Revenue" },
    speed: { type: ControlType.Number, title: "Speed", min: 0, max: 100, step: 1, defaultValue: 50 },
    scale: { type: ControlType.Number, title: "Scale", min: 30, max: 200, step: 1, unit: "%", defaultValue: 100 },
    autoCycle: { type: ControlType.Boolean, title: "Auto Cycle", defaultValue: true },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: {
        type: ControlType.Number,
        title: "Volume",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.5,
        hidden: (p: any) => !p.sound,
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
            cardHeight: { type: ControlType.Number, title: "Card Height", min: 30, max: 100, step: 1, unit: "%", defaultValue: 68 },
            cardRadius: { type: ControlType.Number, title: "Card Radius", min: 0, max: 120, step: 1, defaultValue: 48 },
            cardShadow: { type: ControlType.Number, title: "Card Shadow", min: 0, max: 30, step: 1, defaultValue: 6 },
            lineWeight: { type: ControlType.Number, title: "Line ×100", min: 50, max: 600, step: 10, defaultValue: 250 },
            areaOpacity: { type: ControlType.Number, title: "Area", min: 0, max: 100, step: 1, unit: "%", defaultValue: 35 },
            dotRadius: { type: ControlType.Number, title: "Dot", min: 1, max: 20, step: 1, defaultValue: 6 },
            glowSize: { type: ControlType.Number, title: "Glow", min: 0, max: 30, step: 1, defaultValue: 6 },
            haloScale: { type: ControlType.Number, title: "Halo Scale", min: 100, max: 500, step: 10, unit: "%", defaultValue: 180 },
            haloOpacity: { type: ControlType.Number, title: "Halo", min: 0, max: 100, step: 1, unit: "%", defaultValue: 25 },
            pulseMs: { type: ControlType.Number, title: "Pulse ms", min: 200, max: 5000, step: 50, defaultValue: 1600 },
            thumbMs: { type: ControlType.Number, title: "Thumb ms", min: 0, max: 2000, step: 10, defaultValue: 500 },
            morphMs: { type: ControlType.Number, title: "Morph ms", min: 50, max: 3000, step: 10, defaultValue: 600 },
            morphDelayMs: { type: ControlType.Number, title: "Morph Delay", min: 0, max: 2000, step: 10, defaultValue: 100 },
            staggerMs: { type: ControlType.Number, title: "Stagger ms", min: 0, max: 100, step: 1, defaultValue: 12 },
            countMs: { type: ControlType.Number, title: "Count ms", min: 50, max: 4000, step: 10, defaultValue: 900 },
            holdMs: { type: ControlType.Number, title: "Hold ms", min: 500, max: 15000, step: 100, defaultValue: 4000 },
            firstSwitchMs: { type: ControlType.Number, title: "First Switch", min: 0, max: 15000, step: 100, defaultValue: 3000 },
            tiltDeg: { type: ControlType.Number, title: "Tilt", min: 0, max: 20, step: 1, unit: "°", defaultValue: 4 },
            buttonLift: { type: ControlType.Number, title: "Button Lift", min: 0, max: 20, step: 1, defaultValue: 3 },
            tipIndex: { type: ControlType.Number, title: "Tip Point", min: 0, max: 25, step: 1, defaultValue: 17 },
            trackColor: { type: ControlType.Color, title: "Track", defaultValue: "#24242B" },
            thumbColor: { type: ControlType.Color, title: "Thumb", defaultValue: "#3A3A46" },
            mutedColor: { type: ControlType.Color, title: "Muted", defaultValue: "#8A8A98" },
            labelColor: { type: ControlType.Color, title: "Labels", defaultValue: "#6E6E7C" },
            guideColor: { type: ControlType.Color, title: "Guides", defaultValue: "#3A3A46" },
            badgeAlpha: { type: ControlType.Number, title: "Badge Fill", min: 0, max: 100, step: 1, unit: "%", defaultValue: 14 },
            buttonColor: { type: ControlType.Color, title: "Button", defaultValue: "#24242B" },
            iconColor: { type: ControlType.Color, title: "Icons", defaultValue: "#6E6E7C" },
        },
    },
})

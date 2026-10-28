import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/**
 * Holo Card Dispenser
 * A holographic membership card is issued out of a card reader's slot, its foil
 * sheen follows the pointer, and pressing the button retracts it, lights the slot
 * and issues it again.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    riseStartMs: 600,
    riseMs: 1670,
    pressAtMs: 10620,
    dropMs: 60,
    restMs: 200,
    glowMs: 230,
    peekMs: 650,
    peekPct: 10,
    bandWidth: 45,
    bandAngle: 40,
    follow: 6,
    tiltMax: 3,
    glitter: 35,
    glitterSize: 4,
    brush: 6,
    cardLight: "#D8D2CA",
    cardMid: "#B0ACD7",
    cardDark: "#9B97B1",
    ink: "#1E1E1E",
    ledOn: "#22C55E",
    ledWait: "#F2A12A",
    slotLight: "#FDFDFD",
    slotGlowWidth: 60,
    panelColor: "#151515",
    panelGlow: "#1E1E1E",
    textZone: "#1E1E1E",
    titleColor: "#FDFDFD",
    bodyColor: "#9A9A9A",
    buttonColor: "#FDFDFD",
    cardRadius: 15,
    modalRadius: 36,
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

// ── Design stage (1200 × 800), everything below in design px ──
const STAGE_W = 1200
const STAGE_H = 800
const MODAL_X = 60
const MODAL_Y = 80
const MODAL_W = 1080
const MODAL_H = 640
const LEFT_W = 540
const CARD_W = 392
const CARD_H = 250
const CARD_X = 74
const CARD_Y = 128
const CLIP_Y = 418
const TRAVEL = CLIP_Y - CARD_Y + 2
const SLOT_X = 65
const SLOT_Y = 414
const SLOT_W = 410
const SLOT_H = 9
const FONT_STACK = `"Inter", "Helvetica Neue", Arial, sans-serif`

const GRAIN_URI = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

function mulberry32(a: number) {
    return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const seg = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)))
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3)
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
function bezier(x1: number, y1: number, x2: number, y2: number) {
    const f = (a1: number, a2: number, t: number) => {
        const u = 1 - t
        return 3 * u * u * t * a1 + 3 * u * t * t * a2 + t * t * t
    }
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let lo = 0
        let hi = 1
        let t = x
        for (let i = 0; i < 22; i++) {
            t = (lo + hi) / 2
            if (f(x1, x2, t) < x) lo = t
            else hi = t
        }
        return f(y1, y2, t)
    }
}
const easeRise = bezier(0.16, 1, 0.3, 1)
const easeSweep = bezier(0.43, 0, 0.15, 0.7)

function beats(adv: typeof ADVANCED_DEFAULTS) {
    const riseStart = Math.max(0, adv.riseStartMs / 1000)
    const riseEnd = riseStart + Math.max(0.05, adv.riseMs / 1000)
    const press = Math.max(riseEnd + 0.5, adv.pressAtMs / 1000)
    const dropEnd = press + Math.max(0.016, adv.dropMs / 1000)
    const glowStart = dropEnd + Math.max(0, adv.restMs / 1000)
    const glowEnd = glowStart + Math.max(0.016, adv.glowMs / 1000)
    const peekStart = glowEnd + 0.15
    const cycle = peekStart + Math.max(0.05, adv.peekMs / 1000)
    const ledSwitch = riseStart + 0.45 * (riseEnd - riseStart)
    return { riseStart, riseEnd, press, dropEnd, glowStart, glowEnd, peekStart, cycle, ledSwitch }
}

type Beats = ReturnType<typeof beats>

function sample(t: number, B: Beats, uPeek: number) {
    // card out-ness: 0 = inside the slot, 1 = fully issued
    let u = 1
    if (t < B.riseStart) u = uPeek
    else if (t < B.riseEnd) u = uPeek + (1 - uPeek) * easeRise(seg(t, B.riseStart, B.riseEnd))
    else if (t < B.press) u = 1
    else if (t < B.dropEnd) {
        const k = seg(t, B.press, B.dropEnd)
        u = 1 - k * k
    } else if (t < B.peekStart) u = 0
    else u = uPeek * easeOutCubic(seg(t, B.peekStart, B.cycle))

    // slot light
    let light = 0
    let glowScale = 1
    if (t < B.riseStart) light = 1
    else if (t < B.riseStart + 0.3) light = 1 - easeInOut(seg(t, B.riseStart, B.riseStart + 0.3))
    else if (t < B.glowStart) light = 0
    else if (t < B.glowEnd) {
        const k = easeOutCubic(seg(t, B.glowStart, B.glowEnd))
        light = k
        glowScale = 0.35 + 0.65 * k
    } else light = 1

    // LED: amber while the card is in or coming out
    let amber = 0
    if (t >= B.press) amber = seg(t, B.press, B.press + 0.15)
    else if (t < B.ledSwitch) amber = 1
    else amber = 1 - seg(t, B.ledSwitch, B.ledSwitch + 0.15)

    // button press dim
    let dim = 0
    if (t >= B.press && t < B.press + 0.26) {
        dim = Math.min(seg(t, B.press, B.press + 0.04), 1 - seg(t, B.press + 0.22, B.press + 0.26))
    }

    // scripted foil band (what the reference's cursor did)
    let band = 0.7
    if (t < 3.07) band = 0.7
    else if (t < 3.2) band = lerp(0.7, 0.58, easeOutCubic(seg(t, 3.07, 3.2)))
    else if (t < 3.53) band = 0.58
    else if (t < 4.4) band = lerp(0.58, 0.95, easeSweep(seg(t, 3.53, 4.4)))
    else if (t < 5.2) band = 0.95
    else if (t < 5.93) band = lerp(0.95, 0.62, easeInOut(seg(t, 5.2, 5.93)))
    else if (t < B.press) band = 0.62 + 0.18 * Math.sin((2 * Math.PI * (t - 5.93)) / Math.max(0.5, B.press - 5.93))
    else band = lerp(0.62, 0.7, seg(t, B.press, B.cycle))

    let strength = 1
    if (t > 3.0 && t < 3.6) strength = 1 - 0.4 * Math.sin(Math.PI * seg(t, 3.0, 3.6))

    return { u, light, glowScale, amber, dim, band, strength }
}

function bandGradient(ctx: CanvasRenderingContext2D, pos: number, adv: typeof ADVANCED_DEFAULTS, a: number, mask: boolean) {
    const ang = (adv.bandAngle * Math.PI) / 180
    const nx = Math.sin(ang)
    const ny = -Math.cos(ang)
    const proj = [0, CARD_W * nx, CARD_H * ny, CARD_W * nx + CARD_H * ny]
    const lo = Math.min(...proj)
    const hi = Math.max(...proj)
    const bw = Math.max(10, (adv.bandWidth / 100) * CARD_W)
    const c = lo - bw * 0.5 + pos * (hi - lo + bw)
    const g = ctx.createLinearGradient(nx * (c - bw / 2), ny * (c - bw / 2), nx * (c + bw / 2), ny * (c + bw / 2))
    if (mask) {
        g.addColorStop(0, "rgba(0,0,0,0)")
        g.addColorStop(0.5, `rgba(0,0,0,${a})`)
        g.addColorStop(1, "rgba(0,0,0,0)")
        return g
    }
    g.addColorStop(0, "rgba(250,150,225,0)")
    g.addColorStop(0.14, `rgba(250,150,225,${a * 0.85})`)
    g.addColorStop(0.3, `rgba(180,140,255,${a})`)
    g.addColorStop(0.44, `rgba(130,175,255,${a})`)
    g.addColorStop(0.57, `rgba(130,232,240,${a})`)
    g.addColorStop(0.7, `rgba(170,240,170,${a})`)
    g.addColorStop(0.83, `rgba(248,236,160,${a * 0.9})`)
    g.addColorStop(0.93, `rgba(255,200,215,${a * 0.6})`)
    g.addColorStop(1, "rgba(255,200,215,0)")
    return g
}

function makeCanvas(w: number, h: number) {
    const c = document.createElement("canvas")
    c.width = w
    c.height = h
    return c
}

function bakeLayers(Wpx: number, Hpx: number, k: number, adv: typeof ADVANCED_DEFAULTS) {
    const rand = mulberry32(7)
    const base = makeCanvas(Wpx, Hpx)
    const b = base.getContext("2d")!
    b.setTransform(k, 0, 0, k, 0, 0)
    const g = b.createLinearGradient(0, 0, CARD_W, CARD_H)
    g.addColorStop(0, adv.cardLight)
    g.addColorStop(0.55, adv.cardMid)
    g.addColorStop(1, adv.cardDark)
    b.fillStyle = g
    b.fillRect(0, 0, CARD_W, CARD_H)
    const blot = (x: number, y: number, r: number, col: string) => {
        const rg = b.createRadialGradient(x, y, 0, x, y, r)
        rg.addColorStop(0, col)
        rg.addColorStop(1, "rgba(0,0,0,0)")
        b.fillStyle = rg
        b.fillRect(0, 0, CARD_W, CARD_H)
    }
    blot(70, 90, 170, "rgba(232,216,172,0.55)")
    blot(150, 150, 120, "rgba(226,206,180,0.35)")
    blot(60, 190, 100, "rgba(242,184,224,0.25)")
    blot(30, 60, 80, "rgba(190,232,240,0.22)")

    const streak = makeCanvas(Wpx, Hpx)
    const s = streak.getContext("2d")!
    const contrast = adv.brush / 100
    for (let y = 0; y < Hpx; y++) {
        let x = 0
        while (x < Wpx) {
            const len = 20 + rand() * Wpx * 0.5
            const a = (rand() - 0.5) * 2 * contrast
            s.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`
            s.fillRect(x, y, len, 1)
            x += len
        }
    }

    const glitter = makeCanvas(Wpx, Hpx)
    const gl = glitter.getContext("2d")!
    const cell = Math.max(1, Math.round(Math.max(1, adv.glitterSize) * k))
    for (let y = 0; y < Hpx; y += cell) {
        for (let x = 0; x < Wpx; x += cell) {
            if (rand() < 0.5) continue
            const hue = Math.floor(rand() * 360)
            gl.fillStyle = `hsla(${hue},70%,${Math.round(80 + rand() * 18)}%,${(0.25 + rand() * 0.6).toFixed(2)})`
            gl.fillRect(x, y, cell, cell)
        }
    }
    return { base, streak, glitter, tmp: makeCanvas(Wpx, Hpx) }
}

function LeafMark() {
    return (
        <svg viewBox="0 0 20 20" width="62%" height="62%" style={{ display: "block" }}>
            <path d="M10 2.6 C12.6 5.6 12.6 8.8 10 11.8 C7.4 8.8 7.4 5.6 10 2.6Z" fill="#FDFDFD" />
            <path d="M3.6 7.6 C6.8 7.6 9.4 9.8 10 13.8 C6.4 13.8 4.2 11.4 3.6 7.6Z" fill="#FDFDFD" />
            <path d="M16.4 7.6 C13.2 7.6 10.6 9.8 10 13.8 C13.6 13.8 15.8 11.4 16.4 7.6Z" fill="#FDFDFD" />
            <path d="M10 12 V17.4" stroke="#FDFDFD" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    )
}

type View = { w: number; h: number; vx: number; vy: number; vw: number; vh: number }

// The part of the root that is actually visible: when the root is held at its
// 1200×800 floor inside a smaller parent, fit the stage to the parent's box.
function measureView(el: HTMLElement): View {
    const w = el.offsetWidth || STAGE_W
    const h = el.offsetHeight || STAGE_H
    const view = { w, h, vx: 0, vy: 0, vw: w, vh: h }
    const par = el.parentElement
    if (par && par.offsetWidth > 0 && par.offsetHeight > 0 && (par.offsetWidth < w - 1 || par.offsetHeight < h - 1)) {
        let ox = el.offsetLeft
        let oy = el.offsetTop
        if (el.offsetParent !== par) {
            ox = el.offsetLeft - par.offsetLeft
            oy = el.offsetTop - par.offsetTop
        }
        const x0 = Math.max(0, -ox)
        const y0 = Math.max(0, -oy)
        const x1 = Math.min(w, par.offsetWidth - ox)
        const y1 = Math.min(h, par.offsetHeight - oy)
        if (x1 - x0 > 10 && y1 - y0 > 10) {
            view.vx = x0
            view.vy = y0
            view.vw = x1 - x0
            view.vh = y1 - y0
        }
    }
    return view
}

const fitScale = (v: View, sc: number) => Math.min(v.vw / STAGE_W, v.vh / STAGE_H) * (Math.max(10, sc) / 100)

export default function HoloCardDispenser(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        title = "Welcome to Pro, Nishant",
        body = "Download packs and assets, insert them in Figma with the plugin, or let your AI agent fetch them over MCP.",
        buttonLabel = "Start exploring",
        linkLabel = "Connect your AI agent",
        cardName = "NISHANT",
        memberLine = "Member since Oct 2026",
        plan = "Quarterly",
        image,
        font = { fontSize: 30, variant: "Semibold", letterSpacing: "-0.01em", lineHeight: "1.2em" },
        speed = 36,
        scale = 100,
        foilStrength = 70,
        sound = false,
        soundVolume = 0.5,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const propsRef = useRef(props)
    propsRef.current = props

    const rootRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const shadowRef = useRef<HTMLDivElement>(null)
    const ledOnRef = useRef<HTMLDivElement>(null)
    const ledWaitRef = useRef<HTMLDivElement>(null)
    const glowRef = useRef<HTMLDivElement>(null)
    const bloomRef = useRef<HTMLDivElement>(null)
    const btnRef = useRef<HTMLDivElement>(null)

    const initialView: View = { w: STAGE_W, h: STAGE_H, vx: 0, vy: 0, vw: STAGE_W, vh: STAGE_H }
    const viewRef = useRef<View>(initialView)
    const [view, setView] = useState<View>(initialView)
    const ptrRef = useRef({ x: 0, y: 0, inside: false, down: false })
    const triggerRef = useRef(false)

    const imgSrc = typeof image === "string" ? image : image?.src
    const [failedSrc, setFailedSrc] = useState<string | null>(null)
    const showImg = !!imgSrc && failedSrc !== imgSrc

    // size
    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const measure = () => {
            const v = measureView(el)
            viewRef.current = v
            setView((o) =>
                o.w === v.w && o.h === v.h && o.vx === v.vx && o.vy === v.vy && o.vw === v.vw && o.vh === v.vh ? o : v
            )
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        if (el.parentElement) ro.observe(el.parentElement)
        return () => ro.disconnect()
    }, [])

    // pointer
    useEffect(() => {
        const el = overlayRef.current
        if (!el) return
        const toDesign = (e: PointerEvent) => {
            const v = viewRef.current
            const s = fitScale(v, propsRef.current.scale ?? 100)
            const cx = v.vx + v.vw / 2
            const cy = v.vy + v.vh / 2
            return { x: (e.offsetX - cx) / s + STAGE_W / 2, y: (e.offsetY - cy) / s + STAGE_H / 2 }
        }
        const hits = (x: number, y: number) => {
            const cx = MODAL_X + CARD_X
            const cy = MODAL_Y + CARD_Y
            const onCard = x >= cx && x <= cx + CARD_W && y >= cy && y <= cy + CARD_H
            const b = btnRef.current
            let onBtn = false
            if (b) {
                const bx = MODAL_X + LEFT_W + b.offsetLeft
                const by = MODAL_Y + b.offsetTop
                onBtn = x >= bx && x <= bx + b.offsetWidth && y >= by && y <= by + b.offsetHeight
            }
            return onCard || onBtn
        }
        const move = (e: PointerEvent) => {
            const p = toDesign(e)
            ptrRef.current.x = p.x
            ptrRef.current.y = p.y
            ptrRef.current.inside = true
            el.style.cursor = hits(p.x, p.y) ? "pointer" : "default"
        }
        const leave = () => {
            ptrRef.current.inside = false
        }
        const down = (e: PointerEvent) => {
            const p = toDesign(e)
            ptrRef.current.down = true
            if (hits(p.x, p.y)) triggerRef.current = true
        }
        const up = () => {
            ptrRef.current.down = false
        }
        el.addEventListener("pointermove", move)
        el.addEventListener("pointerenter", move)
        el.addEventListener("pointerleave", leave)
        el.addEventListener("pointerdown", down)
        window.addEventListener("pointerup", up)
        window.addEventListener("pointercancel", up)
        return () => {
            el.removeEventListener("pointermove", move)
            el.removeEventListener("pointerenter", move)
            el.removeEventListener("pointerleave", leave)
            el.removeEventListener("pointerdown", down)
            window.removeEventListener("pointerup", up)
            window.removeEventListener("pointercancel", up)
        }
    }, [])

    // frame loop
    useEffect(() => {
        const rt = RenderTarget.current()
        const isStatic = rt === RenderTarget.thumbnail || rt === RenderTarget.export
        const reduced =
            typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const st = { userCycle: false, prev: 0, phase: 0, band: 0.7, over: 0, tiltX: 0, tiltY: 0, key: "", layers: null as any }
        let raf = 0
        let last = -1

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = last < 0 ? 0 : Math.min(1 / 20, (now - last) / 1000)
            last = now
            const p = propsRef.current
            const adv = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const B = beats(adv)
            const frozen = isStatic || reduced
            const hoverAmt = Math.max(0, adv.hover / 50)

            if (!frozen) {
                st.phase += dt * (Math.max(0, p.speed ?? 50) / 50)
                st.phase = ((st.phase % B.cycle) + B.cycle) % B.cycle
                if (triggerRef.current) {
                    triggerRef.current = false
                    if (st.phase > B.riseEnd && st.phase < B.press) {
                        st.phase = B.press
                        st.userCycle = true
                        if (p.sound) playCue("click", p.soundVolume ?? 0.5, 120)
                    }
                }
                // Follow-up cues only run on a cycle the visitor started, never on autoplay.
                if (st.userCycle) {
                    const vol = p.soundVolume ?? 0.5
                    if (st.phase < st.prev) {
                        if (p.sound) playCue("whoosh", vol, 200)
                        st.userCycle = false
                    } else if (st.prev < B.dropEnd && st.phase >= B.dropEnd && p.sound) playCue("drop", vol, 120)
                }
                st.prev = st.phase
            } else triggerRef.current = false
            const t = frozen ? 2.9 : st.phase

            const uPeek = clamp01(1 - (TRAVEL - 2 - (adv.peekPct / 100) * CARD_H) / TRAVEL)
            const S = sample(t, B, uPeek)

            // pointer
            const ptr = ptrRef.current
            const follow = 1 - Math.exp(-Math.max(1, adv.follow) * dt)
            st.over += ((ptr.inside && !frozen ? 1 : 0) - st.over) * follow
            const nx = (ptr.x - (MODAL_X + CARD_X)) / CARD_W
            const ny = (ptr.y - (MODAL_Y + CARD_Y)) / CARD_H
            const pull = st.over * Math.min(1, hoverAmt)
            const bandTarget = lerp(S.band, Math.min(1.15, Math.max(-0.15, nx)), pull)
            if (frozen) st.band = 0.7
            else if (dt === 0) st.band = bandTarget
            else st.band += (bandTarget - st.band) * follow
            const nyc = clamp01(ny / 1.4)
            const strengthMod = S.strength * (1 - 0.45 * nyc * pull)
            const tiltTY = (Math.min(1.2, Math.max(-0.2, nx)) - 0.5) * 2 * adv.tiltMax * hoverAmt * st.over
            const tiltTX = -(Math.min(1.2, Math.max(-0.2, ny)) - 0.5) * 2 * adv.tiltMax * hoverAmt * st.over
            st.tiltX += (tiltTX - st.tiltX) * follow
            st.tiltY += (tiltTY - st.tiltY) * follow

            const off = (1 - S.u) * TRAVEL
            const card = cardRef.current
            if (card)
                card.style.transform = `perspective(900px) translate3d(0, ${off.toFixed(2)}px, 0) rotateX(${(st.tiltX * S.u).toFixed(3)}deg) rotateY(${(st.tiltY * S.u).toFixed(3)}deg)`
            if (shadowRef.current) shadowRef.current.style.opacity = String((S.u * S.u * 0.55).toFixed(3))
            if (ledOnRef.current) ledOnRef.current.style.opacity = String(1 - S.amber)
            if (ledWaitRef.current) ledWaitRef.current.style.opacity = String(S.amber)
            if (glowRef.current) {
                glowRef.current.style.opacity = String(S.light)
                glowRef.current.style.transform = `scaleX(${S.glowScale})`
            }
            if (bloomRef.current) {
                bloomRef.current.style.opacity = String(S.light * 0.45)
                bloomRef.current.style.transform = `scaleX(${S.glowScale})`
            }
            if (btnRef.current) btnRef.current.style.filter = S.dim > 0 ? `brightness(${1 - 0.14 * S.dim})` : "none"

            // card foil
            const canvas = canvasRef.current
            if (!canvas) return
            const s = fitScale(viewRef.current, p.scale ?? 100)
            const dpr = Math.min(2, window.devicePixelRatio || 1)
            const k = Math.max(0.25, s * dpr)
            const Wpx = Math.max(1, Math.round(CARD_W * k))
            const Hpx = Math.max(1, Math.round(CARD_H * k))
            if (canvas.width !== Wpx || canvas.height !== Hpx) {
                canvas.width = Wpx
                canvas.height = Hpx
            }
            const key = `${Wpx}x${Hpx}|${adv.cardLight}|${adv.cardMid}|${adv.cardDark}|${adv.brush}|${adv.glitterSize}`
            if (key !== st.key) {
                st.key = key
                st.layers = bakeLayers(Wpx, Hpx, k, adv)
            }
            const L = st.layers
            const ctx = canvas.getContext("2d")
            if (!ctx || !L) return
            const foil = clamp01((p.foilStrength ?? 70) / 100)

            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.globalCompositeOperation = "source-over"
            ctx.globalAlpha = 1
            ctx.clearRect(0, 0, Wpx, Hpx)
            ctx.drawImage(L.base, 0, 0)

            ctx.setTransform(k, 0, 0, k, 0, 0)
            ctx.globalAlpha = clamp01(foil * strengthMod * 0.95)
            ctx.fillStyle = bandGradient(ctx, st.band, adv, 1, false)
            ctx.fillRect(0, 0, CARD_W, CARD_H)

            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.globalAlpha = 1
            ctx.drawImage(L.streak, 0, 0)

            const tctx = L.tmp.getContext("2d")
            if (tctx) {
                tctx.setTransform(1, 0, 0, 1, 0, 0)
                tctx.globalCompositeOperation = "source-over"
                tctx.clearRect(0, 0, Wpx, Hpx)
                tctx.drawImage(L.glitter, 0, 0)
                tctx.globalCompositeOperation = "destination-in"
                tctx.setTransform(k, 0, 0, k, 0, 0)
                tctx.fillStyle = bandGradient(tctx, st.band, { ...adv, bandWidth: adv.bandWidth * 1.2 }, 1, true)
                tctx.fillRect(0, 0, CARD_W, CARD_H)
                tctx.globalCompositeOperation = "source-over"
                ctx.globalAlpha = clamp01((adv.glitter / 100) * (foil / 0.7) * strengthMod)
                ctx.drawImage(L.tmp, 0, 0)
            }
            ctx.globalAlpha = clamp01((adv.glitter / 100) * 0.1)
            ctx.drawImage(L.glitter, 0, 0)

            // light from the slot on the card's lower edge
            const visibleH = CLIP_Y - (CARD_Y + off)
            if (S.light > 0.01 && visibleH < CARD_H + 60) {
                ctx.setTransform(k, 0, 0, k, 0, 0)
                ctx.save()
                ctx.translate(CARD_W / 2, visibleH)
                ctx.scale(1, 0.22)
                const r = CARD_W * 0.65
                const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
                rg.addColorStop(0, adv.slotLight)
                rg.addColorStop(0.55, adv.slotLight)
                rg.addColorStop(1, "rgba(255,255,255,0)")
                ctx.globalAlpha = S.light * 0.95
                ctx.fillStyle = rg
                ctx.fillRect(-r, -r, r * 2, r * 2)
                ctx.restore()
            }
            ctx.globalAlpha = 1
        }
        raf = requestAnimationFrame(frame)
        return () => cancelAnimationFrame(raf)
    }, [])

    const s = fitScale(view, scale)
    const stageCx = view.vx + view.vw / 2
    const stageCy = view.vy + view.vh / 2
    const family = font?.fontFamily || FONT_STACK
    const titleStyle: React.CSSProperties = {
        fontFamily: FONT_STACK,
        fontSize: 30,
        lineHeight: 1.2,
        letterSpacing: "-0.01em",
        ...font,
        fontWeight: font?.fontWeight ?? 600,
        color: adv.titleColor,
        margin: 0,
    }
    const gw = (SLOT_W * Math.max(5, adv.slotGlowWidth)) / 100
    const ledBase: React.CSSProperties = {
        position: "absolute",
        left: 0,
        top: 0,
        width: 8,
        height: 8,
        borderRadius: "50%",
    }

    return (
        <div
            ref={rootRef}
            style={{
                minWidth: 1200,
                minHeight: 800,
                position: "relative",
                width: "100%",
                height: "100%",
                ...style,
                overflow: "hidden",
                background,
                isolation: "isolate",
                userSelect: "none",
                fontFamily: family,
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: stageCx,
                    top: stageCy,
                    width: STAGE_W,
                    height: STAGE_H,
                    transform: `translate(-50%, -50%) scale(${s})`,
                    transformOrigin: "50% 50%",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: MODAL_X,
                        top: MODAL_Y,
                        width: MODAL_W,
                        height: MODAL_H,
                        borderRadius: adv.modalRadius,
                        overflow: "hidden",
                        background: adv.textZone,
                    }}
                >
                    {/* illustration panel */}
                    <div
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: LEFT_W,
                            height: MODAL_H,
                            background: `radial-gradient(ellipse 60% 42% at 50% 0%, ${adv.panelGlow}, rgba(0,0,0,0)), ${adv.panelColor}`,
                        }}
                    >
                        {/* reader top face */}
                        <div
                            style={{
                                position: "absolute",
                                left: 30,
                                top: 396,
                                width: 480,
                                height: 44,
                                clipPath: "polygon(27px 0, 453px 0, 480px 44px, 0 44px)",
                                background: "linear-gradient(180deg, #464647 0px, #303031 3px, #2A2A2A 55%, #262626 100%)",
                            }}
                        />
                        {/* card shadow on the reader */}
                        <div
                            ref={shadowRef}
                            style={{
                                position: "absolute",
                                left: 80,
                                top: 388,
                                width: 380,
                                height: 20,
                                borderRadius: "50%",
                                background: "rgba(0,0,0,0.95)",
                                filter: "blur(8px)",
                                opacity: 0,
                            }}
                        />
                        {/* front face */}
                        <div
                            style={{
                                position: "absolute",
                                left: 30,
                                top: 440,
                                width: 480,
                                height: 70,
                                borderTop: "1px solid #101010",
                                background: "linear-gradient(180deg, #1C1C1C 0%, #181818 45%, rgba(21,21,21,0) 100%)",
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                left: 30,
                                top: 441,
                                width: 480,
                                height: 10,
                                background: "linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0))",
                            }}
                        />
                        {/* slot */}
                        <div
                            style={{
                                position: "absolute",
                                left: SLOT_X,
                                top: SLOT_Y,
                                width: SLOT_W,
                                height: SLOT_H,
                                borderRadius: SLOT_H / 2,
                                background: "#000000",
                                boxShadow: "inset 0 2px 3px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.06)",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                ref={glowRef}
                                style={{
                                    position: "absolute",
                                    left: (SLOT_W - gw) / 2,
                                    top: 0,
                                    width: gw,
                                    height: "100%",
                                    background: `radial-gradient(closest-side, ${adv.slotLight}, rgba(255,255,255,0))`,
                                    filter: "blur(1.5px)",
                                    opacity: 0,
                                }}
                            />
                        </div>
                        {/* bloom above the slot */}
                        <div
                            ref={bloomRef}
                            style={{
                                position: "absolute",
                                left: SLOT_X + SLOT_W / 2 - gw * 0.6,
                                top: SLOT_Y - 14,
                                width: gw * 1.2,
                                height: 36,
                                background: `radial-gradient(closest-side, ${adv.slotLight}, rgba(255,255,255,0))`,
                                filter: "blur(6px)",
                                mixBlendMode: "screen",
                                opacity: 0,
                                pointerEvents: "none",
                            }}
                        />
                        {/* LED */}
                        <div style={{ position: "absolute", left: 462, top: 470, width: 8, height: 8 }}>
                            <div
                                ref={ledOnRef}
                                style={{ ...ledBase, background: adv.ledOn, boxShadow: `0 0 6px 1px ${adv.ledOn}`, opacity: 0 }}
                            />
                            <div
                                ref={ledWaitRef}
                                style={{ ...ledBase, background: adv.ledWait, boxShadow: `0 0 6px 1px ${adv.ledWait}` }}
                            />
                        </div>
                        {/* card, clipped at the slot line */}
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                width: LEFT_W,
                                height: CLIP_Y,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                ref={cardRef}
                                style={{
                                    position: "absolute",
                                    left: CARD_X,
                                    top: CARD_Y,
                                    width: CARD_W,
                                    height: CARD_H,
                                    borderRadius: adv.cardRadius,
                                    overflow: "hidden",
                                    boxShadow: "0 14px 28px rgba(0,0,0,0.55)",
                                    transform: `translate3d(0, ${TRAVEL * 0.9}px, 0)`,
                                    willChange: "transform",
                                    color: adv.ink,
                                    fontFamily: family,
                                }}
                            >
                                <canvas
                                    ref={canvasRef}
                                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
                                />
                                <div
                                    style={{
                                        position: "absolute",
                                        left: 22,
                                        top: 22,
                                        width: 31,
                                        height: 31,
                                        borderRadius: "50%",
                                        background: showImg ? "transparent" : adv.ink,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        overflow: "hidden",
                                    }}
                                >
                                    {showImg ? (
                                        <img
                                            src={imgSrc}
                                            alt=""
                                            draggable={false}
                                            onError={() => setFailedSrc(imgSrc)}
                                            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                                        />
                                    ) : (
                                        <LeafMark />
                                    )}
                                </div>
                                <div
                                    style={{
                                        position: "absolute",
                                        right: 22,
                                        top: 27,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        letterSpacing: "0.3em",
                                        marginRight: "-0.3em",
                                        lineHeight: 1,
                                    }}
                                >
                                    PRO
                                </div>
                                <div
                                    style={{
                                        position: "absolute",
                                        left: 22,
                                        bottom: 44,
                                        fontSize: 15,
                                        fontWeight: 700,
                                        letterSpacing: "0.12em",
                                        lineHeight: 1,
                                    }}
                                >
                                    {cardName}
                                </div>
                                <div
                                    style={{
                                        position: "absolute",
                                        left: 22,
                                        bottom: 24,
                                        fontSize: 11,
                                        lineHeight: 1,
                                        opacity: 0.78,
                                    }}
                                >
                                    {memberLine}
                                </div>
                                <div
                                    style={{
                                        position: "absolute",
                                        right: 22,
                                        bottom: 24,
                                        fontSize: 11,
                                        lineHeight: 1,
                                        opacity: 0.78,
                                    }}
                                >
                                    {plan}
                                </div>
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        borderRadius: adv.cardRadius,
                                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
                                        pointerEvents: "none",
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* text panel */}
                    <div
                        style={{
                            position: "absolute",
                            left: LEFT_W,
                            top: 0,
                            width: MODAL_W - LEFT_W,
                            height: MODAL_H,
                            background: adv.textZone,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            padding: "0 52px",
                            boxSizing: "border-box",
                        }}
                    >
                        <svg
                            width={18}
                            height={18}
                            viewBox="0 0 18 18"
                            style={{ position: "absolute", right: 36, top: 36 }}
                        >
                            <path d="M3 3 L15 15 M15 3 L3 15" stroke="#9B9B9B" strokeWidth={2} strokeLinecap="round" />
                        </svg>
                        <div style={titleStyle}>{title}</div>
                        <div
                            style={{
                                marginTop: 16,
                                fontFamily: family,
                                fontSize: 20,
                                lineHeight: "30px",
                                color: adv.bodyColor,
                            }}
                        >
                            {body}
                        </div>
                        <div
                            ref={btnRef}
                            style={{
                                marginTop: 40,
                                height: 64,
                                borderRadius: 16,
                                background: adv.buttonColor,
                                color: "#000000",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontFamily: family,
                                fontSize: 20,
                                fontWeight: 600,
                            }}
                        >
                            {buttonLabel}
                        </div>
                        <div
                            style={{
                                marginTop: 22,
                                textAlign: "center",
                                fontFamily: family,
                                fontSize: 19,
                                color: adv.bodyColor,
                            }}
                        >
                            {linkLabel}
                        </div>
                    </div>
                </div>
            </div>

            {adv.grain > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: GRAIN_URI,
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
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,${adv.vignette / 100}) 100%)`,
                        pointerEvents: "none",
                    }}
                />
            )}
            <div ref={overlayRef} style={{ position: "absolute", inset: 0, zIndex: 10 }} />
        </div>
    )
}

addPropertyControls(HoloCardDispenser, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Page colour behind the modal.",
    },
    title: {
        type: ControlType.String,
        title: "Title",
        defaultValue: "Welcome to Pro, Nishant",
        description: "Heading beside the card reader.",
    },
    body: {
        type: ControlType.String,
        title: "Body",
        defaultValue:
            "Download packs and assets, insert them in Figma with the plugin, or let your AI agent fetch them over MCP.",
        displayTextArea: true,
        description: "Paragraph under the heading.",
    },
    buttonLabel: {
        type: ControlType.String,
        title: "Button",
        defaultValue: "Start exploring",
        description: "Primary button label. Clicking it retracts and re-issues the card.",
    },
    linkLabel: {
        type: ControlType.String,
        title: "Link",
        defaultValue: "Connect your AI agent",
        description: "Secondary link under the button.",
    },
    cardName: {
        type: ControlType.String,
        title: "Card Name",
        defaultValue: "NISHANT",
        description: "Name printed on the card.",
    },
    memberLine: {
        type: ControlType.String,
        title: "Member Line",
        defaultValue: "Member since Oct 2026",
        description: "Small line under the name.",
    },
    plan: {
        type: ControlType.String,
        title: "Plan",
        defaultValue: "Quarterly",
        description: "Plan printed at the card's bottom right.",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 30, variant: "Semibold", letterSpacing: "-0.01em", lineHeight: "1.2em" },
        description: "Typeface for all text; size and weight set the heading.",
    },
    image: {
        type: ControlType.ResponsiveImage,
        title: "Logo",
        description: "Your mark on the card. Empty draws the built-in leaf emblem.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 36,
        description: "50 is the reference pace, 0 stops.",
    },
    scale: {
        type: ControlType.Number,
        title: "Scale",
        min: 50,
        max: 150,
        step: 1,
        unit: "%",
        defaultValue: 100,
        description: "How big the modal draws in the frame.",
    },
    foilStrength: {
        type: ControlType.Number,
        title: "Foil",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 70,
        description: "Strength of the rainbow holographic band and its glitter.",
    },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false, description: "Synthesized click, drop and whoosh when the card is reissued by a press." },
    soundVolume: { type: ControlType.Number, title: "Sound Volume", min: 0, max: 1, step: 0.05, defaultValue: 0.5, description: "Loudness of the sound effects." },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "How strongly the sheen and tilt follow the pointer. 0 is off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            riseStartMs: { type: ControlType.Number, title: "Rise Start", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 600, description: "When the card starts rising." },
            riseMs: { type: ControlType.Number, title: "Rise", min: 200, max: 5000, step: 10, unit: "ms", defaultValue: 1670, description: "Duration of the card's ease-out rise." },
            pressAtMs: { type: ControlType.Number, title: "Auto Press", min: 3000, max: 30000, step: 10, unit: "ms", defaultValue: 10620, description: "When the automatic retract happens." },
            dropMs: { type: ControlType.Number, title: "Drop", min: 16, max: 1000, step: 1, unit: "ms", defaultValue: 60, description: "How fast the card drops into the slot." },
            restMs: { type: ControlType.Number, title: "Rest", min: 0, max: 2000, step: 10, unit: "ms", defaultValue: 200, description: "Empty pause before the slot lights." },
            glowMs: { type: ControlType.Number, title: "Glow", min: 16, max: 2000, step: 1, unit: "ms", defaultValue: 230, description: "Slot light ramp-up time." },
            peekMs: { type: ControlType.Number, title: "Peek", min: 50, max: 3000, step: 10, unit: "ms", defaultValue: 650, description: "Time the card takes to peek out before rising." },
            peekPct: { type: ControlType.Number, title: "Peek Height", min: 0, max: 50, step: 1, unit: "%", defaultValue: 10, description: "How much of the card shows while it peeks." },
            bandWidth: { type: ControlType.Number, title: "Band Width", min: 5, max: 100, step: 1, unit: "%", defaultValue: 45, description: "Rainbow band width, % of the card." },
            bandAngle: { type: ControlType.Number, title: "Band Angle", min: 0, max: 90, step: 1, unit: "°", defaultValue: 40, description: "Tilt of the rainbow band below horizontal." },
            follow: { type: ControlType.Number, title: "Follow", min: 1, max: 20, step: 1, defaultValue: 6, description: "How quickly the sheen and tilt chase the pointer (per second)." },
            tiltMax: { type: ControlType.Number, title: "Tilt", min: 0, max: 15, step: 1, unit: "°", defaultValue: 3, description: "Card tilt toward the pointer." },
            glitter: { type: ControlType.Number, title: "Glitter", min: 0, max: 100, step: 1, unit: "%", defaultValue: 35, description: "Pixel sparkle inside the band." },
            glitterSize: { type: ControlType.Number, title: "Glitter Size", min: 1, max: 10, step: 1, unit: "px", defaultValue: 4, description: "Size of a sparkle cell." },
            brush: { type: ControlType.Number, title: "Brushed", min: 0, max: 30, step: 1, unit: "%", defaultValue: 6, description: "Contrast of the brushed-metal streaks." },
            cardLight: { type: ControlType.Color, title: "Card Light", defaultValue: "#D8D2CA", description: "Card base, top left." },
            cardMid: { type: ControlType.Color, title: "Card Mid", defaultValue: "#B0ACD7", description: "Card base, middle." },
            cardDark: { type: ControlType.Color, title: "Card Dark", defaultValue: "#9B97B1", description: "Card base, bottom right." },
            ink: { type: ControlType.Color, title: "Card Ink", defaultValue: "#1E1E1E", description: "Printing on the card and the emblem disc." },
            ledOn: { type: ControlType.Color, title: "LED Ready", defaultValue: "#22C55E", description: "LED while the card is out." },
            ledWait: { type: ControlType.Color, title: "LED Busy", defaultValue: "#F2A12A", description: "LED while the card is in or issuing." },
            slotLight: { type: ControlType.Color, title: "Slot Light", defaultValue: "#FDFDFD", description: "Light inside the slot." },
            slotGlowWidth: { type: ControlType.Number, title: "Glow Width", min: 5, max: 100, step: 1, unit: "%", defaultValue: 60, description: "Width of the slot light, % of the slot." },
            panelColor: { type: ControlType.Color, title: "Panel", defaultValue: "#151515", description: "Illustration panel colour." },
            panelGlow: { type: ControlType.Color, title: "Panel Glow", defaultValue: "#1E1E1E", description: "Soft lift at the panel's top." },
            textZone: { type: ControlType.Color, title: "Text Zone", defaultValue: "#1E1E1E", description: "Text panel colour." },
            titleColor: { type: ControlType.Color, title: "Title Color", defaultValue: "#FDFDFD", description: "Heading colour." },
            bodyColor: { type: ControlType.Color, title: "Body Color", defaultValue: "#9A9A9A", description: "Paragraph and link colour." },
            buttonColor: { type: ControlType.Color, title: "Button Color", defaultValue: "#FDFDFD", description: "Primary button fill." },
            cardRadius: { type: ControlType.Number, title: "Card Radius", min: 0, max: 60, step: 1, unit: "px", defaultValue: 15, description: "Card corner radius." },
            modalRadius: { type: ControlType.Number, title: "Modal Radius", min: 0, max: 80, step: 1, unit: "px", defaultValue: 36, description: "Modal corner radius." },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening." },
        },
    },
})
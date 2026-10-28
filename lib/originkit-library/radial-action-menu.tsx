import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/**
 * Radial Action Menu
 *
 * A round + toggle in the middle of the stage. Clicking it sends six round icon
 * buttons flying in along fixed radial spokes from beyond the ring. They arrive
 * blurred and transparent, sharpen as they land on a hexagon, and come in one
 * after another clockwise from the top. The + turns 45° into a grey ×. Clicking ×
 * sends all six back out together, quickly, blurring and fading, and the glyph
 * turns back to +. On the canvas and in preview it plays the reference's cycle
 * by itself; a click takes over. Hovering a button makes it bulge toward the
 * pointer like a drop of liquid and wobble back when the pointer leaves.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    satRatio: 91,
    startAngle: -90,
    flyOut: 205,
    openMs: 300,
    closeMs: 130,
    holdMs: 900,
    restMs: 740,
    startDelayMs: 400,
    pressLeadMs: 250,
    openEase: 3,
    closeEase: 2,
    glyphMs: 200,
    blur: 9,
    fadeCurve: 60,
    plusLength: 31,
    plusWeight: 6,
    crossScale: 80,
    crossColor: "#6A6A6A",
    iconScale: 46,
    rimColor: "#D2D2D2",
    edgeShade: 3,
    pressColor: "#E2E2E2",
    shadowOpacity: 10,
    shadowBlur: 12,
    shadowY: 4,
    magnet: 14,
    gooey: 60,
    gooeySpring: 50,
    resumeMs: 4000,
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


const COUNT = 6

// ── colour helpers ──
function parseCol(c: any): [number, number, number, number] {
    if (typeof c !== "string") return [0, 0, 0, 1]
    const s = c.trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("")
        const n = parseInt(h.slice(0, 6), 16)
        const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
        if (isNaN(n)) return [0, 0, 0, 1]
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
    }
    const m = s.match(/rgba?\(([^)]+)\)/i)
    if (m) {
        const p = m[1].split(/[\s,\/]+/).filter(Boolean).map((v) => parseFloat(v))
        return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] === undefined || isNaN(p[3]) ? 1 : p[3]]
    }
    return [0, 0, 0, 1]
}
function mix(a: any, b: any, t: number) {
    const A = parseCol(a)
    const B = parseCol(b)
    const k = Math.max(0, Math.min(1, t))
    const r = Math.round(A[0] + (B[0] - A[0]) * k)
    const g = Math.round(A[1] + (B[1] - A[1]) * k)
    const bl = Math.round(A[2] + (B[2] - A[2]) * k)
    const al = A[3] + (B[3] - A[3]) * k
    return `rgba(${r},${g},${bl},${al.toFixed(3)})`
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

// ── drawing helpers ──
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2)
    g.moveTo(x + r, y)
    g.arcTo(x + w, y, x + w, y + h, r)
    g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r)
    g.arcTo(x, y, x + w, y, r)
    g.closePath()
}

/** A circle whose edge swells toward angle `phi` like a drop of liquid. `amp` is the swell in px. */
type Goo = { phi: number; amp: number }
function discPath(g: CanvasRenderingContext2D, R: number, goo?: Goo | null) {
    g.beginPath()
    if (!goo || Math.abs(goo.amp) < 0.05) {
        g.arc(0, 0, R, 0, Math.PI * 2)
        return
    }
    const N = 72
    const sigma = 0.62
    // the opposite side gives a little, so the drop keeps roughly the same volume
    const back = goo.amp * 0.22
    for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2
        let d = a - goo.phi
        d = Math.atan2(Math.sin(d), Math.cos(d))
        const bump = Math.exp(-(d * d) / (2 * sigma * sigma))
        const dB = Math.atan2(Math.sin(a - goo.phi - Math.PI), Math.cos(a - goo.phi - Math.PI))
        const flat = Math.exp(-(dB * dB) / (2 * 0.9 * 0.9))
        const r = R + goo.amp * bump - back * flat
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
    }
    g.closePath()
}

function drawDisc(g: CanvasRenderingContext2D, R: number, fill: string, adv: any, dpr: number, goo?: Goo | null) {
    const D = R * 2
    g.save()
    g.shadowColor = `rgba(0,0,0,${adv.shadowOpacity / 100})`
    g.shadowBlur = ((D * adv.shadowBlur) / 100) * dpr
    g.shadowOffsetY = ((D * adv.shadowY) / 100) * dpr
    const grad = g.createRadialGradient(-R * 0.2, -R * 0.25, 0, 0, 0, R)
    grad.addColorStop(0, mix(fill, "#ffffff", 0.25))
    grad.addColorStop(0.65, mix(fill, fill, 0))
    grad.addColorStop(1, mix(fill, "#000000", adv.edgeShade / 100))
    g.fillStyle = grad
    discPath(g, R, goo)
    g.fill()
    g.restore()
    g.lineWidth = 1
    g.strokeStyle = adv.rimColor
    discPath(g, Math.max(0, R - 0.5), goo)
    g.stroke()
}

// Built-in icons, drawn in a 100-unit box centred on 0,0.
function drawIcon(g: CanvasRenderingContext2D, i: number, ink: string, paper: string) {
    g.fillStyle = ink
    if (i === 0) {
        // envelope
        g.beginPath()
        rr(g, -48, -38, 96, 76, 16)
        g.fill()
        g.strokeStyle = paper
        g.lineWidth = 9
        g.lineCap = "round"
        g.lineJoin = "round"
        g.beginPath()
        g.moveTo(-28, -14)
        g.lineTo(0, 8)
        g.lineTo(28, -14)
        g.stroke()
    } else if (i === 1) {
        // photo
        g.beginPath()
        rr(g, -44, -44, 88, 88, 20)
        g.fill()
        g.fillStyle = paper
        g.beginPath()
        rr(g, -32, -32, 64, 64, 8)
        g.fill()
        g.save()
        g.beginPath()
        rr(g, -32, -32, 64, 64, 8)
        g.clip()
        g.fillStyle = ink
        g.beginPath()
        g.moveTo(-32, 34)
        g.lineTo(-32, 18)
        g.lineTo(-10, -4)
        g.lineTo(12, 18)
        g.lineTo(20, 10)
        g.lineTo(34, 24)
        g.lineTo(34, 34)
        g.closePath()
        g.fill()
        g.beginPath()
        g.arc(-12, -14, 8, 0, Math.PI * 2)
        g.fill()
        g.restore()
    } else if (i === 2) {
        // bell
        g.beginPath()
        g.arc(0, -42, 7, 0, Math.PI * 2)
        g.fill()
        g.beginPath()
        g.moveTo(-38, 24)
        g.quadraticCurveTo(-28, 14, -28, -2)
        g.lineTo(-28, -8)
        g.bezierCurveTo(-28, -28, -14, -38, 0, -38)
        g.bezierCurveTo(14, -38, 28, -28, 28, -8)
        g.lineTo(28, -2)
        g.quadraticCurveTo(28, 14, 38, 24)
        g.quadraticCurveTo(40, 30, 34, 30)
        g.lineTo(-34, 30)
        g.quadraticCurveTo(-40, 30, -38, 24)
        g.closePath()
        g.fill()
        g.beginPath()
        g.arc(0, 36, 10, 0, Math.PI)
        g.closePath()
        g.fill()
    } else if (i === 3) {
        // speech bubble
        g.beginPath()
        g.ellipse(2, -6, 48, 38, 0, 0, Math.PI * 2)
        g.moveTo(-30, 14)
        g.quadraticCurveTo(-34, 34, -46, 42)
        g.quadraticCurveTo(-24, 40, -10, 26)
        g.closePath()
        g.fill()
    } else if (i === 4) {
        // calendar
        g.beginPath()
        rr(g, -44, -44, 88, 88, 18)
        g.fill()
        g.fillStyle = paper
        g.beginPath()
        rr(g, -34, -22, 68, 56, 8)
        g.fill()
        g.fillStyle = ink
        const rows = [-8, 8, 22]
        const xs = [-21, -7, 7, 21]
        for (let r = 0; r < 3; r++) {
            const n = r === 2 ? 3 : 4
            for (let c = 0; c < n; c++) {
                g.beginPath()
                g.arc(xs[c], rows[r], 4.6, 0, Math.PI * 2)
                g.fill()
            }
        }
    } else {
        // pencil, tip lower-left
        g.save()
        g.rotate(-Math.PI / 4)
        g.scale(1.12, 1.12)
        g.translate(3, 0)
        g.beginPath()
        g.moveTo(-20, -13)
        g.lineTo(29, -13)
        g.arc(29, 0, 13, -Math.PI / 2, Math.PI / 2)
        g.lineTo(-20, 13)
        g.lineTo(-44, 3)
        g.quadraticCurveTo(-48, 0, -44, -3)
        g.closePath()
        g.fill()
        g.strokeStyle = paper
        g.lineWidth = 4
        g.beginPath()
        g.moveTo(22, -15)
        g.lineTo(22, 15)
        g.stroke()
        g.restore()
    }
}

// ── picture inputs ──
type CachedImg = { img: HTMLImageElement; ok: boolean; failed: boolean }
const IMG_CACHE = new Map<string, CachedImg>()
const IMG_LISTENERS = new Set<() => void>()
function srcOf(v: any): string {
    if (!v) return ""
    if (typeof v === "string") return v
    return typeof v.src === "string" ? v.src : ""
}
function getImage(src: string): CachedImg | null {
    if (!src || typeof Image === "undefined") return null
    let c = IMG_CACHE.get(src)
    if (!c) {
        const img = new Image()
        c = { img, ok: false, failed: false }
        const entry = c
        img.onload = () => {
            entry.ok = true
            IMG_LISTENERS.forEach((f) => f())
        }
        img.onerror = () => {
            entry.failed = true
        }
        img.src = src
        IMG_CACHE.set(src, c)
    }
    return c
}

function drawUpload(g: CanvasRenderingContext2D, img: HTMLImageElement, box: number, tint: boolean, color: string, dpr: number) {
    let iw = img.naturalWidth || 0
    let ih = img.naturalHeight || 0
    if (!iw || !ih) iw = ih = 1
    const s = Math.min(box / iw, box / ih)
    const w = iw * s
    const h = ih * s
    if (tint) {
        const t = document.createElement("canvas")
        t.width = Math.max(1, Math.ceil(w * dpr))
        t.height = Math.max(1, Math.ceil(h * dpr))
        const tg = t.getContext("2d")
        if (!tg) return
        tg.drawImage(img, 0, 0, t.width, t.height)
        tg.globalCompositeOperation = "source-in"
        tg.fillStyle = color
        tg.fillRect(0, 0, t.width, t.height)
        g.drawImage(t, -w / 2, -h / 2, w, h)
    } else {
        g.drawImage(img, -w / 2, -h / 2, w, h)
    }
}

let NOISE: HTMLCanvasElement | null = null
function noiseTile() {
    if (NOISE) return NOISE
    const c = document.createElement("canvas")
    c.width = c.height = 128
    const g = c.getContext("2d")
    if (g) {
        const d = g.createImageData(128, 128)
        for (let i = 0; i < d.data.length; i += 4) {
            const v = Math.random() * 255
            d.data[i] = d.data[i + 1] = d.data[i + 2] = v
            d.data[i + 3] = 255
        }
        g.putImageData(d, 0, 0)
    }
    NOISE = c
    return c
}

/** A damped spring on a 0..1 amount, so it overshoots and wobbles like jelly. */
type Jelly = { v: number; vel: number }
function stepJelly(j: Jelly, target: number, dt: number, tension: number) {
    const k = 160 + tension * 4
    const c = 22 - tension * 0.12
    let rem = dt
    while (rem > 1e-6) {
        const h = Math.min(rem, 1 / 240)
        j.vel += (k * (target - j.v) - c * j.vel) * h
        j.v += j.vel * h
        rem -= h
    }
}

export default function RadialActionMenu(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        buttonColor = "#F5F5F5",
        iconColor = "#000000",
        size = 186,
        spread = 114,
        speed = 50,
        stagger = 40,
        autoPlay = true,
        images,
        tint = true,
        sound = false,
        soundVolume = 0.5,
        style,
    } = props

    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const live = useRef<any>({})
    live.current = {
        background,
        buttonColor,
        iconColor,
        size,
        spread,
        speed,
        stagger,
        autoPlay,
        images,
        tint,
        sound,
        soundVolume,
        adv: { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) },
    }

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const target = RenderTarget.current()
        const isStatic = target === RenderTarget.thumbnail || target === RenderTarget.export
        const reduced =
            typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const instant = isStatic || reduced
        const hasFilter = "filter" in ctx

        let W = 1
        let H = 1
        let dpr = 1
        const resize = () => {
            W = Math.max(1, root.offsetWidth)
            H = Math.max(1, root.offsetHeight)
            dpr = Math.min(2, window.devicePixelRatio || 1)
            canvas.width = Math.round(W * dpr)
            canvas.height = Math.round(H * dpr)
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(root)

        let imgVersion = 0
        const onImg = () => {
            imgVersion++
        }
        IMG_LISTENERS.add(onImg)

        const st = {
            open: instant,
            since: -100,
            from: new Array(COUNT).fill(instant ? 1 : 0),
            p: new Array(COUNT).fill(instant ? 1 : 0),
            gFrom: instant ? 1 : 0,
            g: instant ? 1 : 0,
            clock: 0,
            nextAuto: live.current.adv.startDelayMs / 1000,
            pausedUntil: 0,
        }
        const ptr = { x: -9999, y: -9999, inside: false, down: false, over: 0, sx: -9999, sy: -9999, hoverC: 0, press: 0 }
        const geo = { cx: 0, cy: 0, D: 1 }
        // goo state: one jelly + smoothed direction per satellite, and one for the centre button
        const jelly: Jelly[] = Array.from({ length: COUNT + 1 }, () => ({ v: 0, vel: 0 }))
        const gooDir = new Array(COUNT + 1).fill(0)
        const hoverOn = new Array(COUNT + 1).fill(false)

        const toggle = (open: boolean) => {
            const L = live.current
            const adv = L.adv
            st.from = st.p.slice()
            st.gFrom = st.g
            st.open = open
            st.since = st.clock
            const stg = Math.max(0, L.stagger) / 1000
            if (open) st.nextAuto = st.clock + (adv.openMs / 1000 + stg * (COUNT - 1) + adv.holdMs / 1000)
            else st.nextAuto = st.clock + (adv.closeMs + adv.restMs) / 1000
        }

        const onMove = (e: PointerEvent) => {
            ptr.x = e.offsetX
            ptr.y = e.offsetY
            if (!ptr.inside) {
                ptr.sx = ptr.x
                ptr.sy = ptr.y
            }
            ptr.inside = true
        }
        const onLeave = () => {
            ptr.inside = false
        }
        const onDown = (e: PointerEvent) => {
            onMove(e)
            ptr.down = true
            const d = Math.hypot(ptr.x - geo.cx, ptr.y - geo.cy)
            if (d <= geo.D * 0.55) {
                const lv = live.current
                if (lv.sound) playCue(st.open ? "whoosh" : "pop", lv.soundVolume, 120)
                if (instant) {
                    st.open = !st.open
                    st.p.fill(st.open ? 1 : 0)
                    st.from.fill(st.open ? 1 : 0)
                    st.g = st.gFrom = st.open ? 1 : 0
                } else toggle(!st.open)
                st.pausedUntil = performance.now() + live.current.adv.resumeMs
            }
        }
        const onUp = () => {
            ptr.down = false
        }
        root.addEventListener("pointermove", onMove)
        root.addEventListener("pointerenter", onMove)
        root.addEventListener("pointerleave", onLeave)
        root.addEventListener("pointerdown", onDown)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        // each sprite: the full button (disc + icon) and the icon alone, for when the disc is drawn live as goo
        const sprites: { key: string; c: HTMLCanvasElement | null; ic: HTMLCanvasElement | null; full: number }[] = []
        for (let i = 0; i < COUNT; i++) sprites.push({ key: "", c: null, ic: null, full: 0 })

        let grainPattern: CanvasPattern | null = null
        let lastCursor = ""
        let raf = 0
        let last = 0

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const L = live.current
            const adv = L.adv
            let dt = last ? (now - last) / 1000 : 0
            last = now
            if (dt > 1 / 20) dt = 1 / 20
            const k = Math.max(0, L.speed) / 50
            st.clock += dt * k

            // auto cycle: rest → open → hold → close → rest
            const autoOn = L.autoPlay && !instant && now >= st.pausedUntil
            if (autoOn && st.clock >= st.nextAuto) toggle(!st.open)

            // progress per satellite
            const s = st.clock - st.since
            const stg = Math.max(0, L.stagger) / 1000
            const oMs = Math.max(0.001, adv.openMs / 1000)
            const cMs = Math.max(0.001, adv.closeMs / 1000)
            for (let i = 0; i < COUNT; i++) {
                if (instant) {
                    st.p[i] = st.open ? 1 : 0
                    continue
                }
                if (st.open) {
                    const l = clamp01((s - i * stg) / oMs)
                    const e = 1 - Math.pow(1 - l, Math.max(1, adv.openEase))
                    st.p[i] = st.from[i] + (1 - st.from[i]) * e
                } else {
                    const l = clamp01(s / cMs)
                    const e = 1 - Math.pow(1 - l, Math.max(1, adv.closeEase))
                    st.p[i] = st.from[i] * (1 - e)
                }
            }
            if (!instant) {
                if (st.open) {
                    const l = clamp01(s / Math.max(0.001, adv.glyphMs / 1000))
                    const e = l * l * (3 - 2 * l)
                    st.g = st.gFrom + (1 - st.gFrom) * e
                } else {
                    const l = clamp01(s / cMs)
                    const e = 1 - (1 - l) * (1 - l)
                    st.g = st.gFrom * (1 - e)
                }
            } else st.g = st.open ? 1 : 0

            // geometry
            const cx = W / 2
            const cy = H / 2
            let D = Math.max(10, L.size)
            let satD = (D * adv.satRatio) / 100
            let ring = (D * Math.max(0, L.spread)) / 100
            const extent = ring + satD / 2 + D * 0.1
            const fit = Math.min(1, ((Math.min(W, H) / 2) * 0.96) / Math.max(1, extent))
            D *= fit
            satD *= fit
            ring *= fit
            const out = Math.max(ring, (D / fit) * (adv.flyOut / 100) * fit)
            geo.cx = cx
            geo.cy = cy
            geo.D = D

            // pointer easing
            const hoverK = Math.max(0, adv.hover) / 50
            const ek = 1 - Math.exp(-dt * 10)
            ptr.over += ((ptr.inside ? 1 : 0) - ptr.over) * ek
            if (ptr.inside) {
                ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-dt * 14))
                ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-dt * 14))
            }
            const overCentre = ptr.inside && Math.hypot(ptr.x - cx, ptr.y - cy) <= D * 0.55
            ptr.hoverC += ((overCentre ? 1 : 0) - ptr.hoverC) * (1 - Math.exp(-dt * 16))
            let pressTarget = overCentre && ptr.down ? 1 : 0
            if (autoOn) {
                const lead = Math.max(0.001, adv.pressLeadMs / 1000)
                const left = st.nextAuto - st.clock
                if (left < lead && left >= 0) pressTarget = Math.max(pressTarget, 1 - left / lead)
            }
            ptr.press += (pressTarget - ptr.press) * (1 - Math.exp(-dt * 18))

            // draw
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

            const list: any[] = Array.isArray(L.images) ? L.images.map(srcOf).filter(Boolean) : []
            const magnet = adv.magnet * fit * hoverK * ptr.over
            const gooK = (Math.max(0, adv.gooey) / 100) * Math.min(1.5, hoverK)
            let overSat = false

            for (let i = 0; i < COUNT; i++) {
                const p = st.p[i]
                if (p <= 0.002) {
                    jelly[i].v = jelly[i].vel = 0
                    hoverOn[i] = false
                    continue
                }
                // sprite (disc + icon) rebuilt only when its look changes
                const src = list.length ? list[i % list.length] : ""
                const cached = src ? getImage(src) : null
                const ok = !!(cached && cached.ok)
                const satDev = Math.round(satD * 2) / 2
                const key = [satDev, dpr, L.buttonColor, L.iconColor, L.tint, src, ok, imgVersion, adv.iconScale, adv.rimColor, adv.edgeShade, adv.shadowOpacity, adv.shadowBlur, adv.shadowY].join("|")
                const sp = sprites[i]
                if (sp.key !== key || !sp.c || !sp.ic) {
                    const pad = Math.ceil(satDev * (adv.shadowBlur / 100) * 1.4 + (satDev * adv.shadowY) / 100 + 4)
                    const full = satDev + pad * 2
                    const c = sp.c || document.createElement("canvas")
                    const ic = sp.ic || document.createElement("canvas")
                    c.width = ic.width = Math.ceil(full * dpr)
                    c.height = ic.height = Math.ceil(full * dpr)
                    const g = c.getContext("2d")
                    const ig = ic.getContext("2d")
                    const box = (satDev * adv.iconScale) / 100
                    const paintIcon = (t: CanvasRenderingContext2D) => {
                        if (ok && cached) {
                            drawUpload(t, cached.img, box * 1.1, !!L.tint, L.iconColor, dpr)
                        } else {
                            t.save()
                            t.scale(box / 100, box / 100)
                            drawIcon(t, i, L.iconColor, L.buttonColor)
                            t.restore()
                        }
                    }
                    if (g) {
                        g.setTransform(dpr, 0, 0, dpr, 0, 0)
                        g.clearRect(0, 0, full, full)
                        g.translate(full / 2, full / 2)
                        drawDisc(g, satDev / 2, L.buttonColor, adv, dpr)
                        paintIcon(g)
                    }
                    if (ig) {
                        ig.setTransform(dpr, 0, 0, dpr, 0, 0)
                        ig.clearRect(0, 0, full, full)
                        ig.translate(full / 2, full / 2)
                        paintIcon(ig)
                    }
                    sp.c = c
                    sp.ic = ic
                    sp.full = full
                    sp.key = key
                }

                const ang = ((adv.startAngle + (360 / COUNT) * i) * Math.PI) / 180
                const r = out + (ring - out) * p
                const bx = cx + Math.cos(ang) * r
                const by = cy + Math.sin(ang) * r
                let x = bx
                let y = by
                let sc = 1
                if (magnet > 0 && ptr.inside) {
                    const dx = ptr.sx - x
                    const dy = ptr.sy - y
                    const d = Math.hypot(dx, dy) || 1
                    const f = Math.exp(-(d * d) / (satD * satD)) * p
                    const m = Math.min(d, magnet) * f
                    x += (dx / d) * m
                    y += (dy / d) * m
                    sc = 1 + 0.05 * f * Math.min(1, hoverK)
                }

                // goo: swell toward the pointer while it is over the button, wobble back after
                const hovered = ptr.inside && p > 0.85 && gooK > 0 && Math.hypot(ptr.x - bx, ptr.y - by) <= satD * 0.62
                if (hovered) {
                    overSat = true
                    const a = Math.atan2(ptr.y - y, ptr.x - x)
                    if (!hoverOn[i]) {
                        gooDir[i] = a
                        if (L.sound) playCue("tick", L.soundVolume, 60, 1 + i * 0.06)
                    } else {
                        let da = a - gooDir[i]
                        da = Math.atan2(Math.sin(da), Math.cos(da))
                        gooDir[i] += da * (1 - Math.exp(-dt * 16))
                    }
                }
                hoverOn[i] = hovered
                stepJelly(jelly[i], hovered ? 1 : 0, dt, adv.gooeySpring)
                const swell = jelly[i].v * (satD / 2) * 0.42 * gooK
                const goo: Goo | null = Math.abs(swell) > 0.05 ? { phi: gooDir[i], amp: swell } : null

                const alpha = Math.pow(p, Math.max(0.05, adv.fadeCurve / 100))
                const blurPx = ((adv.blur / 100) * satD * (1 - p))
                ctx.save()
                ctx.globalAlpha = alpha
                if (hasFilter) (ctx as any).filter = blurPx > 0.3 ? `blur(${(blurPx * dpr).toFixed(2)}px)` : "none"
                if (goo) {
                    ctx.translate(x, y)
                    ctx.scale(sc, sc)
                    drawDisc(ctx, satD / 2, L.buttonColor, adv, dpr, goo)
                    const fw = sp.full * (satD / Math.max(1, satDev))
                    ctx.drawImage(sp.ic as HTMLCanvasElement, -fw / 2, -fw / 2, fw, fw)
                } else {
                    const fw = sp.full * sc * (satD / Math.max(1, satDev))
                    ctx.drawImage(sp.c as HTMLCanvasElement, x - fw / 2, y - fw / 2, fw, fw)
                }
                ctx.restore()
            }

            // centre toggle
            let ox = 0
            let oy = 0
            if (magnet > 0 && ptr.inside) {
                const dx = ptr.sx - cx
                const dy = ptr.sy - cy
                const d = Math.hypot(dx, dy) || 1
                const f = Math.exp(-(d * d) / (D * D * 1.4))
                const m = Math.min(d, magnet * 0.5) * f
                ox = (dx / d) * m
                oy = (dy / d) * m
            }
            const shade = clamp01(Math.max(ptr.hoverC * 0.6 * Math.min(1, hoverK), ptr.press))
            const fill = mix(L.buttonColor, adv.pressColor, shade)

            const cHover = overCentre && gooK > 0
            if (cHover) {
                const a = Math.atan2(ptr.y - (cy + oy), ptr.x - (cx + ox))
                if (!hoverOn[COUNT]) gooDir[COUNT] = a
                else {
                    let da = a - gooDir[COUNT]
                    da = Math.atan2(Math.sin(da), Math.cos(da))
                    gooDir[COUNT] += da * (1 - Math.exp(-dt * 16))
                }
            }
            hoverOn[COUNT] = cHover
            stepJelly(jelly[COUNT], cHover ? 1 : 0, dt, adv.gooeySpring)
            const cSwell = jelly[COUNT].v * (D / 2) * 0.3 * gooK
            const cGoo: Goo | null = Math.abs(cSwell) > 0.05 ? { phi: gooDir[COUNT], amp: cSwell } : null

            const cursor = overCentre || overSat ? "pointer" : "default"
            if (cursor !== lastCursor) {
                root.style.cursor = cursor
                lastCursor = cursor
            }

            ctx.save()
            ctx.translate(cx + ox, cy + oy)
            drawDisc(ctx, D / 2, fill, adv, dpr, cGoo)
            const g = st.g
            const len = ((D * adv.plusLength) / 100) * (1 + (adv.crossScale / 100 - 1) * g)
            const th = ((D * adv.plusWeight) / 100) * (1 - 0.1 * g)
            ctx.rotate((g * Math.PI) / 4)
            ctx.strokeStyle = mix(L.iconColor, adv.crossColor, g)
            ctx.lineWidth = th
            ctx.lineCap = "round"
            const half = Math.max(0, (len - th) / 2)
            ctx.beginPath()
            ctx.moveTo(-half, 0)
            ctx.lineTo(half, 0)
            ctx.moveTo(0, -half)
            ctx.lineTo(0, half)
            ctx.stroke()
            ctx.restore()

            // overlays
            if (adv.vignette > 0) {
                const vg = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.25, cx, cy, Math.hypot(W, H) / 2)
                vg.addColorStop(0, "rgba(0,0,0,0)")
                vg.addColorStop(1, `rgba(0,0,0,${(adv.vignette / 100) * 0.85})`)
                ctx.fillStyle = vg
                ctx.fillRect(0, 0, W, H)
            }
            if (adv.grain > 0) {
                if (!grainPattern) grainPattern = ctx.createPattern(noiseTile(), "repeat")
                if (grainPattern) {
                    ctx.save()
                    ctx.globalAlpha = (adv.grain / 100) * 0.3
                    ctx.translate(Math.random() * 128, Math.random() * 128)
                    ctx.fillStyle = grainPattern
                    ctx.fillRect(-128, -128, W + 256, H + 256)
                    ctx.restore()
                }
            }
        }
        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            IMG_LISTENERS.delete(onImg)
            root.removeEventListener("pointermove", onMove)
            root.removeEventListener("pointerenter", onMove)
            root.removeEventListener("pointerleave", onLeave)
            root.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
        }
    }, [])

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
                touchAction: "manipulation",
                userSelect: "none",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
            />
        </div>
    )
}

addPropertyControls(RadialActionMenu, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Stage colour behind the menu.",
    },
    buttonColor: {
        type: ControlType.Color,
        title: "Buttons",
        defaultValue: "#F5F5F5",
        description: "Fill of the centre toggle and the six action buttons.",
    },
    iconColor: {
        type: ControlType.Color,
        title: "Icons",
        defaultValue: "#000000",
        description: "Colour of the icons and of the + glyph.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 60,
        max: 400,
        step: 1,
        unit: "px",
        defaultValue: 186,
        description: "Diameter of the centre button; the whole menu scales with it.",
    },
    spread: {
        type: ControlType.Number,
        title: "Spread",
        min: 60,
        max: 220,
        step: 1,
        unit: "%",
        defaultValue: 114,
        description: "Ring radius as a share of the centre button's size.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "50 plays at the designed pace, 0 stops it.",
    },
    stagger: {
        type: ControlType.Number,
        title: "Stagger",
        min: 0,
        max: 200,
        step: 1,
        unit: "ms",
        defaultValue: 40,
        description: "Delay between buttons landing as the menu opens, clockwise from the top.",
    },
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: true,
        description: "Opens and closes by itself; a click on the centre takes over for a few seconds.",
    },
    images: {
        type: ControlType.Array,
        title: "Icons",
        maxCount: 6,
        control: { type: ControlType.ResponsiveImage },
        description: "Your own icons, clockwise from the top. Empty draws the built-in set; one upload goes on every button.",
    },
    tint: {
        type: ControlType.Boolean,
        title: "Tint",
        defaultValue: true,
        description: "Draw uploaded icons as silhouettes in the icon colour.",
    },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false, description: "Synthesized tick when the pointer touches a button and a pop or whoosh on the centre click." },
    soundVolume: { type: ControlType.Number, title: "Sound Volume", min: 0, max: 1, step: 0.05, defaultValue: 0.5, description: "Loudness of the sound effects." },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Strength of the pointer response; 0 turns it off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            satRatio: { type: ControlType.Number, title: "Button Ratio", min: 40, max: 150, step: 1, unit: "%", defaultValue: 91, description: "Action button size vs the centre button." },
            startAngle: { type: ControlType.Number, title: "Start Angle", min: -180, max: 180, step: 1, unit: "°", defaultValue: -90, description: "Angle of the first button." },
            flyOut: { type: ControlType.Number, title: "Fly Out", min: 100, max: 400, step: 1, unit: "%", defaultValue: 205, description: "Radius the buttons fly from and to, vs the centre size." },
            openMs: { type: ControlType.Number, title: "Open Time", min: 50, max: 2000, step: 10, unit: "ms", defaultValue: 300, description: "Each button's fly-in duration." },
            closeMs: { type: ControlType.Number, title: "Close Time", min: 30, max: 2000, step: 10, unit: "ms", defaultValue: 130, description: "Fly-out duration." },
            holdMs: { type: ControlType.Number, title: "Hold", min: 0, max: 5000, step: 10, unit: "ms", defaultValue: 900, description: "Time open in auto play." },
            restMs: { type: ControlType.Number, title: "Rest", min: 0, max: 5000, step: 10, unit: "ms", defaultValue: 740, description: "Time closed in auto play." },
            startDelayMs: { type: ControlType.Number, title: "Start Delay", min: 0, max: 5000, step: 10, unit: "ms", defaultValue: 400, description: "Wait before the first open." },
            pressLeadMs: { type: ControlType.Number, title: "Press Lead", min: 0, max: 1000, step: 10, unit: "ms", defaultValue: 250, description: "Centre darkens this long before an auto click." },
            openEase: { type: ControlType.Number, title: "Open Ease", min: 1, max: 6, step: 1, defaultValue: 3, description: "Ease-out strength of the fly-in." },
            closeEase: { type: ControlType.Number, title: "Close Ease", min: 1, max: 6, step: 1, defaultValue: 2, description: "Ease-out strength of the fly-out." },
            glyphMs: { type: ControlType.Number, title: "Glyph Turn", min: 30, max: 1000, step: 10, unit: "ms", defaultValue: 200, description: "Time for + to turn into ×." },
            blur: { type: ControlType.Number, title: "Blur", min: 0, max: 30, step: 1, unit: "%", defaultValue: 9, description: "Blur at the fly-out radius, % of a button." },
            fadeCurve: { type: ControlType.Number, title: "Fade Curve", min: 10, max: 300, step: 1, unit: "%", defaultValue: 60, description: "Opacity curve along the flight." },
            plusLength: { type: ControlType.Number, title: "Plus Length", min: 10, max: 70, step: 1, unit: "%", defaultValue: 31, description: "Plus size vs the centre button." },
            plusWeight: { type: ControlType.Number, title: "Plus Weight", min: 1, max: 20, step: 1, unit: "%", defaultValue: 6, description: "Plus stroke vs the centre button." },
            crossScale: { type: ControlType.Number, title: "Cross Scale", min: 40, max: 120, step: 1, unit: "%", defaultValue: 80, description: "× size vs the +." },
            crossColor: { type: ControlType.Color, title: "Cross", defaultValue: "#6A6A6A", description: "Colour of the × when open." },
            iconScale: { type: ControlType.Number, title: "Icon Scale", min: 20, max: 80, step: 1, unit: "%", defaultValue: 46, description: "Icon size vs its button." },
            rimColor: { type: ControlType.Color, title: "Rim", defaultValue: "#D2D2D2", description: "Hairline around every button." },
            edgeShade: { type: ControlType.Number, title: "Edge Shade", min: 0, max: 30, step: 1, unit: "%", defaultValue: 3, description: "Darkening toward each button's rim." },
            pressColor: { type: ControlType.Color, title: "Press", defaultValue: "#E2E2E2", description: "Centre fill when hovered or pressed." },
            shadowOpacity: { type: ControlType.Number, title: "Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 10, description: "Drop shadow opacity." },
            shadowBlur: { type: ControlType.Number, title: "Shadow Blur", min: 0, max: 50, step: 1, unit: "%", defaultValue: 12, description: "Shadow blur vs button size." },
            shadowY: { type: ControlType.Number, title: "Shadow Y", min: 0, max: 20, step: 1, unit: "%", defaultValue: 4, description: "Shadow drop vs button size." },
            magnet: { type: ControlType.Number, title: "Magnet", min: 0, max: 60, step: 1, unit: "px", defaultValue: 14, description: "How far buttons lean toward the pointer." },
            gooey: { type: ControlType.Number, title: "Gooey", min: 0, max: 100, step: 1, unit: "%", defaultValue: 60, description: "How far a button swells toward the pointer like a drop of liquid. 0 turns it off." },
            gooeySpring: { type: ControlType.Number, title: "Gooey Wobble", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Bounciness of the swell. Higher snaps faster and wobbles more." },
            resumeMs: { type: ControlType.Number, title: "Resume", min: 0, max: 20000, step: 100, unit: "ms", defaultValue: 4000, description: "Auto play resumes this long after a click." },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening." },
        },
    },
})

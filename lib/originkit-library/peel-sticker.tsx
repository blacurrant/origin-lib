import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/**
 * Peel Sticker — any PNG or SVG turned into a die-cut vinyl sticker.
 * Drag an edge to peel it back over a rolled crease (the printed liner shows
 * on the flap), let go and it springs flat. The pointer sweeps a holographic
 * fringe along the white border. With no pointer it peels itself from a
 * different edge every cycle.
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
    markColor: "#000000",
    borderColor: "#FFFFFF",
    backColor: "#D6D6D9",
    backTextColor: "#9A9A9D",
    backTextSize: 13,
    backTextAngle: -30,
    shadowColor: "#000000",
    shadowBlur: 24,
    shadowOffset: 8,
    shadowOpacity: 30,
    liftBlur: 48,
    liftOffset: 18,
    liftScale: 2,
    settleMs: 180,
    creaseWidth: 18,
    creaseLight: 75,
    creaseShade: 30,
    flapShadowBlur: 18,
    flapShadowOpacity: 40,
    rimWidth: 4,
    shineReach: 170,
    shineBands: 2,
    sheen: 8,
    peelMs: 1000,
    holdMs: 250,
    restMs: 1300,
    peelDepth: 80,
    dragFollow: 35,
    captionColor: "#7A7A7E",
    captionSize: 13,
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


const DEFAULT_IMAGE = {"src":"/blocks/dolphin-sticker.png","alt":""}

const X_PATH =
    "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
const X_BOX = { x: 1.254, y: 2.25, w: 21.556, h: 19.5 }

// Demo peels: drag direction (deg, y down) and share of the sticker's extent
const DEMO_STEPS = [
    { a: 33, d: 1 },
    { a: 78, d: 0.62 },
    { a: 215, d: 0.8 },
    { a: 300, d: 0.55 },
]

const RAINBOW = ["#FF4D5E", "#FFB830", "#F4F06A", "#5CF0E6", "#5B8CFF", "#C86BFF"]

// ── helpers ──

function srcOf(v: any): string {
    if (!v) return ""
    if (typeof v === "string") return v
    return typeof v.src === "string" ? v.src : ""
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function bezier(x1: number, y1: number, x2: number, y2: number) {
    const b = (t: number, a: number, c: number) =>
        3 * a * t * (1 - t) * (1 - t) + 3 * c * t * t * (1 - t) + t * t * t
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let lo = 0
        let hi = 1
        let t = x
        for (let i = 0; i < 24; i++) {
            t = (lo + hi) / 2
            if (b(t, x1, x2) < x) lo = t
            else hi = t
        }
        return b(t, y1, y2)
    }
}
const peelEase = bezier(0.65, 0, 0.35, 1)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)

function parseRGB(c: string): [number, number, number] {
    if (typeof c !== "string") return [0, 0, 0]
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
        if (isNaN(n)) return [0, 0, 0]
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const m = s.match(/[\d.]+/g)
    if (m && m.length >= 3) return [+m[0], +m[1], +m[2]]
    return [0, 0, 0]
}
function rgba(c: string, a: number) {
    const [r, g, b] = parseRGB(c)
    return `rgba(${r},${g},${b},${clamp01(a)})`
}

function makeCanvas(w: number, h: number) {
    const c = document.createElement("canvas")
    c.width = Math.max(1, Math.ceil(w))
    c.height = Math.max(1, Math.ceil(h))
    return c
}
function ctx2d(c: HTMLCanvasElement, read = false) {
    return c.getContext("2d", read ? { willReadFrequently: true } : undefined) as CanvasRenderingContext2D
}

function tinted(src: HTMLCanvasElement, color: string) {
    const c = makeCanvas(src.width, src.height)
    const g = ctx2d(c)
    g.drawImage(src, 0, 0)
    g.globalCompositeOperation = "source-in"
    g.fillStyle = color
    g.fillRect(0, 0, c.width, c.height)
    return c
}

// Minkowski dilation by stamping in small steps: rounded outer corners.
function dilate(src: HTMLCanvasElement, r: number) {
    let cur = src
    let done = 0
    while (done < r - 0.01) {
        const d = Math.min(5, r - done)
        const nx = makeCanvas(src.width, src.height)
        const g = ctx2d(nx)
        g.drawImage(cur, 0, 0)
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2
            g.drawImage(cur, Math.cos(a) * d, Math.sin(a) * d)
        }
        cur = nx
        done += d
    }
    return cur
}

function shadowOf(sil: HTMLCanvasElement, blur: number, color: string, pad: number) {
    const c = makeCanvas(sil.width + pad * 2, sil.height + pad * 2)
    const g = ctx2d(c)
    const shift = c.width + 200
    g.shadowColor = color
    g.shadowBlur = blur
    g.shadowOffsetX = shift
    g.drawImage(sil, pad - shift, pad)
    return c
}

function drawArt(g: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, mark: string) {
    if (img) {
        g.drawImage(img, x, y, w, h)
        return
    }
    g.save()
    g.translate(x, y)
    g.scale(w / X_BOX.w, h / X_BOX.h)
    g.translate(-X_BOX.x, -X_BOX.y)
    g.fillStyle = mark
    g.fill(new Path2D(X_PATH), "evenodd")
    g.restore()
}

type Baked = {
    w: number
    h: number
    s: number
    pad: number
    front: HTMLCanvasElement
    back: HTMLCanvasElement
    sil: HTMLCanvasElement
    rim: HTMLCanvasElement
    shadowRest: HTMLCanvasElement
    shadowLift: HTMLCanvasElement
    edges: Float32Array
    mask: Uint8Array | null
    mw: number
    mh: number
    cx: number
    cy: number
}

function bake(img: HTMLImageElement | null, aspect: number, size: number, B: number, dpr: number, text: string, adv: typeof ADVANCED_DEFAULTS): Baked {
    const artW = aspect >= 1 ? size : size * aspect
    const artH = aspect >= 1 ? size / aspect : size
    const w = artW + 2 * B
    const h = artH + 2 * B
    let s = dpr
    if (Math.max(w, h) * s > 2600) s = 2600 / Math.max(w, h)
    const W = Math.ceil(w * s)
    const H = Math.ceil(h * s)

    const art = makeCanvas(W, H)
    drawArt(ctx2d(art), img, B * s, B * s, artW * s, artH * s, adv.markColor)

    const rimR = Math.max(0, B - Math.max(0, adv.rimWidth)) * s
    const inner = dilate(art, rimR)
    const outer = dilate(inner, B * s - rimR)
    const sil = tinted(outer, adv.borderColor)

    const rim = makeCanvas(W, H)
    const rg = ctx2d(rim)
    rg.drawImage(sil, 0, 0)
    rg.globalCompositeOperation = "destination-out"
    rg.drawImage(tinted(inner, "#000"), 0, 0)

    const front = makeCanvas(W, H)
    const fg = ctx2d(front)
    fg.drawImage(sil, 0, 0)
    fg.drawImage(art, 0, 0)

    const back = makeCanvas(W, H)
    const bg = ctx2d(back)
    bg.drawImage(sil, 0, 0)
    bg.globalCompositeOperation = "source-in"
    bg.fillStyle = adv.backColor
    bg.fillRect(0, 0, W, H)
    bg.globalCompositeOperation = "source-atop"
    const lg = bg.createLinearGradient(0, 0, W, H)
    lg.addColorStop(0, "rgba(255,255,255,0.22)")
    lg.addColorStop(0.5, "rgba(255,255,255,0)")
    lg.addColorStop(1, "rgba(0,0,0,0.08)")
    bg.fillStyle = lg
    bg.fillRect(0, 0, W, H)
    if (text && text.trim()) {
        const fs = Math.max(4, adv.backTextSize * s)
        bg.save()
        bg.translate(W / 2, H / 2)
        bg.rotate((adv.backTextAngle * Math.PI) / 180)
        bg.scale(-1, 1) // printed to be read through the flip
        bg.font = `500 ${fs}px Inter, "Helvetica Neue", Arial, sans-serif`
        bg.fillStyle = adv.backTextColor
        bg.textBaseline = "middle"
        const tw = bg.measureText(text).width + fs * 1.8
        const rowH = fs * 2.4
        const R = Math.hypot(W, H) / 2 + tw
        let row = 0
        for (let y = -R; y <= R; y += rowH, row++) {
            for (let x = -R + (row % 2) * tw * 0.5; x <= R; x += tw) bg.fillText(text, x, y)
        }
        bg.restore()
    }

    const pad = Math.ceil((Math.max(adv.shadowBlur, adv.liftBlur) * 1.5 + Math.max(adv.shadowOffset, adv.liftOffset) + 6) * s)
    const shadowRest = shadowOf(sil, Math.max(0, adv.shadowBlur) * s, adv.shadowColor, pad)
    const shadowLift = shadowOf(sil, Math.max(0, adv.liftBlur) * s, adv.shadowColor, pad)

    // Alpha map for edges, grabbing and centroid
    const q = Math.min(1, 200 / Math.max(w, h))
    const mw = Math.max(4, Math.round(w * q))
    const mh = Math.max(4, Math.round(h * q))
    let mask: Uint8Array | null = null
    try {
        const sm = makeCanvas(mw, mh)
        const sg = ctx2d(sm, true)
        sg.drawImage(sil, 0, 0, mw, mh)
        const d = sg.getImageData(0, 0, mw, mh).data
        mask = new Uint8Array(mw * mh)
        for (let i = 0; i < mw * mh; i++) mask[i] = d[i * 4 + 3] > 110 ? 1 : 0
    } catch (e) {
        mask = null // tainted (picture without CORS): fall back to the box
    }
    const pts: number[] = []
    let sx = 0
    let sy = 0
    let cnt = 0
    if (mask) {
        for (let y = 0; y < mh; y++) {
            for (let x = 0; x < mw; x++) {
                if (!mask[y * mw + x]) continue
                cnt++
                sx += x
                sy += y
                const edge =
                    x === 0 || y === 0 || x === mw - 1 || y === mh - 1 ||
                    !mask[y * mw + x - 1] || !mask[y * mw + x + 1] ||
                    !mask[(y - 1) * mw + x] || !mask[(y + 1) * mw + x]
                if (edge) pts.push(((x + 0.5) / mw) * w, ((y + 0.5) / mh) * h)
            }
        }
    }
    if (pts.length === 0) {
        mask = null
        const st = 6
        for (let x = 0; x <= w; x += st) pts.push(x, 0, x, h)
        for (let y = st; y < h; y += st) pts.push(0, y, w, y)
    }
    return {
        w, h, s, pad, front, back, sil, rim, shadowRest, shadowLift,
        edges: new Float32Array(pts), mask, mw, mh,
        cx: cnt ? ((sx / cnt + 0.5) / mw) * w : w / 2,
        cy: cnt ? ((sy / cnt + 0.5) / mh) * h : h / 2,
    }
}

function nearestEdge(b: Baked, x: number, y: number) {
    const e = b.edges
    let best = Infinity
    let bx = 0
    let by = 0
    for (let i = 0; i < e.length; i += 2) {
        const dx = e[i] - x
        const dy = e[i + 1] - y
        const d = dx * dx + dy * dy
        if (d < best) {
            best = d
            bx = e[i]
            by = e[i + 1]
        }
    }
    return { x: bx, y: by, d: Math.sqrt(best) }
}

function extreme(b: Baked, ux: number, uy: number) {
    const e = b.edges
    let mn = Infinity
    let mx = -Infinity
    let px = 0
    let py = 0
    for (let i = 0; i < e.length; i += 2) {
        const d = e[i] * ux + e[i + 1] * uy
        if (d < mn) {
            mn = d
            px = e[i]
            py = e[i + 1]
        }
        if (d > mx) mx = d
    }
    return { x: px, y: py, range: Math.max(1, mx - mn) }
}

function insideAt(b: Baked, x: number, y: number) {
    if (x < 0 || y < 0 || x > b.w || y > b.h) return false
    if (!b.mask) return true
    const ix = Math.min(b.mw - 1, Math.floor((x / b.w) * b.mw))
    const iy = Math.min(b.mh - 1, Math.floor((y / b.h) * b.mh))
    return b.mask[iy * b.mw + ix] === 1
}

type Pic = { img: HTMLImageElement; state: "loading" | "ok" | "fail" }
const PICS = new Map<string, Pic>()
function picture(src: string): Pic {
    let p = PICS.get(src)
    if (p) return p
    const img = new Image()
    img.decoding = "async"
    const entry: Pic = { img, state: "loading" }
    img.onload = () => (entry.state = "ok")
    img.onerror = () => (entry.state = "fail")
    img.src = src
    PICS.set(src, entry)
    return entry
}

function makeNoise() {
    const c = makeCanvas(128, 128)
    const g = ctx2d(c)
    const d = g.createImageData(128, 128)
    for (let i = 0; i < d.data.length; i += 4) {
        const v = Math.random() * 255
        d.data[i] = v
        d.data[i + 1] = v
        d.data[i + 2] = v
        d.data[i + 3] = 255
    }
    g.putImageData(d, 0, 0)
    return c
}

function clipHalf(g: CanvasRenderingContext2D, mx: number, my: number, nx: number, ny: number) {
    const px = -ny
    const py = nx
    const L = 10000
    g.beginPath()
    g.moveTo(mx + px * L, my + py * L)
    g.lineTo(mx - px * L, my - py * L)
    g.lineTo(mx - px * L + nx * L, my - py * L + ny * L)
    g.lineTo(mx + px * L + nx * L, my + py * L + ny * L)
    g.closePath()
    g.clip()
}

export default function PeelSticker(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        image = DEFAULT_IMAGE,
        size = 560,
        border = 24,
        shine = 60,
        speed = 67,
        damping = 50,
        autoPeel = true,
        backText = "blocks",
        caption = "Drag an edge to peel · move over it for the shine",
        sound = false,
        soundVolume = 0.5,
        style,
    } = props

    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const liveRef = useRef<any>(null)
    liveRef.current = {
        background, src: srcOf(image), size, border, shine, speed, damping,
        autoPeel, backText, caption, sound, soundVolume, advanced: props.advanced,
    }

    useEffect(() => {
        const root = rootRef.current
        const cvs = canvasRef.current
        if (!root || !cvs) return
        const ctx = cvs.getContext("2d")
        if (!ctx) return
        const flap = document.createElement("canvas")
        const fctx = ctx2d(flap)
        const fx = document.createElement("canvas")
        const xctx = ctx2d(fx)
        const noise = makeNoise()
        let grainPat: CanvasPattern | null = null
        const isStatic = RenderTarget.current() === RenderTarget.thumbnail
        const reduced =
            typeof window !== "undefined" && !!window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches

        const st: any = {
            b: null as Baked | null, key: "", picKey: "", liftStart: 0, last: 0,
            px: 0, py: 0, over: false, overAmt: 0, drag: false,
            pressX: 0, pressY: 0, off0X: 0, off0Y: 0,
            gx: 0, gy: 0, offX: 0, offY: 0, vx: 0, vy: 0,
            ox: 0, oy: 0, k: 1,
            shineAmt: 0, shx: 0, shy: 0, va: -2.3,
            demo: { phase: "rest", t: ADVANCED_DEFAULTS.restMs - 400, idx: -1, dx: 1, dy: 0, len: 0 },
        }

                let W = 0
        let H = 0
        let dpr = 1
        const resize = () => {
            W = root.offsetWidth
            H = root.offsetHeight
            dpr = Math.min(2, window.devicePixelRatio || 1)
            const cw = Math.max(1, Math.round(W * dpr))
            const ch = Math.max(1, Math.round(H * dpr))
            if (cvs.width !== cw || cvs.height !== ch) {
                cvs.width = cw
                cvs.height = ch
            }
            if (flap.width !== cw || flap.height !== ch) {
                flap.width = cw
                flap.height = ch
            }
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(root)

        const onMove = (e: PointerEvent) => {
            st.px = e.offsetX
            st.py = e.offsetY
            st.over = true
        }
        const onLeave = () => {
            if (!st.drag) st.over = false
        }
        const onDown = (e: PointerEvent) => {
            st.px = e.offsetX
            st.py = e.offsetY
            st.over = true
            const b: Baked | null = st.b
            if (!b) return
            const lx = (e.offsetX - st.ox) / st.k
            const ly = (e.offsetY - st.oy) / st.k
            const L = Math.hypot(st.offX, st.offY)
            const nearTip = L > 2 && Math.hypot(lx - (st.gx + st.offX), ly - (st.gy + st.offY)) < 60
            const near = nearestEdge(b, lx, ly)
            if (!nearTip && !insideAt(b, lx, ly) && near.d > 40) return
            if (!nearTip && L < 3) {
                st.gx = near.x
                st.gy = near.y
            }
            st.drag = true
            st.pressX = lx
            st.pressY = ly
            st.off0X = st.offX
            st.off0Y = st.offY
            cvs.style.cursor = "grabbing"
            const lv = liveRef.current
            if (lv.sound) playCue("tick", lv.soundVolume, 80)
            try {
                cvs.setPointerCapture(e.pointerId)
            } catch (err) {}
            e.preventDefault()
        }
        const onUp = () => {
            if (!st.drag) return
            st.drag = false
            cvs.style.cursor = "grab"
            const lv = liveRef.current
            if (lv.sound && Math.hypot(st.offX, st.offY) > 8) playCue("pop", lv.soundVolume, 120)
        }
        cvs.addEventListener("pointermove", onMove)
        cvs.addEventListener("pointerenter", onMove)
        cvs.addEventListener("pointerleave", onLeave)
        cvs.addEventListener("pointerdown", onDown)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        let raf = 0
        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = st.last ? Math.min((now - st.last) / 1000, 0.05) : 0
            st.last = now
            if (W < 2 || H < 2) return
            const p = liveRef.current
            const adv = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }

            // ── picture + bake ──
            const pic = p.src ? picture(p.src) : null
            const img = pic && pic.state === "ok" ? pic.img : null
            const picKey = img ? p.src : "builtin"
            if (picKey !== st.picKey) {
                st.picKey = picKey
                st.liftStart = now
            }
            const key = [
                picKey, p.size, p.border, p.backText, dpr, adv.markColor, adv.borderColor,
                adv.backColor, adv.backTextColor, adv.backTextSize, adv.backTextAngle,
                adv.shadowColor, adv.shadowBlur, adv.shadowOffset, adv.liftBlur, adv.liftOffset, adv.rimWidth,
            ].join("|")
            if (key !== st.key) {
                st.key = key
                const aspect = img
                    ? img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
                    : X_BOX.w / X_BOX.h
                const prev: Baked | null = st.b
                st.b = bake(img, aspect, Math.max(40, p.size), Math.max(0, p.border), dpr, p.backText, adv)
                fx.width = st.b.front.width
                fx.height = st.b.front.height
                if (!prev || prev.w !== st.b.w || prev.h !== st.b.h) {
                    st.offX = st.offY = st.vx = st.vy = 0
                    st.gx = st.b.cx
                    st.gy = st.b.cy
                    if (prev) {
                        st.demo.phase = "rest"
                        st.demo.t = 0
                    }
                }
            }
            const b: Baked = st.b

            // ── layout ──
            const lift = adv.settleMs > 0 ? 1 - easeOutCubic((now - st.liftStart) / adv.settleMs) : 0
            const capSpace = p.caption ? adv.captionSize + 26 : 0
            const fit = Math.min(1, (W * 0.92) / b.w, ((H - capSpace) * 0.9) / b.h)
            const k = fit * (1 + (adv.liftScale / 100) * lift)
            const ox = W / 2 - (b.w * k) / 2
            const oy = (H - capSpace) / 2 - (b.h * k) / 2
            st.ox = ox
            st.oy = oy
            st.k = k
            const plx = (st.px - ox) / k
            const ply = (st.py - oy) / k

            // ── fold target ──
            const hk = Math.max(0, adv.hover) / 50
            st.overAmt += ((st.over ? 1 : 0) - st.overAmt) * (1 - Math.exp(-dt / 0.07))
            const sp = Math.max(0, p.speed) / 50
            const releaseW = 4 + Math.max(0, p.damping) * 0.16
            const hoverActive = st.over && hk > 0 && !st.drag
            const demo = st.demo
            const L0 = Math.hypot(st.offX, st.offY)
            let tx = 0
            let ty = 0
            let omega = releaseW
            const frozen = isStatic || reduced

            if (frozen) {
                const u = Math.SQRT1_2
                const ex = extreme(b, u, u)
                st.gx = ex.x
                st.gy = ex.y
                st.offX = u * ex.range * 0.12
                st.offY = u * ex.range * 0.12
                st.vx = st.vy = 0
            } else if (st.drag) {
                tx = st.off0X + plx - st.pressX
                ty = st.off0Y + ply - st.pressY
                omega = Math.max(4, adv.dragFollow)
                demo.phase = "rest"
                demo.t = 0
            } else if (hoverActive) {
                // pointer over: the sticker lies flat (shine only) so an edge can be grabbed
                demo.phase = "rest"
                demo.t = 0
            } else if (p.autoPeel && sp > 0) {
                demo.t += dt * 1000 * sp
                if (demo.phase === "rest" && demo.t >= adv.restMs && L0 < 1.5) {
                    demo.idx = (demo.idx + 1) % DEMO_STEPS.length
                    const step = DEMO_STEPS[demo.idx]
                    const a = (step.a * Math.PI) / 180
                    demo.dx = Math.cos(a)
                    demo.dy = Math.sin(a)
                    const ex = extreme(b, demo.dx, demo.dy)
                    st.gx = ex.x
                    st.gy = ex.y
                    demo.len = ex.range * step.d * (adv.peelDepth / 100)
                    demo.phase = "peel"
                    demo.t = 0
                }
                if (demo.phase === "peel") {
                    const u = adv.peelMs > 0 ? clamp01(demo.t / adv.peelMs) : 1
                    const e = peelEase(u)
                    tx = demo.dx * demo.len * e
                    ty = demo.dy * demo.len * e
                    omega = 30
                    if (u >= 1) {
                        demo.phase = "hold"
                        demo.t = 0
                    }
                } else if (demo.phase === "hold") {
                    tx = demo.dx * demo.len
                    ty = demo.dy * demo.len
                    omega = 30
                    if (demo.t >= adv.holdMs) {
                        demo.phase = "release"
                        demo.t = 0
                    }
                } else if (demo.phase === "release") {
                    if (L0 < 1 && Math.hypot(st.vx, st.vy) < 20) {
                        demo.phase = "rest"
                        demo.t = 0
                    }
                }
            }

            if (!frozen) {
                let rem = dt
                while (rem > 1e-6) {
                    const h = Math.min(rem, 1 / 240)
                    const ax = omega * omega * (tx - st.offX) - 2 * omega * st.vx
                    const ay = omega * omega * (ty - st.offY) - 2 * omega * st.vy
                    st.vx += ax * h
                    st.vy += ay * h
                    st.offX += st.vx * h
                    st.offY += st.vy * h
                    rem -= h
                }
            }

            // ── shine target ──
            let shT = 0
            let spx = st.shx
            let spy = st.shy
            if (!frozen && st.over && hk > 0) {
                shT = Math.min(1.5, hk)
                spx = plx
                spy = ply
            } else if (!frozen && p.autoPeel && sp > 0 && demo.phase === "rest") {
                st.va += dt * sp * 1.4
                shT = 0.8
                spx = b.cx + Math.cos(st.va) * b.w * 0.55
                spy = b.cy + Math.sin(st.va) * b.h * 0.55
            }
            st.shineAmt += (shT - st.shineAmt) * (1 - Math.exp(-dt / 0.08))
            const pe = 1 - Math.exp(-dt / 0.05)
            st.shx += (spx - st.shx) * pe
            st.shy += (spy - st.shy) * pe

            // ── draw ──
            const cw = cvs.width
            const ch = cvs.height
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.globalAlpha = 1
            ctx.globalCompositeOperation = "source-over"
            ctx.shadowColor = "rgba(0,0,0,0)"
            ctx.clearRect(0, 0, cw, ch)
            ctx.fillStyle = p.background
            ctx.fillRect(0, 0, cw, ch)

            const L = Math.hypot(st.offX, st.offY)
            const active = L > 0.5
            const nx = active ? st.offX / L : 1
            const ny = active ? st.offY / L : 0
            const mx = st.gx + st.offX / 2
            const my = st.gy + st.offY / 2

            ctx.save()
            ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy)
            if (active) clipHalf(ctx, mx, my, nx, ny)
            const padC = b.pad / b.s
            const shOp = adv.shadowOpacity / 100
            ctx.globalAlpha = clamp01(shOp * (1 - lift))
            ctx.drawImage(b.shadowRest, -padC + adv.shadowOffset * 0.3, -padC + adv.shadowOffset, b.w + 2 * padC, b.h + 2 * padC)
            if (lift > 0) {
                ctx.globalAlpha = clamp01(shOp * lift * 1.1)
                ctx.drawImage(b.shadowLift, -padC + adv.liftOffset * 0.3, -padC + adv.liftOffset, b.w + 2 * padC, b.h + 2 * padC)
            }
            ctx.globalAlpha = 1
            ctx.drawImage(b.front, 0, 0, b.w, b.h)

            // sheen band across the vinyl
            const S = b.s
            if (adv.sheen > 0) {
                xctx.setTransform(1, 0, 0, 1, 0, 0)
                xctx.globalCompositeOperation = "source-over"
                xctx.clearRect(0, 0, fx.width, fx.height)
                xctx.drawImage(b.sil, 0, 0)
                xctx.globalCompositeOperation = "source-in"
                const t = 0.42 + ((st.shx / b.w) - 0.5) * 0.35 * clamp01(st.shineAmt)
                const gr = xctx.createLinearGradient(fx.width, 0, 0, fx.height)
                gr.addColorStop(clamp01(t - 0.14), "rgba(255,255,255,0)")
                gr.addColorStop(clamp01(t), `rgba(255,255,255,${clamp01(adv.sheen / 100)})`)
                gr.addColorStop(clamp01(t + 0.14), "rgba(255,255,255,0)")
                xctx.fillStyle = gr
                xctx.fillRect(0, 0, fx.width, fx.height)
                ctx.drawImage(fx, 0, 0, b.w, b.h)
            }

            // holographic fringe on the border near the pointer
            const shineA = (Math.max(0, p.shine) / 100) * st.shineAmt
            if (shineA > 0.01 && adv.rimWidth > 0) {
                xctx.setTransform(1, 0, 0, 1, 0, 0)
                xctx.globalCompositeOperation = "source-over"
                xctx.clearRect(0, 0, fx.width, fx.height)
                xctx.drawImage(b.rim, 0, 0)
                xctx.globalCompositeOperation = "source-in"
                const sx = st.shx * S
                const sy = st.shy * S
                const bands = Math.max(1, Math.round(adv.shineBands))
                const anyX = xctx as any
                let grad: CanvasGradient
                if (typeof anyX.createConicGradient === "function") {
                    grad = anyX.createConicGradient(now * 0.0004, sx, sy)
                } else {
                    grad = xctx.createLinearGradient(0, 0, fx.width, fx.height)
                }
                const n = RAINBOW.length * bands
                for (let i = 0; i <= n; i++) grad.addColorStop(i / n, RAINBOW[i % RAINBOW.length])
                xctx.fillStyle = grad
                xctx.fillRect(0, 0, fx.width, fx.height)
                xctx.globalCompositeOperation = "destination-in"
                const rr = Math.max(1, adv.shineReach * S)
                const rad = xctx.createRadialGradient(sx, sy, 0, sx, sy, rr)
                rad.addColorStop(0, "rgba(0,0,0,1)")
                rad.addColorStop(0.5, "rgba(0,0,0,0.6)")
                rad.addColorStop(1, "rgba(0,0,0,0)")
                xctx.fillStyle = rad
                xctx.fillRect(0, 0, fx.width, fx.height)
                ctx.globalAlpha = clamp01(shineA)
                ctx.drawImage(fx, 0, 0, b.w, b.h)
                ctx.globalAlpha = 1
            }
            ctx.restore()

            // the peeled flap: liner side, mirrored across the fold line
            if (active) {
                fctx.setTransform(1, 0, 0, 1, 0, 0)
                fctx.globalCompositeOperation = "source-over"
                fctx.clearRect(0, 0, flap.width, flap.height)
                fctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy)
                fctx.save()
                clipHalf(fctx, mx, my, nx, ny)
                const km = mx * nx + my * ny
                fctx.transform(1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, 2 * km * nx, 2 * km * ny)
                fctx.drawImage(b.back, 0, 0, b.w, b.h)
                fctx.restore()
                fctx.globalCompositeOperation = "source-atop"
                const cwid = Math.max(1, adv.creaseWidth)
                const cg = fctx.createLinearGradient(mx, my, mx + nx * cwid, my + ny * cwid)
                const light = clamp01(adv.creaseLight / 100)
                cg.addColorStop(0, `rgba(60,60,66,${clamp01(adv.creaseShade / 100)})`)
                cg.addColorStop(0.2, `rgba(255,255,255,${light})`)
                cg.addColorStop(0.6, `rgba(255,255,255,${light * 0.2})`)
                cg.addColorStop(1, "rgba(255,255,255,0)")
                fctx.fillStyle = cg
                fctx.fillRect(-1e4, -1e4, 2e4, 2e4)
                const reach = Math.max(cwid + 1, L * 0.5)
                const tg = fctx.createLinearGradient(mx, my, mx + nx * reach, my + ny * reach)
                tg.addColorStop(0, "rgba(0,0,0,0)")
                tg.addColorStop(1, "rgba(0,0,0,0.07)")
                fctx.fillStyle = tg
                fctx.fillRect(-1e4, -1e4, 2e4, 2e4)

                ctx.save()
                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.shadowColor = rgba(adv.shadowColor, adv.flapShadowOpacity / 100)
                ctx.shadowBlur = Math.max(0, adv.flapShadowBlur) * dpr * k
                ctx.shadowOffsetX = nx * 3 * dpr * k
                ctx.shadowOffsetY = (ny * 3 + 4) * dpr * k
                ctx.drawImage(flap, 0, 0)
                ctx.restore()
            }

            // caption
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            if (p.caption) {
                ctx.font = `400 ${Math.max(6, adv.captionSize)}px Inter, "Helvetica Neue", Arial, sans-serif`
                ctx.fillStyle = adv.captionColor
                ctx.textAlign = "center"
                ctx.textBaseline = "alphabetic"
                ctx.fillText(p.caption, W / 2, H - 16)
            }

            // grain + vignette
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            if (adv.grain > 0) {
                if (!grainPat) grainPat = ctx.createPattern(noise, "repeat")
                if (grainPat) {
                    ctx.save()
                    ctx.globalAlpha = clamp01(adv.grain / 100) * 0.18
                    ctx.translate(Math.floor(Math.random() * 128), Math.floor(Math.random() * 128))
                    ctx.fillStyle = grainPat
                    ctx.fillRect(-128, -128, cw + 256, ch + 256)
                    ctx.restore()
                }
            }
            if (adv.vignette > 0) {
                const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.hypot(cw, ch) / 2)
                vg.addColorStop(0, "rgba(0,0,0,0)")
                vg.addColorStop(1, `rgba(0,0,0,${clamp01(adv.vignette / 100) * 0.85})`)
                ctx.fillStyle = vg
                ctx.fillRect(0, 0, cw, ch)
            }
        }
        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            cvs.removeEventListener("pointermove", onMove)
            cvs.removeEventListener("pointerenter", onMove)
            cvs.removeEventListener("pointerleave", onLeave)
            cvs.removeEventListener("pointerdown", onDown)
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
                overflow: "hidden",
                background,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                    touchAction: "none",
                    cursor: "grab",
                }}
            />
        </div>
    )
}

addPropertyControls(PeelSticker, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Surface the sticker lies on.",
    },
    backText: {
        type: ControlType.String,
        title: "Back Text",
        defaultValue: "blocks",
        description: "Printed on the liner, seen on the peeled flap.",
    },
    caption: {
        type: ControlType.String,
        title: "Caption",
        defaultValue: "Drag an edge to peel · move over it for the shine",
        description: "Hint line under the sticker. Empty hides it.",
    },
    image: {
        defaultValue: DEFAULT_IMAGE,
        type: ControlType.ResponsiveImage,
        title: "Image",
        description: "Your PNG or SVG (transparent background). Empty draws the built-in X mark.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 120,
        max: 1200,
        step: 1,
        unit: "px",
        defaultValue: 560,
        description: "Long edge of the artwork, before the border.",
    },
    border: {
        type: ControlType.Number,
        title: "Border",
        min: 0,
        max: 60,
        step: 1,
        unit: "px",
        defaultValue: 24,
        description: "Width of the white die-cut margin around the picture.",
    },
    shine: {
        type: ControlType.Number,
        title: "Shine",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 60,
        description: "Strength of the holographic fringe on the edge.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 67,
        description: "Pace of the automatic peel. 0 stops it.",
    },
    damping: {
        type: ControlType.Number,
        title: "Damping",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "How fast the flap springs back flat. Higher settles faster.",
    },
    autoPeel: {
        type: ControlType.Boolean,
        title: "Auto Peel",
        defaultValue: true,
        description: "Peel itself from a different edge when nobody is dragging.",
    },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false, description: "Synthesized tick on grabbing an edge and a pop when it lets go." },
    soundVolume: { type: ControlType.Number, title: "Sound Volume", min: 0, max: 1, step: 0.05, defaultValue: 0.5, description: "Loudness of the sound effects." },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Pointer response strength. 0 turns it off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Darkened edges." },
            markColor: { type: ControlType.Color, title: "Mark", defaultValue: "#000000", description: "Colour of the built-in X." },
            borderColor: { type: ControlType.Color, title: "Border Color", defaultValue: "#FFFFFF", description: "Die-cut margin colour." },
            backColor: { type: ControlType.Color, title: "Liner", defaultValue: "#D6D6D9", description: "Back side of the sticker." },
            backTextColor: { type: ControlType.Color, title: "Liner Text", defaultValue: "#9A9A9D", description: "Print on the back." },
            backTextSize: { type: ControlType.Number, title: "Liner Text Size", min: 6, max: 40, step: 1, unit: "px", defaultValue: 13, description: "Print size on the back." },
            backTextAngle: { type: ControlType.Number, title: "Liner Angle", min: -90, max: 90, step: 1, unit: "°", defaultValue: -30, description: "Angle of the printed rows." },
            shadowColor: { type: ControlType.Color, title: "Shadow", defaultValue: "#000000", description: "Drop shadow colour." },
            shadowBlur: { type: ControlType.Number, title: "Shadow Blur", min: 0, max: 80, step: 1, unit: "px", defaultValue: 24, description: "Resting shadow blur." },
            shadowOffset: { type: ControlType.Number, title: "Shadow Offset", min: 0, max: 40, step: 1, unit: "px", defaultValue: 8, description: "Resting shadow drop." },
            shadowOpacity: { type: ControlType.Number, title: "Shadow Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30, description: "Shadow strength." },
            liftBlur: { type: ControlType.Number, title: "Lift Blur", min: 0, max: 100, step: 1, unit: "px", defaultValue: 48, description: "Shadow blur when a new picture lands." },
            liftOffset: { type: ControlType.Number, title: "Lift Offset", min: 0, max: 60, step: 1, unit: "px", defaultValue: 18, description: "Shadow drop when a new picture lands." },
            liftScale: { type: ControlType.Number, title: "Lift Scale", min: 0, max: 10, step: 1, unit: "%", defaultValue: 2, description: "Extra size when a new picture lands." },
            settleMs: { type: ControlType.Number, title: "Settle", min: 0, max: 1000, step: 10, unit: "ms", defaultValue: 180, description: "Time to land a new picture." },
            creaseWidth: { type: ControlType.Number, title: "Crease Width", min: 2, max: 60, step: 1, unit: "px", defaultValue: 18, description: "Width of the rolled fold." },
            creaseLight: { type: ControlType.Number, title: "Crease Light", min: 0, max: 100, step: 1, unit: "%", defaultValue: 75, description: "Highlight on the roll." },
            creaseShade: { type: ControlType.Number, title: "Crease Shade", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30, description: "Dark edge at the fold." },
            flapShadowBlur: { type: ControlType.Number, title: "Flap Shadow", min: 0, max: 60, step: 1, unit: "px", defaultValue: 18, description: "Blur of the flap's cast shadow." },
            flapShadowOpacity: { type: ControlType.Number, title: "Flap Shadow Op.", min: 0, max: 100, step: 1, unit: "%", defaultValue: 40, description: "Strength of the flap's cast shadow." },
            rimWidth: { type: ControlType.Number, title: "Shine Width", min: 0, max: 20, step: 1, unit: "px", defaultValue: 4, description: "Width of the holographic edge band." },
            shineReach: { type: ControlType.Number, title: "Shine Reach", min: 20, max: 600, step: 1, unit: "px", defaultValue: 170, description: "How far along the edge the shine spreads." },
            shineBands: { type: ControlType.Number, title: "Shine Bands", min: 1, max: 6, step: 1, defaultValue: 2, description: "Rainbow repeats around the pointer." },
            sheen: { type: ControlType.Number, title: "Sheen", min: 0, max: 40, step: 1, unit: "%", defaultValue: 8, description: "Diagonal light band on the vinyl." },
            peelMs: { type: ControlType.Number, title: "Peel Time", min: 200, max: 4000, step: 10, unit: "ms", defaultValue: 1000, description: "Duration of an automatic peel." },
            holdMs: { type: ControlType.Number, title: "Hold", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 250, description: "Pause at full peel." },
            restMs: { type: ControlType.Number, title: "Rest", min: 0, max: 6000, step: 10, unit: "ms", defaultValue: 1300, description: "Flat pause between peels." },
            peelDepth: { type: ControlType.Number, title: "Peel Depth", min: 10, max: 200, step: 1, unit: "%", defaultValue: 80, description: "How far the automatic peel pulls." },
            dragFollow: { type: ControlType.Number, title: "Drag Follow", min: 5, max: 80, step: 1, defaultValue: 35, description: "How tightly the flap follows a drag." },
            captionColor: { type: ControlType.Color, title: "Caption Color", defaultValue: "#7A7A7E", description: "Hint text colour." },
            captionSize: { type: ControlType.Number, title: "Caption Size", min: 8, max: 32, step: 1, unit: "px", defaultValue: 13, description: "Hint text size." },
        },
    },
})

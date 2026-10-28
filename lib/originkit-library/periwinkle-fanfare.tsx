import { addPropertyControls, ControlType } from "./framer-shim"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"

// useLayoutEffect warns during server rendering; it only matters in the browser.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

/*
 * PeriwinkleFanfare — a dark "Submit" pill that celebrates with confetti.
 *
 * Tap it and the arrow and letters drop out of the pill one after another,
 * blurring as they go, while the pill draws in to a narrower capsule and
 * three periwinkle dots fade in, already riding a slow wave. When loading
 * ends the dots hop up and fall out through the floor, the pill springs back
 * to full width and a burst of tumbling paper confetti and tiny sparks fires
 * up from its lower edge, over the pill, out of the top of the frame and
 * flutters down again. "Success" fades in letter by letter, a green check
 * draws itself in, and after a hold everything fades away right-to-left
 * and "Submit" drops back in from above.
 *
 * Built after the screen recording vid25.mp4 (a submit → loading → success
 * button with a confetti burst). Every number below was measured off its
 * frames at 60 fps; times are seconds from the tap, sizes are px in the
 * clip's own 304 × 416 frame (the recording is 2× that):
 * - pill 172.3 × 40.85, #1C1F2E on #F2F6FE, centre 6.1 px below the frame's
 *   (shipped on black instead: the pill is lifted to #202437 and edged with
 *   a periwinkle hairline so it still reads; the clip's colours are one
 *   Background / Button / Ring change away);
 *   loading narrows it to 137.75 (80 %) with easeOutCubic over 0.30 s, and
 *   it widens back over 0.10 s.
 * - label: Helvetica/Arial 14.24 px (Arial ink widths of "Submit" and
 *   "Success" agree to 0.01 px), white; arrow #577BF9, check #65FBA4.
 * - dots: Ø 3.9, pitch 8.55; wave 8.2 high on a 1.0 s period, 0.1 s apart,
 *   rise 0.217 s · hold 0.031 s · fall 0.223 s on cubic-bezier(.28,.17,.27,.89)
 *   (fit at 0.6 % rms).
 * - confetti: tracked piece by piece. Paper rectangles launch from a line
 *   5.5 px under the pill at 5.5–12 px/frame, fall under 0.30 px/frame²
 *   capped at 3.0 px/frame and sway sideways; sparks fall under
 *   0.555 px/frame² with 0.98/frame drag on x. Six colours in equal shares.
 *
 * Where the clip's behaviour does not survive being a component:
 * - the clip's per-frame physics would run twice as fast at 120 Hz; here it
 *   runs in px/s on a fixed 1/120 s substep and is drawn interpolated.
 * - the clip's confetti only ever leaves through the frame's floor; here a
 *   piece also fades out after ~4 s so a very tall frame still settles.
 *
 * How it is built:
 * - The pill, label, dots and check are DOM: a real <button> (keyboard,
 *   screen readers, the browser's own hit-testing), each glyph its own span
 *   so it can move on its own. Only transform, opacity, filter and the
 *   pill's clip-path change while it animates — never layout.
 * - Confetti is one Canvas2D layer over the frame, ~40 shapes drawn with
 *   setTransform; it clears only what it drew.
 * - One rAF loop, paced to whole vsyncs at ≤ 60 fps, runs from the tap until
 *   the last piece has gone and the label is home, then stops. It pauses
 *   off screen and in hidden tabs.
 */

// ---------------------------------------------------------------- constants

const REF_W = 304
const REF_H = 416
const REF_ASPECT = REF_W / REF_H
const BTN_CY = 214.1 // pill centre in the reference frame (frame centre is 208)
const REF_BTN_H = 40.85 // everything inside the pill is measured against this
const FONT_K = 14.24 / REF_BTN_H // label size per px of button height
const GAP = 9.6 // icon ink → text box
const ARROW_DY = -0.7 // icon ink centres sit a hair above the pill's centre
const CHECK_DY = -1.35
const SPAWN_DROP = 5.5 // launch line below the pill's lower edge
const SPAWN_SPAN = 0.4 // ± share of the pill's width the launch line covers
const PERSPECTIVE = 600 // ref px: the lens Tilt leans the pill under
const MAX_DPR = 2
const PIXEL_CAP = 4.2e6
const STEP = 1 / 120 // confetti substep, s
const MAX_PIECES = 160
const FADE_AT = 3.6 // s after launch a piece starts to fade…
const FADE_FOR = 0.6 // …over this long

// Timeline at Speed 5, s. Phase A runs from the tap, B from the end of
// loading, C from the end of the hold.
const A_ARROW_OUT = 0.3
const A_ARROW_DROP = 150 // px/s: the arrow just falls out of the pill
const A_GLYPH_STAGGER = 0.033
const A_GLYPH_OUT = 0.18
const A_GLYPH_DROP = 9
const A_SHRINK_AT = 0.017
const A_SHRINK = 0.3
const A_DOTS_IN_AT = 0.317
const A_DOTS_IN = 0.25
const WAVE_ORIGIN = -0.013
const WAVE_STAGGER = 0.1
const WAVE_RISE = 0.217
const WAVE_HOLD = 0.031
const WAVE_FALL = 0.223
const B_DOTS_UP = 0.1
const B_DOTS_HOP = 6.1 // px the dots hop before falling
const B_DOTS_HANG = 0.033
const B_DOTS_FALL = 0.2
const B_DOTS_G = 1620 // px/s² as they fall out
const B_WIDEN_AT = 0.3
const B_WIDEN = 0.1
const B_BURST_AT = 0.345
const B_SUCC_AT = 1.0
const B_SUCC_STAGGER = 0.03
const B_SUCC_IN = 0.13
const B_CHECK_LEAD = 0.22 // after the last letter starts
const B_CHECK = 0.205
const C_OUT_STAGGER = 0.027
const C_OUT = 0.14
const C_CHECK_OUT_AT = 0.11
const C_CHECK_OUT = 0.15
const C_GAP = 0.273 // after the last success letter has gone
const C_GLYPH_STAGGER = 0.03
const C_GLYPH_IN = 0.13
const C_GLYPH_RISE = 7.5
const C_ARROW_LAG = 0.069
const C_ARROW_IN = 0.362
const C_ARROW_RISE = 22.5

// ---------------------------------------------------------------- types

interface FontValue {
    fontFamily?: string
    fontWeight?: number | string
    fontStyle?: string
    letterSpacing?: string | number
}

export interface Palette {
    /** The pill. */
    button: string
    /** The arrow and the loading dots. */
    accent: string
    /** The check. */
    success: string
    /** Hairline round the pill, so it reads on a dark page. */
    ring: string
}

export interface Confetti {
    /** Paper rectangles in one burst. */
    pieces: number
    /** Small round sparks in one burst. */
    sparks: number
    colors: string[]
    /** 0–10: how high the burst flies. */
    power: number
}

export interface Placement {
    x: number
    y: number
    angle: number
    tilt: number
}

export interface Timing {
    /** 0–10: how fast every transition plays. */
    speed: number
    /** Seconds from the tap until loading ends. */
    loading: number
    /** Seconds "Success" stays before it resets. */
    hold: number
    /** Reset to the label by itself after Hold; off waits for a tap. */
    autoReset: boolean
}

export interface Advanced {
    loadingWidth: number
    dotSize: number
    dotPitch: number
    waveHeight: number
    wavePeriod: number
    pieceSize: number
    sparkSize: number
    launchMin: number
    launchMax: number
    gravity: number
    fallSpeed: number
    sway: number
    spin: number
    sparkGravity: number
}

export interface PeriwinkleFanfareProps {
    label?: string
    successLabel?: string
    background?: string
    font?: FontValue
    textColor?: string
    confetti?: Partial<Confetti>
    buttonWidth?: number
    buttonHeight?: number
    radius?: number
    palette?: Partial<Palette>
    placement?: Partial<Placement>
    timing?: Partial<Timing>
    advanced?: Partial<Advanced>
    /** Fired on the tap that starts the sequence. */
    onSubmit?: () => void
    style?: CSSProperties
}

const DEFAULTS = {
    label: "Submit",
    successLabel: "Success",
    background: "#000000",
    textColor: "#FFFFFF",
    buttonWidth: 296,
    buttonHeight: 81,
    radius: 60,
}

const DEFAULT_PALETTE: Palette = {
    button: "#202437",
    accent: "#577BF9",
    success: "#65FBA4",
    ring: "rgba(129, 152, 255, 0.28)",
}
const DEFAULT_CONFETTI: Confetti = {
    pieces: 24,
    sparks: 12,
    colors: ["#AEC0FD", "#8699DE", "#5A7CF8", "#6F55F5", "#5740D7", "#3455C9"],
    power: 5,
}
const DEFAULT_PLACEMENT: Placement = { x: 0, y: 0, angle: 0, tilt: 0 }
const DEFAULT_TIMING: Timing = { speed: 5, loading: 1.79, hold: 2.75, autoReset: true }
const DEFAULT_ADVANCED: Advanced = {
    loadingWidth: 80,
    dotSize: 3.9,
    dotPitch: 8.55,
    waveHeight: 8.2,
    wavePeriod: 1,
    pieceSize: 11,
    sparkSize: 3.6,
    launchMin: 330,
    launchMax: 720,
    gravity: 1080,
    fallSpeed: 180,
    sway: 60,
    spin: 150,
    sparkGravity: 2000,
}

const SANS = 'Helvetica, Arial, sans-serif' // the clip's widths are Helvetica's, not Neue's

// Icon ink in ref px around its own centre (stroke included in the box).
const ARROW_R = 5.67
const ARROW_STROKE = 1.96
const ARROW_BOX = 2 * ARROW_R + ARROW_STROKE
const CHECK_PTS = "-5.65 0.5 -1.9 4 5.6 -4"
const CHECK_STROKE = 2.5
const CHECK_W = 5.65 + 5.6 + CHECK_STROKE
const CHECK_H = 8 + CHECK_STROKE

// ---------------------------------------------------------------- helpers

function clamp(x: number, a: number, b: number) {
    return x < a ? a : x > b ? b : x
}

function clamp01(x: number) {
    return x < 0 ? 0 : x > 1 ? 1 : x
}

function easeOutCubic(t: number) {
    const u = 1 - clamp01(t)
    return 1 - u * u * u
}

function easeOutQuad(t: number) {
    const u = 1 - clamp01(t)
    return 1 - u * u
}

function easeInOutQuad(t: number) {
    t = clamp01(t)
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

// cubic-bezier(x1, y1, x2, y2) solved by Newton with a bisection fallback.
function bezier(x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const X = (s: number) => ((ax * s + bx) * s + cx) * s
    const dX = (s: number) => (3 * ax * s + 2 * bx) * s + cx
    return (p: number) => {
        p = clamp01(p)
        let s = p
        for (let i = 0; i < 6; i++) {
            const d = dX(s)
            if (Math.abs(d) < 1e-6) break
            const e = X(s) - p
            if (Math.abs(e) < 1e-5) break
            s -= e / d
        }
        if (s < 0 || s > 1 || Math.abs(X(s) - p) > 1e-3) {
            let lo = 0, hi = 1
            for (let i = 0; i < 24; i++) {
                s = (lo + hi) / 2
                if (X(s) < p) lo = s
                else hi = s
            }
        }
        return ((ay * s + by) * s + cy) * s
    }
}

const WAVE_EASE = bezier(0.28, 0.17, 0.27, 0.89)

// 0 → 1 → 0 over one wave, given seconds into the cycle.
function waveAt(phase: number) {
    if (phase < 0) return 0
    if (phase < WAVE_RISE) return WAVE_EASE(phase / WAVE_RISE)
    if (phase < WAVE_RISE + WAVE_HOLD) return 1
    const f = phase - WAVE_RISE - WAVE_HOLD
    if (f < WAVE_FALL) return 1 - WAVE_EASE(f / WAVE_FALL)
    return 0
}

function mulberry(seed: number) {
    let s = seed >>> 0
    return () => {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Framer colours can arrive as var(--token); the canvas cannot read those.
function resolveColor(el: HTMLElement, c: string) {
    const prev = el.style.color
    el.style.color = ""
    el.style.color = c
    const out = el.style.color ? getComputedStyle(el).color : "rgba(0,0,0,0)"
    el.style.color = prev
    return out
}

function glyphsOf(s: string) {
    return Array.from(s)
}

// Speed 5 = the reference; each 2.5 steps doubles or halves it.
function rateOf(speed: number) {
    return Math.pow(2, (clamp(speed, 0, 10) - 5) / 2.5)
}

// A style writer that skips unchanged values, so a settled glyph costs nothing.
class Styler {
    t = ""
    o = ""
    f = ""
    reset() {
        this.t = this.o = this.f = "#"
    }
    write(el: HTMLElement | SVGElement | null, t: string, o: string, f: string) {
        if (!el) return
        const s = el.style
        if (t !== this.t) s.transform = this.t = t
        if (o !== this.o) s.opacity = this.o = o
        if (f !== this.f) s.filter = this.f = f
    }
}

function pose(st: Styler, el: HTMLElement | SVGElement | null, y: number, o: number, blur: number) {
    st.write(
        el,
        // 2D only: a 3D transform would promote the glyph to its own layer,
        // rastered once and stretched (soft) when the canvas zooms.
        Math.abs(y) < 0.01 ? "none" : `translate(0px,${y.toFixed(2)}px)`,
        o >= 0.999 ? "1" : o <= 0.001 ? "0" : o.toFixed(3),
        blur < 0.05 ? "none" : `blur(${blur.toFixed(2)}px)`
    )
}

// ---------------------------------------------------------------- confetti

interface Burst {
    n: number
    kind: Uint8Array // 0 rectangle, 1 spark
    x: Float32Array
    y: Float32Array
    px: Float32Array
    py: Float32Array
    vx: Float32Array
    vy: Float32Array
    drift: Float32Array
    swayA: Float32Array
    swayW: Float32Array
    swayP: Float32Array
    w: Float32Array
    h: Float32Array
    rot: Float32Array
    spin: Float32Array
    flip: Float32Array
    flipW: Float32Array
    color: Uint8Array
    age: Float32Array
    alive: Uint8Array
}

function makeBurst(): Burst {
    const f = () => new Float32Array(MAX_PIECES)
    return {
        n: 0,
        kind: new Uint8Array(MAX_PIECES),
        x: f(), y: f(), px: f(), py: f(), vx: f(), vy: f(),
        drift: f(), swayA: f(), swayW: f(), swayP: f(),
        w: f(), h: f(), rot: f(), spin: f(), flip: f(), flipW: f(),
        color: new Uint8Array(MAX_PIECES),
        age: f(),
        alive: new Uint8Array(MAX_PIECES),
    }
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 304
 * @framerIntrinsicHeight 416
 */
export default function PeriwinkleFanfare(props: PeriwinkleFanfareProps) {
    const {
        label = DEFAULTS.label,
        successLabel = DEFAULTS.successLabel,
        background = DEFAULTS.background,
        font,
        textColor = DEFAULTS.textColor,
        buttonWidth = DEFAULTS.buttonWidth,
        buttonHeight = DEFAULTS.buttonHeight,
        radius = DEFAULTS.radius,
        style,
    } = props
    const palette = { ...DEFAULT_PALETTE, ...props.palette }
    const placement = { ...DEFAULT_PLACEMENT, ...props.placement }

    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    const ringRef = useRef<HTMLSpanElement>(null)
    const ringWRef = useRef(1)
    const arrowRef = useRef<SVGSVGElement>(null)
    const checkRef = useRef<SVGPolylineElement>(null)
    const glyphRefs = useRef<(HTMLSpanElement | null)[]>([])
    const succRefs = useRef<(HTMLSpanElement | null)[]>([])
    const dotRefs = useRef<(HTMLSpanElement | null)[]>([])

    // Latest props for the loop, merged at render, never inside it.
    const live = useRef({
        props,
        confetti: { ...DEFAULT_CONFETTI, ...props.confetti },
        timing: { ...DEFAULT_TIMING, ...props.timing },
        advanced: { ...DEFAULT_ADVANCED, ...props.advanced },
        palette,
        placement,
        nGlyph: 0,
        nSucc: 0,
    })
    live.current = {
        props,
        confetti: { ...DEFAULT_CONFETTI, ...props.confetti },
        timing: { ...DEFAULT_TIMING, ...props.timing },
        advanced: { ...DEFAULT_ADVANCED, ...props.advanced },
        palette,
        placement,
        nGlyph: glyphsOf(label).length,
        nSucc: glyphsOf(successLabel).length,
    }

    const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 })
    const tapRef = useRef<() => void>(() => {})
    const kickRef = useRef<() => void>(() => {})
    const [busy, setBusy] = useState(false)

    // ------------------------------------------------------------ the loop
    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return
        const ctx = canvas.getContext("2d")

        let W = 0, H = 0
        let shown = 1
        let res = 1 // resolution budget, 0.6–1, stepped by the burst's own draw time
        let pr = 1
        let raf = 0
        let visible = true
        let pageShown = !document.hidden
        let reduced = false

        // Timeline state (real seconds since the tap).
        let running = false
        let clock = 0
        let loadEnd = 0 // when loading ends
        let holdStart = 0 // check fully drawn
        let resetAt = Infinity // hold ends
        let endAt = Infinity
        let burstFired = false

        const burst = makeBurst()
        let simAcc = 0
        let colorKey = ""
        let colors: string[] = []
        let dirty: [number, number, number, number] | null = null

        const stGlyph: Styler[] = []
        const stSucc: Styler[] = []
        const stDot = [new Styler(), new Styler(), new Styler()]
        const stArrow = new Styler()
        let lastClip = ""
        let lastDash = ""

        // Vsync pacing (≤ 60 fps on any panel).
        const gaps: number[] = []
        let every = 1
        let lastTick = 0
        let lastDraw = 0
        let drawEma = 0
        let fastFor = 0
        let sinceMeasure = 0

        // Device pixels per CSS px: the screen's ratio (≤ 2) times how much the
        // frame is shown enlarged (Framer's canvas zoom, ≤ 2). Never fewer than
        // the layout box has.
        const sizeCanvas = () => {
            const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1) * clamp(shown, 1, 2)
            let p = dpr * res
            if (W * H * p * p > PIXEL_CAP) p = Math.sqrt(PIXEL_CAP / (W * H))
            const cw = Math.max(1, Math.round(W * p))
            const ch = Math.max(1, Math.round(H * p))
            if (canvas.width !== cw || canvas.height !== ch) {
                canvas.width = cw
                canvas.height = ch
                dirty = null
            }
            pr = cw / Math.max(1, W)
        }

        // A zoom on an ancestor (Framer's canvas) fires no resize, so the shown
        // scale is re-read at each tap and a few times a second while drawing.
        let lastDpr = window.devicePixelRatio || 1
        const measureShown = () => {
            const b = root.getBoundingClientRect()
            const s = W > 0 ? b.width / W : 1
            const d = window.devicePixelRatio || 1
            if (Math.abs(s - shown) / Math.max(shown, 1e-3) > 0.05 || d !== lastDpr) {
                shown = s
                lastDpr = d
                sizeCanvas()
                return true
            }
            return false
        }

        const ro = new ResizeObserver((es) => {
            const r = es[0].contentRect
            W = r.width
            H = r.height
            measureShown()
            sizeCanvas()
            const d = window.devicePixelRatio || 1
            setSize((o) => (o.w === W && o.h === H && o.dpr === d ? o : { w: W, h: H, dpr: d }))
            if (running) kick()
        })
        ro.observe(root)

        const io = new IntersectionObserver((es) => {
            visible = es[es.length - 1].isIntersecting
            if (visible && running) kick()
        })
        io.observe(root)
        const onVis = () => {
            pageShown = !document.hidden
            if (pageShown && running) kick()
        }
        document.addEventListener("visibilitychange", onVis)
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        reduced = mq.matches
        const onMq = () => (reduced = mq.matches)
        mq.addEventListener?.("change", onMq)

        // -------------------------------------------------- frame geometry
        // One unit: the reference frame contained in this one.
        const unit = () => Math.min(H, W / REF_ASPECT) / REF_H

        // Pill-local point (px from the pill's centre) → frame px, through
        // the same transform the stage carries.
        const toFrame = (lx: number, ly: number, out: Float32Array) => {
            const L = live.current
            const u = unit()
            const pl = L.placement
            const a = (pl.angle * Math.PI) / 180
            const tl = (clamp(pl.tilt, -80, 80) * Math.PI) / 180
            const x1 = lx * Math.cos(a) - ly * Math.sin(a)
            const y1 = lx * Math.sin(a) + ly * Math.cos(a)
            const y2 = y1 * Math.cos(tl)
            const z2 = y1 * Math.sin(tl)
            const P = PERSPECTIVE * u
            const s = P / Math.max(1e-3, P - z2)
            out[0] = W / 2 + (pl.x / 100) * W + x1 * s
            out[1] = H / 2 + (BTN_CY - REF_H / 2) * u + (pl.y / 100) * H + y2 * s
        }

        // -------------------------------------------------- confetti
        const syncColors = () => {
            const list = live.current.confetti.colors
            const key = list.join("|")
            if (key !== colorKey) {
                colorKey = key
                colors = list.map((cc) => resolveColor(root, cc))
            }
        }

        const fire = () => {
            syncColors()
            const L = live.current
            const c = L.confetti
            const A = L.advanced
            const u = unit()
            const btnW = L.props.buttonWidth ?? DEFAULTS.buttonWidth
            const btnH = L.props.buttonHeight ?? DEFAULTS.buttonHeight
            const nR = clamp(Math.round(c.pieces), 0, MAX_PIECES)
            const nS = clamp(Math.round(c.sparks), 0, MAX_PIECES - nR)
            const pw = Math.pow(1.6, (clamp(c.power, 0, 10) - 5) / 5) // 0.63×–1.6× launch speed
            const ang = (L.placement.angle * Math.PI) / 180
            const ca = Math.cos(ang), sa = Math.sin(ang)
            const rnd = mulberry((Math.random() * 4294967296) >>> 0)
            const tmp = new Float32Array(2)
            const nCol = Math.max(1, colors.length)
            burst.n = nR + nS
            for (let i = 0; i < burst.n; i++) {
                const spark = i >= nR
                burst.kind[i] = spark ? 1 : 0
                toFrame((rnd() * 2 - 1) * SPAWN_SPAN * btnW * u, (btnH / 2 + SPAWN_DROP) * u, tmp)
                burst.x[i] = burst.px[i] = tmp[0]
                burst.y[i] = burst.py[i] = tmp[1]
                // Upward speed skewed slow: tuned so the cloud's height and paper
                // area track the clip's, sample by sample, through the fall.
                const lo = A.launchMin, hi = Math.max(A.launchMin, A.launchMax)
                const up = spark
                    ? (lo + (hi - lo) * (0.25 + 0.55 * rnd())) * pw * u
                    : (lo + (hi - lo) * Math.pow(rnd(), 1.5)) * pw * u
                const side = (spark ? 240 : 145) * (rnd() * 2 - 1) * u
                // Launch "up" turns with the pill's Angle; gravity stays down.
                burst.vx[i] = side * ca + up * sa
                burst.vy[i] = side * sa - up * ca
                burst.drift[i] = (rnd() * 2 - 1) * 48 * u
                burst.swayA[i] = (0.5 + rnd()) * u
                burst.swayW[i] = (Math.PI * 2) / (0.55 + 0.6 * rnd())
                burst.swayP[i] = rnd() * Math.PI * 2
                if (spark) {
                    burst.w[i] = burst.h[i] = A.sparkSize * (0.8 + 0.4 * rnd())
                } else {
                    const w = A.pieceSize * (0.74 + 0.52 * rnd())
                    burst.w[i] = w
                    burst.h[i] = w * (0.55 + 0.4 * rnd())
                }
                burst.rot[i] = rnd() * Math.PI * 2
                burst.spin[i] = (((rnd() * 2 - 1) * A.spin) * Math.PI) / 180
                burst.flip[i] = rnd() * Math.PI * 2
                burst.flipW[i] = (2 + 4 * rnd()) * (rnd() < 0.5 ? -1 : 1)
                burst.color[i] = Math.floor(rnd() * nCol) % nCol
                burst.age[i] = 0
                burst.alive[i] = 1
            }
            simAcc = 0
        }

        const stepBurst = (dt: number) => {
            const A = live.current.advanced
            const u = unit()
            const g = A.gravity * u
            const vt = A.fallSpeed * u
            const gs = A.sparkGravity * u
            const sway = A.sway
            const kx = Math.exp(-1.212 * dt) // 0.98 per 60 Hz frame
            let any = false
            for (let i = 0; i < burst.n; i++) {
                if (!burst.alive[i]) continue
                burst.px[i] = burst.x[i]
                burst.py[i] = burst.y[i]
                const age = (burst.age[i] += dt)
                if (burst.kind[i] === 1) {
                    burst.vx[i] *= kx
                    burst.vy[i] += gs * dt
                    burst.x[i] += burst.vx[i] * dt
                    burst.y[i] += burst.vy[i] * dt
                } else {
                    burst.vx[i] *= kx
                    const vy = burst.vy[i] + g * dt
                    burst.vy[i] = vy > vt ? vt : vy
                    const sw = sway * burst.swayA[i] * Math.sin(burst.swayW[i] * age + burst.swayP[i])
                    burst.x[i] += (burst.vx[i] + burst.drift[i] + sw) * dt
                    burst.y[i] += burst.vy[i] * dt
                }
                if (burst.y[i] > H + 30 * u || age > FADE_AT + FADE_FOR) burst.alive[i] = 0
                else any = true
            }
            return any
        }

        const drawBurst = (alpha: number) => {
            if (!ctx) return
            if (dirty) {
                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1])
            }
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
            const u = unit()
            for (let i = 0; i < burst.n; i++) {
                if (!burst.alive[i]) continue
                const x = burst.px[i] + (burst.x[i] - burst.px[i]) * alpha
                const y = burst.py[i] + (burst.y[i] - burst.py[i]) * alpha
                const age = burst.age[i]
                const fade = clamp01((FADE_AT + FADE_FOR - age) / FADE_FOR)
                if (fade <= 0) continue
                ctx.globalAlpha = fade
                ctx.fillStyle = colors[burst.color[i]] || "#5A7CF8"
                const w = burst.w[i] * u
                const h = burst.h[i] * u
                if (burst.kind[i] === 1) {
                    ctx.setTransform(pr, 0, 0, pr, x * pr, y * pr)
                    ctx.beginPath()
                    ctx.arc(0, 0, w / 2, 0, Math.PI * 2)
                    ctx.fill()
                } else {
                    // In-plane spin plus a flip about the piece's own long
                    // axis: the paper foreshortens to a sliver and back.
                    const r = burst.rot[i] + burst.spin[i] * age
                    const f = Math.cos(burst.flip[i] + burst.flipW[i] * age)
                    const c = Math.cos(r), s = Math.sin(r)
                    ctx.setTransform(c * pr, s * pr, -s * f * pr, c * f * pr, x * pr, y * pr)
                    ctx.fillRect(-w / 2, -h / 2, w, h)
                }
                const m = Math.max(w, h) * 0.75 + 2
                if (x - m < x0) x0 = x - m
                if (y - m < y0) y0 = y - m
                if (x + m > x1) x1 = x + m
                if (y + m > y1) y1 = y + m
            }
            ctx.globalAlpha = 1
            if (x1 > x0) {
                dirty = [
                    Math.max(0, Math.floor(x0 * pr)),
                    Math.max(0, Math.floor(y0 * pr)),
                    Math.min(canvas.width, Math.ceil(x1 * pr)),
                    Math.min(canvas.height, Math.ceil(y1 * pr)),
                ]
            } else dirty = null
        }

        const clearBurst = () => {
            burst.n = 0
            if (ctx && dirty) {
                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1])
            }
            dirty = null
        }

        // -------------------------------------------------- the timeline
        const schedule = () => {
            const L = live.current
            const r = rateOf(L.timing.speed)
            loadEnd = Math.max(L.timing.loading, (A_DOTS_IN_AT + A_DOTS_IN) / r + 0.05)
            const checkAt = B_SUCC_AT + B_SUCC_STAGGER * Math.max(0, L.nSucc - 1) + B_CHECK_LEAD
            holdStart = loadEnd + (checkAt + B_CHECK) / r
        }

        const glyphInAt = (nSucc: number) => C_OUT_STAGGER * Math.max(0, nSucc - 1) + C_OUT + C_GAP

        const apply = (t: number) => {
            const L = live.current
            const A = L.advanced
            const r = rateOf(L.timing.speed)
            const u = unit()
            const btnW = (L.props.buttonWidth ?? DEFAULTS.buttonWidth) * u
            const btnH = L.props.buttonHeight ?? DEFAULTS.buttonHeight
            const k = (btnH / REF_BTN_H) * u // px per measured px inside the pill
            const R = Math.min(L.props.radius ?? DEFAULTS.radius, btnH / 2) * u
            const nG = L.nGlyph
            const nS = L.nSucc
            const calm = reduced

            const a = t * r // phase A clock
            const b = (t - loadEnd) * r // phase B clock
            const c = (t - resetAt) * r // phase C clock (negative until reset)

            // Pill width.
            const loadW = btnW * clamp(A.loadingWidth, 20, 100) / 100
            let w = btnW
            if (running) {
                const p = calm ? (a > A_SHRINK_AT ? 1 : 0) : easeOutCubic((a - A_SHRINK_AT) / A_SHRINK)
                w = btnW - (btnW - loadW) * p
                if (b >= 0) {
                    const q = calm ? (b > B_WIDEN_AT ? 1 : 0) : easeOutCubic((b - B_WIDEN_AT) / B_WIDEN)
                    w = loadW + (btnW - loadW) * q
                }
            }
            const d = Math.max(0, (btnW - w) / 2)
            const clip = `inset(0px ${d.toFixed(2)}px round ${R.toFixed(2)}px)`
            if (clip !== lastClip && btnRef.current) {
                btnRef.current.style.clipPath = lastClip = clip
                // The ring is the same capsule one hairline larger, narrowed alike.
                const rw = ringWRef.current
                if (ringRef.current) ringRef.current.style.clipPath = `inset(0px ${d.toFixed(2)}px round ${(R + rw).toFixed(2)}px)`
            }

            // Label glyphs: drop out, later drop back in reverse order.
            const gIn = glyphInAt(nS)
            for (let i = 0; i < nG; i++) {
                const st = (stGlyph[i] ||= new Styler())
                let y = 0, o = 1, bl = 0
                if (running) {
                    if (c < 0) {
                        const p = clamp01((a - A_GLYPH_STAGGER * i) / A_GLYPH_OUT)
                        y = calm ? 0 : A_GLYPH_DROP * easeOutQuad(p) * k
                        o = (1 - p) * (1 - p)
                        bl = calm ? 0 : 1.5 * p * k
                    } else {
                        const p = clamp01((c - gIn - C_GLYPH_STAGGER * (nG - 1 - i)) / C_GLYPH_IN)
                        y = calm ? 0 : -C_GLYPH_RISE * Math.pow(1 - p, 1.2) * k
                        o = Math.pow(p, 1.1)
                        bl = calm ? 0 : 0.6 * (1 - p) * k
                    }
                }
                pose(st, glyphRefs.current[i], y, o, bl)
            }
            {
                let y = 0, o = 1
                if (running) {
                    if (c < 0) {
                        const p = clamp01(a / A_ARROW_OUT)
                        y = calm ? 0 : (A_ARROW_DROP * A_ARROW_OUT * p * k)
                        o = calm ? 1 - p : 1 - 0.8 * p
                        if (p >= 1) o = 0
                    } else {
                        const p = clamp01((c - gIn - C_ARROW_LAG) / C_ARROW_IN)
                        y = calm ? 0 : -C_ARROW_RISE * Math.pow(1 - p, 3.06) * k
                        o = 1 - (1 - p) * (1 - p)
                    }
                }
                pose(stArrow, arrowRef.current, y + ARROW_DY * k, o, 0)
            }

            // Dots: fade in already riding the wave, hop and fall out.
            for (let j = 0; j < 3; j++) {
                let y = 0, o = 0, bl = 0
                if (running && c < 0 && b < B_DOTS_UP + B_DOTS_HANG + B_DOTS_FALL) {
                    o = clamp01((a - A_DOTS_IN_AT) / A_DOTS_IN)
                    bl = calm ? 0 : 1.5 * (1 - o) * k
                    const period = Math.max(0.2, A.wavePeriod)
                    const ph = (((a - WAVE_ORIGIN - WAVE_STAGGER * j) % period) + period) % period
                    let wave = calm ? 0 : waveAt(ph) * A.waveHeight
                    let hop = 0
                    if (b >= 0) {
                        wave *= 1 - easeOutQuad(b / B_DOTS_UP)
                        if (!calm) {
                            if (b < B_DOTS_UP) hop = -B_DOTS_HOP * easeOutQuad(b / B_DOTS_UP)
                            else if (b < B_DOTS_UP + B_DOTS_HANG) hop = -B_DOTS_HOP
                            else {
                                const f = b - B_DOTS_UP - B_DOTS_HANG
                                hop = -B_DOTS_HOP + 0.5 * B_DOTS_G * f * f
                            }
                        } else o *= 1 - clamp01(b / 0.2)
                    }
                    y = (-wave + hop) * k
                }
                pose(stDot[j], dotRefs.current[j], y, o, bl)
            }

            // Success letters fade in, then out right to left.
            for (let i = 0; i < nS; i++) {
                const st = (stSucc[i] ||= new Styler())
                let o = 0, bl = 0
                if (running && b >= 0) {
                    const p = clamp01((b - B_SUCC_AT - B_SUCC_STAGGER * i) / B_SUCC_IN)
                    o = easeOutQuad(p)
                    bl = calm ? 0 : 2 * (1 - p) * k
                    if (c >= 0) {
                        const q = clamp01((c - C_OUT_STAGGER * (nS - 1 - i)) / C_OUT)
                        o *= Math.pow(1 - q, 1.5)
                        bl = calm ? 0 : 0.8 * q * k
                    }
                }
                pose(st, succRefs.current[i], 0, o, bl)
            }

            // The check draws itself in, and un-draws from the tip.
            let drawn = 0
            if (running && b >= 0) {
                const at = B_SUCC_AT + B_SUCC_STAGGER * Math.max(0, nS - 1) + B_CHECK_LEAD
                drawn = calm ? (b >= at ? 1 : 0) : Math.pow(clamp01((b - at) / B_CHECK), 1.4)
                if (c >= 0) drawn *= 1 - (calm ? (c >= C_CHECK_OUT_AT ? 1 : 0) : easeInOutQuad((c - C_CHECK_OUT_AT) / C_CHECK_OUT))
            }
            const dash = drawn <= 0.002 ? "0" : `${drawn.toFixed(4)}`
            if (dash !== lastDash && checkRef.current) {
                lastDash = dash
                const el = checkRef.current
                el.style.strokeDashoffset = `${(1 - drawn).toFixed(4)}`
                el.style.opacity = drawn <= 0.002 ? "0" : "1"
            }

            // Burst.
            if (running && !burstFired && b >= B_BURST_AT) {
                burstFired = true
                if (!calm && L.confetti.pieces + L.confetti.sparks > 0) fire()
            }

            // Hold → reset.
            if (running && resetAt === Infinity && L.timing.autoReset && t >= holdStart) {
                resetAt = holdStart + Math.max(0, L.timing.hold)
            }
            if (resetAt !== Infinity) {
                const gEnd = glyphInAt(nS) + Math.max(C_GLYPH_STAGGER * Math.max(0, nG - 1) + C_GLYPH_IN, C_ARROW_LAG + C_ARROW_IN)
                endAt = resetAt + gEnd / r
            }
        }

        // -------------------------------------------------- driving it
        const frame = (now: number) => {
            raf = 0
            if (!running || !visible || !pageShown) return
            raf = requestAnimationFrame(frame)

            // Pace to whole vsyncs, at most 60 fps.
            if (lastTick) {
                const g = now - lastTick
                if (g > 0 && g < 100) {
                    gaps.push(g)
                    if (gaps.length > 15) gaps.shift()
                }
            }
            lastTick = now
            if (gaps.length >= 5) {
                const sorted = gaps.slice().sort((p, q) => p - q)
                const period = sorted[sorted.length >> 1]
                const x = 16.7 / period + 0.1
                if (x < every - 0.1 || x >= every + 1.1) every = Math.max(1, Math.floor(x))
                if (lastDraw && now - lastDraw < (every - 0.5) * period) return
            }
            const dtMs = lastDraw ? now - lastDraw : 16.7
            lastDraw = now
            const dt = Math.min(0.1, dtMs / 1000)
            clock += dt

            // Keep the confetti buffer at the scale the frame is shown at.
            if (burst.n > 0 && ++sinceMeasure >= 15) {
                sinceMeasure = 0
                measureShown()
            }

            // Resolution budget, judged on the burst's own draw time — never on
            // frame gaps, which the Framer editor stretches while a control is
            // dragged and which would otherwise blur the confetti for nothing.
            if (burst.n > 0) {
                if (drawEma > 4 && res > 0.6) {
                    res = Math.max(0.6, res - 0.2)
                    drawEma = 0
                    fastFor = 0
                    sizeCanvas()
                } else if (res < 1 && drawEma < 1.5 && ++fastFor > 60) {
                    res = Math.min(1, res + 0.2)
                    fastFor = 0
                    sizeCanvas()
                }
            }

            // Auto Reset off: time stands still at the hold until a tap.
            const frozen = resetAt === Infinity && !live.current.timing.autoReset && clock >= holdStart
            if (frozen) clock = holdStart
            const t = clock
            apply(t)

            // Confetti on a fixed substep, drawn interpolated.
            let alive = false
            if (burst.n > 0) {
                syncColors()
                simAcc += dt * rateOf(live.current.timing.speed)
                let steps = 0
                alive = true
                while (simAcc >= STEP && steps < 24) {
                    alive = stepBurst(STEP)
                    simAcc -= STEP
                    steps++
                }
                if (steps === 24) simAcc = 0
                const d0 = performance.now()
                drawBurst(simAcc / STEP)
                drawEma = drawEma * 0.9 + (performance.now() - d0) * 0.1
                if (!alive) clearBurst()
            }

            if (t >= endAt && !alive) finish()
            else if (frozen && !alive && raf) {
                // Nothing left to move: wait for the tap without drawing.
                cancelAnimationFrame(raf)
                raf = 0
            }
        }

        const kick = () => {
            if (!raf && running && visible && pageShown) {
                lastTick = 0
                lastDraw = 0
                raf = requestAnimationFrame(frame)
            }
        }

        const finish = () => {
            running = false
            clock = 0
            resetAt = Infinity
            endAt = Infinity
            clearBurst()
            apply(0)
            setBusy(false)
            if (raf) cancelAnimationFrame(raf)
            raf = 0
        }

        tapRef.current = () => {
            const L = live.current
            if (!running) {
                running = true
                clock = 0
                burstFired = false
                resetAt = Infinity
                endAt = Infinity
                schedule()
                syncColors() // read the palette now, not mid-burst
                measureShown()
                sinceMeasure = 0
                setBusy(true)
                L.props.onSubmit?.()
                kick()
            } else if (!L.timing.autoReset && resetAt === Infinity && clock >= holdStart) {
                resetAt = clock
                kick()
            }
        }
        kickRef.current = () => {
            // React may have rewritten inline styles; forget what was written.
            for (const st of stGlyph) st.reset()
            for (const st of stSucc) st.reset()
            for (const st of stDot) st.reset()
            stArrow.reset()
            lastClip = lastDash = "#"
            if (running) {
                schedule()
                kick()
            } else apply(0)
        }

        return () => {
            ro.disconnect()
            io.disconnect()
            document.removeEventListener("visibilitychange", onVis)
            mq.removeEventListener?.("change", onMq)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [])

    // Re-pose after any prop change (sizes, labels) without waiting for a tap.
    useIsoLayoutEffect(() => {
        kickRef.current()
    })

    // ------------------------------------------------------------ render
    const W = size.w
    const H = size.h
    const u = W > 0 && H > 0 ? Math.min(H, W / REF_ASPECT) / REF_H : 1
    const px = (v: number) => `${v}px`
    // Snap the pill's box and position to whole device pixels, so its edge
    // and the label never land between pixels and go soft.
    const snap = (v: number) => Math.round(v * size.dpr) / size.dpr
    const btnW = snap(buttonWidth * u)
    const btnHpx = snap(buttonHeight * u)
    const ringW = Math.max(1, snap(u))
    ringWRef.current = ringW
    const k = (buttonHeight / REF_BTN_H) * u
    const R = Math.min(radius, buttonHeight / 2) * u
    const fs = FONT_K * buttonHeight * u
    const glyphs = glyphsOf(label)
    const succ = glyphsOf(successLabel)
    const adv = { ...DEFAULT_ADVANCED, ...props.advanced }

    const fontStyle: CSSProperties = {
        fontFamily: font?.fontFamily ? `${font.fontFamily}, ${SANS}` : SANS,
        fontWeight: font?.fontWeight ?? 400,
        fontStyle: font?.fontStyle ?? "normal",
        letterSpacing: font?.letterSpacing ?? "normal",
    }

    const a = (placement.angle * Math.PI) / 180
    const tilt = clamp(placement.tilt, -80, 80)
    const stageX = W / 2 + (placement.x / 100) * W
    const stageY = H / 2 + (BTN_CY - REF_H / 2) * u + (placement.y / 100) * H
    // 3D only when Tilt asks for it: a flat transform keeps the pill and its
    // text painted at full resolution at any zoom.
    let stageTransform = `translate(${snap(stageX - btnW / 2)}px, ${snap(stageY - btnHpx / 2)}px)`
    if (tilt !== 0) stageTransform += ` perspective(${PERSPECTIVE * u}px) rotateX(${tilt}deg)`
    if (a !== 0) stageTransform += ` rotate(${a}rad)`

    const row: CSSProperties = {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: px(GAP * k),
        pointerEvents: "none",
    }
    const glyphStyle: CSSProperties = { display: "inline-block", whiteSpace: "pre" }
    const text: CSSProperties = {
        display: "flex",
        fontSize: px(fs),
        lineHeight: 1,
        color: textColor,
        whiteSpace: "nowrap",
        // Greyscale smoothing, as in the clip, and outlines that scale
        // smoothly rather than snapping between hinted sizes.
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "geometricPrecision",
        ...fontStyle,
    }

    glyphRefs.current.length = glyphs.length
    succRefs.current.length = succ.length

    return (
        <div
            ref={rootRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                aspectRatio: `${REF_W} / ${REF_H}`,
                ...style,
                background,
                overflow: "hidden",
                userSelect: "none",
                WebkitUserSelect: "none",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: px(btnW),
                    height: px(btnHpx),
                    transform: stageTransform,
                    transformOrigin: "50% 50%",
                    visibility: W > 0 ? "visible" : "hidden",
                }}
            >
                {/* Hairline ring: a capsule one hairline larger, behind the pill. */}
                <span
                    ref={ringRef}
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: px(-ringW),
                        borderRadius: px(R + ringW),
                        background: palette.ring,
                        clipPath: `inset(0px 0px round ${R + ringW}px)`,
                        pointerEvents: "none",
                    }}
                />
                <button
                    ref={btnRef}
                    type="button"
                    aria-label={label}
                    aria-busy={busy}
                    onClick={() => tapRef.current()}
                    style={{
                        position: "absolute",
                        inset: 0,
                        margin: 0,
                        padding: 0,
                        border: "none",
                        borderRadius: px(R),
                        overflow: "hidden",
                        cursor: "pointer",
                        backgroundColor: palette.button,
                        // The clip shades the top inside edge darker; on a black page
                        // that is lost, so it is a faint sheen instead.
                        backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${palette.button} 90%, white) 0px, ${palette.button} ${px(6 * k)})`,
                        clipPath: `inset(0px 0px round ${R}px)`,
                        WebkitTapHighlightColor: "transparent",
                        touchAction: "manipulation",
                    }}
                >
                    {/* Idle label: arrow + glyphs */}
                    <span style={row}>
                        <svg
                            ref={arrowRef}
                            width={ARROW_BOX * k}
                            height={ARROW_BOX * k}
                            viewBox={`${-ARROW_BOX / 2} ${-ARROW_BOX / 2} ${ARROW_BOX} ${ARROW_BOX}`}
                            style={{ display: "block", flex: "none", overflow: "visible", transform: `translate(0px,${ARROW_DY * k}px)` }}
                            fill="none"
                            stroke={palette.accent}
                            strokeWidth={ARROW_STROKE}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d={`M0 ${-ARROW_R}V${ARROW_R}M${-ARROW_R} 0L0 ${ARROW_R}L${ARROW_R} 0`} />
                        </svg>
                        <span style={text}>
                            {glyphs.map((g, i) => (
                                <span key={i} ref={(el) => {
 glyphRefs.current[i] = el
 }} style={glyphStyle}>
                                    {g}
                                </span>
                            ))}
                        </span>
                    </span>

                    {/* Loading dots */}
                    <span style={{ ...row, gap: px(Math.max(0, adv.dotPitch - adv.dotSize) * k) }}>
                        {[0, 1, 2].map((j) => (
                            <span
                                key={j}
                                ref={(el) => {
 dotRefs.current[j] = el
 }}
                                style={{
                                    display: "block",
                                    flex: "none",
                                    width: px(adv.dotSize * k),
                                    height: px(adv.dotSize * k),
                                    borderRadius: "50%",
                                    background: palette.accent,
                                    opacity: 0,
                                }}
                            />
                        ))}
                    </span>

                    {/* Success: check + glyphs */}
                    <span style={row} aria-hidden>
                        <svg
                            width={CHECK_W * k}
                            height={CHECK_H * k}
                            viewBox={`${-5.65 - CHECK_STROKE / 2} ${-4 - CHECK_STROKE / 2} ${CHECK_W} ${CHECK_H}`}
                            style={{ display: "block", flex: "none", overflow: "visible", transform: `translate(0px,${CHECK_DY * k}px)` }}
                            fill="none"
                            stroke={palette.success}
                            strokeWidth={CHECK_STROKE}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline
                                ref={checkRef}
                                points={CHECK_PTS}
                                pathLength={1}
                                style={{ strokeDasharray: "1 1", strokeDashoffset: 1, opacity: 0 }}
                            />
                        </svg>
                        <span style={text}>
                            {succ.map((g, i) => (
                                <span
                                    key={i}
                                    ref={(el) => {
 succRefs.current[i] = el
 }}
                                    style={{ ...glyphStyle, opacity: 0 }}
                                >
                                    {g}
                                </span>
                            ))}
                        </span>
                    </span>
                </button>
            </div>
            <canvas
                ref={canvasRef}
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}

// ---------------------------------------------------------------- controls

addPropertyControls(PeriwinkleFanfare, {
    label: { type: ControlType.String, title: "Label", defaultValue: "Submit" },
    successLabel: { type: ControlType.String, title: "Success", defaultValue: "Success" },
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    textColor: { type: ControlType.Color, title: "Text Color", defaultValue: "#FFFFFF" },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontFamily: "Helvetica", fontWeight: 400 },
        description: "Size follows Button Height.",
    },
    buttonWidth: { type: ControlType.Number, title: "Button Width", unit: "px", min: 80, max: 600, step: 1, defaultValue: 296 },
    buttonHeight: { type: ControlType.Number, title: "Button Height", unit: "px", min: 30, max: 200, step: 1, defaultValue: 81 },
    radius: { type: ControlType.Number, title: "Radius", unit: "px", min: 0, max: 100, step: 1, defaultValue: 60 },
    palette: {
        type: ControlType.Object,
        title: "Palette",
        controls: {
            button: { type: ControlType.Color, title: "Button", defaultValue: "#202437" },
            accent: { type: ControlType.Color, title: "Accent", defaultValue: "#577BF9" },
            success: { type: ControlType.Color, title: "Success", defaultValue: "#65FBA4" },
            ring: { type: ControlType.Color, title: "Ring", defaultValue: "rgba(129, 152, 255, 0.28)" },
        },
    },
    confetti: {
        type: ControlType.Object,
        title: "Confetti",
        controls: {
            pieces: { type: ControlType.Number, title: "Pieces", min: 0, max: 120, step: 1, defaultValue: 24 },
            sparks: { type: ControlType.Number, title: "Sparks", min: 0, max: 120, step: 1, defaultValue: 12 },
            colors: {
                type: ControlType.Array,
                title: "Colors",
                control: { type: ControlType.Color },
                maxCount: 12,
                defaultValue: ["#AEC0FD", "#8699DE", "#5A7CF8", "#6F55F5", "#5740D7", "#3455C9"],
            },
            power: { type: ControlType.Number, title: "Power", min: 0, max: 10, step: 0.1, defaultValue: 5 },
        },
    },
    timing: {
        type: ControlType.Object,
        title: "Timing",
        controls: {
            speed: { type: ControlType.Number, title: "Speed", min: 0, max: 10, step: 0.1, defaultValue: 5 },
            loading: { type: ControlType.Number, title: "Loading", unit: "s", min: 0.5, max: 10, step: 0.05, defaultValue: 1.79 },
            hold: { type: ControlType.Number, title: "Hold", unit: "s", min: 0, max: 10, step: 0.05, defaultValue: 2.75 },
            autoReset: { type: ControlType.Boolean, title: "Auto Reset", defaultValue: true, enabledTitle: "On", disabledTitle: "Off" },
        },
    },
    placement: {
        type: ControlType.Object,
        title: "Placement",
        controls: {
            x: { type: ControlType.Number, title: "X Offset", unit: "%", min: -50, max: 50, step: 0.5, defaultValue: 0 },
            y: { type: ControlType.Number, title: "Y Offset", unit: "%", min: -50, max: 50, step: 0.5, defaultValue: 0 },
            angle: { type: ControlType.Number, title: "Angle", unit: "°", min: -180, max: 180, step: 1, defaultValue: 0 },
            tilt: { type: ControlType.Number, title: "Tilt", unit: "°", min: -80, max: 80, step: 1, defaultValue: 0 },
        },
    },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            loadingWidth: { type: ControlType.Number, title: "Loading Width", unit: "%", min: 20, max: 100, step: 1, defaultValue: 80 },
            dotSize: { type: ControlType.Number, title: "Dot Size", unit: "px", min: 1, max: 12, step: 0.1, defaultValue: 3.9 },
            dotPitch: { type: ControlType.Number, title: "Dot Pitch", unit: "px", min: 3, max: 30, step: 0.05, defaultValue: 8.55 },
            waveHeight: { type: ControlType.Number, title: "Wave Height", unit: "px", min: 0, max: 20, step: 0.1, defaultValue: 8.2 },
            wavePeriod: { type: ControlType.Number, title: "Wave Period", unit: "s", min: 0.3, max: 3, step: 0.05, defaultValue: 1 },
            pieceSize: { type: ControlType.Number, title: "Piece Size", unit: "px", min: 3, max: 30, step: 0.5, defaultValue: 11 },
            sparkSize: { type: ControlType.Number, title: "Spark Size", unit: "px", min: 1, max: 12, step: 0.1, defaultValue: 3.6 },
            launchMin: { type: ControlType.Number, title: "Launch Min", unit: "px/s", min: 0, max: 1500, step: 10, defaultValue: 330 },
            launchMax: { type: ControlType.Number, title: "Launch Max", unit: "px/s", min: 0, max: 2000, step: 10, defaultValue: 720 },
            gravity: { type: ControlType.Number, title: "Gravity", unit: "px/s²", min: 100, max: 4000, step: 10, defaultValue: 1080 },
            fallSpeed: { type: ControlType.Number, title: "Fall Speed", unit: "px/s", min: 40, max: 800, step: 5, defaultValue: 180 },
            sway: { type: ControlType.Number, title: "Sway", min: 0, max: 200, step: 1, defaultValue: 60 },
            spin: { type: ControlType.Number, title: "Spin", unit: "°/s", min: 0, max: 720, step: 5, defaultValue: 150 },
            sparkGravity: { type: ControlType.Number, title: "Spark Gravity", unit: "px/s²", min: 100, max: 5000, step: 10, defaultValue: 2000 },
        },
    },
})

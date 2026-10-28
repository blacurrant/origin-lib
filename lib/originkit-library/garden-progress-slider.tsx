/**
 * GardenProgressSlider — Recreate the reference exactly. No description was given — read what it is and how it moves from the clip itself.
 *
 * Built on the Loader template (lib/templates/LoaderTemplate.tsx).
 * Only the EFFECT block and the effect controls are specific to this component.
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
import { addPropertyControls, ControlType } from "./framer-shim"
import { useEffect, useRef, type CSSProperties } from "react"

// ── moments-kit v1 ──
// Shared by every moments/ component. Canonical copy: moments/kit/moments-kit.v1.ts.
// Edit there, then paste verbatim into each component; moments/checks/kit-sync.mjs enforces it.

type RGBA = [number, number, number, number]

const COLOR_CACHE = new Map<string, RGBA | null>()

function parseColor(input: string | undefined, fallback: RGBA): RGBA {
    if (typeof input !== "string") return fallback
    let hit = COLOR_CACHE.get(input)
    if (hit === undefined) {
        hit = parseColorRaw(input)
        COLOR_CACHE.set(input, hit)
    }
    return hit ?? fallback
}

function parseColorRaw(raw: string): RGBA | null {
    let s = raw.trim()
    const v = /^var\(\s*--[^,]+,\s*(.+)\)$/.exec(s)
    if (v) s = v[1].trim()
    if (s[0] === "#") {
        const h = s.slice(1)
        const x = (a: string) => parseInt(a, 16)
        let r: number, g: number, b: number, a = 255
        if (h.length === 3 || h.length === 4) {
            r = x(h[0] + h[0]); g = x(h[1] + h[1]); b = x(h[2] + h[2])
            if (h.length === 4) a = x(h[3] + h[3])
        } else if (h.length === 6 || h.length === 8) {
            r = x(h.slice(0, 2)); g = x(h.slice(2, 4)); b = x(h.slice(4, 6))
            if (h.length === 8) a = x(h.slice(6, 8))
        } else return null
        const out: RGBA = [r / 255, g / 255, b / 255, a / 255]
        return out.every(Number.isFinite) ? out : null
    }
    const m = /^(rgba?|hsla?)\(([^)]*)\)$/i.exec(s)
    if (!m) return null
    const parts = m[2].split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const num = (p: string, scale: number) =>
        p.endsWith("%") ? (parseFloat(p) / 100) * scale : parseFloat(p)
    const alpha = parts.length > 3 ? num(parts[3], 1) : 1
    let rgb: [number, number, number]
    if (m[1].toLowerCase().startsWith("rgb")) {
        rgb = [num(parts[0], 255) / 255, num(parts[1], 255) / 255, num(parts[2], 255) / 255]
    } else {
        const hh = (((parseFloat(parts[0]) % 360) + 360) % 360) / 360
        const ss = num(parts[1], 1), ll = num(parts[2], 1)
        const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
        const p = 2 * ll - q
        const f = (t: number) => {
            t = (t + 1) % 1
            if (t < 1 / 6) return p + (q - p) * 6 * t
            if (t < 1 / 2) return q
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
            return p
        }
        rgb = [f(hh + 1 / 3), f(hh), f(hh - 1 / 3)]
    }
    const out: RGBA = [rgb[0], rgb[1], rgb[2], alpha]
    return out.every(Number.isFinite) ? out.map((c) => Math.min(1, Math.max(0, c))) as RGBA : null
}

function cssRgba(c: RGBA): string {
    return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3]})`
}

interface FramerFont {
    fontFamily?: string
    fontWeight?: number | string
    fontStyle?: string
    fontSize?: number | string
    lineHeight?: number | string
    letterSpacing?: number | string
}

const FALLBACK_FAMILY = "Inter, system-ui, sans-serif"

function quoteFamily(family: string): string {
    return family
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => (n[0] === "'" || n[0] === '"' || /^[a-z-]+$/i.test(n) ? n : `"${n.replace(/"/g, '\\"')}"`))
        .join(", ")
}

function fontShorthand(font: FramerFont | undefined, fallbackSize: number, fallbackWeight: number) {
    const f = font || {}
    let size = fallbackSize
    if (typeof f.fontSize === "number" && Number.isFinite(f.fontSize)) size = f.fontSize
    else if (typeof f.fontSize === "string") {
        const n = parseFloat(f.fontSize)
        if (Number.isFinite(n)) size = f.fontSize.includes("rem") ? n * 16 : n
    }
    let lineHeight = size * 1.3
    if (typeof f.lineHeight === "number" && Number.isFinite(f.lineHeight))
        lineHeight = f.lineHeight <= 4 ? f.lineHeight * size : f.lineHeight
    else if (typeof f.lineHeight === "string") {
        const n = parseFloat(f.lineHeight)
        if (Number.isFinite(n))
            lineHeight = f.lineHeight.endsWith("%") ? (n / 100) * size : f.lineHeight.endsWith("em") ? n * size : n <= 4 ? n * size : n
    }
    const family = f.fontFamily ? quoteFamily(f.fontFamily) : FALLBACK_FAMILY
    const shorthand = `${f.fontStyle || "normal"} ${f.fontWeight || fallbackWeight} ${size}px ${family}`
    return { shorthand, size, lineHeight }
}

function wrapLines(measure: (s: string) => number, text: string, maxWidth: number): string[] {
    const out: string[] = []
    for (const para of String(text ?? "").split("\n")) {
        const words = para.split(/ +/)
        let line = ""
        for (const w of words) {
            const next = line ? `${line} ${w}` : w
            if (line && measure(next) > maxWidth) {
                out.push(line)
                line = w
            } else line = next
        }
        out.push(line)
    }
    return out
}

function radiusPx(w: number, h: number, pct: number): number {
    return (Math.min(w, h) / 2) * Math.min(1, Math.max(0, pct / 100))
}

type Phase = "idle" | "playing" | "held" | "restoring"
interface TriggerState { phase: Phase; t: number; timer: number; prevPlay: boolean | undefined }
interface TriggerInput {
    dt: number; animDt: number; playDur: number; restoreDur: number; holdS: number
    play: boolean | undefined; clicked: boolean; onCanvas: boolean
}
interface TriggerEvents { started: boolean; completed: boolean; restored: boolean }

const TRIGGER_IDLE: TriggerState = { phase: "idle", t: 0, timer: 0, prevPlay: undefined }
const CANVAS_IDLE_S = 1
// R3 ruling: compare with epsilon everywhere a float accumulator (dt/animDt
// summed frame by frame) is checked against a duration boundary — repeated
// 0.1 additions land on 0.9999999999999999, not 1, so a strict >= misses the
// transition for exactly one extra frame and the reducer's own tests (which
// assert phase after an exact frame count) go red on that alone.
const EPS = 1e-9

// I2 ruling: controlled mode (play !== undefined) reacts to the play LEVEL
// each step, not an edge against prevPlay — an uncontrolled run (play was
// undefined, so prevPlay never became true) that switches straight to
// play:false must still interrupt on that very frame. prevPlay stays on the
// state shape (set below every step) but is no longer read for a decision.
// I1 ruling: only the two *interrupt* transitions — playing→restoring and
// restoring→playing — mirror progress (t = 1 - s.t) so a controlled toggle
// keeps the visual position continuous. held→restoring and idle→playing are
// normal starts and still begin at t = 0.
function stepTrigger(s: TriggerState, i: TriggerInput): { s: TriggerState; e: TriggerEvents } {
    const e: TriggerEvents = { started: false, completed: false, restored: false }
    const n: TriggerState = { ...s, prevPlay: i.play }
    const controlled = i.play !== undefined
    const start = (t = 0) => { n.phase = "playing"; n.t = t; n.timer = 0; e.started = true }
    const restore = (t = 0) => { n.phase = "restoring"; n.t = t; n.timer = 0 }

    switch (s.phase) {
        case "idle":
            n.timer = s.timer + i.dt
            if (controlled ? i.play === true : i.clicked || (i.onCanvas && n.timer >= CANVAS_IDLE_S - EPS)) start()
            break
        case "playing":
            if (controlled && i.play === false) { restore(1 - s.t); break }
            n.t = Math.min(1, s.t + i.animDt / Math.max(1e-3, i.playDur))
            if (n.t >= 1 - EPS) { n.t = 1; n.phase = "held"; n.timer = 0; e.completed = true }
            break
        case "held":
            if (controlled) { if (i.play === false) restore(0); break }
            n.timer = s.timer + i.dt
            if (n.timer >= i.holdS - EPS) restore(0)
            break
        case "restoring":
            if (controlled && i.play === true) { start(1 - s.t); break }
            n.t = Math.min(1, s.t + i.animDt / Math.max(1e-3, i.restoreDur))
            if (n.t >= 1 - EPS) { n.phase = "idle"; n.t = 0; n.timer = 0; e.restored = true }
            break
    }
    return { s: n, e }
}

interface CardSpec {
    w: number; h: number; dpr: number; fill: string; rounded: number
    title: string; body: string; font: FramerFont | undefined; textColor: string
    image: HTMLImageElement | null; pad: number
}
interface GlyphBox { ch: string; x: number; y: number; w: number; h: number }

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

/** Paints the card into ctx (canvas already sized w*dpr × h*dpr). Returns glyph boxes in CSS px when asked. */
function drawCard(ctx: CanvasRenderingContext2D, spec: CardSpec, wantGlyphs: boolean): GlyphBox[] {
    const { w, h, dpr, pad } = spec
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const r = radiusPx(w, h, spec.rounded)
    roundRectPath(ctx, 0, 0, w, h, r)
    ctx.fillStyle = cssRgba(parseColor(spec.fill, [1, 1, 1, 1]))
    ctx.fill()
    ctx.save()
    roundRectPath(ctx, 0, 0, w, h, r)
    ctx.clip()
    let y = pad
    if (spec.image && spec.image.naturalWidth > 0) {
        const ih = Math.round(h * 0.5)
        const s = Math.max(w / spec.image.naturalWidth, ih / spec.image.naturalHeight)
        const dw = spec.image.naturalWidth * s, dh = spec.image.naturalHeight * s
        ctx.save()
        ctx.beginPath(); ctx.rect(0, 0, w, ih); ctx.clip()
        ctx.drawImage(spec.image, (w - dw) / 2, (ih - dh) / 2, dw, dh)
        ctx.restore()
        y = ih + pad
    }
    const glyphs: GlyphBox[] = []
    const color = cssRgba(parseColor(spec.textColor, [0, 0, 0, 1]))
    const title = fontShorthand(spec.font, 22, 700)
    const body = fontShorthand(spec.font ? { ...spec.font, fontSize: title.size * 0.68, fontWeight: 400 } : undefined, 15, 400)
    const block = (text: string, f: { shorthand: string; size: number; lineHeight: number }) => {
        if (!text) return
        ctx.font = f.shorthand
        ctx.fillStyle = color
        ctx.textBaseline = "top"
        ctx.textAlign = "left"
        for (const line of wrapLines((s) => ctx.measureText(s).width, text, w - pad * 2)) {
            if (y + f.size > h - pad * 0.5) break
            ctx.fillText(line, pad, y)
            if (wantGlyphs) {
                // Prefix measures, so kerning between neighbours is respected.
                let prefix = ""
                for (const ch of line) {
                    const x = pad + ctx.measureText(prefix).width
                    const cw = pad + ctx.measureText(prefix + ch).width - x
                    if (ch.trim()) glyphs.push({ ch, x, y, w: cw, h: f.lineHeight })
                    prefix += ch
                }
            }
            y += f.lineHeight
        }
        y += f.size * 0.4
    }
    block(spec.title, title)
    block(spec.body, body)
    ctx.restore()
    return glyphs
}

function loadImage(src: string | undefined): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        if (!src || typeof Image === "undefined") return resolve(null)
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = src
    })
}

function createProgram<U extends string>(gl: WebGL2RenderingContext, vs: string, fs: string, uniforms: readonly U[]) {
    const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!
        gl.shaderSource(s, src)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(s) || "shader compile failed"
            gl.deleteShader(s)
            throw new Error(log)
        }
        return s
    }
    const program = gl.createProgram()!
    const vsh = sh(gl.VERTEX_SHADER, vs)
    const fsh = sh(gl.FRAGMENT_SHADER, fs)
    gl.attachShader(program, vsh)
    gl.attachShader(program, fsh)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program) || "link failed"
        gl.deleteShader(vsh)
        gl.deleteShader(fsh)
        gl.deleteProgram(program)
        throw new Error(log)
    }
    // Shaders are flagged for deletion once linked; the GL driver frees them
    // for real after they're detached, which happens when the program itself
    // is eventually deleted. No reason to keep the compile units around.
    gl.deleteShader(vsh)
    gl.deleteShader(fsh)
    const u = {} as Record<U, WebGLUniformLocation>
    for (const name of uniforms) {
        const loc = gl.getUniformLocation(program, name)
        if (!loc) {
            gl.deleteProgram(program)
            throw new Error(`uniform ${name} not found`)
        }
        u[name] = loc
    }
    return { program, u }
}
// ── /moments-kit ──

// ══ EFFECT — replace from here ══════════════════════════════════════════════

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    flowerCount: 52,
    seed: 7,
    stemMin: 60,
    stemMax: 135,
    headScale: 100,
    stemWidth: 2,
    growMs: 350,
    popMs: 250,
    staggerMs: 12,
    wiltMs: 450,
    petalCount: 6,
    petalMs: 1400,
    petalRise: 70,
    beeSpring: 7,
    beeOffset: 2,
    beeBob: 4,
    beeSize: 100,
    swayDeg: 2,
    labelSize: 22,
    percentAlpha: 70,
    trackThick: 5,
    trackAlpha: 45,
    trackColor: "#383936",
    tuftColor: "#5A6E54",
    demoHoldMs: 1500,
    tulipColor: "#E3B65C",
    poppyColor: "#F08A78",
    pinkColor: "#F7A2A7",
    daisyColor: "#F0E3DA",
    centreColor: "#E9B44C",
    blueColor: "#8FB6F0",
    lilacColor: "#A99BE0",
    asterColor: "#BBA6EA",
    beeColor: "#F2C14E",
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
type Adv = typeof ADVANCED_DEFAULTS

/** Effect-only props (≤ 3). Add matching rows at the end of addPropertyControls. */
interface EffectProps {
    value?: number
    demo?: boolean
    label?: string
    advanced?: Partial<typeof ADVANCED_DEFAULTS>
}

type Kind = "tulip" | "pinkTulip" | "poppy" | "cosmos" | "daisy" | "blue" | "lavender" | "aster" | "bud"
interface Leaf { f: number; side: number }
interface Slot {
    t: number; kind: Kind; len: number; lean: number; curve: number; phase: number; period: number
    leaves: Leaf[]; bud: number; alive: boolean; age: number; delay: number; s: number; h: number; bend: number
}
interface Petal { x: number; y: number; vx: number; vy: number; a: number; spin: number; life: number; max: number; color: string; len: number; round: boolean }
interface Tuft { d: number; h: number; lean: number }

interface Effect {
    slots: Slot[]
    key: string
    tufts: Tuft[]
    petals: Petal[]
    beeX: number
    beeV: number
    pct: number
    prevV: number
    first: boolean
    userV: number | null
    reduced: boolean
    noise: HTMLCanvasElement | null
    pattern: CanvasPattern | null
}

// Measured from the reference: the first eleven flowers (track fraction, kind, stem length in ref px).
const FIXED_SLOTS: [number, Kind, number][] = [
    [0.014, "tulip", 104],
    [0.036, "poppy", 115],
    [0.066, "daisy", 124],
    [0.101, "lavender", 83],
    [0.123, "daisy", 101],
    [0.151, "blue", 50],
    [0.173, "blue", 87],
    [0.221, "poppy", 116],
    [0.252, "cosmos", 59],
    [0.273, "pinkTulip", 99],
    [0.297, "poppy", 71],
]
const KIND_W: [Kind, number][] = [["daisy", 3], ["cosmos", 2], ["poppy", 2], ["aster", 1.3], ["blue", 1.5], ["lavender", 0.6], ["pinkTulip", 1], ["bud", 1.4]]
const TAIL_W: [Kind, number][] = [["bud", 4], ["daisy", 1.5], ["aster", 1], ["blue", 1], ["cosmos", 1], ["lavender", 0.6]]

// Demo drag, read from the clip (seconds, value 0..1).
const DEMO_KEYS: [number, number][] = [
    [0, 0.3], [0.29, 0.34], [0.88, 0.34], [1.27, 0.4], [1.56, 0.46], [1.85, 0.66], [2.14, 0.69], [2.43, 0.69],
    [2.73, 0.56], [3.02, 0.42], [3.31, 0.27], [3.7, 0.24], [3.87, 0.26], [4.02, 0.42], [4.07, 0.93], [4.12, 1],
]

function rng(seed: number) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function clamp01(x: number) {
    return x < 0 ? 0 : x > 1 ? 1 : x
}
function easeOut(t: number) {
    return 1 - Math.pow(1 - t, 3)
}
function backOut(t: number) {
    const c1 = 1.70158, c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
function col(s: string | undefined, fb: RGBA = [1, 1, 1, 1]) {
    return cssRgba(parseColor(s, fb))
}

function pickKind(r: number, tail: boolean): Kind {
    const w = tail ? TAIL_W : KIND_W
    let sum = 0
    for (const [, x] of w) sum += x
    let q = r * sum
    for (const [k, x] of w) {
        q -= x
        if (q <= 0) return k
    }
    return w[0][0]
}

function makeSlot(r: () => number, t: number, kind: Kind, len: number): Slot {
    const leafN = kind === "bud" ? (r() < 0.5 ? 0 : 1) : r() < 0.55 ? 1 : 2
    const leaves: Leaf[] = []
    let side = r() < 0.5 ? -1 : 1
    for (let i = 0; i < leafN; i++) {
        leaves.push({ f: 0.2 + r() * 0.35, side })
        side = -side
    }
    return {
        t, kind, len, lean: (r() - 0.5) * 0.12, curve: (r() - 0.5) * 0.14, phase: r() * Math.PI * 2, period: 2.5 + r() * 1.5,
        leaves, bud: Math.floor(r() * 3), alive: false, age: 0, delay: 0, s: 0, h: 0, bend: 0,
    }
}

function buildSlots(adv: Adv): Slot[] {
    const r = rng(Math.round(num(adv.seed, 7)) * 9973 + 1)
    const out: Slot[] = FIXED_SLOTS.map(([t, k, l]) => makeSlot(r, t, k, l))
    const count = Math.max(FIXED_SLOTS.length + 4, Math.min(120, Math.round(num(adv.flowerCount, 52))))
    const rest = count - FIXED_SLOTS.length
    const a = 0.322, b = 0.992
    const lo = num(adv.stemMin, 60), hi = Math.max(lo, num(adv.stemMax, 135))
    let prev: Kind = "poppy"
    for (let i = 0; i < rest; i++) {
        const t = a + ((b - a) * (i + 0.5 + (r() - 0.5) * 0.5)) / rest
        const tail = t > 0.86
        let kind = pickKind(r(), tail)
        if (kind === prev) kind = pickKind(r(), tail)
        prev = kind
        const taper = tail ? 1 - ((t - 0.86) / 0.14) * 0.45 : 1
        let len = (lo + (hi - lo) * r()) * taper
        if (kind === "bud") len *= 0.9
        const sl = makeSlot(r, t, kind, len)
        if (i === rest - 1) { sl.kind = "bud"; sl.lean = 0.16; sl.leaves = [] }
        out.push(sl)
    }
    return out
}

function buildTufts(): Tuft[] {
    const r = rng(4242)
    const out: Tuft[] = []
    for (let d = 2; d < 946; d += 5 + r() * 4) out.push({ d, h: 6 + r() * 8, lean: (r() - 0.5) * 0.52 })
    return out
}

function makeNoise(): HTMLCanvasElement | null {
    if (typeof document === "undefined") return null
    const c = document.createElement("canvas")
    c.width = 128
    c.height = 128
    const g = c.getContext("2d")
    if (!g) return null
    const img = g.createImageData(128, 128)
    const d = img.data
    for (let i = 0; i < 128 * 128; i++) {
        const v = Math.random() * 255
        d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255
    }
    g.putImageData(img, 0, 0)
    return c
}

function bakeEffect(_stage: Stage, _p: Props): Effect {
    const reduced = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    return {
        slots: [], key: "", tufts: buildTufts(), petals: [], beeX: 0, beeV: 0, pct: 0, prevV: 0, first: true,
        userV: null, reduced, noise: makeNoise(), pattern: null,
    }
}

function demoValue(clock: number, holdS: number): number {
    const end = 4.12 + holdS
    const period = end + 1.6
    const t = ((clock % period) + period) % period
    let k0: [number, number] = DEMO_KEYS[0]
    let k1: [number, number] = DEMO_KEYS[0]
    if (t >= 4.12) {
        if (t < end) return 1
        if (t < end + 0.8) { k0 = [end, 1]; k1 = [end + 0.8, 0.3] } else return 0.3
    } else {
        for (let i = 0; i < DEMO_KEYS.length - 1; i++) {
            if (t <= DEMO_KEYS[i + 1][0]) { k0 = DEMO_KEYS[i]; k1 = DEMO_KEYS[i + 1]; break }
        }
    }
    const f = clamp01((t - k0[0]) / Math.max(1e-4, k1[0] - k0[0]))
    const g = f * 0.5 + f * f * (3 - 2 * f) * 0.5
    return k0[1] + (k1[1] - k0[1]) * g
}

function kindColor(k: Kind, adv: Adv, bud: number): string {
    switch (k) {
        case "tulip": return adv.tulipColor
        case "poppy": return adv.poppyColor
        case "pinkTulip":
        case "cosmos": return adv.pinkColor
        case "daisy": return adv.daisyColor
        case "blue": return adv.blueColor
        case "lavender": return adv.lilacColor
        case "aster": return adv.asterColor
        default: return bud === 0 ? adv.daisyColor : bud === 1 ? adv.pinkColor : adv.asterColor
    }
}

function ringOfCircles(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, rr: number, pr: number, rot: number) {
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr
        ctx.moveTo(x + pr, y)
        ctx.arc(x, y, pr, 0, Math.PI * 2)
    }
    ctx.fill()
}
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
}
function petalRing(ctx: CanvasRenderingContext2D, cy: number, n: number, rr: number, rx: number, ry: number) {
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const x = Math.cos(a) * rr, y = cy + Math.sin(a) * rr
        ctx.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * rx)
        ctx.ellipse(x, y, rx, ry, a, 0, Math.PI * 2)
    }
    ctx.fill()
}

/** Head in reference px, origin at the stem top, up = −y. */
function drawHead(ctx: CanvasRenderingContext2D, sl: Slot, adv: Adv) {
    ctx.fillStyle = col(kindColor(sl.kind, adv, sl.bud))
    switch (sl.kind) {
        case "tulip":
        case "pinkTulip": {
            const k = sl.kind === "pinkTulip" ? 0.9 : 1
            ctx.beginPath()
            ctx.moveTo(-10 * k, -16 * k)
            ctx.lineTo(-5 * k, -11 * k)
            ctx.lineTo(0, -18 * k)
            ctx.lineTo(5 * k, -11 * k)
            ctx.lineTo(10 * k, -16 * k)
            ctx.quadraticCurveTo(11 * k, 0, 0, 1 * k)
            ctx.quadraticCurveTo(-11 * k, 0, -10 * k, -16 * k)
            ctx.closePath()
            ctx.fill()
            break
        }
        case "poppy": {
            ringOfCircles(ctx, 0, -12, 8, 9, 6, sl.phase)
            disc(ctx, 0, -12, 10)
            ctx.fillStyle = "#7A3A34"
            disc(ctx, 0, -12, 3.5)
            break
        }
        case "cosmos": {
            ringOfCircles(ctx, 0, -11, 6, 7.5, 6.5, sl.phase)
            disc(ctx, 0, -11, 10)
            ctx.fillStyle = "#E0707A"
            disc(ctx, 0, -11, 4.5)
            break
        }
        case "daisy": {
            petalRing(ctx, -10, 11, 6.5, 5, 2.4)
            ctx.fillStyle = col(adv.centreColor)
            disc(ctx, 0, -10, 4)
            break
        }
        case "aster": {
            petalRing(ctx, -10, 12, 7, 5.5, 1.9)
            ctx.fillStyle = "#EFE6F2"
            disc(ctx, 0, -10, 3.5)
            break
        }
        case "blue": {
            ringOfCircles(ctx, 0, -9, 5, 5, 4.3, -Math.PI / 2)
            ctx.fillStyle = col(adv.centreColor)
            disc(ctx, 0, -9, 2)
            break
        }
        case "lavender": {
            ctx.beginPath()
            for (let i = 0; i < 6; i++) {
                const s = 0.7 + (0.3 * i) / 5
                const x = i % 2 ? 1.5 : -1.5, y = -6 + i * 6.5
                ctx.moveTo(x + 4.2 * s, y)
                ctx.ellipse(x, y, 4.2 * s, 4 * s, 0, 0, Math.PI * 2)
            }
            ctx.fill()
            break
        }
        default:
            disc(ctx, 0, -2, 2.8)
    }
}

function drawBee(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, tilt: number, flap: number, adv: Adv) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(tilt)
    ctx.scale(k, k)
    ctx.fillStyle = col(adv.beeColor, [0.95, 0.76, 0.3, 1])
    ctx.beginPath()
    ctx.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.fillStyle = "#3A3530"
    ctx.fillRect(-8, -14, 3.5, 28)
    ctx.fillRect(0, -14, 3.5, 28)
    ctx.restore()
    ctx.fillStyle = "#3A3530"
    disc(ctx, 11, -3, 1.8)
    ctx.strokeStyle = "#3A3530"
    ctx.lineWidth = 1.2
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(12, -9)
    ctx.quadraticCurveTo(15, -13, 18, -14)
    ctx.stroke()
    ctx.fillStyle = "rgba(214, 218, 222, 0.72)"
    ctx.beginPath()
    ctx.ellipse(-2, -15, 5.5, 8 * flap, -0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
}

function spawnPetals(fx: Effect, sl: Slot, x: number, y: number, u: number, adv: Adv) {
    const n = 3 + Math.floor(Math.random() * Math.max(1, Math.round(num(adv.petalCount, 6)) - 2))
    const color = col(kindColor(sl.kind, adv, sl.bud))
    const round = sl.kind === "blue" || sl.kind === "bud" || sl.kind === "lavender"
    const rise = num(adv.petalRise, 70) * u
    const life = Math.max(0.1, num(adv.petalMs, 1400) / 1000)
    for (let i = 0; i < n; i++) {
        if (fx.petals.length > 400) break
        const l = life * (0.8 + Math.random() * 0.4)
        fx.petals.push({
            x: x + (Math.random() - 0.5) * 16 * u,
            y: y - 10 * u + (Math.random() - 0.5) * 12 * u,
            vx: (Math.random() * 1.6 - 0.5) * rise * 0.7,
            vy: -(0.4 + Math.random() * 0.8) * rise,
            a: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 6,
            life: l,
            max: l,
            color,
            len: round ? 2.4 * u : (3 + Math.random() * 3) * u,
            round,
        })
    }
}

/**
 * One frame. `clock` is seconds of speed-scaled time; `progress` is 0..1
 * (eased) or null when indeterminate. (cx, cy) is the centre, `size` the
 * garden track's length in CSS px.
 */
function drawEffect(stage: Stage, fx: Effect, p: Props, cx: number, cy: number, size: number, clock: number, progress: number | null, dt: number): void {
    const { ctx, W, H } = stage
    const adv: Adv = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
    const L = size
    const u = L / 946
    const x0 = cx - L / 2
    const trackY = cy + 71 * u
    const ptr = stage.pointer
    const hoverK = Math.max(0, num(adv.hover, 50)) / 50

    const key = `${adv.flowerCount}|${adv.seed}|${adv.stemMin}|${adv.stemMax}`
    if (key !== fx.key) {
        fx.key = key
        fx.slots = buildSlots(adv)
        fx.first = true
    }

    // Value: progress prop, then a drag on the garden, then the demo, then the Value control.
    if (progress === null && ptr.down && ptr.over > 0.05 && ptr.y > trackY - 220 * u && ptr.y < trackY + 50 * u && ptr.x > x0 - 40 * u && ptr.x < x0 + L + 40 * u)
        fx.userV = clamp01((ptr.x - x0) / Math.max(1, L))
    let v: number
    if (progress !== null) v = progress
    else if (fx.userV !== null) v = fx.userV
    else if (p.demo !== false && !fx.reduced) v = demoValue(clock, Math.max(0, num(adv.demoHoldMs, 1500)) / 1000)
    else v = clamp01(num(p.value, 30) / 100)

    const instant = fx.first || fx.reduced
    const headX = x0 + v * L
    const growS = Math.max(0.05, num(adv.growMs, 350) / 1000)
    const popS = Math.max(0.05, num(adv.popMs, 250) / 1000)
    const wiltS = Math.max(0.05, num(adv.wiltMs, 450) / 1000)
    const staggerS = Math.max(0, num(adv.staggerMs, 12)) / 1000
    const swayRad = fx.reduced ? 0 : (num(adv.swayDeg, 2) * Math.PI) / 180
    const green = col(p.accent, [0.42, 0.52, 0.38, 1])

    // Track
    const thick = Math.max(1, num(adv.trackThick, 5)) * u
    ctx.lineCap = "round"
    ctx.lineWidth = thick
    const tc = parseColor(adv.trackColor, [0.22, 0.22, 0.21, 1])
    ctx.strokeStyle = cssRgba([tc[0], tc[1], tc[2], tc[3] * clamp01(num(adv.trackAlpha, 45) / 100)])
    ctx.beginPath()
    ctx.moveTo(x0, trackY)
    ctx.lineTo(x0 + L, trackY)
    ctx.stroke()
    if (v > 0.001) {
        ctx.strokeStyle = green
        ctx.beginPath()
        ctx.moveTo(x0, trackY)
        ctx.lineTo(headX, trackY)
        ctx.stroke()
        // Grass tufts on the filled part
        ctx.strokeStyle = col(adv.tuftColor, [0.35, 0.43, 0.33, 1])
        ctx.lineWidth = 1.3 * u
        ctx.beginPath()
        for (const tf of fx.tufts) {
            const x = x0 + tf.d * u
            if (x > headX) break
            const y = trackY - thick / 2
            ctx.moveTo(x, y + 0.5 * u)
            ctx.lineTo(x + Math.sin(tf.lean) * tf.h * u, y - Math.cos(tf.lean) * tf.h * u)
        }
        ctx.stroke()
    }

    // Flowers
    const n = fx.slots.length
    const sig = 70 * u
    const headK = (Math.max(0, num(adv.headScale, 100)) / 100) * u
    const stemW = Math.max(0.5, num(adv.stemWidth, 2)) * u
    for (const sl of fx.slots) {
        const bx = x0 + sl.t * L
        const dx = bx - ptr.x
        const near = ptr.over > 0.001 ? Math.sign(dx || 1) * Math.exp(-(dx * dx) / (sig * sig)) * ptr.over * hoverK * ((6 * Math.PI) / 180) : 0
        sl.bend += (near - sl.bend) * (1 - Math.exp(-10 * dt))

        let justDied = false
        if (!sl.alive && sl.t <= v) {
            sl.alive = true
            if (instant) { sl.age = 99; sl.delay = 0 }
            else {
                sl.age = (1 - Math.cbrt(1 - Math.min(1, sl.s))) * growS
                sl.delay = sl.s > 0 ? 0 : Math.max(0, sl.t - fx.prevV) * n * staggerS
            }
        } else if (sl.alive && sl.t > v + 0.002) {
            sl.alive = false
            justDied = true
        }
        if (sl.alive) {
            if (sl.delay > 0) sl.delay -= dt
            else sl.age += dt
            sl.s = easeOut(clamp01(sl.age / growS))
            sl.h = sl.age > 0.7 * growS ? backOut(clamp01((sl.age - 0.7 * growS) / popS)) : 0
        }

        const th = sl.lean + Math.sin((clock * Math.PI * 2) / sl.period + sl.phase) * swayRad + sl.bend
        const len = sl.len * u * sl.s
        const tx = bx + Math.sin(th) * len
        const ty = trackY - Math.cos(th) * len
        const head = sl.h

        if (justDied && !fx.reduced && sl.h > 0.3) spawnPetals(fx, sl, tx, ty, u, adv)
        if (!sl.alive) {
            sl.s = fx.reduced ? 0 : Math.max(0, sl.s - dt / wiltS)
            sl.h = 0
        }
        if (len < 0.5) continue

        const cpx = (bx + tx) / 2 + Math.cos(th) * sl.curve * len
        const cpy = (trackY + ty) / 2 + Math.sin(th) * sl.curve * len
        ctx.strokeStyle = green
        ctx.fillStyle = green
        ctx.lineWidth = sl.kind === "bud" ? stemW * 0.65 : stemW
        ctx.beginPath()
        ctx.moveTo(bx, trackY)
        ctx.quadraticCurveTo(cpx, cpy, tx, ty)
        ctx.stroke()

        const g = clamp01((sl.s - 0.4) / 0.35)
        if (g > 0) {
            for (const lf of sl.leaves) {
                const f = lf.f, q = 1 - f
                const px = q * q * bx + 2 * q * f * cpx + f * f * tx
                const py = q * q * trackY + 2 * q * f * cpy + f * f * ty
                const la = th + lf.side * 0.75
                const lx = Math.sin(la), ly = -Math.cos(la)
                ctx.beginPath()
                ctx.ellipse(px + lx * 5 * u * g, py + ly * 5 * u * g, 5 * u * g, 2.3 * u * g, la - Math.PI / 2, 0, Math.PI * 2)
                ctx.fill()
            }
        }
        if (head > 0.01 && !justDied) {
            ctx.save()
            ctx.translate(tx, ty)
            ctx.rotate(th * 0.7)
            const k = headK * head
            ctx.scale(k, k)
            drawHead(ctx, sl, adv)
            ctx.restore()
        }
    }

    // Petals
    const keep: Petal[] = []
    for (const pt of fx.petals) {
        pt.life -= dt
        if (pt.life <= 0) continue
        pt.vy += 18 * u * dt
        const drag = Math.exp(-1.0 * dt)
        pt.vx *= drag
        pt.vy *= drag
        pt.x += pt.vx * dt
        pt.y += pt.vy * dt
        pt.a += pt.spin * dt
        ctx.globalAlpha = clamp01(pt.life / (0.35 * pt.max))
        ctx.fillStyle = pt.color
        ctx.beginPath()
        ctx.ellipse(pt.x, pt.y, pt.len, pt.round ? pt.len : pt.len * 0.45, pt.a, 0, Math.PI * 2)
        ctx.fill()
        keep.push(pt)
    }
    ctx.globalAlpha = 1
    fx.petals = keep

    // Bee: a critically damped spring after the head
    const target = Math.min(x0 + L, Math.max(x0, headX + num(adv.beeOffset, 2) * u))
    if (instant) { fx.beeX = target; fx.beeV = 0 }
    else {
        const w = Math.max(0.5, num(adv.beeSpring, 7))
        fx.beeV += (w * w * (target - fx.beeX) - 2 * w * fx.beeV) * dt
        fx.beeX += fx.beeV * dt
    }
    const bob = fx.reduced ? 0 : Math.sin(clock * Math.PI * 2 * 3) * num(adv.beeBob, 4) * u
    const tilt = fx.reduced ? 0 : Math.max(-0.3, Math.min(0.3, (fx.beeV / Math.max(1, 1500 * u)) * 0.25))
    const flap = fx.reduced ? 1 : 0.7 + 0.3 * Math.abs(Math.sin(clock * 55))
    drawBee(ctx, fx.beeX, trackY - 22 * u + bob, u * (Math.max(10, num(adv.beeSize, 100)) / 100), tilt, flap, adv)

    // Label and readout
    if (instant) fx.pct = v * 100
    else fx.pct += (v * 100 - fx.pct) * (1 - Math.exp(-dt / 0.2))
    const fs = Math.max(4, num(adv.labelSize, 22) * u)
    ctx.font = `400 ${fs}px Inter, system-ui, sans-serif`
    ctx.textBaseline = "alphabetic"
    const tcol = parseColor(p.color, [0.76, 0.72, 0.72, 1])
    ctx.fillStyle = cssRgba(tcol)
    ctx.textAlign = "left"
    ctx.fillText(typeof p.label === "string" ? p.label : "Garden", x0 - 21 * u, cy - 133 * u)
    ctx.fillStyle = cssRgba([tcol[0], tcol[1], tcol[2], tcol[3] * clamp01(num(adv.percentAlpha, 70) / 100)])
    ctx.textAlign = "right"
    ctx.fillText(`${Math.round(fx.pct)}%`, x0 + L + 20 * u, cy - 133 * u)
    ctx.textAlign = "left"

    // Overlays
    const grain = clamp01(num(adv.grain, 0) / 100)
    if (grain > 0 && fx.noise) {
        if (!fx.pattern) fx.pattern = ctx.createPattern(fx.noise, "repeat")
        if (fx.pattern) {
            const ox = Math.floor(Math.random() * 128), oy = Math.floor(Math.random() * 128)
            ctx.save()
            ctx.globalAlpha = grain * 0.22
            ctx.translate(-ox, -oy)
            ctx.fillStyle = fx.pattern
            ctx.fillRect(0, 0, W + 128, H + 128)
            ctx.restore()
        }
    }
    const vig = clamp01(num(adv.vignette, 0) / 100)
    if (vig > 0) {
        const m = Math.max(W, H)
        const gr = ctx.createRadialGradient(W / 2, H / 2, m * 0.3, W / 2, H / 2, m * 0.75)
        gr.addColorStop(0, "rgba(0, 0, 0, 0)")
        gr.addColorStop(1, `rgba(0, 0, 0, ${vig})`)
        ctx.fillStyle = gr
        ctx.fillRect(0, 0, W, H)
    }

    fx.prevV = v
    fx.first = false
}

// ══ /EFFECT ═════════════════════════════════════════════════════════════════

interface Props extends EffectProps {
    background?: string
    color?: string
    accent?: string
    size?: number
    speed?: number
    /** 0–100 for a determinate loader; omit for indeterminate. No panel row. */
    progress?: number
    style?: CSSProperties
}
interface Stage {
    ctx: CanvasRenderingContext2D
    W: number
    H: number
    dpr: number
    /**
     * The pointer over the stage, for the effect's pointer response (RULES.md):
     * x, y in CSS px; `over` eases to 1 while it is over the stage and back to 0
     * after; `down` while pressed. Scale the response by the Advanced `hover` row.
     */
    pointer: StagePointer
}
interface StagePointer {
    x: number
    y: number
    over: number
    down: boolean
}

function num(v: unknown, d: number): number {
    return typeof v === "number" && Number.isFinite(v) ? v : d
}

export default function GardenProgressSlider(props: Props) {
    props = withMovedControls(props)
    // Read live from propsRef; destructured here so their defaults sit in the signature.
    const { background = "#000000", color = "#C2B8B8", accent = "#6C8462", size = 800, speed = 50, style } = props
    void [color, accent, size, speed]
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const propsRef = useRef(props)
    propsRef.current = props

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!root || !canvas || !ctx) return
        const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const stage: Stage = { ctx, W: 0, H: 0, dpr: 1, pointer: { x: 0, y: 0, over: 0, down: false } }
        const resize = () => {
            stage.W = root.offsetWidth
            stage.H = root.offsetHeight
            stage.dpr = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = Math.max(1, Math.round(stage.W * stage.dpr))
            canvas.height = Math.max(1, Math.round(stage.H * stage.dpr))
        }
        const ro = new ResizeObserver(resize)
        ro.observe(root)
        resize()

        // The pointer, for the effect's pointer response. offsetX/Y, never
        // getBoundingClientRect: that carries the canvas zoom.
        let pointerInside = false
        const onPointerMove = (e: PointerEvent) => {
            stage.pointer.x = e.offsetX
            stage.pointer.y = e.offsetY
            pointerInside = true
        }
        const onPointerLeave = () => {
            pointerInside = false
            stage.pointer.down = false
        }
        const onPointerDown = () => {
            stage.pointer.down = true
        }
        const onPointerUp = () => {
            stage.pointer.down = false
        }
        canvas.addEventListener("pointermove", onPointerMove)
        canvas.addEventListener("pointerenter", onPointerMove)
        canvas.addEventListener("pointerleave", onPointerLeave)
        canvas.addEventListener("pointerdown", onPointerDown)
        window.addEventListener("pointerup", onPointerUp)
        window.addEventListener("pointercancel", onPointerUp)

        let fx: Effect | null = null
        let key = ""
        let shown = 0
        let clock = 0
        let raf = 0
        let last = -1
        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            stage.pointer.over += ((pointerInside ? 1 : 0) - stage.pointer.over) * (1 - Math.exp(-8 * dt))
            last = now
            const p = propsRef.current
            const next = JSON.stringify([stage.W, stage.H, stage.dpr])
            if (next !== key || !fx) {
                key = next
                fx = bakeEffect(stage, p)
            }
            const rate = (Math.max(0, Math.min(100, num(p.speed, 50))) / 50) * (reduced ? 0.25 : 1)
            const animDt = dt * rate
            clock += animDt
            const target = typeof p.progress === "number" && Number.isFinite(p.progress) ? Math.max(0, Math.min(1, p.progress / 100)) : null
            if (target !== null) shown += (target - shown) * (1 - Math.exp(-8 * dt))
            const sz = Math.max(20, Math.min(800, num(p.size, 800)))
            ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0)
            ctx.clearRect(0, 0, stage.W, stage.H)
            drawEffect(stage, fx, p, stage.W / 2, stage.H / 2, sz, clock, target === null ? null : shown, animDt)
        }
        raf = requestAnimationFrame(frame)
        return () => {
            cancelAnimationFrame(raf)
            canvas.removeEventListener("pointermove", onPointerMove)
            canvas.removeEventListener("pointerenter", onPointerMove)
            canvas.removeEventListener("pointerleave", onPointerLeave)
            canvas.removeEventListener("pointerdown", onPointerDown)
            window.removeEventListener("pointerup", onPointerUp)
            window.removeEventListener("pointercancel", onPointerUp)
            ro.disconnect()
        }
    }, [])

    return (
        <div ref={rootRef} role="progressbar" aria-busy="true" style={{ position: "relative", minWidth: 1200, minHeight: 800, overflow: "hidden", background, ...style }}>
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
        </div>
    )
}

addPropertyControls(GardenProgressSlider, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    color: { type: ControlType.Color, title: "Color", defaultValue: "#C2B8B8" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#6C8462" },
    label: { type: ControlType.String, title: "Label", defaultValue: "Garden" },
    size: { type: ControlType.Number, title: "Size", min: 20, max: 800, step: 1, unit: "px", defaultValue: 800 },
    speed: { type: ControlType.Number, title: "Speed", min: 0, max: 100, step: 1, defaultValue: 50 },
    // ── effect controls (≤ 3) ──
    value: { type: ControlType.Number, title: "Value", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30 },
    demo: { type: ControlType.Boolean, title: "Demo", defaultValue: true, enabledTitle: "On", disabledTitle: "Off" },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            flowerCount: { type: ControlType.Number, title: "Flowers", min: 20, max: 90, step: 1, defaultValue: 52 },
            seed: { type: ControlType.Number, title: "Seed", min: 1, max: 999, step: 1, defaultValue: 7 },
            stemMin: { type: ControlType.Number, title: "Stem Min", min: 10, max: 200, step: 1, unit: "px", defaultValue: 60 },
            stemMax: { type: ControlType.Number, title: "Stem Max", min: 10, max: 300, step: 1, unit: "px", defaultValue: 135 },
            headScale: { type: ControlType.Number, title: "Bloom Size", min: 40, max: 250, step: 1, unit: "%", defaultValue: 100 },
            stemWidth: { type: ControlType.Number, title: "Stem Width", min: 1, max: 8, step: 1, unit: "px", defaultValue: 2 },
            growMs: { type: ControlType.Number, title: "Grow", min: 50, max: 2000, step: 10, unit: "ms", defaultValue: 350 },
            popMs: { type: ControlType.Number, title: "Bloom Pop", min: 50, max: 1500, step: 10, unit: "ms", defaultValue: 250 },
            staggerMs: { type: ControlType.Number, title: "Stagger", min: 0, max: 100, step: 1, unit: "ms", defaultValue: 12 },
            wiltMs: { type: ControlType.Number, title: "Wilt", min: 50, max: 2000, step: 10, unit: "ms", defaultValue: 450 },
            petalCount: { type: ControlType.Number, title: "Petals Max", min: 3, max: 12, step: 1, defaultValue: 6 },
            petalMs: { type: ControlType.Number, title: "Petal Life", min: 200, max: 4000, step: 10, unit: "ms", defaultValue: 1400 },
            petalRise: { type: ControlType.Number, title: "Petal Rise", min: 0, max: 300, step: 1, unit: "px", defaultValue: 70 },
            beeSpring: { type: ControlType.Number, title: "Bee Follow", min: 1, max: 30, step: 1, defaultValue: 7 },
            beeOffset: { type: ControlType.Number, title: "Bee Offset", min: -60, max: 60, step: 1, unit: "px", defaultValue: 2 },
            beeBob: { type: ControlType.Number, title: "Bee Bob", min: 0, max: 20, step: 1, unit: "px", defaultValue: 4 },
            beeSize: { type: ControlType.Number, title: "Bee Size", min: 10, max: 300, step: 1, unit: "%", defaultValue: 100 },
            swayDeg: { type: ControlType.Number, title: "Sway", min: 0, max: 15, step: 1, unit: "°", defaultValue: 2 },
            labelSize: { type: ControlType.Number, title: "Label Size", min: 8, max: 60, step: 1, unit: "px", defaultValue: 22 },
            percentAlpha: { type: ControlType.Number, title: "Percent Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 70 },
            trackThick: { type: ControlType.Number, title: "Track Weight", min: 1, max: 20, step: 1, unit: "px", defaultValue: 5 },
            trackAlpha: { type: ControlType.Number, title: "Track Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 45 },
            trackColor: { type: ControlType.Color, title: "Track", defaultValue: "#383936" },
            tuftColor: { type: ControlType.Color, title: "Grass Tufts", defaultValue: "#5A6E54" },
            demoHoldMs: { type: ControlType.Number, title: "Demo Hold", min: 0, max: 6000, step: 10, unit: "ms", defaultValue: 1500 },
            tulipColor: { type: ControlType.Color, title: "Tulip", defaultValue: "#E3B65C" },
            poppyColor: { type: ControlType.Color, title: "Poppy", defaultValue: "#F08A78" },
            pinkColor: { type: ControlType.Color, title: "Pink", defaultValue: "#F7A2A7" },
            daisyColor: { type: ControlType.Color, title: "Daisy", defaultValue: "#F0E3DA" },
            centreColor: { type: ControlType.Color, title: "Centres", defaultValue: "#E9B44C" },
            blueColor: { type: ControlType.Color, title: "Forget-me-not", defaultValue: "#8FB6F0" },
            lilacColor: { type: ControlType.Color, title: "Lavender", defaultValue: "#A99BE0" },
            asterColor: { type: ControlType.Color, title: "Aster", defaultValue: "#BBA6EA" },
            beeColor: { type: ControlType.Color, title: "Bee", defaultValue: "#F2C14E" },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
        },
    },
})

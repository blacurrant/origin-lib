/**
 * BloomWaveText — this is good, we can have this by making little chagne
 *
 * Built on the Text template (lib/templates/TextTemplate.tsx).
 * Only the EFFECT block and the effect controls are specific to this component.
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"
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

const PLAY_S = 1.2
const RESTORE_S = 1.2
const DEFAULT_TEXT = "Thinking..."
const DEFAULT_FONT: FramerFont = { fontFamily: "Inter", fontWeight: 400, fontSize: 160, lineHeight: 1.2 }

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    blue: "#3A8EE6",
    green: "#2FA37A",
    orange: "#F07A3A",
    pink: "#F6C3CF",
    cream: "#F4EEE6",
    centreMix: 55,
    petals: 5,
    petalSize: 50,
    centreSize: 34,
    sizeJitter: 30,
    spacing: 50,
    band: 60,
    lead: 195,
    bloomBand: 12,
    speckBand: 14,
    inkLag: 60,
    overshoot: 100,
    frontJitter: 4,
    wobble: 12,
    sag: 30,
    bulge: 25,
    speckDensity: 300,
    speckSize: 2,
    hover: 50,
    hoverRadius: 9,
    hoverPush: 60,
    hoverBloom: 100,
    grain: 0,
    vignette: 0,
    seed: 7,
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

/** Effect-only props (≤ 3). Add matching rows at the end of addPropertyControls. */
interface EffectProps {
    ink?: string
    density?: number
    flowerSize?: number
    advanced?: Partial<typeof ADVANCED_DEFAULTS>
}

interface Flower {
    x: number
    y: number
    xn: number
    r: number
    rot: number
    k: number
    ph: number
}
interface Speck {
    x: number
    y: number
    xn: number
    s: number
    th: number
}
interface Effect {
    ink: HTMLCanvasElement
    scratch: HTMLCanvasElement | null
    sctx: CanvasRenderingContext2D | null
    bx0: number
    bx1: number
    em: number
    sprites: HTMLCanvasElement[]
    spriteS: number
    spriteR0: number
    flowers: Flower[]
    specks: Speck[][]
    speckColors: string[]
    grain: HTMLCanvasElement | null
    adv: typeof ADVANCED_DEFAULTS
}

function bwClamp(v: number, a = 0, b = 1): number {
    return v < a ? a : v > b ? b : v
}
function bwSmooth(a: number, b: number, x: number): number {
    if (b <= a) return x >= b ? 1 : 0
    const t = bwClamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
}
function bwBack(x: number, c1: number): number {
    const c3 = c1 + 1
    const u = x - 1
    return 1 + c3 * u * u * u + c1 * u * u
}
function bwRand(seed: number): () => number {
    let a = seed | 0
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
function bwMix(a: RGBA, b: RGBA, k: number): string {
    return cssRgba([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, 1])
}
const BW_FALLBACK: RGBA[] = [
    [0.23, 0.56, 0.9, 1],
    [0.18, 0.64, 0.48, 1],
    [0.94, 0.48, 0.23, 1],
    [0.96, 0.76, 0.81, 1],
    [0.96, 0.93, 0.9, 1],
]

/** The tinted glyph mask alone: always succeeds, so the word paints even if the flower bake fails. */
function bwInk(mask: GlyphMask, color: string | undefined): HTMLCanvasElement {
    const ink = document.createElement("canvas")
    ink.width = Math.max(1, mask.w)
    ink.height = Math.max(1, mask.h)
    const ix = ink.getContext("2d")
    if (ix) {
        ix.drawImage(mask.canvas, 0, 0)
        ix.globalCompositeOperation = "source-in"
        ix.fillStyle = cssRgba(parseColor(color, [1, 1, 1, 1]))
        ix.fillRect(0, 0, ink.width, ink.height)
        ix.globalCompositeOperation = "source-over"
    }
    return ink
}

function bakeEffect(stage: Stage, mask: GlyphMask, p: Props): Effect {
    const adv = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
    const ink = bwInk(mask, p.ink)
    const base: Effect = {
        ink, scratch: null, sctx: null, bx0: 0, bx1: Math.max(1, mask.w - 1), em: Math.max(1, mask.fontPx * stage.dpr),
        sprites: [], spriteS: 1, spriteR0: 1, flowers: [], specks: [], speckColors: [], grain: null, adv,
    }
    try {
        return bakeFlowers(stage, mask, p, base)
    } catch {
        return base
    }
}

function bakeFlowers(stage: Stage, mask: GlyphMask, p: Props, base: Effect): Effect {
    const adv = base.adv
    const { w, h, alpha } = mask
    const dpr = Math.max(1, stage.dpr || 1)
    const em = base.em
    if (w < 4 || h < 4 || em < 4) return base

    const scratch = document.createElement("canvas")
    scratch.width = w
    scratch.height = h
    const sctx = scratch.getContext("2d")

    // Inside pixels (strided so the list stays small) and the text's horizontal extent.
    const step = Math.max(1, Math.round(em / 48))
    const inside: number[] = []
    let minX = w
    let maxX = -1
    for (let y = 0; y < h; y += step)
        for (let x = 0; x < w; x += step) {
            if (alpha[y * w + x] > 0.5) {
                if (inside.length < 200000) inside.push(y * w + x)
                if (x < minX) minX = x
                if (x > maxX) maxX = x
            }
        }
    if (inside.length === 0 || maxX < minX) return base
    const span = Math.max(1, maxX - minX)
    const rand = bwRand(Math.round(num(adv.seed, 7)) * 9973 + 17)

    // Flower anchors: Poisson-disc rejection sampling inside the glyphs.
    const sizeK = bwClamp(num(p.flowerSize, 71), 10, 400) / 100
    const baseR = Math.max(1.5, 0.075 * em * sizeK)
    const jit = bwClamp(num(adv.sizeJitter, 30), 0, 90) / 100
    const inkArea = (inside.length * step * step) / (em * em)
    const target = Math.max(0, Math.min(2400, Math.round(inkArea * 5 * bwClamp(num(p.density, 80), 0, 100))))
    const minD = Math.max(1, (baseR * bwClamp(num(adv.spacing, 50), 0, 200)) / 100)
    const gw = Math.ceil(w / minD) + 4
    const grid = new Map<number, number[]>()
    const pts: number[] = []
    const fj = bwClamp(num(adv.frontJitter, 4), 0, 30) / 100
    const tries = Math.min(72000, target * 30)
    for (let a = 0; a < tries && pts.length / 2 < target; a++) {
        const idx = inside[Math.floor(rand() * inside.length)]
        const x = (idx % w) + rand() * step
        const y = Math.floor(idx / w) + rand() * step
        const cx = Math.floor(x / minD) + 1
        const cy = Math.floor(y / minD) + 1
        let ok = true
        for (let dy = -1; dy <= 1 && ok; dy++)
            for (let dx = -1; dx <= 1 && ok; dx++) {
                const list = grid.get((cy + dy) * gw + cx + dx)
                if (!list) continue
                for (let n = 0; n < list.length; n++) {
                    const j = list[n]
                    const ddx = pts[j] - x
                    const ddy = pts[j + 1] - y
                    if (ddx * ddx + ddy * ddy < minD * minD) {
                        ok = false
                        break
                    }
                }
            }
        if (!ok) continue
        const key = cy * gw + cx
        const list = grid.get(key)
        if (list) list.push(pts.length)
        else grid.set(key, [pts.length])
        pts.push(x, y)
    }
    const weights = [1, 1, 1.1, 0.9, 0.35]
    const wSum = 4.35
    const pick = () => {
        let r = rand() * wSum
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i]
            if (r <= 0) return i
        }
        return 0
    }
    const flowers: Flower[] = []
    for (let i = 0; i + 1 < pts.length; i += 2) {
        flowers.push({
            x: mask.x + pts[i],
            y: mask.y + pts[i + 1],
            xn: (pts[i] - minX) / span + (rand() * 2 - 1) * fj,
            r: baseR * (1 - jit + rand() * 2 * jit),
            rot: rand() * Math.PI * 2,
            k: pick(),
            ph: rand() * Math.PI * 2,
        })
    }

    // Flower sprites: petals round a contrasting centre.
    const cols = [adv.blue, adv.green, adv.orange, adv.pink, adv.cream].map((c, i) => parseColor(c, BW_FALLBACK[i]))
    const white: RGBA = [1, 1, 1, 1]
    const R0 = Math.max(2, baseR * (1 + jit) * 1.3)
    const S = Math.min(256, Math.ceil(R0 * 1.05) + 2)
    const petals = Math.round(bwClamp(num(adv.petals, 5), 3, 12))
    const petalK = bwClamp(num(adv.petalSize, 50), 10, 100) / 100
    const centreK = bwClamp(num(adv.centreSize, 34), 0, 100) / 100
    const mixK = bwClamp(num(adv.centreMix, 55), 0, 100) / 100
    const sprites: HTMLCanvasElement[] = []
    for (let i = 0; i < cols.length; i++) {
        const c = cols[i]
        const cv = document.createElement("canvas")
        cv.width = S * 2
        cv.height = S * 2
        const g = cv.getContext("2d")
        if (g) {
            g.translate(S, S)
            g.fillStyle = cssRgba([c[0], c[1], c[2], 1])
            const pr = R0 * petalK
            const pd = R0 - pr
            for (let k = 0; k < petals; k++) {
                const a = (k / petals) * Math.PI * 2 - Math.PI / 2
                g.beginPath()
                g.arc(Math.cos(a) * pd, Math.sin(a) * pd, pr, 0, Math.PI * 2)
                g.fill()
            }
            g.fillStyle = i === 4 ? cssRgba([cols[2][0], cols[2][1], cols[2][2], 1]) : bwMix(c, white, mixK)
            g.beginPath()
            g.arc(0, 0, Math.max(0.5, R0 * centreK), 0, Math.PI * 2)
            g.fill()
        }
        sprites.push(cv)
    }

    // Speckle: fine coloured grains inside the ink at each front.
    const speckColors = [adv.blue, adv.green, adv.orange, adv.pink, "#B0B7BD"].map((c) => cssRgba(parseColor(c, [0.7, 0.7, 0.7, 1])))
    const specks: Speck[][] = speckColors.map(() => [])
    const nSpeck = Math.min(6000, Math.round((flowers.length * bwClamp(num(adv.speckDensity, 300), 0, 1000)) / 100))
    const ss = Math.max(0.5, num(adv.speckSize, 2)) * dpr
    for (let i = 0; i < nSpeck; i++) {
        const idx = inside[Math.floor(rand() * inside.length)]
        const x = (idx % w) + rand() * step
        specks[Math.floor(rand() * speckColors.length) % speckColors.length].push({
            x: mask.x + x,
            y: mask.y + Math.floor(idx / w) + rand() * step,
            xn: (x - minX) / span,
            s: ss * (0.5 + rand()),
            th: rand(),
        })
    }

    // Grain tile.
    const grain = document.createElement("canvas")
    grain.width = 128
    grain.height = 128
    const gx = grain.getContext("2d")
    if (gx) {
        const img = gx.createImageData(128, 128)
        for (let i = 0; i < 128 * 128; i++) {
            const v = Math.floor(rand() * 255)
            img.data[i * 4] = v
            img.data[i * 4 + 1] = v
            img.data[i * 4 + 2] = v
            img.data[i * 4 + 3] = 255
        }
        gx.putImageData(img, 0, 0)
    }

    return {
        ...base,
        scratch, sctx, bx0: minX, bx1: maxX, sprites, spriteS: S, spriteR0: R0,
        flowers, specks, speckColors, grain,
    }
}

/**
 * One sweep across play + restore: a band of flowers travels left→right.
 * Ahead of it the word is ink; behind it the ink comes back.
 */
function drawEffect(stage: Stage, mask: GlyphMask, fx: Effect, t: number, phase: Phase): void {
    const { ctx } = stage
    ctx.save()
    try {
        drawBloom(stage, mask, fx, t, phase)
    } catch {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
        ctx.drawImage(fx.ink, mask.x, mask.y)
    }
    ctx.restore()
}

function drawBloom(stage: Stage, mask: GlyphMask, fx: Effect, t: number, phase: Phase): void {
    const { ctx } = stage
    const dpr = Math.max(1, stage.dpr || 1)
    const adv = fx.adv
    const P = phase === "playing" ? t : phase === "held" ? 1 : phase === "restoring" ? 2 - t : 0
    const u = bwClamp(P / 2)
    const B = Math.max(0.01, num(adv.bloomBand, 12) / 100)
    const L = Math.max(0, num(adv.speckBand, 14) / 100)
    const J = bwClamp(num(adv.frontJitter, 4), 0, 30) / 100
    const lag = Math.max(0.05, num(adv.inkLag, 60) / 100)
    const band = bwClamp(num(adv.band, 60), 5, 200) / 100
    const leadK = Math.max(0.5, num(adv.lead, 195) / 100)
    // Trailing (wilt) front clears the word exactly at the end of the sweep; the leading front runs ahead, faster early on.
    const fw = u * (1 + B + 2 * J + band) - band - J
    const fb = Math.min(fw + band * 1.6, u * leadK - J)
    const bandW = Math.max(1e-3, fb - fw)
    const Wd = stage.W * dpr
    const Hd = stage.H * dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Ink, faded out behind the bloom front and back in behind the wilt front.
    const N = 48
    const stops: number[] = []
    let allInk = true
    for (let i = 0; i <= N; i++) {
        const xn = i / N
        const gone = bwSmooth(B * 0.2, B * (0.2 + lag), fb - xn)
        const back = bwSmooth(B * 0.1, B * (0.1 + lag), fw - xn)
        const a = Math.max(1 - gone, back)
        stops.push(a)
        if (a < 0.999) allInk = false
    }
    const s = fx.sctx
    if (allInk || !s || !fx.scratch || fx.flowers.length === 0) {
        ctx.drawImage(fx.ink, mask.x, mask.y)
    } else {
        s.setTransform(1, 0, 0, 1, 0, 0)
        s.globalCompositeOperation = "source-over"
        s.clearRect(0, 0, fx.scratch.width, fx.scratch.height)
        s.drawImage(fx.ink, 0, 0)
        s.globalCompositeOperation = "destination-in"
        const g = s.createLinearGradient(fx.bx0, 0, Math.max(fx.bx0 + 1, fx.bx1), 0)
        for (let i = 0; i <= N; i++) g.addColorStop(i / N, `rgba(0,0,0,${bwClamp(stops[i]).toFixed(3)})`)
        s.fillStyle = g
        s.fillRect(0, 0, fx.scratch.width, fx.scratch.height)
        s.globalCompositeOperation = "source-over"
        ctx.drawImage(fx.scratch, mask.x, mask.y)
    }

    // Speckle in a band around each front.
    if (P > 0 && P < 2) {
        for (let c = 0; c < fx.specks.length; c++) {
            ctx.fillStyle = fx.speckColors[c]
            for (const sp of fx.specks[c]) {
                const dB = fb - sp.xn
                const dW = fw - sp.xn
                const vB = bwSmooth(-L, 0, dB) * (1 - bwSmooth(B * 0.3, B * 0.9, dB))
                const vW = bwSmooth(B * 0.5, B, dW) * (1 - bwSmooth(B, B + L, dW))
                if (Math.max(vB, vW) > sp.th) ctx.fillRect(sp.x - sp.s / 2, sp.y - sp.s / 2, sp.s, sp.s)
            }
        }
    }

    // Pointer: blooms flowers near it and pushes them open.
    const hv = (bwClamp(num(adv.hover, 50), 0, 100) / 50) * bwClamp(stage.pointer.over)
    const px = stage.pointer.x * dpr
    const py = stage.pointer.y * dpr
    const hR = Math.max(1, (num(adv.hoverRadius, 9) / 100) * Wd * (stage.pointer.down ? 1.4 : 1))
    const c1 = 1.70158 * Math.max(0, num(adv.overshoot, 100) / 100)
    const sagPx = (num(adv.sag, 30) / 30) * 0.13 * fx.em
    const bulge = num(adv.bulge, 25) / 100
    const wob = num(adv.wobble, 12) / 100
    const push = num(adv.hoverPush, 60) / 100
    const hb = num(adv.hoverBloom, 100) / 100
    const S = fx.spriteS
    const R0 = Math.max(1, fx.spriteR0)
    if (fx.sprites.length === 5) {
        for (const f of fx.flowers) {
            const dB = fb - f.xn
            const bloom = bwClamp(dB / B)
            const wilt = bwClamp((fw - f.xn) / B)
            let sc = bloom > 0 ? bwBack(bloom, c1) * (1 - wilt * wilt * wilt) : 0
            let x = f.x
            let y = f.y
            if (hv > 0.001) {
                const dx = f.x - px
                const dy = f.y - py
                const d = Math.hypot(dx, dy)
                const fall = 1 - bwSmooth(0, hR, d)
                if (fall > 0) {
                    sc = Math.max(sc, bwClamp(fall * hv * hb) * 0.95)
                    if (d > 0.5) {
                        const m = push * f.r * 1.5 * fall * Math.min(2, hv)
                        x += (dx / d) * m
                        y += (dy / d) * m
                    }
                }
            }
            if (!(sc > 0.02)) continue
            const xc = bwClamp(f.xn)
            const sinA = Math.sin(Math.PI * bwClamp(dB / bandW))
            y += sagPx * sinA * Math.pow(xc, 1.5) * Math.min(1, sc)
            x += wob * f.r * Math.sin(f.ph + P * 9.4)
            y += wob * f.r * Math.cos(f.ph * 1.3 + P * 7.1)
            const rr = f.r * sc * (1 + bulge * sinA * xc)
            const k = rr / R0
            const a = f.rot + P * 0.6
            const cs = Math.cos(a) * k
            const sn = Math.sin(a) * k
            ctx.setTransform(cs, sn, -sn, cs, x, y)
            ctx.drawImage(fx.sprites[f.k], -S, -S)
        }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Vignette and grain overlays.
    const vig = bwClamp(num(adv.vignette, 0) / 100)
    if (vig > 0) {
        const g = ctx.createRadialGradient(Wd / 2, Hd / 2, Math.min(Wd, Hd) * 0.25, Wd / 2, Hd / 2, Math.max(1, Math.hypot(Wd, Hd) / 2))
        g.addColorStop(0, "rgba(0,0,0,0)")
        g.addColorStop(1, `rgba(0,0,0,${(vig * 0.85).toFixed(3)})`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, Wd, Hd)
    }
    const gr = bwClamp(num(adv.grain, 0) / 100)
    if (gr > 0 && fx.grain) {
        const pat = ctx.createPattern(fx.grain, "repeat")
        if (pat) {
            ctx.setTransform(1, 0, 0, 1, -Math.floor(Math.random() * 128), -Math.floor(Math.random() * 128))
            ctx.globalAlpha = gr * 0.35
            ctx.fillStyle = pat
            ctx.fillRect(0, 0, Wd + 128, Hd + 128)
            ctx.globalAlpha = 1
            ctx.setTransform(1, 0, 0, 1, 0, 0)
        }
    }
}

// ══ /EFFECT ═════════════════════════════════════════════════════════════════

interface Props extends EffectProps {
    background?: string
    speed?: number
    hold?: number
    autoPlay?: boolean
    text?: string
    font?: FramerFont
    play?: boolean
    onComplete?: () => void
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
/** Cropped glyph mask in DEVICE px: `canvas` is w×h, placed at (x, y) on the stage canvas. */
interface GlyphMask {
    canvas: HTMLCanvasElement
    alpha: Float32Array
    x: number
    y: number
    w: number
    h: number
    fontPx: number
}

function num(v: unknown, d: number): number {
    return typeof v === "number" && Number.isFinite(v) ? v : d
}

/** Chamfer distance (device px) from each inside pixel (alpha > 0.5) to the nearest outside pixel. */
function distanceInside(a: Float32Array, w: number, h: number): Float32Array {
    const d = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) d[i] = a[i] > 0.5 ? 1e9 : 0
    const D2 = Math.SQRT2
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const i = y * w + x
            if (d[i] === 0) continue
            let v = d[i]
            if (x > 0) v = Math.min(v, d[i - 1] + 1)
            if (y > 0) {
                v = Math.min(v, d[i - w] + 1)
                if (x > 0) v = Math.min(v, d[i - w - 1] + D2)
                if (x < w - 1) v = Math.min(v, d[i - w + 1] + D2)
            }
            d[i] = v
        }
    for (let y = h - 1; y >= 0; y--)
        for (let x = w - 1; x >= 0; x--) {
            const i = y * w + x
            if (d[i] === 0) continue
            let v = d[i]
            if (x < w - 1) v = Math.min(v, d[i + 1] + 1)
            if (y < h - 1) {
                v = Math.min(v, d[i + w] + 1)
                if (x < w - 1) v = Math.min(v, d[i + w + 1] + D2)
                if (x > 0) v = Math.min(v, d[i + w - 1] + D2)
            }
            d[i] = v
        }
    return d
}
void distanceInside

function buildMask(W: number, H: number, dpr: number, text: string, font: FramerFont): GlyphMask {
    const full = document.createElement("canvas")
    full.width = Math.max(1, Math.round(W * dpr))
    full.height = Math.max(1, Math.round(H * dpr))
    const ctx = full.getContext("2d")!
    const size0 = num(DEFAULT_FONT.fontSize, 160)
    let f = fontShorthand(font, size0, 700)
    ctx.font = f.shorthand
    const raw = String(text ?? "").split("\n")
    const widest = Math.max(1, ...raw.map((l) => ctx.measureText(l).width))
    const fit = Math.min(1, (W * 0.86) / widest, (H * 0.8) / (f.lineHeight * raw.length))
    if (fit < 1) f = fontShorthand({ ...font, fontSize: f.size * fit, lineHeight: f.lineHeight / f.size }, size0, 700)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = f.shorthand
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#fff"
    const top = H / 2 - (f.lineHeight * (raw.length - 1)) / 2
    raw.forEach((line, i) => ctx.fillText(line, W / 2, top + i * f.lineHeight))
    const pad = Math.ceil(8 * dpr)
    const x0 = Math.max(0, Math.floor((W / 2 - W * 0.47) * dpr))
    const y0 = Math.max(0, Math.floor((top - f.lineHeight) * dpr) - pad)
    const x1 = Math.min(full.width, Math.ceil((W / 2 + W * 0.47) * dpr))
    const y1 = Math.min(full.height, Math.ceil((top + f.lineHeight * raw.length) * dpr) + pad)
    const w = Math.max(1, x1 - x0)
    const h = Math.max(1, y1 - y0)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    canvas.getContext("2d")!.drawImage(full, x0, y0, w, h, 0, 0, w, h)
    const px = canvas.getContext("2d")!.getImageData(0, 0, w, h).data
    const alpha = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) alpha[i] = px[i * 4 + 3] / 255
    return { canvas, alpha, x: x0, y: y0, w, h, fontPx: f.size }
}

export default function BloomWaveText(props: Props) {
    props = withMovedControls(props)
    // speed / hold are read live from propsRef; destructured here so their defaults sit in the signature.
    const { background = "#000000", speed = 19, hold = 0, autoPlay = true, style } = props
    void [speed, hold, autoPlay]
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const propsRef = useRef(props)
    propsRef.current = props

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!root || !canvas || !ctx) return
        const onCanvas = RenderTarget.current() === RenderTarget.canvas
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

        let mask: GlyphMask | null = null
        let fx: Effect | null = null
        let key = ""
        let fontTick = 0
        const loadedFonts = new Set<string>()
        const sync = () => {
            const p = propsRef.current
            const font = p.font || DEFAULT_FONT
            const text = p.text ?? DEFAULT_TEXT
            const effectKeys = Object.keys(p).filter((n) => !["text", "font", "style", "play", "onComplete", "speed", "hold", "autoPlay", "background"].includes(n))
            const next = JSON.stringify([text, font, stage.W, stage.H, stage.dpr, fontTick, effectKeys.map((n) => (p as Record<string, unknown>)[n])])
            if (next === key && fx) return
            key = next
            const sh = fontShorthand(font, 160, 700).shorthand
            if (!loadedFonts.has(sh) && document.fonts?.load) {
                loadedFonts.add(sh)
                document.fonts.load(sh).then(() => fontTick++, () => {})
            }
            mask = buildMask(stage.W, stage.H, stage.dpr, text, font)
            fx = bakeEffect(stage, mask, p)
        }

        let clicked = false
        let state: TriggerState = TRIGGER_IDLE
        const onDown = () => {
            clicked = true
        }
        canvas.addEventListener("pointerdown", onDown)

        let raf = 0
        let last = -1
        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            stage.pointer.over += ((pointerInside ? 1 : 0) - stage.pointer.over) * (1 - Math.exp(-8 * dt))
            last = now
            sync()
            const p = propsRef.current
            const r = stepTrigger(state, {
                dt,
                animDt: dt * (Math.max(0, Math.min(100, num(p.speed, 19))) / 50),
                playDur: reduced ? 0.2 : PLAY_S,
                restoreDur: reduced ? 0.2 : RESTORE_S,
                holdS: Math.max(0, Math.min(10, num(p.hold, 0))),
                play: p.play,
                clicked,
                // Auto Play: the left→right sweep restarts by itself (1 s of plain text between sweeps), in preview as on the canvas.
                onCanvas: onCanvas || (p.autoPlay ?? true) === true,
            })
            clicked = false
            state = r.s
            if (r.e.completed) p.onComplete?.()
            const t = state.phase === "playing" ? state.t : state.phase === "held" ? 1 : state.phase === "restoring" ? 1 - state.t : 0
            ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0)
            ctx.clearRect(0, 0, stage.W, stage.H)
            if (mask && fx) drawEffect(stage, mask, fx, t, state.phase)
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
            canvas.removeEventListener("pointerdown", onDown)
        }
    }, [])

    return (
        <div ref={rootRef} style={{ position: "relative", minWidth: 1200, minHeight: 800, overflow: "hidden", background, ...style }}>
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: "pointer" }} />
        </div>
    )
}

addPropertyControls(BloomWaveText, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    // ── effect controls (≤ 3) ──
    ink: { type: ControlType.Color, title: "Text Color", defaultValue: "#FFFFFF" },
    text: { type: ControlType.String, title: "Text", displayTextArea: true, defaultValue: "Thinking..." },
    font: { type: ControlType.Font, title: "Font", controls: "extended", defaultValue: {"fontFamily":"Inter","variant":"Regular","fontWeight":400,"fontSize":160,"lineHeight":1.2,"letterSpacing":"0em","textAlign":"left"} },
    speed: { type: ControlType.Number, title: "Speed", min: 0, max: 100, step: 1, defaultValue: 19 },
    hold: { type: ControlType.Number, title: "Hold", min: 0, max: 10, step: 1, unit: "s", defaultValue: 0 },
    autoPlay: { type: ControlType.Boolean, title: "Auto Play", defaultValue: true },
    density: { type: ControlType.Number, title: "Density", min: 10, max: 100, step: 1, unit: "%", defaultValue: 80 },
    flowerSize: { type: ControlType.Number, title: "Flower Size", min: 40, max: 200, step: 1, unit: "%", defaultValue: 71 },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            blue: { type: ControlType.Color, title: "Blue", defaultValue: "#3A8EE6" },
            green: { type: ControlType.Color, title: "Green", defaultValue: "#2FA37A" },
            orange: { type: ControlType.Color, title: "Orange", defaultValue: "#F07A3A" },
            pink: { type: ControlType.Color, title: "Pink", defaultValue: "#F6C3CF" },
            cream: { type: ControlType.Color, title: "Cream", defaultValue: "#F4EEE6" },
            centreMix: { type: ControlType.Number, title: "Centre Lighten", min: 0, max: 100, step: 1, unit: "%", defaultValue: 55 },
            petals: { type: ControlType.Number, title: "Petals", min: 3, max: 12, step: 1, defaultValue: 5 },
            petalSize: { type: ControlType.Number, title: "Petal Size", min: 10, max: 100, step: 1, unit: "%", defaultValue: 50 },
            centreSize: { type: ControlType.Number, title: "Centre Size", min: 0, max: 100, step: 1, unit: "%", defaultValue: 34 },
            sizeJitter: { type: ControlType.Number, title: "Size Jitter", min: 0, max: 90, step: 1, unit: "%", defaultValue: 30 },
            spacing: { type: ControlType.Number, title: "Spacing", min: 0, max: 200, step: 1, unit: "%", defaultValue: 50 },
            band: { type: ControlType.Number, title: "Band Width", min: 5, max: 200, step: 1, unit: "%", defaultValue: 60 },
            lead: { type: ControlType.Number, title: "Lead Speed", min: 50, max: 400, step: 1, unit: "%", defaultValue: 195 },
            bloomBand: { type: ControlType.Number, title: "Bloom Band", min: 1, max: 60, step: 1, unit: "%", defaultValue: 12 },
            speckBand: { type: ControlType.Number, title: "Speck Band", min: 0, max: 60, step: 1, unit: "%", defaultValue: 14 },
            inkLag: { type: ControlType.Number, title: "Ink Fade", min: 5, max: 300, step: 1, unit: "%", defaultValue: 60 },
            overshoot: { type: ControlType.Number, title: "Overshoot", min: 0, max: 300, step: 1, unit: "%", defaultValue: 100 },
            frontJitter: { type: ControlType.Number, title: "Front Jitter", min: 0, max: 30, step: 1, unit: "%", defaultValue: 4 },
            wobble: { type: ControlType.Number, title: "Wobble", min: 0, max: 100, step: 1, unit: "%", defaultValue: 12 },
            sag: { type: ControlType.Number, title: "Sag", min: 0, max: 100, step: 1, defaultValue: 30 },
            bulge: { type: ControlType.Number, title: "Bulge", min: 0, max: 100, step: 1, unit: "%", defaultValue: 25 },
            speckDensity: { type: ControlType.Number, title: "Speck Density", min: 0, max: 1000, step: 1, unit: "%", defaultValue: 300 },
            speckSize: { type: ControlType.Number, title: "Speck Size", min: 1, max: 8, step: 1, unit: "px", defaultValue: 2 },
            hoverRadius: { type: ControlType.Number, title: "Hover Radius", min: 1, max: 40, step: 1, unit: "%", defaultValue: 9 },
            hoverPush: { type: ControlType.Number, title: "Hover Push", min: 0, max: 200, step: 1, unit: "%", defaultValue: 60 },
            hoverBloom: { type: ControlType.Number, title: "Hover Bloom", min: 0, max: 100, step: 1, unit: "%", defaultValue: 100 },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
            seed: { type: ControlType.Number, title: "Seed", min: 1, max: 999, step: 1, defaultValue: 7 },
        },
    },
})

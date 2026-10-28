/**
 * LiquidGlassClock — glass-tube clock with glowing liquid hands and a sweeping needle.
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
import { addPropertyControls, ControlType } from "./framer-shim"
import { useEffect, useRef, type CSSProperties } from "react"

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

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    revolutionMs: 6700,
    sprintMs: 350,
    sprintDeg: 60,
    startAngle: 42,
    minuteAngle: 265,
    hourAngle: 82,
    minuteStep: 1,
    stepMs: 300,
    slosh: 50,
    liquidGlow: 100,
    swirl: 70,
    markerBase: 35,
    markerGlow: 20,
    trailMs: 1200,
    markerInner: 86,
    markerThick: 42,
    handInner: 17,
    minuteOuter: 85,
    minuteThick: 105,
    hourOuter: 56,
    hourThick: 100,
    needleLength: 87,
    needleTail: 21,
    needleWidth: 14,
    hubSize: 30,
    offsetY: -1,
    glassOpacity: 92,
    bubbles: 8,
    glassDark: "#05090D",
    rimColor: "#3D7598",
    specColor: "#7FB8D6",
    bubbleColor: "#CFE6F2",
    liquidDeep: "#0D6FC8",
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

interface EffectProps {
    liquid?: number
    markers?: number
    /** "loader" sweeps as before; "current" shows the device time; "set" starts at hour:minute and runs on. */
    timeMode?: string
    hour?: number
    minute?: number
    advanced?: Partial<typeof ADVANCED_DEFAULTS>
}

interface Effect {
    grain: CanvasPattern | null
    setKey: number
    setAt: number
    last: number
    leanM: number
    leanH: number
    press: number
    boost: number
}

interface Glass {
    body: RGBA
    dark: RGBA
    rim: RGBA
    spec: RGBA
    bubble: RGBA
    opacity: number
}

interface LiquidBlob {
    u: number
    len: number
    a: number
}

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const WHITE: RGBA = [1, 1, 1, 1]

function fract(x: number): number {
    return x - Math.floor(x)
}

function hash(n: number): number {
    return fract(Math.sin(n * 127.1 + 311.7) * 43758.5453)
}

function clamp01(x: number): number {
    return Math.max(0, Math.min(1, x))
}

function rgba(c: RGBA, a: number): string {
    return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${clamp01(a * c[3])})`
}

function mixColor(a: RGBA, b: RGBA, t: number): RGBA {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]
}

/** A slug of liquid travelling along a tube: s is its own 0..1 clock, it runs for `span` of it. */
function slug(s: number, span: number, from: number, to: number): { u: number; a: number } {
    if (s >= span) return { u: to, a: 0 }
    const k = s / span
    const a = Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.2)
    return { u: from + (to - from) * k, a: clamp01(a) }
}

/**
 * A glass capsule along +x from x0 to x1 (context already rotated): a dark
 * cylinder with lighter walls, glowing liquid slugs with swirling cores,
 * white specks, a rim and specular streaks.
 */
function glassTube(
    ctx: CanvasRenderingContext2D,
    x0: number,
    x1: number,
    th: number,
    g: Glass,
    glow: RGBA,
    deep: RGBA,
    blobs: LiquidBlob[],
    lit: number,
    seed: number,
    nBub: number,
    phase: number,
    swirl: number
): void {
    const len = x1 - x0
    const r = th / 2
    if (len <= 0 || th <= 0) return
    const rr = Math.min(r, len / 2)

    roundRectPath(ctx, x0, -r, len, th, rr)
    const body = ctx.createLinearGradient(0, -r, 0, r)
    body.addColorStop(0, rgba(g.body, g.opacity))
    body.addColorStop(0.3, rgba(g.dark, g.opacity))
    body.addColorStop(0.7, rgba(g.dark, g.opacity))
    body.addColorStop(1, rgba(g.body, g.opacity))
    ctx.fillStyle = body
    ctx.fill()

    ctx.save()
    roundRectPath(ctx, x0, -r, len, th, rr)
    ctx.clip()
    if (lit > 0.002) {
        ctx.globalCompositeOperation = "lighter"
        const core = mixColor(glow, WHITE, 0.55)
        for (let bi = 0; bi < blobs.length; bi++) {
            const b = blobs[bi]
            if (b.len <= 0.005 || b.a <= 0.002) continue
            const c = x0 + b.u * len
            const hl = Math.max(1, (b.len * len) / 2)
            const a = Math.min(1, b.a * lit)
            const gr = ctx.createLinearGradient(c - hl, 0, c + hl, 0)
            gr.addColorStop(0, rgba(deep, 0))
            gr.addColorStop(0.2, rgba(deep, a * 0.8))
            gr.addColorStop(0.5, rgba(glow, a))
            gr.addColorStop(0.8, rgba(deep, a * 0.8))
            gr.addColorStop(1, rgba(deep, 0))
            ctx.fillStyle = gr
            ctx.fillRect(c - hl, -r, hl * 2, th)
            // Swirling bright cores inside the slug.
            if (swirl > 0.01 && b.len > 0.08) {
                for (let k = 0; k < 5; k++) {
                    const hs = seed * 13 + bi * 5.1 + k * 3.7
                    const sx = c + (hash(hs) - 0.5) * hl * 1.5 + Math.sin(phase * 3 + k * 1.9) * hl * 0.12
                    const sw = hl * (0.18 + 0.25 * hash(hs + 1.3))
                    const sh = th * (0.18 + 0.22 * hash(hs + 2.9))
                    const sy = (hash(hs + 4.1) - 0.5) * th * 0.35 + Math.cos(phase * 2 + k) * th * 0.05
                    const fall = 1 - Math.min(1, Math.abs(sx - c) / (hl * 1.05))
                    const aa = a * fall * swirl
                    if (aa < 0.01) continue
                    ctx.save()
                    ctx.translate(sx, sy)
                    ctx.scale(Math.max(0.5, sw), Math.max(0.5, sh))
                    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
                    rg.addColorStop(0, rgba(core, aa))
                    rg.addColorStop(0.45, rgba(glow, aa * 0.7))
                    rg.addColorStop(1, rgba(glow, 0))
                    ctx.fillStyle = rg
                    ctx.beginPath()
                    ctx.arc(0, 0, 1, 0, TAU)
                    ctx.fill()
                    ctx.restore()
                }
            }
        }
        ctx.globalCompositeOperation = "source-over"
        // Glass depth: the liquid feathers out toward both long walls.
        const shade = ctx.createLinearGradient(0, -r, 0, r)
        shade.addColorStop(0, rgba(g.dark, 0.5))
        shade.addColorStop(0.25, rgba(g.dark, 0))
        shade.addColorStop(0.72, rgba(g.dark, 0))
        shade.addColorStop(1, rgba(g.dark, 0.55))
        ctx.fillStyle = shade
        ctx.fillRect(x0, -r, len, th)
    }
    // Fine white specks in the glass.
    ctx.lineCap = "round"
    for (let i = 0; i < nBub; i++) {
        const s = seed * 31 + i * 7.13
        const u = 0.08 + 0.84 * fract(hash(s) + 0.01 * Math.sin(phase + i * 1.7))
        const bx = x0 + u * len
        const by = (hash(s + 3.1) - 0.5) * th * 0.5
        const l = th * (0.12 + 0.2 * hash(s + 5.3))
        const ang = (hash(s + 7.7) - 0.5) * 1.2
        ctx.beginPath()
        ctx.moveTo(bx - (Math.cos(ang) * l) / 2, by - (Math.sin(ang) * l) / 2)
        ctx.lineTo(bx + (Math.cos(ang) * l) / 2, by + (Math.sin(ang) * l) / 2)
        ctx.lineWidth = Math.max(0.6, th * 0.05)
        ctx.strokeStyle = rgba(g.bubble, 0.6)
        ctx.stroke()
    }
    ctx.restore()

    roundRectPath(ctx, x0, -r, len, th, rr)
    ctx.lineWidth = Math.max(1, th * 0.08)
    ctx.strokeStyle = rgba(g.rim, 0.95)
    ctx.stroke()

    ctx.lineCap = "round"
    if (len > th * 1.2) {
        ctx.beginPath()
        ctx.moveTo(x0 + r * 0.9, -r * 0.55)
        ctx.lineTo(x1 - r * 0.9, -r * 0.55)
        ctx.lineWidth = Math.max(0.75, th * 0.06)
        ctx.strokeStyle = rgba(g.spec, 0.55)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x0 + r, r * 0.6)
        ctx.lineTo(x1 - r, r * 0.6)
        ctx.lineWidth = Math.max(0.6, th * 0.05)
        ctx.strokeStyle = rgba(g.spec, 0.3)
        ctx.stroke()
    }
    const hot = mixColor(g.spec, WHITE, 0.6)
    ctx.fillStyle = rgba(hot, 0.85)
    ctx.beginPath()
    ctx.arc(x1 - r * 0.8, -r * 0.4, Math.max(0.6, th * 0.07), 0, TAU)
    ctx.fill()
}

function bakeEffect(stage: Stage, _p: Props): Effect {
    let grain: CanvasPattern | null = null
    if (typeof document !== "undefined") {
        const c = document.createElement("canvas")
        c.width = 128
        c.height = 128
        const g = c.getContext("2d")
        if (g) {
            const img = g.createImageData(128, 128)
            const d = img.data
            for (let i = 0; i < d.length; i += 4) {
                const v = Math.random() * 255
                d[i] = v
                d[i + 1] = v
                d[i + 2] = v
                d[i + 3] = 255
            }
            g.putImageData(img, 0, 0)
            grain = stage.ctx.createPattern(c, "repeat")
        }
    }
    return { grain, setKey: -1, setAt: 0, last: -1, leanM: 0, leanH: 0, press: 0, boost: 0 }
}

/**
 * One frame. `clock` is seconds of speed-scaled time; `progress` is 0..1
 * (eased) or null when indeterminate. (cx, cy) is the centre, `size` the
 * loader's diameter in CSS px.
 */
function drawEffect(stage: Stage, fx: Effect, p: Props, cx: number, cy: number, size: number, clock: number, progress: number | null, dt: number): void {
    void dt
    const { ctx, W, H } = stage
    const adv = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }

    // Real time for the pointer easing, so it still settles at speed 0.
    const now = typeof performance !== "undefined" ? performance.now() : 0
    const rdt = fx.last < 0 ? 0 : Math.min(0.05, Math.max(0, (now - fx.last) / 1000))
    fx.last = now
    const ease = 1 - Math.exp(-6 * rdt)
    const hk = Math.max(0, num(adv.hover, 50)) / 50

    const R = size / 2
    const oy = cy + (num(adv.offsetY, -1) / 100) * H

    // Clock mode: seconds since midnight, from the device clock or from a set
    // hour:minute that keeps running from the moment it was set.
    const mode = p.timeMode === "current" || p.timeMode === "set" ? p.timeMode : "loader"
    let clockTime: number | null = null
    if (mode !== "loader") {
        const d = new Date()
        const dayS = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000
        if (mode === "current") clockTime = dayS
        else {
            const sh = Math.max(0, Math.min(23, Math.round(num(p.hour, 10))))
            const sm = Math.max(0, Math.min(59, Math.round(num(p.minute, 10))))
            const k = sh * 60 + sm
            if (fx.setKey !== k) {
                fx.setKey = k
                fx.setAt = dayS
            }
            clockTime = k * 60 + ((((dayS - fx.setAt) % 86400) + 86400) % 86400)
        }
    }

    // Needle: an even sweep, then a quick fall into 12 (sprintDeg in sprintMs).
    const T = Math.max(1, num(adv.revolutionMs, 6700) / 1000)
    const sprintS = Math.max(0, Math.min(T * 0.5, num(adv.sprintMs, 350) / 1000))
    const sprintDeg = Math.max(0, Math.min(180, num(adv.sprintDeg, 60)))
    const slowDeg = 360 - sprintDeg
    const omega = slowDeg / Math.max(0.01, T - sprintS)
    let needleDeg: number
    let revs = 0
    let tau: number
    if (clockTime !== null) {
        // A real second hand: one smooth sweep a minute.
        tau = clockTime % 60
        needleDeg = tau * 6
    } else if (progress === null) {
        const abs = num(adv.startAngle, 42) / omega + clock
        revs = Math.floor(abs / T)
        tau = abs - revs * T
        if (tau < T - sprintS) needleDeg = omega * tau
        else {
            const s = Math.min(1, (tau - (T - sprintS)) / Math.max(1e-3, sprintS))
            const k = Math.min(1, (omega * sprintS) / Math.max(1, sprintDeg))
            needleDeg = slowDeg + sprintDeg * (k * s + (1 - k) * s * s)
        }
    } else {
        needleDeg = (progress * 360) % 360
        tau = fract(clock / T) * T
    }
    needleDeg = ((needleDeg % 360) + 360) % 360
    const phase = (TAU * clock) / T
    const cyc = clockTime !== null ? fract(clock / T) : tau / T

    // Each time the needle passes 12 the hands step on, and the liquid sloshes.
    const stepS = Math.max(0.01, num(adv.stepMs, 300) / 1000)
    const e = 1 - Math.pow(1 - Math.min(1, tau / stepS), 3)
    const sloshK = (num(adv.slosh, 50) / 100) * 0.3 * Math.sin(tau * 9) * Math.exp(-tau * 3.2)
    let minDeg: number
    let hourDeg: number
    let slosh: number
    if (clockTime !== null) {
        // The minute hand clicks on at the top of each minute; the hour hand creeps.
        minDeg = 6 * (Math.floor(clockTime / 60) - 1 + e)
        hourDeg = (clockTime / 120) % 360
        slosh = sloshK
    } else {
        const steps = revs >= 1 ? revs - 1 + e : 0
        const stepDeg = num(adv.minuteStep, 1)
        minDeg = num(adv.minuteAngle, 265) + stepDeg * steps
        hourDeg = num(adv.hourAngle, 82) + (stepDeg / 12) * steps
        slosh = revs >= 1 ? sloshK : 0
    }

    // Pointer: liquid leans toward it, nearby markers light, the needle glows.
    const pt = stage.pointer
    const pover = pt.over * hk
    const dx = pt.x - cx
    const dy = pt.y - oy
    const proj = (deg: number) => {
        const a = deg * DEG
        return Math.max(-1, Math.min(1, (dx * Math.sin(a) - dy * Math.cos(a)) / Math.max(1, R)))
    }
    fx.leanM += (proj(minDeg) * 0.15 * pover - fx.leanM) * ease
    fx.leanH += (proj(hourDeg) * 0.15 * pover - fx.leanH) * ease
    fx.press += ((pt.down ? 1 : 0) * hk - fx.press) * ease

    const na = needleDeg * DEG
    const nLen = (R * num(adv.needleLength, 87)) / 100
    const nTail = (R * num(adv.needleTail, 21)) / 100
    const along = Math.max(-nTail, Math.min(nLen, dx * Math.sin(na) - dy * Math.cos(na)))
    const near = Math.max(0, 1 - Math.hypot(dx - along * Math.sin(na), dy + along * Math.cos(na)) / Math.max(1, 0.3 * R))
    fx.boost += (near * pover - fx.boost) * ease

    const glass: Glass = {
        body: parseColor(p.color, [0.11, 0.169, 0.212, 1]),
        dark: parseColor(adv.glassDark, [0.02, 0.035, 0.051, 1]),
        rim: parseColor(adv.rimColor, [0.239, 0.459, 0.596, 1]),
        spec: parseColor(adv.specColor, [0.498, 0.722, 0.839, 1]),
        bubble: parseColor(adv.bubbleColor, [0.812, 0.902, 0.949, 1]),
        opacity: clamp01(num(adv.glassOpacity, 92) / 100),
    }
    const glow = parseColor(p.accent, [0.275, 0.784, 1, 1])
    const deep = parseColor(adv.liquidDeep, [0.051, 0.435, 0.784, 1])
    const L = Math.max(0, Math.min(100, num(p.liquid, 50))) / 50
    const swirl = clamp01(num(adv.swirl, 70) / 100)
    const pressLift = 1 + 0.35 * fx.press
    const handLit = (clamp01(num(adv.liquidGlow, 100) / 100) || 0) * pressLift

    // ── markers: glass pills with a resting glow, brighter just after the needle ──
    const count = Math.max(1, Math.min(60, Math.round(num(p.markers, 12))))
    const mIn = (R * num(adv.markerInner, 86)) / 100
    const mTh = (R * num(adv.markerThick, 42)) / 1000
    const trail = Math.max(0.05, num(adv.trailMs, 1200) / 1000)
    const mBase = clamp01(num(adv.markerBase, 35) / 100)
    const mGlow = clamp01(num(adv.markerGlow, 20) / 100)
    const avgOmega = clockTime !== null ? 6 : 360 / T
    for (let i = 0; i < count; i++) {
        const deg = (i * 360) / count
        const age = ((((needleDeg - deg) % 360) + 360) % 360) / avgOmega
        const a = deg * DEG
        const mid = (mIn + R) / 2
        const pd = Math.max(0, 1 - Math.hypot(dx - Math.sin(a) * mid, dy + Math.cos(a) * mid) / Math.max(1, 0.35 * R))
        const lit = mBase + mGlow * Math.exp(-age / trail) + 0.35 * pd * pover
        ctx.save()
        ctx.translate(cx, oy)
        ctx.rotate(a - Math.PI / 2)
        glassTube(ctx, mIn, R, mTh, glass, glow, deep, [{ u: 0.5, len: 1.1, a: 1 }], lit, i + 1, 1, phase, 0)
        ctx.restore()
    }

    // ── stems from the hub to the hands ──
    const hIn = (R * num(adv.handInner, 17)) / 100
    ctx.lineCap = "round"
    for (const deg of [hourDeg, minDeg]) {
        ctx.save()
        ctx.translate(cx, oy)
        ctx.rotate(deg * DEG - Math.PI / 2)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(hIn + 1, 0)
        ctx.lineWidth = Math.max(1, R * 0.009)
        ctx.strokeStyle = rgba(glass.rim, 0.95)
        ctx.stroke()
        ctx.restore()
    }

    // ── hour hand: two slugs a revolution, hub → tip ──
    const hs = fract(2 * (cyc - 0.66))
    const h1 = slug(hs, 0.6, -0.1, 1.0)
    const h2 = slug(fract(hs - 0.3), 0.6, -0.1, 1.0)
    const hourBlobs: LiquidBlob[] = [
        { u: h1.u + fx.leanH + slosh * 0.6, len: 0.55 * L, a: h1.a },
        { u: h2.u + fx.leanH * 0.5, len: 0.35 * L, a: h2.a * 0.45 },
        { u: 0.5, len: 1.1 * Math.min(1, L), a: 0.08 },
    ]
    ctx.save()
    ctx.translate(cx, oy)
    ctx.rotate(hourDeg * DEG - Math.PI / 2)
    glassTube(ctx, hIn, (R * num(adv.hourOuter, 56)) / 100, (R * num(adv.hourThick, 100)) / 1000, glass, glow, deep, hourBlobs, handLit, 101, Math.round(num(adv.bubbles, 8) * 0.6), phase, swirl)
    ctx.restore()

    // ── minute hand: one slug a revolution, hub → tip ──
    const ms = fract(cyc - 0.66)
    const m1 = slug(ms, 0.8, -0.05, 0.97)
    const m2 = slug(fract(ms - 0.28), 0.8, -0.05, 0.97)
    const minuteBlobs: LiquidBlob[] = [
        { u: m1.u + fx.leanM + slosh, len: 0.45 * L, a: m1.a },
        { u: m2.u + fx.leanM * 0.6 + slosh * 0.5, len: 0.3 * L, a: m2.a * 0.45 },
        { u: 0.5, len: 1.1 * Math.min(1, L), a: 0.08 },
    ]
    ctx.save()
    ctx.translate(cx, oy)
    ctx.rotate(minDeg * DEG - Math.PI / 2)
    glassTube(ctx, hIn, (R * num(adv.minuteOuter, 85)) / 100, (R * num(adv.minuteThick, 105)) / 1000, glass, glow, deep, minuteBlobs, handLit, 202, Math.round(num(adv.bubbles, 8)), phase, swirl)
    ctx.restore()

    // ── second needle: tapered steel-blue glass, with a teardrop hub ──
    const nw = Math.max(1, (R * num(adv.needleWidth, 14)) / 1000)
    const hr = Math.max(2, (R * num(adv.hubSize, 30)) / 1000)
    ctx.save()
    ctx.translate(cx, oy)
    ctx.rotate(na - Math.PI / 2)
    if (fx.boost > 0.01) {
        ctx.shadowColor = rgba(glow, 0.7 * Math.min(1, fx.boost))
        ctx.shadowBlur = 14 * fx.boost
    }
    const ng = ctx.createLinearGradient(-nTail, 0, nLen, 0)
    ng.addColorStop(0, rgba(glass.rim, 1))
    ng.addColorStop(1, rgba(mixColor(glass.spec, glow, Math.min(1, 0.25 + fx.boost)), 1))
    ctx.beginPath()
    ctx.moveTo(-nTail, -nw * 0.3)
    ctx.lineTo(0, -nw * 0.55)
    ctx.lineTo(nLen, -nw * 0.18)
    ctx.lineTo(nLen, nw * 0.18)
    ctx.lineTo(0, nw * 0.55)
    ctx.lineTo(-nTail, nw * 0.3)
    ctx.closePath()
    ctx.fillStyle = ng
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.shadowColor = "transparent"
    ctx.beginPath()
    ctx.moveTo(-nTail * 0.9, -nw * 0.2)
    ctx.lineTo(nLen * 0.98, -nw * 0.08)
    ctx.lineWidth = Math.max(0.5, nw * 0.2)
    ctx.strokeStyle = rgba(mixColor(glass.spec, WHITE, 0.3), 0.6)
    ctx.stroke()

    // Hub: a glass drop pointing along the needle.
    ctx.beginPath()
    ctx.moveTo(hr * 2.4, 0)
    ctx.quadraticCurveTo(hr * 0.9, -hr, 0, -hr)
    ctx.arc(0, 0, hr, -Math.PI / 2, Math.PI / 2, true)
    ctx.quadraticCurveTo(hr * 0.9, hr, hr * 2.4, 0)
    ctx.closePath()
    const hg = ctx.createRadialGradient(-hr * 0.35, -hr * 0.35, hr * 0.1, 0, 0, hr * 1.4)
    hg.addColorStop(0, rgba(glass.spec, 1))
    hg.addColorStop(0.5, rgba(glass.body, 1))
    hg.addColorStop(1, rgba(glass.dark, 1))
    ctx.fillStyle = hg
    ctx.fill()
    ctx.lineWidth = Math.max(1, hr * 0.15)
    ctx.strokeStyle = rgba(glass.rim, 1)
    ctx.stroke()
    ctx.fillStyle = rgba(mixColor(glass.spec, WHITE, 0.5), 0.8)
    ctx.beginPath()
    ctx.arc(-hr * 0.3, -hr * 0.35, Math.max(0.6, hr * 0.22), 0, TAU)
    ctx.fill()
    ctx.restore()

    // ── overlays ──
    const vig = clamp01(num(adv.vignette, 0) / 100)
    if (vig > 0) {
        const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2)
        vg.addColorStop(0, "rgba(0, 0, 0, 0)")
        vg.addColorStop(1, `rgba(0, 0, 0, ${vig * 0.85})`)
        ctx.fillStyle = vg
        ctx.fillRect(0, 0, W, H)
    }
    const grn = clamp01(num(adv.grain, 0) / 100)
    if (grn > 0 && fx.grain) {
        ctx.save()
        ctx.globalAlpha = grn * 0.18
        ctx.translate(-Math.random() * 128, -Math.random() * 128)
        ctx.fillStyle = fx.grain
        ctx.fillRect(0, 0, W + 128, H + 128)
        ctx.restore()
    }
}

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

export default function LiquidGlassClock(props: Props) {
    props = withMovedControls(props)
    const { background = "#000000", style } = props
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

        // offsetX/Y, never getBoundingClientRect: that carries the canvas zoom.
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
            const sz = Math.max(20, Math.min(800, num(p.size, 670)))
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

addPropertyControls(LiquidGlassClock, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    color: { type: ControlType.Color, title: "Color", defaultValue: "#1C2B36" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#46C8FF" },
    size: { type: ControlType.Number, title: "Size", min: 20, max: 800, step: 1, unit: "px", defaultValue: 670 },
    speed: { type: ControlType.Number, title: "Speed", min: 0, max: 100, step: 1, defaultValue: 50 },
    timeMode: {
        type: ControlType.Enum,
        title: "Time",
        options: ["loader", "current", "set"],
        optionTitles: ["Loader", "Current Time", "Set Time"],
        defaultValue: "loader",
    },
    hour: { type: ControlType.Number, title: "Hour", min: 0, max: 23, step: 1, defaultValue: 10, hidden: (p: any) => p.timeMode !== "set" },
    minute: { type: ControlType.Number, title: "Minute", min: 0, max: 59, step: 1, defaultValue: 10, hidden: (p: any) => p.timeMode !== "set" },
    liquid: { type: ControlType.Number, title: "Liquid", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
    markers: { type: ControlType.Number, title: "Markers", min: 4, max: 24, step: 1, defaultValue: 12 },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            revolutionMs: { type: ControlType.Number, title: "Revolution", min: 1000, max: 30000, step: 100, unit: "ms", defaultValue: 6700 },
            sprintMs: { type: ControlType.Number, title: "Sprint Time", min: 0, max: 2000, step: 10, unit: "ms", defaultValue: 350 },
            sprintDeg: { type: ControlType.Number, title: "Sprint Angle", min: 0, max: 180, step: 1, unit: "°", defaultValue: 60 },
            startAngle: { type: ControlType.Number, title: "Needle Start", min: 0, max: 359, step: 1, unit: "°", defaultValue: 42 },
            minuteAngle: { type: ControlType.Number, title: "Minute Angle", min: 0, max: 359, step: 1, unit: "°", defaultValue: 265 },
            hourAngle: { type: ControlType.Number, title: "Hour Angle", min: 0, max: 359, step: 1, unit: "°", defaultValue: 82 },
            minuteStep: { type: ControlType.Number, title: "Minute Step", min: 0, max: 90, step: 1, unit: "°", defaultValue: 1 },
            stepMs: { type: ControlType.Number, title: "Step Time", min: 0, max: 2000, step: 10, unit: "ms", defaultValue: 300 },
            slosh: { type: ControlType.Number, title: "Slosh", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
            liquidGlow: { type: ControlType.Number, title: "Liquid Glow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 100 },
            swirl: { type: ControlType.Number, title: "Swirl", min: 0, max: 100, step: 1, unit: "%", defaultValue: 70 },
            markerBase: { type: ControlType.Number, title: "Marker Light", min: 0, max: 100, step: 1, unit: "%", defaultValue: 35 },
            markerGlow: { type: ControlType.Number, title: "Marker Glow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 20 },
            trailMs: { type: ControlType.Number, title: "Glow Trail", min: 100, max: 5000, step: 50, unit: "ms", defaultValue: 1200 },
            markerInner: { type: ControlType.Number, title: "Marker Inner", min: 50, max: 99, step: 1, unit: "%", defaultValue: 86 },
            markerThick: { type: ControlType.Number, title: "Marker Thick", min: 5, max: 150, step: 1, unit: "‰", defaultValue: 42 },
            handInner: { type: ControlType.Number, title: "Hand Inner", min: 0, max: 60, step: 1, unit: "%", defaultValue: 17 },
            minuteOuter: { type: ControlType.Number, title: "Minute Length", min: 20, max: 100, step: 1, unit: "%", defaultValue: 85 },
            minuteThick: { type: ControlType.Number, title: "Minute Thick", min: 10, max: 200, step: 1, unit: "‰", defaultValue: 105 },
            hourOuter: { type: ControlType.Number, title: "Hour Length", min: 20, max: 100, step: 1, unit: "%", defaultValue: 56 },
            hourThick: { type: ControlType.Number, title: "Hour Thick", min: 10, max: 200, step: 1, unit: "‰", defaultValue: 100 },
            needleLength: { type: ControlType.Number, title: "Needle Length", min: 20, max: 100, step: 1, unit: "%", defaultValue: 87 },
            needleTail: { type: ControlType.Number, title: "Needle Tail", min: 0, max: 60, step: 1, unit: "%", defaultValue: 21 },
            needleWidth: { type: ControlType.Number, title: "Needle Width", min: 2, max: 60, step: 1, unit: "‰", defaultValue: 14 },
            hubSize: { type: ControlType.Number, title: "Hub Size", min: 5, max: 120, step: 1, unit: "‰", defaultValue: 30 },
            offsetY: { type: ControlType.Number, title: "Offset Y", min: -20, max: 20, step: 1, unit: "%", defaultValue: -1 },
            glassOpacity: { type: ControlType.Number, title: "Glass Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 92 },
            bubbles: { type: ControlType.Number, title: "Specks", min: 0, max: 30, step: 1, defaultValue: 8 },
            glassDark: { type: ControlType.Color, title: "Glass Dark", defaultValue: "#05090D" },
            rimColor: { type: ControlType.Color, title: "Rim", defaultValue: "#3D7598" },
            specColor: { type: ControlType.Color, title: "Specular", defaultValue: "#7FB8D6" },
            bubbleColor: { type: ControlType.Color, title: "Specks Color", defaultValue: "#CFE6F2" },
            liquidDeep: { type: ControlType.Color, title: "Liquid Deep", defaultValue: "#0D6FC8" },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
        },
    },
})

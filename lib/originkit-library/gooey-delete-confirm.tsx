import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    pillRatio: 217,
    gap: 46,
    offsetY: 0,
    collapseMs: 500,
    idleMs: 150,
    hoverMs: 400,
    expandMs: 900,
    openHoldMs: 150,
    cancelHoverMs: 350,
    phaseMs: 75,
    easeX1: 30,
    easeY1: 40,
    easeX2: 20,
    restGoo: 25,
    bulge: 3,
    pillColor: "#F9F9F9",
    topColor: "#FFFFFF",
    edgeColor: "#D4D4D4",
    borderWidth: 1,
    shade: 30,
    highlight: 60,
    shadowAlpha: 8,
    shadowY: 5,
    shadowBlur: 14,
    cancelColor: "#111111",
    cancelHoverColor: "#DADADA",
    circleTint: 25,
    confirmTint: 8,
    iconSize: 62,
    iconStroke: 7,
    squash: 3,
    pull: 4,
    resumeMs: 2500,
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

const DESIGN_SIZE = 196
const SYSTEM_FONT =
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, Arial, sans-serif'

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec4 uA;
uniform vec4 uB;
uniform float uK;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uTop;
uniform vec3 uTopB;
uniform vec3 uEdge;
uniform vec4 uBg;
uniform float uBorder;
uniform vec3 uShadow;
uniform vec2 uLook;

float sdStadium(vec2 p, vec4 s) {
    float r = min(s.z, s.w);
    vec2 q = abs(p - s.xy) - s.zw + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec2 field(vec2 p) {
    float d1 = sdStadium(p, uA);
    float d2 = sdStadium(p, uB);
    float k = max(uK, 0.001);
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    float d = mix(d2, d1, h) - k * h * (1.0 - h);
    return vec2(d, h);
}

void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 f = field(p);
    float d = f.x;
    vec3 base = mix(uColB, uColA, f.y);
    vec3 topC = mix(uTopB, uTop, f.y);
    float hh = max(mix(uB.w, uA.w, f.y), 1.0);
    float cy = mix(uB.y, uA.y, f.y);
    float ny = (p.y - cy) / hh;

    vec3 col = mix(base, topC, (1.0 - smoothstep(-0.95, 0.1, ny)) * 0.6);
    float rim = 1.0 - smoothstep(0.0, 0.35 * hh, -d);
    float lower = smoothstep(-0.2, 1.0, ny);
    col *= 1.0 - uLook.x * 0.16 * rim * lower;
    float band = uBorder + 2.0 * max(uBorder, 1.0);
    float hl = (1.0 - smoothstep(uBorder, band, -d)) * (1.0 - smoothstep(-0.8, 0.0, ny));
    col = mix(col, vec3(1.0), clamp(hl * uLook.y * 0.8, 0.0, 1.0));
    float bm = 1.0 - smoothstep(uBorder - 0.5, uBorder + 0.5, -d);
    col = mix(col, uEdge, bm * step(0.01, uBorder));

    float a = clamp(0.5 - d, 0.0, 1.0);

    float ds = field(p - vec2(0.0, uShadow.x)).x;
    float blurR = max(uShadow.y, 1.0);
    float sh = uShadow.z * (1.0 - smoothstep(-blurR * 0.5, blurR, ds));
    float bga = uBg.a;
    vec3 bgPre = uBg.rgb * (1.0 - sh) * bga;
    float bgOut = bga + (1.0 - bga) * sh;

    gl_FragColor = vec4(col * a + bgPre * (1.0 - a), a + bgOut * (1.0 - a));
}
`

const UNIFORMS = [
    "uRes",
    "uA",
    "uB",
    "uK",
    "uColA",
    "uColB",
    "uTop",
    "uTopB",
    "uEdge",
    "uBg",
    "uBorder",
    "uShadow",
    "uLook",
]

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const seg = (u: number, a: number, b: number) => clamp((u - a) / (b - a), 0, 1)
const smooth = (a: number, b: number, x: number) => {
    const t = clamp((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
}
const ramp = (x: number, d: number) => clamp(x / Math.max(1, d), 0, 1)

function parseColor(input: any, fallback: number[]): number[] {
    if (typeof input !== "string") return fallback
    let s = input.trim()
    const v = s.match(/^var\([^,]+,\s*(.+)\)$/)
    if (v) s = v[1].trim()
    if (s === "transparent") return [0, 0, 0, 0]
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((c) => c + c)
                .join("")
        if (h.length === 6) h += "ff"
        if (h.length !== 8) return fallback
        const n = parseInt(h, 16)
        if (isNaN(n)) return fallback
        return [
            ((n >>> 24) & 255) / 255,
            ((n >>> 16) & 255) / 255,
            ((n >>> 8) & 255) / 255,
            (n & 255) / 255,
        ]
    }
    const m = s.match(/rgba?\(([^)]+)\)/i)
    if (m) {
        const parts = m[1].split(/[\s,\/]+/).filter(Boolean)
        if (parts.length >= 3) {
            let a = parts.length > 3 ? parseFloat(parts[3]) : 1
            if (parts[3] && parts[3].includes("%")) a /= 100
            return [
                parseFloat(parts[0]) / 255,
                parseFloat(parts[1]) / 255,
                parseFloat(parts[2]) / 255,
                clamp(isNaN(a) ? 1 : a, 0, 1),
            ]
        }
    }
    return fallback
}

const mix3 = (a: number[], b: number[], t: number) => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
]

const cssOf = (c: number[]) =>
    `rgba(${Math.round(clamp(c[0], 0, 1) * 255)},${Math.round(
        clamp(c[1], 0, 1) * 255
    )},${Math.round(clamp(c[2], 0, 1) * 255)},${c.length > 3 ? clamp(c[3], 0, 1) : 1})`

function makeBezier(x1: number, y1: number, x2: number, y2: number) {
    const bx = (t: number) =>
        3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t
    const by = (t: number) =>
        3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let lo = 0
        let hi = 1
        for (let i = 0; i < 22; i++) {
            const mid = (lo + hi) / 2
            if (bx(mid) < x) lo = mid
            else hi = mid
        }
        return by((lo + hi) / 2)
    }
}

type Ease = (x: number) => number

function openState(u: number, fa: number, fb: number, E: Ease) {
    return {
        pa: fa + (1 - fa) * E(seg(u, 0.15, 1)),
        pb: fb + (1 - fb) * E(seg(u, 0, 0.8)),
    }
}

function closeState(u: number, fa: number, fb: number, E: Ease) {
    return {
        pa: fa * (1 - E(seg(u, 0.05, 1))),
        pb: fb * (1 - E(seg(u, 0, 0.45))),
    }
}

function cycleParts(adv: any) {
    const C = Math.max(1, adv.collapseMs)
    const I = Math.max(0, adv.idleMs)
    const Hm = Math.max(0, adv.hoverMs)
    const X = Math.max(1, adv.expandMs)
    const O = Math.max(0, adv.openHoldMs)
    const Ch = Math.max(0, adv.cancelHoverMs)
    const openAt = C + I + Hm
    const cancelOn = openAt + X + O
    return { C, I, Hm, X, O, Ch, openAt, cancelOn, P: cancelOn + Ch }
}

function demoSample(tauMs: number, adv: any, E: Ease, still: boolean) {
    if (still)
        return { pa: 1, pb: 1, hc: 0, hconf: 0, hb: 0, dA: 0, dB: 0, open: true, u: 1 }
    const c = cycleParts(adv)
    const t = ((tauMs % c.P) + c.P) % c.P
    const opening = t >= c.openAt
    const u = opening ? (t - c.openAt) / c.X : t / c.C
    const st = opening ? openState(u, 0, 0, E) : closeState(u, 1, 1, E)
    const hc = ramp(t - (c.C + c.I), 100) * (1 - ramp(t - c.openAt, 220))
    const hb =
        t >= c.cancelOn
            ? ramp(t - c.cancelOn, 150)
            : t < c.openAt
              ? 1 - ramp(t, 180)
              : 0
    const tri = (x: number, w: number) => Math.max(0, 1 - Math.abs(x) / w)
    const dA = tri(t - (c.openAt - 60), 90)
    const dB = Math.max(tri(t - (c.P - 60), 90), tri(t + 60, 90))
    return { pa: st.pa, pb: st.pb, hc, hconf: 0, hb, dA, dB, open: opening, u: Math.min(1, u) }
}

function sdStadium(px: number, py: number, s: any) {
    const r = Math.min(s.hw, s.hh)
    const qx = Math.abs(px - s.cx) - s.hw + r
    const qy = Math.abs(py - s.cy) - s.hh + r
    return (
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
    )
}

function stadiumPath(ctx: CanvasRenderingContext2D, s: any, k: number) {
    const r = Math.min(s.hw, s.hh) * k
    const x = (s.cx - s.hw) * k
    const y = (s.cy - s.hh) * k
    const w = s.hw * 2 * k
    const h = s.hh * 2 * k
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2)
    ctx.lineTo(x + r, y + h)
    ctx.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2)
    ctx.closePath()
}

function roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2))
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
}

function initGL(canvas: HTMLCanvasElement) {
    try {
        const gl = canvas.getContext("webgl", {
            premultipliedAlpha: true,
            antialias: false,
            alpha: true,
        }) as WebGLRenderingContext | null
        if (!gl) return null
        const compile = (type: number, src: string) => {
            const s = gl.createShader(type)
            if (!s) throw new Error("createShader failed")
            gl.shaderSource(s, src)
            gl.compileShader(s)
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(s) || "shader compile failed")
            return s
        }
        const prog = gl.createProgram()
        if (!prog) throw new Error("createProgram failed")
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(prog) || "link failed")
        gl.useProgram(prog)
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
        const aPos = gl.getAttribLocation(prog, "aPos")
        gl.enableVertexAttribArray(aPos)
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
        const loc: Record<string, WebGLUniformLocation> = {}
        for (const n of UNIFORMS) {
            const l = gl.getUniformLocation(prog, n)
            if (l === null) throw new Error(`Missing uniform ${n}`)
            loc[n] = l
        }
        return { gl, prog, loc }
    } catch (e) {
        console.warn("GooeyDeleteConfirm: WebGL unavailable", e)
        return null
    }
}

function drawLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    px: number,
    color: string,
    alpha: number,
    blurPx: number,
    family: string,
    weight: any,
    spacing: string
) {
    if (alpha <= 0.003 || px < 1 || !text) return
    ctx.save()
    ctx.globalAlpha = clamp(alpha, 0, 1)
    ctx.filter = blurPx > 0.3 ? `blur(${blurPx.toFixed(2)}px)` : "none"
    ctx.font = `${weight} ${px}px ${family}`
    try {
        ;(ctx as any).letterSpacing = spacing
    } catch {}
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = color
    ctx.fillText(text, x, y + px * 0.36)
    ctx.restore()
}

/** Solid bin: handle, lid and a tapered body with three slats cut out. */
function drawTrash(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    s: number,
    color: string,
    alpha: number,
    blurPx: number,
    slat: number
) {
    if (alpha <= 0.003 || s < 1) return
    ctx.save()
    ctx.globalAlpha = clamp(alpha, 0, 1)
    ctx.filter = blurPx > 0.3 ? `blur(${blurPx.toFixed(2)}px)` : "none"
    ctx.fillStyle = color
    const w = s * 0.84
    const top = y - s / 2
    const hw = w * 0.38
    const hh = s * 0.12
    const t = s * 0.075
    ctx.beginPath()
    ctx.rect(x - hw / 2, top, hw, hh + t)
    ctx.rect(x - hw / 2 + t, top + t, hw - 2 * t, hh)
    ctx.fill("evenodd")

    const lidY = top + hh
    const lidH = s * 0.13
    ctx.beginPath()
    roundRectPath(ctx, x - w / 2, lidY, w, lidH, lidH * 0.35)
    ctx.fill()

    const bTop = lidY + lidH + s * 0.05
    const bBot = y + s / 2
    const tw = w * 0.8
    const bw = w * 0.66
    const r = s * 0.08
    ctx.beginPath()
    ctx.moveTo(x - tw / 2, bTop)
    ctx.lineTo(x + tw / 2, bTop)
    ctx.lineTo(x + bw / 2, bBot - r)
    ctx.quadraticCurveTo(x + bw / 2, bBot, x + bw / 2 - r, bBot)
    ctx.lineTo(x - bw / 2 + r, bBot)
    ctx.quadraticCurveTo(x - bw / 2, bBot, x - bw / 2, bBot - r)
    ctx.closePath()
    const sw = Math.max(0.5, s * slat)
    const sTop = bTop + s * 0.1
    const sH = Math.max(0, bBot - bTop - s * 0.2)
    for (const dx of [-w * 0.17, 0, w * 0.17]) ctx.rect(x + dx - sw / 2, sTop, sw, sH)
    ctx.fill("evenodd")
    ctx.restore()
}

/**
 * Gooey delete button: a round trash button that splits into Confirm / Cancel pills
 * through one smooth-union silhouette, and flows back together on Cancel.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function GooeyDeleteConfirm(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        accent = "#E5142E",
        confirmText = "Confirm",
        cancelText = "Cancel",
        font = {},
        size = 196,
        speed = 50,
        goo = 50,
        blur = 50,
        style,
    } = props

    const rootRef = useRef<HTMLDivElement>(null)
    const glRef = useRef<HTMLCanvasElement>(null)
    const uiRef = useRef<HTMLCanvasElement>(null)
    const propsRef = useRef<any>(null)
    propsRef.current = {
        background,
        accent,
        confirmText,
        cancelText,
        font,
        size,
        speed,
        goo,
        blur,
        advanced: props.advanced,
    }

    useEffect(() => {
        const root = rootRef.current
        const glCanvas = glRef.current
        const ui = uiRef.current
        if (!root || !glCanvas || !ui) return
        const ctx = ui.getContext("2d")
        if (!ctx) return

        let W = 1
        let H = 1
        let dpr = 1
        const resize = () => {
            W = Math.max(1, root.offsetWidth)
            H = Math.max(1, root.offsetHeight)
            dpr = Math.min(2, window.devicePixelRatio || 1)
            for (const c of [glCanvas, ui]) {
                c.width = Math.max(1, Math.round(W * dpr))
                c.height = Math.max(1, Math.round(H * dpr))
            }
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(root)

        const glr = initGL(glCanvas)

        const rt = RenderTarget.current()
        const isStatic =
            rt === RenderTarget.thumbnail || rt === (RenderTarget as any).export
        const mq =
            typeof window.matchMedia === "function"
                ? window.matchMedia("(prefers-reduced-motion: reduce)")
                : null
        let reduced = !!mq?.matches
        const onMq = () => {
            reduced = !!mq?.matches
        }
        mq?.addEventListener?.("change", onMq)

        const grainTile = document.createElement("canvas")
        grainTile.width = 128
        grainTile.height = 128
        const gctx = grainTile.getContext("2d")
        if (gctx) {
            const img = gctx.createImageData(128, 128)
            for (let i = 0; i < img.data.length; i += 4) {
                const v = Math.random() * 255
                img.data[i] = v
                img.data[i + 1] = v
                img.data[i + 2] = v
                img.data[i + 3] = 255
            }
            gctx.putImageData(img, 0, 0)
        }
        const grainPattern = ctx.createPattern(grainTile, "repeat")

        const sim: any = {
            mode: "demo",
            tau: 0,
            pa: 1,
            pb: 1,
            hc: 0,
            hconf: 0,
            hb: 0,
            dA: 0,
            dB: 0,
            over: 0,
            idle: 0,
            px: 0,
            py: 0,
            demo: null,
            live: { open: true, u: 1, fa: 1, fb: 1 },
            ptr: { x: 0, y: 0, inside: false, down: false },
            gA: null,
            gB: null,
        }

        const hitTest = (x: number, y: number) => {
            if (!sim.gA) return null
            if (sim.pb > 0.5 && sim.gB && sdStadium(x, y, sim.gB) < 0) return "B"
            if (sdStadium(x, y, sim.gA) < 0) return "A"
            return null
        }

        const enterLive = () => {
            if (sim.mode !== "demo") return
            const d = sim.demo
            sim.mode = "live"
            sim.live = d
                ? { open: d.open, u: d.u, fa: d.open ? 0 : 1, fb: d.open ? 0 : 1 }
                : { open: true, u: 1, fa: 1, fb: 1 }
        }

        const startTween = (open: boolean) => {
            sim.live = { open, u: 0, fa: sim.pa, fb: sim.pb }
        }

        const onMove = (e: PointerEvent) => {
            sim.ptr.x = e.offsetX
            sim.ptr.y = e.offsetY
            sim.ptr.inside = true
            sim.idle = 0
            enterLive()
        }
        const onLeave = () => {
            sim.ptr.inside = false
        }
        const onDown = (e: PointerEvent) => {
            onMove(e)
            sim.ptr.down = true
            const hit = hitTest(sim.ptr.x, sim.ptr.y)
            if (!hit) return
            if (!sim.live.open && hit === "A") startTween(true)
            else if (sim.live.open) startTween(false)
        }
        const onUp = () => {
            sim.ptr.down = false
        }
        root.addEventListener("pointerenter", onMove)
        root.addEventListener("pointermove", onMove)
        root.addEventListener("pointerleave", onLeave)
        root.addEventListener("pointerdown", onDown)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        let raf = 0
        let last = -1
        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = last < 0 ? 0 : Math.min(1 / 20, (now - last) / 1000)
            last = now

            const p = propsRef.current
            const adv = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const rate = Math.max(0, p.speed) / 50
            const hk = Math.max(0, adv.hover) / 50
            const E = makeBezier(
                clamp(adv.easeX1 / 100, 0, 1),
                adv.easeY1 / 100,
                clamp(adv.easeX2 / 100, 0, 1),
                1
            )
            const ms = dt * 1000 * rate
            const still = reduced || isStatic

            if (sim.mode === "demo") {
                sim.tau += ms
                const s = demoSample(sim.tau + adv.phaseMs, adv, E, still)
                sim.demo = s
                sim.pa = s.pa
                sim.pb = s.pb
                sim.hc = s.hc
                sim.hconf = s.hconf
                sim.hb = s.hb
                sim.dA = s.dA
                sim.dB = s.dB
                sim.over += (0 - sim.over) * (1 - Math.exp(-dt * 6))
            } else {
                const L = sim.live
                const dur = L.open ? adv.expandMs : adv.collapseMs
                L.u = still ? 1 : Math.min(1, L.u + ms / Math.max(1, dur))
                const st = L.open ? openState(L.u, L.fa, L.fb, E) : closeState(L.u, L.fa, L.fb, E)
                sim.pa = st.pa
                sim.pb = st.pb
                const hit = sim.ptr.inside ? hitTest(sim.ptr.x, sim.ptr.y) : null
                const kk = 1 - Math.exp(-dt * 14)
                sim.hc += ((hit === "A" && !L.open ? 1 : 0) - sim.hc) * kk
                sim.hconf += ((hit === "A" && L.open ? 1 : 0) - sim.hconf) * kk
                sim.hb += ((hit === "B" && L.open ? 1 : 0) - sim.hb) * kk
                const kd = 1 - Math.exp(-dt * 24)
                sim.dA += ((sim.ptr.down && hit === "A" ? 1 : 0) - sim.dA) * kd
                sim.dB += ((sim.ptr.down && hit === "B" ? 1 : 0) - sim.dB) * kd
                sim.over += ((sim.ptr.inside ? 1 : 0) - sim.over) * (1 - Math.exp(-dt * 6))
                root.style.cursor = hit ? "pointer" : ""
                if (!sim.ptr.inside && !sim.ptr.down) {
                    sim.idle += dt * 1000
                    if (
                        sim.idle > adv.resumeMs &&
                        L.u >= 1 &&
                        sim.hc + sim.hb + sim.hconf < 0.02
                    ) {
                        const c = cycleParts(adv)
                        sim.mode = "demo"
                        sim.tau = (L.open ? c.openAt + c.X : c.C) - adv.phaseMs
                        root.style.cursor = ""
                    }
                }
            }

            // ── geometry (CSS px) ──
            const S = Math.max(8, p.size)
            const k = S / DESIGN_SIZE
            const half = S / 2
            const pw = Math.max(S, (S * adv.pillRatio) / 100)
            const sep = (pw + Math.max(0, adv.gap) * k) / 2
            const hs = sim.mode === "live" ? Math.min(1, hk) : 1

            let tx = 0
            let ty = 0
            if (sim.ptr.inside && !still) {
                tx = clamp((sim.ptr.x - W / 2) / Math.max(1, W / 2), -1, 1)
                ty = clamp((sim.ptr.y - H / 2) / Math.max(1, H / 2), -1, 1)
            }
            const kp = 1 - Math.exp(-dt * 5)
            sim.px += (tx - sim.px) * kp
            sim.py += (ty - sim.py) * kp
            const pullPx = (Math.max(0, adv.pull) / 100) * S * 0.5 * hk
            const cx = W / 2 + sim.px * pullPx
            const cy = H / 2 + adv.offsetY * k + sim.py * pullPx * 0.6

            const pa = clamp(sim.pa, 0, 1)
            const pb = clamp(sim.pb, 0, 1)
            const wA = Math.sin(Math.PI * pa)
            const wB = Math.sin(Math.PI * pb)
            const sq = adv.squash / 100
            const bu = adv.bulge / 100
            const pressA = 1 - 0.04 * sim.dA
            const pressB = 1 - 0.04 * sim.dB
            const A = {
                cx: cx - sep * pa,
                cy,
                hw: lerp(half, pw / 2, pa) * (1 + bu * wA) * pressA,
                hh: half * (1 - sq * wA) * pressA,
            }
            const B = {
                cx: lerp(A.cx, cx + sep, pb),
                cy,
                hw: lerp(half * 0.4, pw / 2, pb) * (1 + bu * wB) * pressB,
                hh: half * lerp(0.4, 1, pb) * (1 - sq * wB) * pressB,
            }
            sim.gA = A
            sim.gB = B

            const motion = Math.max(wA, wB)
            const gooK =
                S * ((adv.restGoo / 100) * 0.3 + (Math.max(0, p.goo) / 50) * 0.4 * motion)

            // ── colours ──
            const white = [1, 1, 1]
            const pill = parseColor(adv.pillColor, [0.976, 0.976, 0.976, 1])
            const acc = parseColor(p.accent, [0.898, 0.078, 0.18, 1])
            const hcE = clamp(sim.hc * hs, 0, 1)
            const hconfE = clamp(sim.hconf * hs, 0, 1)
            const hbE = clamp(sim.hb * hs, 0, 1)
            const circlePink = mix3(white, acc, adv.circleTint / 100)
            const confirmPink = mix3(pill, acc, adv.confirmTint / 100)
            const colA = mix3(mix3(pill, circlePink, hcE), confirmPink, hconfE).map(
                (c) => c * (1 - 0.06 * sim.dA)
            )
            const cancelHov = parseColor(adv.cancelHoverColor, [0.855, 0.855, 0.855, 1])
            const colB = mix3(pill, cancelHov, hbE).map((c) => c * (1 - 0.06 * sim.dB))
            const top0 = parseColor(adv.topColor, [1, 1, 1, 1])
            const topA = mix3(top0, colA, Math.max(hcE, hconfE) * 0.85)
            const topB = mix3(top0, colB, hbE * 0.85)
            const edge = parseColor(adv.edgeColor, [0.83, 0.83, 0.83, 1])
            const bg = parseColor(p.background, [0, 0, 0, 1])

            if (glr) {
                const { gl, loc } = glr
                gl.viewport(0, 0, glCanvas.width, glCanvas.height)
                gl.uniform2f(loc.uRes, glCanvas.width, glCanvas.height)
                gl.uniform4f(loc.uA, A.cx * dpr, A.cy * dpr, A.hw * dpr, A.hh * dpr)
                gl.uniform4f(loc.uB, B.cx * dpr, B.cy * dpr, B.hw * dpr, B.hh * dpr)
                gl.uniform1f(loc.uK, gooK * dpr)
                gl.uniform3f(loc.uColA, colA[0], colA[1], colA[2])
                gl.uniform3f(loc.uColB, colB[0], colB[1], colB[2])
                gl.uniform3f(loc.uTop, topA[0], topA[1], topA[2])
                gl.uniform3f(loc.uTopB, topB[0], topB[1], topB[2])
                gl.uniform3f(loc.uEdge, edge[0], edge[1], edge[2])
                gl.uniform4f(loc.uBg, bg[0], bg[1], bg[2], bg[3])
                gl.uniform1f(loc.uBorder, Math.max(0, adv.borderWidth) * dpr)
                gl.uniform3f(
                    loc.uShadow,
                    adv.shadowY * k * dpr,
                    Math.max(0, adv.shadowBlur) * k * dpr,
                    clamp(adv.shadowAlpha / 100, 0, 1)
                )
                gl.uniform2f(loc.uLook, adv.shade / 30, adv.highlight / 60)
                gl.clearColor(0, 0, 0, 0)
                gl.clear(gl.COLOR_BUFFER_BIT)
                gl.drawArrays(gl.TRIANGLES, 0, 3)
            }

            // ── overlay: fallback shapes, icon, labels, grain, vignette ──
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, ui.width, ui.height)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.filter = "none"

            if (!glr) {
                ctx.fillStyle = cssOf(bg)
                ctx.fillRect(0, 0, W, H)
                ctx.fillStyle = cssOf(colB)
                stadiumPath(ctx, B, 1)
                ctx.fill()
                ctx.fillStyle = cssOf(colA)
                stadiumPath(ctx, A, 1)
                ctx.fill()
            }

            const blurMax = (Math.max(0, p.blur) / 50) * 0.07 * S
            const f = p.font || {}
            const family = f.fontFamily || SYSTEM_FONT
            const weight = f.fontWeight || 600
            const spacing =
                typeof f.letterSpacing === "string"
                    ? f.letterSpacing
                    : `${Number(f.letterSpacing) || 0}px`
            const fs = parseFloat(f.fontSize) || 48
            const fontPx = fs * k
            const accCss = cssOf(acc)
            const cancelCss = cssOf(parseColor(adv.cancelColor, [0.067, 0.067, 0.067, 1]))

            const iconOut = smooth(0, 0.55, pa)
            drawTrash(
                ctx,
                A.cx - (A.hw - half) * 0.85,
                A.cy,
                Math.max(1, adv.iconSize) * k * (A.hh / half),
                accCss,
                1 - iconOut,
                blurMax * iconOut,
                Math.max(1, adv.iconStroke) / 100
            )
            const confIn = smooth(0.3, 1, pa)
            drawLabel(
                ctx,
                p.confirmText,
                A.cx,
                A.cy,
                fontPx * lerp(0.85, 1, confIn),
                accCss,
                confIn,
                blurMax * (1 - confIn),
                family,
                weight,
                spacing
            )
            const canIn = smooth(0.35, 1, pb)
            drawLabel(
                ctx,
                p.cancelText,
                B.cx,
                B.cy,
                fontPx * lerp(0.7, 1, canIn),
                cancelCss,
                canIn,
                blurMax * (1 - canIn),
                family,
                weight,
                spacing
            )

            if (adv.vignette > 0) {
                const g = ctx.createRadialGradient(
                    W / 2,
                    H / 2,
                    Math.min(W, H) * 0.3,
                    W / 2,
                    H / 2,
                    Math.hypot(W, H) * 0.6
                )
                g.addColorStop(0, "rgba(0,0,0,0)")
                g.addColorStop(1, `rgba(0,0,0,${clamp(adv.vignette / 100, 0, 1)})`)
                ctx.fillStyle = g
                ctx.fillRect(0, 0, W, H)
            }
            if (adv.grain > 0 && grainPattern) {
                ctx.save()
                ctx.globalAlpha = clamp(adv.grain / 100, 0, 1) * 0.22
                ctx.globalCompositeOperation = "overlay"
                ctx.fillStyle = grainPattern
                ctx.fillRect(0, 0, W, H)
                ctx.restore()
            }
        }
        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            mq?.removeEventListener?.("change", onMq)
            root.removeEventListener("pointerenter", onMove)
            root.removeEventListener("pointermove", onMove)
            root.removeEventListener("pointerleave", onLeave)
            root.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            root.style.cursor = ""
        }
    }, [])

    const layer: React.CSSProperties = {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
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
                overflow: "hidden",
                background,
                touchAction: "manipulation",
                userSelect: "none",
            }}
        >
            <canvas ref={glRef} style={layer} />
            <canvas ref={uiRef} style={{ ...layer, pointerEvents: "none" }} />
        </div>
    )
}

addPropertyControls(GooeyDeleteConfirm, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#E5142E" },
    confirmText: { type: ControlType.String, title: "Confirm", defaultValue: "Confirm" },
    cancelText: { type: ControlType.String, title: "Cancel", defaultValue: "Cancel" },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 48, variant: "Semibold", letterSpacing: "-0.01em", lineHeight: "1em" },
    },
    size: { type: ControlType.Number, title: "Size", min: 40, max: 400, step: 1, unit: "px", defaultValue: 196 },
    speed: { type: ControlType.Number, title: "Speed", min: 0, max: 100, step: 1, defaultValue: 50 },
    goo: { type: ControlType.Number, title: "Goo", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
    blur: { type: ControlType.Number, title: "Blur", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            pillRatio: { type: ControlType.Number, title: "Pill Width", min: 100, max: 400, step: 1, unit: "%", defaultValue: 217 },
            gap: { type: ControlType.Number, title: "Gap", min: 0, max: 120, step: 1, defaultValue: 46 },
            offsetY: { type: ControlType.Number, title: "Offset Y", min: -400, max: 400, step: 1, defaultValue: 0 },
            collapseMs: { type: ControlType.Number, title: "Collapse", min: 100, max: 3000, step: 10, unit: "ms", defaultValue: 500 },
            idleMs: { type: ControlType.Number, title: "Idle", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 150 },
            hoverMs: { type: ControlType.Number, title: "Hover Hold", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 400 },
            expandMs: { type: ControlType.Number, title: "Expand", min: 100, max: 3000, step: 10, unit: "ms", defaultValue: 900 },
            openHoldMs: { type: ControlType.Number, title: "Open Hold", min: 0, max: 5000, step: 10, unit: "ms", defaultValue: 150 },
            cancelHoverMs: { type: ControlType.Number, title: "Cancel Hold", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 350 },
            phaseMs: { type: ControlType.Number, title: "Phase", min: 0, max: 5000, step: 5, unit: "ms", defaultValue: 75 },
            easeX1: { type: ControlType.Number, title: "Ease X1", min: 0, max: 100, step: 1, defaultValue: 30 },
            easeY1: { type: ControlType.Number, title: "Ease Y1", min: -100, max: 200, step: 1, defaultValue: 40 },
            easeX2: { type: ControlType.Number, title: "Ease X2", min: 0, max: 100, step: 1, defaultValue: 20 },
            restGoo: { type: ControlType.Number, title: "Rest Goo", min: 0, max: 100, step: 1, unit: "%", defaultValue: 25 },
            bulge: { type: ControlType.Number, title: "Bulge", min: 0, max: 30, step: 1, unit: "%", defaultValue: 3 },
            pillColor: { type: ControlType.Color, title: "Pill", defaultValue: "#F9F9F9" },
            topColor: { type: ControlType.Color, title: "Top Light", defaultValue: "#FFFFFF" },
            edgeColor: { type: ControlType.Color, title: "Edge", defaultValue: "#D4D4D4" },
            borderWidth: { type: ControlType.Number, title: "Border", min: 0, max: 6, step: 1, unit: "px", defaultValue: 1 },
            shade: { type: ControlType.Number, title: "Shade", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30 },
            highlight: { type: ControlType.Number, title: "Highlight", min: 0, max: 100, step: 1, unit: "%", defaultValue: 60 },
            shadowAlpha: { type: ControlType.Number, title: "Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 8 },
            shadowY: { type: ControlType.Number, title: "Shadow Y", min: 0, max: 60, step: 1, defaultValue: 5 },
            shadowBlur: { type: ControlType.Number, title: "Shadow Blur", min: 0, max: 80, step: 1, defaultValue: 14 },
            cancelColor: { type: ControlType.Color, title: "Cancel Text", defaultValue: "#111111" },
            cancelHoverColor: { type: ControlType.Color, title: "Cancel Hover", defaultValue: "#DADADA" },
            circleTint: { type: ControlType.Number, title: "Circle Tint", min: 0, max: 100, step: 1, unit: "%", defaultValue: 25 },
            confirmTint: { type: ControlType.Number, title: "Confirm Tint", min: 0, max: 100, step: 1, unit: "%", defaultValue: 8 },
            iconSize: { type: ControlType.Number, title: "Icon Size", min: 10, max: 120, step: 1, defaultValue: 62 },
            iconStroke: { type: ControlType.Number, title: "Icon Slats", min: 2, max: 30, step: 1, unit: "%", defaultValue: 7 },
            squash: { type: ControlType.Number, title: "Squash", min: 0, max: 30, step: 1, unit: "%", defaultValue: 3 },
            pull: { type: ControlType.Number, title: "Pull", min: 0, max: 30, step: 1, unit: "%", defaultValue: 4 },
            resumeMs: { type: ControlType.Number, title: "Resume", min: 0, max: 10000, step: 100, unit: "ms", defaultValue: 2500 },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
        },
    },
})

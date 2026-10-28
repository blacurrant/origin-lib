import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

const DEFAULT_IMAGES = [{"src":"https://images.unsplash.com/photo-1791965558115-58fb666a7850?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792187790722-66db7d13a53f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792592108795-076164280be6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792614268370-d7a7046adbcf?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""}]

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    hover: 50,
    hoverTilt: 8,
    tilt: 1,
    cardAspect: 79,
    slotGap: 159,
    sideScale: 62,
    camera: 240,
    offsetY: -1,
    flareX: 15,
    flarePower: 3,
    fadeStart: 120,
    fadeEnd: 160,
    fringe: 40,
    smear: 30,
    chroma: 30,
    fringeOuter: "#3FE8F0",
    fringeInner: "#FF4FD8",
    settleMs: 800,
    bounce: 0,
    stepsPerBurst: 2,
    stepGapMs: 680,
    startDelayMs: 470,
    throwMs: 150,
    dragPx: 35,
    arrowSize: 44,
    arrowGap: 12,
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

const TW = 808
const TH = 1024

const VS = `#version 300 es
in vec2 aLocal;
uniform vec2 uCardSize;
uniform float uMargin;
uniform float uYaw;
uniform float uPitch;
uniform float uRoll;
uniform vec3 uOffset;
uniform float uCam;
uniform float uAspect;
uniform float uCurve;
uniform float uCurveX;
uniform float uPow;
out vec2 vLocal;
out float vEdge;
void main() {
  vec2 l = aLocal * (uCardSize + vec2(2.0 * uMargin));
  vLocal = l;
  vec3 p = vec3(l, 0.0);
  float cr = cos(uRoll), sr = sin(uRoll);
  p.xy = vec2(cr * p.x - sr * p.y, sr * p.x + cr * p.y);
  float cp = cos(uPitch), sp = sin(uPitch);
  p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
  float cy = cos(uYaw), sy = sin(uYaw);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  p += uOffset;
  float s = uCam / max(uCam - p.z, 0.05);
  vec2 n = vec2(p.x * s / max(uAspect, 0.01), p.y * s);
  float e = pow(abs(n.x), uPow);
  n.y *= 1.0 + uCurve * e;
  n.x *= 1.0 + uCurveX * e;
  vEdge = uCurve * e;
  gl_Position = vec4(n, 0.0, 1.0);
}`

const FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vEdge;
uniform sampler2D uTex;
uniform vec2 uCardSize;
uniform float uRadius;
uniform float uFringe;
uniform float uSmear;
uniform float uChroma;
uniform float uAlpha;
uniform vec3 uFringeA;
uniform vec3 uFringeB;
out vec4 outColor;
float sdr(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 hb = uCardSize * 0.5;
  float r = min(uRadius, min(hb.x, hb.y));
  float d = sdr(vLocal, hb, r);
  float aa = max(fwidth(d), 1e-4);
  float f = uFringe * vEdge;
  float a0 = 1.0 - smoothstep(-aa, aa, d);
  float a1 = 1.0 - smoothstep(-aa, aa, d - f);
  float a2 = 1.0 - smoothstep(-aa, aa, d - 2.0 * f);
  if (a2 <= 0.001) discard;
  vec2 uv = vec2(vLocal.x / max(uCardSize.x, 1e-4) + 0.5, 0.5 - vLocal.y / max(uCardSize.y, 1e-4));
  float sm = uSmear * vEdge;
  float ca = uChroma * vEdge;
  vec3 c = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float o = (float(i) / 4.0 - 0.5) * sm;
    c.r += texture(uTex, uv + vec2(o + ca, 0.0)).r;
    c.g += texture(uTex, uv + vec2(o, 0.0)).g;
    c.b += texture(uTex, uv + vec2(o - ca, 0.0)).b;
  }
  c /= 5.0;
  vec3 col = c * a0 + uFringeB * max(a1 - a0, 0.0) + uFringeA * max(a2 - a1, 0.0);
  outColor = vec4(col * uAlpha, a2 * uAlpha);
}`

function parseColor(c: any): [number, number, number] {
    if (typeof c !== "string") return [1, 1, 1]
    const s = c.trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((x) => x + x)
                .join("")
        const n = parseInt(h.slice(0, 6), 16)
        if (isNaN(n)) return [1, 1, 1]
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    }
    const m = s.match(/[\d.]+/g)
    if (m && m.length >= 3) return [+m[0] / 255, +m[1] / 255, +m[2] / 255]
    return [1, 1, 1]
}

function rgba(hex: string, a: number) {
    const [r, g, b] = parseColor(hex)
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, rgba(hex, a))
    g.addColorStop(0.45, rgba(hex, a * 0.65))
    g.addColorStop(1, rgba(hex, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, TW, TH)
}

// Card bodies: blurred multi-blob mesh fields. Blob = [x, y, radius (of TH), colour, alpha]
const BODIES: any[] = [
    {
        base: "#EE5A2A",
        blobs: [
            [0.9, 0.92, 0.5, "#E8452A", 0.95],
            [0.05, 0.85, 0.4, "#E8452A", 0.8],
            [0.5, 0.12, 0.55, "#F7D84A", 1],
            [0.02, 0.55, 0.3, "#F06A2A", 0.8],
            [0.5, 0.47, 0.42, "#B9C23A", 1],
            [0.5, 0.47, 0.3, "#688A42", 1],
            [0.5, 0.46, 0.17, "#1E2A0E", 0.95],
            [0.5, 1.03, 0.3, "#FF7FB0", 0.85],
        ],
        title: ["Access to advanced", "intelligence"],
        footer: "GPT 5.2, Claude, Google",
    },
    {
        base: "#5A1028",
        blobs: [
            [0.1, 0.1, 0.4, "#7C1737", 0.9],
            [0.88, 0.2, 0.5, "#B95B65", 0.7],
            [0.92, 0.88, 0.38, "#AF2941", 0.85],
            [0.18, 0.78, 0.5, "#E0245A", 0.95],
            [0.55, 0.46, 0.3, "#14081B", 0.9],
            [0.4, 0.62, 0.18, "#FF5A78", 0.35],
        ],
        title: ["Weekly Credit hours /", "Image generation"],
        footer: "Image engine v2.0",
    },
    {
        grad: [
            [0, "#07102A"],
            [0.35, "#0A1F5C"],
            [0.72, "#2556BE"],
            [1, "#3D7BFF"],
        ],
        blobs: [
            [0.15, 0.92, 0.42, "#1E5BFF", 0.85],
            [0.5, 0.62, 0.25, "#1440B8", 0.5],
            [0.75, 0.82, 0.32, "#5065E2", 0.55],
            [0.58, 0.88, 0.16, "#0A1530", 0.7],
            [0.99, 1.0, 0.36, "#E6FBFF", 0.95],
        ],
        title: ["Artificial intelligence", "vs Human Tone"],
        footer: "Results Customization",
    },
    {
        base: "#4234A0",
        blobs: [
            [0.08, 0.6, 0.5, "#2A1B5E", 0.9],
            [0.6, 0.48, 0.28, "#5A2FA8", 0.6],
            [0.92, 0.12, 0.5, "#9A53E7", 0.95],
            [0.5, 0.98, 0.45, "#C07AF0", 0.85],
            [0.15, 0.95, 0.25, "#2A1B5E", 0.6],
        ],
        title: ["Expand limits with Sora", "video creation"],
        footer: "Support Sora, Kling & Runway",
    },
]

function fnt(fam: string, w: any, size: number) {
    return `${w} ${Math.round(size)}px ${fam}`
}

function bigNumber(
    ctx: CanvasRenderingContext2D,
    fam: string,
    text: string,
    sup: string,
    cx: number,
    cy: number,
    size: number,
    fill: [string, string],
    supFill: string
) {
    ctx.font = fnt(fam, 300, size)
    ctx.textAlign = "left"
    const w = ctx.measureText(text).width
    const cap = size * 0.72
    const base = cy + cap / 2
    const x0 = cx - w / 2
    const g = ctx.createLinearGradient(0, base - cap, 0, base)
    g.addColorStop(0, fill[0])
    g.addColorStop(1, fill[1])
    ctx.fillStyle = g
    ctx.fillText(text, x0, base)
    if (sup) {
        const ss = size * 0.31
        ctx.font = fnt(fam, 300, ss)
        ctx.fillStyle = supFill
        ctx.fillText(sup, x0 + w + size * 0.04, base - cap + ss * 0.72)
    }
    return { x0, w, base, cap }
}

function plusChip(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, plus: boolean) {
    ctx.fillStyle = "rgba(20,8,27,0.5)"
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "rgba(255,255,255,0.8)"
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(x - r * 0.32, y)
    ctx.lineTo(x + r * 0.32, y)
    if (plus) {
        ctx.moveTo(x, y - r * 0.32)
        ctx.lineTo(x, y + r * 0.32)
    }
    ctx.stroke()
}

function paintDetails(ctx: CanvasRenderingContext2D, kind: number, fam: string) {
    const cy = TH * 0.49
    const size = TH * 0.18
    if (kind === 0) {
        const cx = TW * 0.5
        const R = TW * 0.3
        const fadeAt = (120 * Math.PI) / 180
        for (let i = 0; i < 120; i++) {
            const a = (i / 120) * Math.PI * 2
            let dd = Math.abs(a - fadeAt)
            dd = Math.min(dd, Math.PI * 2 - dd) / Math.PI
            const f = Math.min(1, Math.max(0, (dd - 0.04) / 0.35))
            if (f <= 0) continue
            ctx.strokeStyle = `rgba(255,250,215,${0.6 * f})`
            ctx.lineWidth = 2.5
            const len = TH * (i % 5 === 0 ? 0.026 : 0.018)
            ctx.beginPath()
            ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
            ctx.lineTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len))
            ctx.stroke()
        }
        ctx.strokeStyle = "rgba(255,250,215,0.25)"
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2)
        ctx.stroke()
        bigNumber(ctx, fam, "95", "th", cx, cy, size, ["#FFFFFF", "#F4F1D8"], "#D6E38A")
    } else if (kind === 1) {
        bigNumber(ctx, fam, "720", "", TW * 0.5, cy, size, ["#FFFFFF", "#FFC2CF"], "#fff")
        plusChip(ctx, TW * 0.13, cy, TW * 0.043, true)
        plusChip(ctx, TW * 0.87, cy, TW * 0.043, true)
        const y = TH * 0.625
        for (let i = 0; i < 64; i++) {
            const x = TW * 0.14 + (i / 63) * TW * 0.72
            const n = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1
            const h = TH * (0.008 + n * 0.03)
            const red = i === 40
            ctx.fillStyle = red ? "#FF3B5C" : "rgba(255,255,255,0.45)"
            ctx.fillRect(x - 1, y - (red ? TH * 0.04 : h) / 2, red ? 3 : 2, red ? TH * 0.04 : h)
        }
    } else if (kind === 2) {
        bigNumber(ctx, fam, "25", "%", TW * 0.5, cy, size, ["#9AF4FF", "#3A8DFF"], "#9AE6FF")
        const y = TH * 0.625
        const x0 = TW * 0.06
        const x1 = TW * 0.94
        const g = ctx.createLinearGradient(x0, 0, x1, 0)
        g.addColorStop(0, "rgba(120,200,255,0.25)")
        g.addColorStop(0.5, "rgba(150,225,255,0.9)")
        g.addColorStop(1, "rgba(120,200,255,0.3)")
        ctx.fillStyle = g
        ctx.fillRect(x0, y - 1.5, x1 - x0, 3)
        const kx = x0 + (x1 - x0) * 0.25
        ctx.save()
        ctx.shadowColor = "rgba(200,240,255,0.95)"
        ctx.shadowBlur = 24
        ctx.fillStyle = "#FFFFFF"
        ctx.beginPath()
        ctx.arc(kx, y, TW * 0.017, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        ctx.font = fnt(fam, 400, TH * 0.024)
        ctx.fillStyle = "rgba(255,255,255,0.85)"
        ctx.textAlign = "left"
        ctx.fillText("AI", x0, y + TH * 0.04)
        ctx.textAlign = "right"
        ctx.fillText("Human", x1, y + TH * 0.04)
        ctx.textAlign = "left"
    } else {
        ctx.strokeStyle = "rgba(226,166,240,0.6)"
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(TW * 0.62, TH * 0.22)
        ctx.lineTo(TW * 0.62, TH * 0.76)
        ctx.moveTo(TW * 0.12, cy)
        ctx.lineTo(TW * 0.88, cy)
        ctx.stroke()
        ctx.font = fnt(fam, 300, TH * 0.17)
        ctx.fillStyle = "rgba(255,255,255,0.1)"
        ctx.textAlign = "center"
        ctx.fillText("1.0", TW * 0.5, cy - TH * 0.17 + TH * 0.06)
        ctx.fillText("3.0", TW * 0.5, cy + TH * 0.17 + TH * 0.06)
        ctx.textAlign = "left"
        const n = bigNumber(ctx, fam, "2.0", "", TW * 0.5, cy, TH * 0.16, ["#FFD0F4", "#D7A2FF"], "#fff")
        ctx.font = fnt(fam, 300, TH * 0.055)
        ctx.fillStyle = "#E7B8FF"
        ctx.fillText("v", n.x0 - TW * 0.06, n.base - n.cap + TH * 0.04)
        plusChip(ctx, TW * 0.16, cy, TW * 0.044, false)
        plusChip(ctx, TW * 0.84, TH * 0.6, TW * 0.044, true)
        const pw = TW * 0.205
        const ph = TH * 0.044
        const px = TW - TW * 0.058 - pw
        const py = TH * 0.075
        ctx.fillStyle = "rgba(255,255,255,0.15)"
        ctx.beginPath()
        if ((ctx as any).roundRect) (ctx as any).roundRect(px, py, pw, ph, ph / 2)
        else ctx.rect(px, py, pw, ph)
        ctx.fill()
        ctx.font = fnt(fam, 400, TH * 0.021)
        ctx.fillStyle = "rgba(255,255,255,0.85)"
        ctx.textAlign = "center"
        ctx.fillText("Beta version", px + pw / 2, py + ph * 0.68)
        ctx.textAlign = "left"
    }
}

function paintCard(ctx: CanvasRenderingContext2D, kind: number, fam: string, titleWeight: any, pic: HTMLImageElement | null) {
    ctx.save()
    ctx.clearRect(0, 0, TW, TH)
    const b = BODIES[kind]
    if (b.grad) {
        const g = ctx.createLinearGradient(0, 0, 0, TH)
        b.grad.forEach((s: any) => g.addColorStop(s[0], s[1]))
        ctx.fillStyle = g
    } else ctx.fillStyle = b.base
    ctx.fillRect(0, 0, TW, TH)
    for (const bl of b.blobs) blob(ctx, bl[0] * TW, bl[1] * TH, bl[2] * TH, bl[3], bl[4])
    if (pic) {
        const iw = pic.naturalWidth || 1
        const ih = pic.naturalHeight || iw
        const k = Math.max(TW / iw, TH / ih)
        const w = iw * k
        const h = ih * k
        ctx.drawImage(pic, (TW - w) / 2, (TH - h) / 2, w, h)
        ctx.restore()
        return
    }
    const padX = TW * 0.062
    ctx.textBaseline = "alphabetic"
    ctx.textAlign = "left"
    ctx.fillStyle = "rgba(255,255,255,0.92)"
    ctx.font = fnt(fam, titleWeight, TH * 0.031)
    b.title.forEach((l: string, k: number) => ctx.fillText(l, padX, TH * 0.1 + TH * 0.024 + k * TH * 0.0426))
    ctx.fillText(b.footer, padX, TH * (1 - 0.085))
    paintDetails(ctx, kind, fam)
    ctx.restore()
}

/**
 * Mirror Flip Carousel — cards on a track that yaw 180° per slot, flaring
 * out to the frame edges in a wide-angle barrel warp with a chromatic fringe.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function MirrorFlipCarousel(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        images = DEFAULT_IMAGES,
        scale = 100,
        speed = 19,
        autoplay = true,
        interval = 3700,
        curve = 60,
        rounded = 9,
        arrows = true,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const srcs: string[] = (Array.isArray(images) ? images : [])
        .map((v: any) => (typeof v === "string" ? v : v?.src))
        .filter(Boolean)
    const fontFamily: string = props.font?.fontFamily || "Inter"
    const fontWeight: any = props.font?.fontWeight || 400
    const bakeKey = srcs.join("\n") + "|" + fontFamily + "|" + fontWeight

    const propsRef = useRef<any>({})
    propsRef.current = { ...props, speed, autoplay, interval, curve, rounded, scale, srcs, fontFamily, fontWeight, bakeKey }

    const simRef = useRef<any>({
        t: 0,
        pos: 0,
        vel: 0,
        target: 0,
        stepIn: 0,
        nextAt: ADVANCED_DEFAULTS.startDelayMs / 1000,
        burstAt: ADVANCED_DEFAULTS.startDelayMs / 1000,
        dragging: false,
        dragX: 0,
        dragStart: 0,
        dragMoved: 0,
        lastMoveT: 0,
        hx: 0,
        hy: 0,
        tx: 0,
        ty: 0,
        over: 0,
        overT: 0,
        dirty: true,
        cw: 0,
        ch: 0,
    })

    const go = (dir: number) => {
        const s = simRef.current
        s.target = Math.round(s.target) + dir
        s.stepIn = 0
        s.burstAt = s.nextAt = s.t + Math.max(1000, propsRef.current.interval || 3700) / 1000
    }

    useEffect(() => {
        if (typeof document === "undefined" || !(document as any).fonts) return
        const fam = `"${fontFamily}"`
        ;(document as any).fonts
            .load(`300 40px ${fam}`)
            .then(() => (document as any).fonts.load(`${fontWeight} 32px ${fam}`))
            .then(() => {
                simRef.current.dirty = true
            })
            .catch(() => {})
        ;(document as any).fonts.ready?.then(() => {
            simRef.current.dirty = true
        })
    }, [fontFamily, fontWeight])

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return
        const s = simRef.current
        const a0 = { ...ADVANCED_DEFAULTS, ...(propsRef.current.advanced ?? {}) }
        s.nextAt = s.burstAt = a0.startDelayMs / 1000

        const rt = RenderTarget.current()
        const isStatic = rt === RenderTarget.thumbnail || rt === (RenderTarget as any).export
        const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null

        let gl: WebGL2RenderingContext | null = null
        let prog: WebGLProgram | null = null
        let vao: WebGLVertexArrayObject | null = null
        let vbo: WebGLBuffer | null = null
        let ibo: WebGLBuffer | null = null
        let idxCount = 0
        let U: Record<string, WebGLUniformLocation> = {}
        const textures: WebGLTexture[] = []
        let aniso: any = null

        try {
            gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true })
            if (!gl) throw new Error("WebGL2 unavailable")
            const compile = (type: number, src: string) => {
                const sh = gl!.createShader(type)!
                gl!.shaderSource(sh, src)
                gl!.compileShader(sh)
                if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(sh) || "shader")
                return sh
            }
            const vs = compile(gl.VERTEX_SHADER, VS)
            const fs = compile(gl.FRAGMENT_SHADER, FS)
            prog = gl.createProgram()!
            gl.attachShader(prog, vs)
            gl.attachShader(prog, fs)
            gl.linkProgram(prog)
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link")
            gl.deleteShader(vs)
            gl.deleteShader(fs)
            const names = [
                "uCardSize", "uMargin", "uYaw", "uPitch", "uRoll", "uOffset", "uCam", "uAspect", "uCurve", "uCurveX", "uPow",
                "uTex", "uRadius", "uFringe", "uSmear", "uChroma", "uAlpha", "uFringeA", "uFringeB",
            ]
            for (const n of names) {
                const loc = gl.getUniformLocation(prog, n)
                if (loc === null) throw new Error("Missing uniform " + n)
                U[n] = loc
            }
            const GX = 48
            const GY = 56
            const verts = new Float32Array((GX + 1) * (GY + 1) * 2)
            let k = 0
            for (let j = 0; j <= GY; j++)
                for (let i = 0; i <= GX; i++) {
                    verts[k++] = i / GX - 0.5
                    verts[k++] = j / GY - 0.5
                }
            const idx = new Uint16Array(GX * GY * 6)
            k = 0
            for (let j = 0; j < GY; j++)
                for (let i = 0; i < GX; i++) {
                    const a = j * (GX + 1) + i
                    const b = a + 1
                    const c = a + GX + 1
                    const d = c + 1
                    idx[k++] = a
                    idx[k++] = b
                    idx[k++] = c
                    idx[k++] = b
                    idx[k++] = d
                    idx[k++] = c
                }
            idxCount = idx.length
            vao = gl.createVertexArray()
            gl.bindVertexArray(vao)
            vbo = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
            gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
            const loc = gl.getAttribLocation(prog, "aLocal")
            gl.enableVertexAttribArray(loc)
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
            ibo = gl.createBuffer()
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
            gl.bindVertexArray(null)
            aniso = gl.getExtension("EXT_texture_filter_anisotropic")
        } catch (err) {
            console.error(err)
            gl = null
        }

        // Image cache: one load per src
        const pics = new Map<string, { img: HTMLImageElement; state: number }>()
        const getPic = (src: string) => {
            let e = pics.get(src)
            if (!e) {
                const img = new Image()
                img.crossOrigin = "anonymous"
                e = { img, state: 0 }
                const ent = e
                img.onload = () => {
                    ent.state = 1
                    s.dirty = true
                }
                img.onerror = () => {
                    ent.state = 2
                    s.dirty = true
                }
                pics.set(src, e)
                img.src = src
            }
            return e.state === 1 ? e.img : null
        }

        const off = document.createElement("canvas")
        off.width = TW
        off.height = TH
        const octx = off.getContext("2d")!
        let bakedKey = ""

        const bake = () => {
            if (!gl) return
            const p = propsRef.current
            const list: string[] = p.srcs || []
            const N = Math.max(4, Math.min(8, list.length))
            while (textures.length < N) {
                const t = gl.createTexture()!
                gl.bindTexture(gl.TEXTURE_2D, t)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
                if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8)
                textures.push(t)
            }
            while (textures.length > N) gl.deleteTexture(textures.pop()!)
            const fam = `"${p.fontFamily}", Inter, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`
            for (let i = 0; i < N; i++) {
                const src = list.length ? list[i % list.length] : ""
                let pic = src ? getPic(src) : null
                paintCard(octx, i % 4, fam, p.fontWeight, pic)
                gl.bindTexture(gl.TEXTURE_2D, textures[i])
                try {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off)
                } catch {
                    if (src) {
                        const e = pics.get(src)
                        if (e) e.state = 2
                    }
                    paintCard(octx, i % 4, fam, p.fontWeight, null)
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off)
                }
                gl.generateMipmap(gl.TEXTURE_2D)
            }
            bakedKey = p.bakeKey
            s.dirty = false
        }

        const ro = new ResizeObserver(() => {
            s.cw = root.offsetWidth
            s.ch = root.offsetHeight
        })
        ro.observe(root)
        s.cw = root.offsetWidth
        s.ch = root.offsetHeight

        // Pointer: hover tilt
        const onHoverMove = (e: PointerEvent) => {
            if (e.target !== canvas) return
            const w = canvas.offsetWidth || 1
            const h = canvas.offsetHeight || 1
            s.tx = (e.offsetX / w) * 2 - 1
            s.ty = (e.offsetY / h) * 2 - 1
            s.overT = 1
        }
        const onEnter = () => {
            s.overT = 1
        }
        const onLeave = () => {
            s.overT = 0
        }

        // Drag
        const onMove = (e: PointerEvent) => {
            if (!s.dragging) return
            const a = { ...ADVANCED_DEFAULTS, ...(propsRef.current.advanced ?? {}) }
            const per = Math.max(40, (root.offsetWidth || 1) * a.dragPx / 100)
            const dx = e.clientX - s.dragX
            s.dragMoved = Math.max(s.dragMoved, Math.abs(dx))
            const np = s.dragStart - dx / per
            const now = performance.now()
            const dts = Math.max(1, now - s.lastMoveT) / 1000
            const v = (np - s.pos) / dts
            s.vel = s.vel * 0.5 + v * 0.5
            s.pos = np
            s.lastMoveT = now
        }
        const onUp = () => {
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            if (!s.dragging) return
            s.dragging = false
            root.style.cursor = "grab"
            const a = { ...ADVANCED_DEFAULTS, ...(propsRef.current.advanced ?? {}) }
            if (performance.now() - s.lastMoveT > 120) s.vel = 0
            s.vel = Math.max(-8, Math.min(8, s.vel))
            if (s.dragMoved < 4) {
                s.target = Math.round(s.pos)
            } else {
                const base = Math.round(s.dragStart)
                const proj = Math.round(s.pos + s.vel * (a.throwMs / 1000))
                s.target = Math.max(base - 2, Math.min(base + 2, proj))
            }
            s.stepIn = 0
            s.burstAt = s.nextAt = s.t + Math.max(1000, propsRef.current.interval || 3700) / 1000
        }
        const onDown = (e: PointerEvent) => {
            if (e.pointerType === "mouse" && e.button !== 0) return
            const el = e.target as HTMLElement
            if (el && el.closest && el.closest("[data-arrow]")) return
            s.dragging = true
            s.dragX = e.clientX
            s.dragStart = s.pos
            s.dragMoved = 0
            s.vel = 0
            s.lastMoveT = performance.now()
            root.style.cursor = "grabbing"
            window.addEventListener("pointermove", onMove)
            window.addEventListener("pointerup", onUp)
            window.addEventListener("pointercancel", onUp)
        }
        root.addEventListener("pointermove", onHoverMove)
        root.addEventListener("pointerenter", onEnter)
        root.addEventListener("pointerleave", onLeave)
        root.addEventListener("pointerdown", onDown)

        let raf = 0
        let last = -1
        const tick = (now: number) => {
            raf = requestAnimationFrame(tick)
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            last = now
            const p = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const reduced = !!mq?.matches
            const sp = Math.max(0, Math.min(100, p.speed ?? 50)) / 50
            s.t += dt * sp

            // Autoplay: bursts of steps, rest between bursts
            if (p.autoplay && !isStatic && !reduced && sp > 0 && !s.dragging) {
                if (s.t >= s.nextAt) {
                    s.target = Math.round(s.target) + 1
                    s.stepIn += 1
                    if (s.stepIn < Math.max(1, a.stepsPerBurst)) {
                        s.nextAt = s.t + a.stepGapMs / 1000
                    } else {
                        s.stepIn = 0
                        const iv = Math.max(1000, p.interval || 3700) / 1000
                        s.burstAt = Math.max(s.burstAt + iv, s.t + a.stepGapMs / 1000)
                        s.nextAt = s.burstAt
                    }
                }
            }

            // Spring toward target (critically damped by default: fast start, long settle)
            if (!s.dragging) {
                if (reduced || sp <= 0) {
                    s.pos = s.target
                    s.vel = 0
                } else {
                    const omega = Math.min(40, (5.8 / Math.max(0.05, a.settleMs / 1000)) * sp)
                    const zeta = Math.max(0.2, 1 - (a.bounce / 100) * 0.7)
                    const n = 4
                    const h = dt / n
                    for (let i = 0; i < n; i++) {
                        const acc = -omega * omega * (s.pos - s.target) - 2 * zeta * omega * s.vel
                        s.vel += acc * h
                        s.pos += s.vel * h
                    }
                }
            }

            const N = Math.max(4, textures.length)
            if (!s.dragging && Math.abs(s.pos - s.target) < 1e-4 && Math.abs(s.vel) < 1e-4) {
                const k = Math.floor(s.target / N) * N
                s.target -= k
                s.pos = s.target
                s.vel = 0
                s.dragStart -= k
            }

            // Pointer easing
            const ek = 1 - Math.exp(-dt * 6)
            s.over += (s.overT - s.over) * ek
            s.hx += (s.tx * s.overT - s.hx) * ek
            s.hy += (s.ty * s.overT - s.hy) * ek

            if (!gl || !prog) return
            if (s.dirty || bakedKey !== p.bakeKey) bake()

            const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2)
            const cw = Math.max(1, s.cw || root.offsetWidth)
            const ch = Math.max(1, s.ch || root.offsetHeight)
            const W = Math.round(cw * dpr)
            const Hh = Math.round(ch * dpr)
            if (canvas.width !== W || canvas.height !== Hh) {
                canvas.width = W
                canvas.height = Hh
            }
            gl.viewport(0, 0, W, Hh)
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT)
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
            gl.useProgram(prog)
            gl.bindVertexArray(vao)

            const cardH = 1.34 * Math.max(10, Math.min(300, p.scale ?? 100)) / 100
            const cardW = cardH * Math.max(20, a.cardAspect) / 100
            const slot = cardW * a.slotGap / 100
            const cam = Math.max(0.5, a.camera / 100)
            const zBack = cam * (100 / Math.max(5, a.sideScale) - 1)
            const curveAmt = Math.max(0, Math.min(100, p.curve ?? 60)) / 80
            const deg = Math.PI / 180
            const hoverK = (a.hover / 50) * s.over
            const fa = parseColor(a.fringeOuter)
            const fb = parseColor(a.fringeInner)

            gl.uniform2f(U.uCardSize, cardW, cardH)
            gl.uniform1f(U.uMargin, 0.12)
            gl.uniform1f(U.uCam, cam)
            gl.uniform1f(U.uAspect, cw / ch)
            gl.uniform1f(U.uCurve, curveAmt)
            gl.uniform1f(U.uCurveX, (a.flareX / 100) * (curveAmt / 0.75))
            gl.uniform1f(U.uPow, Math.max(1, a.flarePower))
            gl.uniform1i(U.uTex, 0)
            gl.uniform1f(U.uRadius, (Math.max(0, Math.min(100, p.rounded ?? 9)) / 100) * Math.min(cardW, cardH) / 2)
            gl.uniform1f(U.uFringe, a.fringe / 1000)
            gl.uniform1f(U.uSmear, (a.smear / 100) * 0.3)
            gl.uniform1f(U.uChroma, (a.chroma / 100) * 0.04)
            gl.uniform3f(U.uFringeA, fa[0], fa[1], fa[2])
            gl.uniform3f(U.uFringeB, fb[0], fb[1], fb[2])
            gl.activeTexture(gl.TEXTURE0)

            const fs0 = a.fadeStart / 100
            const fs1 = Math.max(fs0 + 0.01, a.fadeEnd / 100)
            const order: { i: number; d: number }[] = []
            for (let i = 0; i < textures.length; i++) {
                let d = (((i - s.pos) % N) + N) % N
                if (d >= N / 2) d -= N
                if (Math.abs(d) < fs1) order.push({ i, d })
            }
            order.sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
            for (const { i, d } of order) {
                const ad = Math.abs(d)
                const t = Math.min(1, Math.max(0, (ad - fs0) / (fs1 - fs0)))
                const alpha = 1 - t * t * (3 - 2 * t)
                const wH = Math.max(0, 1 - ad) * hoverK
                gl.uniform1f(U.uYaw, d * Math.PI + s.hx * a.hoverTilt * deg * wH)
                gl.uniform1f(U.uPitch, s.hy * a.hoverTilt * deg * wH)
                gl.uniform1f(U.uRoll, a.tilt * deg)
                gl.uniform3f(U.uOffset, d * slot, (a.offsetY / 100) * 2, -zBack * ad)
                gl.uniform1f(U.uAlpha, alpha)
                gl.bindTexture(gl.TEXTURE_2D, textures[i])
                gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0)
            }
            gl.bindVertexArray(null)
        }
        raf = requestAnimationFrame(tick)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            root.removeEventListener("pointermove", onHoverMove)
            root.removeEventListener("pointerenter", onEnter)
            root.removeEventListener("pointerleave", onLeave)
            root.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            pics.forEach((e) => {
                e.img.onload = null
                e.img.onerror = null
            })
            if (gl) {
                textures.forEach((t) => gl!.deleteTexture(t))
                if (vbo) gl.deleteBuffer(vbo)
                if (ibo) gl.deleteBuffer(ibo)
                if (vao) gl.deleteVertexArray(vao)
                if (prog) gl.deleteProgram(prog)
            }
        }
    }, [])

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowRight") {
            e.preventDefault()
            go(1)
        } else if (e.key === "ArrowLeft") {
            e.preventDefault()
            go(-1)
        }
    }

    const btnSize = Math.max(20, adv.arrowSize)
    const btnStyle: React.CSSProperties = {
        width: btnSize,
        height: btnSize,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
        outline: "none",
    }
    const chevron = (dir: number) => (
        <svg width={btnSize * 0.4} height={btnSize * 0.4} viewBox="0 0 16 16" fill="none">
            <path
                d={dir < 0 ? "M10 3 L5 8 L10 13" : "M6 3 L11 8 L6 13"}
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
    const grainUrl =
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

    return (
        <div
            ref={rootRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            style={{
                minWidth: 1200,
                minHeight: 800,
                width: "100%",
                height: "100%",
                ...style,
                position: "relative",
                overflow: "hidden",
                background,
                isolation: "isolate",
                cursor: "grab",
                touchAction: "pan-y",
                userSelect: "none",
                outline: "none",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
            />
            {adv.vignette > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,${
                            Math.min(100, adv.vignette) / 100
                        }) 100%)`,
                    }}
                />
            )}
            {adv.grain > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        backgroundImage: grainUrl,
                        backgroundSize: "160px 160px",
                        opacity: (Math.min(100, adv.grain) / 100) * 0.5,
                        mixBlendMode: "overlay",
                    }}
                />
            )}
            {arrows && (
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        bottom: "5%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: adv.arrowGap,
                        zIndex: 2,
                    }}
                >
                    <button data-arrow="prev" aria-label="Previous card" style={btnStyle} onClick={() => go(-1)}>
                        {chevron(-1)}
                    </button>
                    <button data-arrow="next" aria-label="Next card" style={btnStyle} onClick={() => go(1)}>
                        {chevron(1)}
                    </button>
                </div>
            )}
        </div>
    )
}

addPropertyControls(MirrorFlipCarousel, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Stage colour behind the cards.",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        description: "Typeface for the card titles, numbers and captions.",
    },
    images: {
        defaultValue: DEFAULT_IMAGES,
        type: ControlType.Array,
        title: "Images",
        maxCount: 8,
        control: { type: ControlType.ResponsiveImage },
        description: "Your own card faces. One goes on every card, several in turn. Empty draws the built-in cards.",
    },
    scale: {
        type: ControlType.Number,
        title: "Scale",
        min: 40,
        max: 160,
        step: 1,
        unit: "%",
        defaultValue: 100,
        description: "How big the cards draw.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 19,
        description: "How fast cards flip to the next slot. 0 stops the motion.",
    },
    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: true,
        description: "Advance on its own in bursts of steps.",
    },
    interval: {
        type: ControlType.Number,
        title: "Interval",
        min: 1000,
        max: 10000,
        step: 100,
        unit: "ms",
        defaultValue: 3700,
        description: "Time from one autoplay burst to the next.",
        hidden: (p: any) => !p.autoplay,
    },
    curve: {
        type: ControlType.Number,
        title: "Curve",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 60,
        description: "Wide-angle flare of the side cards. 0 is a plain perspective track.",
    },
    rounded: {
        type: ControlType.Number,
        title: "Rounded",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 9,
        description: "Card corner radius as a share of the largest possible.",
    },
    arrows: {
        type: ControlType.Boolean,
        title: "Arrows",
        defaultValue: true,
        description: "Show previous / next buttons. Dragging and arrow keys always work.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "How strongly the centre card tilts toward the pointer. 0 is off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            hoverTilt: { type: ControlType.Number, title: "Hover Tilt", min: 0, max: 30, step: 1, unit: "°", defaultValue: 8, description: "Largest pointer tilt." },
            tilt: { type: ControlType.Number, title: "Tilt", min: -10, max: 10, step: 1, unit: "°", defaultValue: 1, description: "Resting roll of the cards." },
            cardAspect: { type: ControlType.Number, title: "Card Aspect", min: 40, max: 150, step: 1, unit: "%", defaultValue: 79, description: "Card width as a share of its height." },
            slotGap: { type: ControlType.Number, title: "Slot Spacing", min: 100, max: 260, step: 1, unit: "%", defaultValue: 159, description: "Distance between slots as a share of card width." },
            sideScale: { type: ControlType.Number, title: "Side Scale", min: 20, max: 100, step: 1, unit: "%", defaultValue: 62, description: "Size of the side cards before the flare." },
            camera: { type: ControlType.Number, title: "Camera", min: 80, max: 800, step: 1, defaultValue: 240, description: "Camera distance; lower is wider-angle." },
            offsetY: { type: ControlType.Number, title: "Offset Y", min: -30, max: 30, step: 1, unit: "%", defaultValue: -1, description: "Vertical shift of the track." },
            flareX: { type: ControlType.Number, title: "Flare X", min: 0, max: 60, step: 1, unit: "%", defaultValue: 15, description: "Horizontal stretch toward the frame edges." },
            flarePower: { type: ControlType.Number, title: "Flare Power", min: 1, max: 6, step: 1, defaultValue: 3, description: "How sharply the flare grows toward the edges." },
            fadeStart: { type: ControlType.Number, title: "Fade Start", min: 50, max: 200, step: 1, unit: "%", defaultValue: 120, description: "Slot offset where far cards begin to fade." },
            fadeEnd: { type: ControlType.Number, title: "Fade End", min: 60, max: 200, step: 1, unit: "%", defaultValue: 160, description: "Slot offset where far cards are gone." },
            fringe: { type: ControlType.Number, title: "Fringe", min: 0, max: 100, step: 1, defaultValue: 40, description: "Width of the cyan / magenta outline fringe." },
            smear: { type: ControlType.Number, title: "Smear", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30, description: "Horizontal streaking on the flared cards." },
            chroma: { type: ControlType.Number, title: "Chroma", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30, description: "RGB split on the flared cards." },
            fringeOuter: { type: ControlType.Color, title: "Fringe Outer", defaultValue: "#3FE8F0", description: "Outer fringe colour." },
            fringeInner: { type: ControlType.Color, title: "Fringe Inner", defaultValue: "#FF4FD8", description: "Inner fringe colour." },
            settleMs: { type: ControlType.Number, title: "Settle", min: 100, max: 3000, step: 10, unit: "ms", defaultValue: 800, description: "Time for one step to settle at speed 50." },
            bounce: { type: ControlType.Number, title: "Bounce", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Overshoot at the end of a step." },
            stepsPerBurst: { type: ControlType.Number, title: "Steps / Burst", min: 1, max: 4, step: 1, defaultValue: 2, description: "Autoplay steps in each burst." },
            stepGapMs: { type: ControlType.Number, title: "Step Gap", min: 100, max: 3000, step: 10, unit: "ms", defaultValue: 680, description: "Time between steps inside a burst." },
            startDelayMs: { type: ControlType.Number, title: "Start Delay", min: 0, max: 5000, step: 10, unit: "ms", defaultValue: 470, description: "Wait before the first autoplay step." },
            throwMs: { type: ControlType.Number, title: "Throw", min: 0, max: 600, step: 10, unit: "ms", defaultValue: 150, description: "How far a flick carries after release." },
            dragPx: { type: ControlType.Number, title: "Drag Distance", min: 10, max: 100, step: 1, unit: "%", defaultValue: 35, description: "Drag width per card, as a share of the component width." },
            arrowSize: { type: ControlType.Number, title: "Arrow Size", min: 24, max: 96, step: 1, unit: "px", defaultValue: 44, description: "Diameter of the arrow buttons." },
            arrowGap: { type: ControlType.Number, title: "Arrow Gap", min: 0, max: 80, step: 1, unit: "px", defaultValue: 12, description: "Space between the arrow buttons." },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over the whole component." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening over the whole component." },
        },
    },
})

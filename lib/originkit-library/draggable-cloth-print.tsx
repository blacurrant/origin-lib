import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

const DEFAULT_IMAGE = {"src":"https://images.unsplash.com/photo-1792614268370-d7a7046adbcf?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""}

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    hover: 50,
    grain: 0,
    vignette: 0,
    panelColor: "#E9E5DD",
    backColor: "#ECE8E1",
    rimColor: "#D8D5D0",
    captionColor: "#6B6765",
    margin: 6,
    squareSize: 10,
    colPitch: 16,
    rowPitch: 12,
    gridTop: 23,
    stipple: 2,
    squareTilt: 4,
    seed: 7,
    airDrag: 30,
    friction: 10,
    iterations: 10,
    liftHeight: 14,
    carryHeight: 55,
    twist: 180,
    dragDistance: 15,
    cycleMs: 9000,
    restRotation: -2,
    sheetX: 50,
    sheetY: 52,
    shadowOpacity: 30,
    shadowOffset: 10,
    shadowBlur: 5,
    liftBlur: 26,
    ambient: 55,
    specular: 25,
    sheen: 35,
    sheenWidth: 15,
    sheenX: 56,
    sheenY: 58,
    fov: 30,
    ringOpacity: 80,
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

// ── cloth grid ──
const NX = 22
const NY = 28
const SUB = 2
const RX = (NX - 1) * SUB + 1
const RY = (NY - 1) * SUB + 1
const ASPECT = 0.77
const TEX_W = 1024
const TEX_H = Math.round(TEX_W / ASPECT)
const STEP = 1 / 240
const CYCLE = 9 // nominal seconds of the ghost hand's cycle (clip: 8.92 s)

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const sm = (e0: number, e1: number, x: number) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)
}
function bezier(x1: number, y1: number, x2: number, y2: number) {
    const bx = (u: number) => 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u
    const by = (u: number) => 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u
    return (t: number) => {
        if (t <= 0) return 0
        if (t >= 1) return 1
        let lo = 0
        let hi = 1
        for (let i = 0; i < 24; i++) {
            const m = (lo + hi) / 2
            if (bx(m) < t) lo = m
            else hi = m
        }
        return by((lo + hi) / 2)
    }
}
// Measured bursts (Apple Vision flow on the reference)
const EZ_A = bezier(0.65, 0.3, 0, 0.2)
const EZ_B = bezier(0.25, 0.08, 0, 0.18)
const EZ_C = bezier(0.53, 0.28, 0.7, 0.9)
const EZ_D = bezier(1, 1, 0.53, 0.7)
const EZ_IO = bezier(0.45, 0, 0.25, 1)

function parseColor(s: any, fb: number[]): number[] {
    if (typeof s !== "string") return fb
    const t = s.trim()
    if (t[0] === "#") {
        let h = t.slice(1)
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((c) => c + c)
                .join("")
        const n = parseInt(h.slice(0, 6), 16)
        if (isNaN(n)) return fb
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    }
    const m = t.match(/rgba?\(([^)]+)\)/)
    if (m) {
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat)
        if (p.length >= 3 && p.every((v) => !isNaN(v))) return [p[0] / 255, p[1] / 255, p[2] / 255]
    }
    return fb
}

function hash3(x: number, y: number, s: number) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
}

// ── shaders ──
const VS_SHEET = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aUV;
uniform vec2 uHalf;
uniform float uD;
out vec3 vW;
out vec3 vN;
out vec2 vUV;
void main(){
  float k = uD / max(uD - aPos.z, 0.2 * uD);
  vec2 s = aPos.xy * k;
  gl_Position = vec4(s.x / uHalf.x, -s.y / uHalf.y, clamp(0.5 - aPos.z * 0.4, -0.99, 0.99), 1.0);
  vW = vec3(s, aPos.z);
  vN = aNor;
  vUV = aUV;
}`

const FS_SHEET = `#version 300 es
precision highp float;
in vec3 vW;
in vec3 vN;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec3 uBack;
uniform vec3 uRim;
uniform vec3 uLight;
uniform vec4 uShade;
uniform vec2 uSheenC;
uniform vec2 uRimPx;
uniform float uAlpha;
out vec4 o;
void main(){
  vec3 n = normalize(vN + vec3(0.0, 0.0, 1e-4));
  vec3 base;
  if (gl_FrontFacing) {
    base = texture(uTex, vUV).rgb;
    float e = min(min(vUV.x, 1.0 - vUV.x) * uRimPx.x, min(vUV.y, 1.0 - vUV.y) * uRimPx.y);
    base = mix(uRim, base, smoothstep(0.0, 1.5, e) * 0.6 + 0.4);
  } else {
    n = -n;
    base = uBack;
  }
  float flatL = max(uLight.z, 1e-3);
  float d = dot(n, uLight);
  float shade = uShade.x + (1.0 - uShade.x) * clamp(d / flatL, 0.0, 1.3);
  vec3 h = normalize(uLight + vec3(0.0, 0.0, 1.0));
  float sp = max(pow(max(dot(n, h), 0.0), 12.0) - pow(h.z, 12.0), 0.0) * uShade.y;
  vec3 c = base * shade + vec3(sp);
  vec2 dir = vec2(0.70710678);
  float cc = dot(vW.xy - uSheenC + n.xy * 0.45, dir);
  float w = max(uShade.w, 1e-3);
  float band = exp(-(cc * cc) / (w * w));
  c = mix(c, vec3(1.0), band * uShade.z * clamp(n.z, 0.0, 1.0));
  o = vec4(clamp(c, 0.0, 1.0), uAlpha);
}`

const VS_SHADOW = `#version 300 es
layout(location=0) in vec3 aPos;
uniform vec2 uHalf;
uniform vec4 uOff;
out float vZ;
void main(){
  vec2 p = aPos.xy + uOff.xy + uOff.zw * aPos.z;
  gl_Position = vec4(p.x / uHalf.x, -p.y / uHalf.y, 0.0, 1.0);
  vZ = aPos.z;
}`

const FS_SHADOW = `#version 300 es
precision highp float;
in float vZ;
uniform float uFade;
out vec4 o;
void main(){
  float z = max(vZ, 0.0);
  float contact = 1.0 - smoothstep(0.0, 0.025, z);
  float lifted = (1.0 - contact) * (1.0 - smoothstep(0.0, max(uFade, 1e-3), z)) * 0.8;
  o = vec4(contact, lifted, 0.0, 1.0);
}`

const VS_FULL = `#version 300 es
out vec2 vUV;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FS_BLUR = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uT;
uniform vec2 uStep;
uniform vec2 uR;
out vec4 o;
void main(){
  float r = 0.0;
  float g = 0.0;
  float ws = 0.0;
  for (int i = -6; i <= 6; i++) {
    float f = float(i) / 6.0;
    float w = exp(-f * f * 2.5);
    r += texture(uT, vUV + uStep * f * uR.x).r * w;
    g += texture(uT, vUV + uStep * f * uR.y).g * w;
    ws += w;
  }
  o = vec4(r / ws, g / ws, 0.0, 1.0);
}`

const FS_BG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uS;
uniform vec3 uBg;
uniform float uOp;
out vec4 o;
void main(){
  vec2 s = texture(uS, vUV).rg;
  float a = max(s.r, s.g) * uOp;
  o = vec4(uBg * (1.0 - a), 1.0);
}`

const FS_OVER = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec2 uRes;
uniform float uVig;
uniform float uGrain;
uniform float uTime;
out vec4 o;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  float asp = uRes.x / max(uRes.y, 1.0);
  vec2 q = vUV - 0.5; q.x *= asp;
  float r = length(q) / length(vec2(0.5 * asp, 0.5));
  float v = smoothstep(0.35, 1.0, r) * uVig;
  float n = hash(floor(gl_FragCoord.xy) + floor(uTime * 24.0) * 17.0);
  float ga = uGrain * 0.18;
  float a = ga + v * (1.0 - ga);
  vec3 col = vec3(n) * ga / max(a, 1e-4);
  o = vec4(col, a);
}`

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
    const sh = (type: number, src: string) => {
        const s = gl.createShader(type)
        if (!s) throw new Error("createShader failed")
        gl.shaderSource(s, src)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(s)
            gl.deleteShader(s)
            throw new Error("Shader: " + log)
        }
        return s
    }
    const v = sh(gl.VERTEX_SHADER, vs)
    const f = sh(gl.FRAGMENT_SHADER, fs)
    const p = gl.createProgram()
    if (!p) throw new Error("createProgram failed")
    gl.attachShader(p, v)
    gl.attachShader(p, f)
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("Link: " + gl.getProgramInfoLog(p))
    gl.deleteShader(v)
    gl.deleteShader(f)
    return p
}
function uniformsOf(gl: WebGL2RenderingContext, p: WebGLProgram, names: string[]) {
    const out: Record<string, WebGLUniformLocation> = {}
    for (const n of names) {
        const l = gl.getUniformLocation(p, n)
        if (l === null) throw new Error("Missing uniform " + n)
        out[n] = l
    }
    return out
}

// ── the print (front texture) ──
function drawPrint(cv: HTMLCanvasElement, live: any, a: any, img: HTMLImageElement | null) {
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const W = TEX_W
    const H = TEX_H
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = live.paperColor
    ctx.fillRect(0, 0, W, H)
    const m = (a.margin / 100) * W
    const px0 = m
    const py0 = m
    const pw = W - 2 * m
    const ph = H - m - 0.075 * H
    ctx.fillStyle = a.panelColor
    ctx.fillRect(px0, py0, pw, ph)
    const g = ctx.createRadialGradient(
        px0 + pw / 2,
        py0 + ph * 0.48,
        Math.min(pw, ph) * 0.2,
        px0 + pw / 2,
        py0 + ph * 0.48,
        Math.max(pw, ph) * 0.75
    )
    g.addColorStop(0, "rgba(255,255,255,0.10)")
    g.addColorStop(1, "rgba(120,110,98,0.10)")
    ctx.fillStyle = g
    ctx.fillRect(px0, py0, pw, ph)

    if (img) {
        let iw = img.naturalWidth
        let ih = img.naturalHeight
        if (!iw || !ih) {
            iw = 1
            ih = 1
        }
        const sc = Math.max((pw * 0.84) / iw, (ph * 0.84) / ih)
        const dw = iw * sc
        const dh = ih * sc
        try {
            ctx.save()
            ctx.beginPath()
            ctx.rect(px0 + pw * 0.08, py0 + ph * 0.08, pw * 0.84, ph * 0.84)
            ctx.clip()
            ctx.drawImage(img, px0 + (pw - dw) / 2, py0 + (ph - dh) / 2, dw, dh)
            ctx.restore()
        } catch (e) {
            /* fall back to the paper */
        }
    } else {
        const ink = parseColor(live.inkColor, [0.06, 0.055, 0.047]).map((v) => Math.round(v * 255))
        const id = ctx.getImageData(0, 0, W, H)
        const d = id.data
        const half = ((a.squareSize / 100) * W) / 2
        const cell = Math.max(1, Math.round(a.stipple))
        const seed = Math.round(a.seed)
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 4; c++) {
                const idx = r * 4 + c
                const cx = (0.5 + (c - 1.5) * (a.colPitch / 100)) * W
                const cy = (a.gridTop / 100 + r * (a.rowPitch / 100)) * H
                const tilt = (hash3(idx, seed, 1) - 0.5) * 2 * ((a.squareTilt * Math.PI) / 180)
                const ang = hash3(idx, seed, 2) * Math.PI * 2
                const dxs = Math.cos(ang)
                const dys = Math.sin(ang)
                const norm = half * (Math.abs(dxs) + Math.abs(dys))
                const ct = Math.cos(tilt)
                const st = Math.sin(tilt)
                const ext = Math.ceil(half * 1.5)
                const x0 = Math.max(0, Math.floor(cx - ext))
                const x1 = Math.min(W - 1, Math.ceil(cx + ext))
                const y0 = Math.max(0, Math.floor(cy - ext))
                const y1 = Math.min(H - 1, Math.ceil(cy + ext))
                for (let y = y0; y <= y1; y++) {
                    for (let x = x0; x <= x1; x++) {
                        const rx = x + 0.5 - cx
                        const ry = y + 0.5 - cy
                        const lx = rx * ct + ry * st
                        const ly = -rx * st + ry * ct
                        if (Math.abs(lx) > half || Math.abs(ly) > half) continue
                        const t = ((lx * dxs + ly * dys) / norm + 1) / 2
                        const dens = Math.pow(1 - sm(0.02, 1.0, t), 1.25)
                        const hv = hash3(Math.floor(x / cell), Math.floor(y / cell), seed + idx * 31)
                        if (hv < dens) {
                            const o = (y * W + x) * 4
                            d[o] = ink[0]
                            d[o + 1] = ink[1]
                            d[o + 2] = ink[2]
                            d[o + 3] = 255
                        }
                    }
                }
            }
        }
        ctx.putImageData(id, 0, 0)
    }
    ctx.fillStyle = a.captionColor
    ctx.font = `${Math.round(0.0208 * H)}px "IBM Plex Mono", ui-monospace, Menlo, monospace`
    ctx.textBaseline = "alphabetic"
    ctx.fillText(String(live.caption ?? ""), 0.054 * W, H - 0.05 * H)
}

/**
 * Draggable Cloth Print — a paper print simulated as Verlet cloth, picked up,
 * folded, carried, twisted and dropped by a ghost hand; grab it yourself.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function DraggableClothPrint(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        paperColor = "#F4F2EE",
        inkColor = "#0F0E0C",
        caption = "Turn",
        size = 600,
        speed = 23,
        stiffness = 40,
        weight = 50,
        image = DEFAULT_IMAGE,
        style,
    } = props
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ringRef = useRef<HTMLDivElement>(null)
    const liveRef = useRef<any>(null)
    liveRef.current = {
        background,
        paperColor,
        inkColor,
        caption,
        size,
        speed,
        stiffness,
        weight,
        imageSrc: typeof image === "string" ? image : image?.src || "",
        advanced: props.advanced,
    }

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        const ring = ringRef.current
        if (!root || !canvas || !ring) return
        const gl = canvas.getContext("webgl2", {
            antialias: true,
            alpha: false,
            depth: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
        }) as WebGL2RenderingContext | null
        if (!gl) return

        const rt = RenderTarget.current()
        const isStatic = rt === RenderTarget.thumbnail || rt === RenderTarget.export
        const reduced =
            isStatic ||
            (typeof window !== "undefined" &&
                !!window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches)

        let P: any
        try {
            const sheetP = createProgram(gl, VS_SHEET, FS_SHEET)
            const shadowP = createProgram(gl, VS_SHADOW, FS_SHADOW)
            const blurP = createProgram(gl, VS_FULL, FS_BLUR)
            const bgP = createProgram(gl, VS_FULL, FS_BG)
            const overP = createProgram(gl, VS_FULL, FS_OVER)
            P = {
                sheet: {
                    p: sheetP,
                    u: uniformsOf(gl, sheetP, [
                        "uHalf",
                        "uD",
                        "uTex",
                        "uBack",
                        "uRim",
                        "uLight",
                        "uShade",
                        "uSheenC",
                        "uRimPx",
                        "uAlpha",
                    ]),
                },
                shadow: { p: shadowP, u: uniformsOf(gl, shadowP, ["uHalf", "uOff", "uFade"]) },
                blur: { p: blurP, u: uniformsOf(gl, blurP, ["uT", "uStep", "uR"]) },
                bg: { p: bgP, u: uniformsOf(gl, bgP, ["uS", "uBg", "uOp"]) },
                over: { p: overP, u: uniformsOf(gl, overP, ["uRes", "uVig", "uGrain", "uTime"]) },
            }
        } catch (err) {
            console.error(err)
            return
        }

        // ── cloth state ──
        const N = NX * NY
        const pos = new Float32Array(N * 3)
        const prev = new Float32Array(N * 3)
        const inv = new Float32Array(N).fill(1)
        const gi = new Int16Array(N)
        const gj = new Int16Array(N)
        for (let j = 0; j < NY; j++)
            for (let i = 0; i < NX; i++) {
                gi[j * NX + i] = i
                gj[j * NX + i] = j
            }
        const DXS = ASPECT / (NX - 1)
        const DYS = 1 / (NY - 1)
        const ca: number[] = []
        const cb: number[] = []
        const crl: number[] = []
        const ckd: number[] = []
        const id = (i: number, j: number) => j * NX + i
        const addC = (a: number, b: number, kind: number) => {
            ca.push(a)
            cb.push(b)
            crl.push(Math.hypot((gi[b] - gi[a]) * DXS, (gj[b] - gj[a]) * DYS))
            ckd.push(kind)
        }
        for (let j = 0; j < NY; j++)
            for (let i = 0; i < NX; i++) {
                if (i + 1 < NX) addC(id(i, j), id(i + 1, j), 0)
                if (j + 1 < NY) addC(id(i, j), id(i, j + 1), 0)
                if (i + 1 < NX && j + 1 < NY) {
                    addC(id(i, j), id(i + 1, j + 1), 1)
                    addC(id(i + 1, j), id(i, j + 1), 1)
                }
                if (i + 2 < NX) addC(id(i, j), id(i + 2, j), 2)
                if (j + 2 < NY) addC(id(i, j), id(i, j + 2), 2)
            }
        const CA = Int32Array.from(ca)
        const CB = Int32Array.from(cb)
        const CR = Float32Array.from(crl)
        const CK = Uint8Array.from(ckd)
        const NC = CA.length

        // self-collision hash
        const HS = 4096
        const hStart = new Int32Array(HS + 1)
        const hFill = new Int32Array(HS)
        const hItems = new Int32Array(N)
        const hKey = new Int32Array(N)
        const hk = (x: number, y: number, z: number) =>
            ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 0) & (HS - 1)
        const COL_R = 0.95 * Math.min(DXS, DYS)

        // ── render mesh (Catmull-Rom refined) ──
        const cr4 = (t: number) => {
            const t2 = t * t
            const t3 = t2 * t
            return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2]
        }
        const colI = new Int32Array(RX * 4)
        const colW = new Float32Array(RX * 4)
        for (let c = 0; c < RX; c++) {
            const u = c / SUB
            const i = Math.min(Math.floor(u), NX - 2)
            const w = cr4(u - i)
            for (let a = 0; a < 4; a++) {
                colI[c * 4 + a] = clamp(i - 1 + a, 0, NX - 1)
                colW[c * 4 + a] = w[a]
            }
        }
        const rowI = new Int32Array(RY * 4)
        const rowW = new Float32Array(RY * 4)
        for (let r = 0; r < RY; r++) {
            const u = r / SUB
            const j = Math.min(Math.floor(u), NY - 2)
            const w = cr4(u - j)
            for (let a = 0; a < 4; a++) {
                rowI[r * 4 + a] = clamp(j - 1 + a, 0, NY - 1)
                rowW[r * 4 + a] = w[a]
            }
        }
        const RN = RX * RY
        const rpos = new Float32Array(RN * 3)
        const rnor = new Float32Array(RN * 3)
        const ruv = new Float32Array(RN * 2)
        for (let j = 0; j < RY; j++)
            for (let i = 0; i < RX; i++) {
                ruv[(j * RX + i) * 2] = i / (RX - 1)
                ruv[(j * RX + i) * 2 + 1] = j / (RY - 1)
            }
        const indices = new Uint16Array((RX - 1) * (RY - 1) * 6)
        {
            let q = 0
            for (let j = 0; j < RY - 1; j++)
                for (let i = 0; i < RX - 1; i++) {
                    const a = j * RX + i
                    const b = a + 1
                    const c = a + RX
                    const d = c + 1
                    indices[q++] = a
                    indices[q++] = b
                    indices[q++] = c
                    indices[q++] = b
                    indices[q++] = d
                    indices[q++] = c
                }
        }

        const meshVao = gl.createVertexArray()
        gl.bindVertexArray(meshVao)
        const posBuf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
        gl.bufferData(gl.ARRAY_BUFFER, rpos.byteLength, gl.DYNAMIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
        const norBuf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, norBuf)
        gl.bufferData(gl.ARRAY_BUFFER, rnor.byteLength, gl.DYNAMIC_DRAW)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
        const uvBuf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf)
        gl.bufferData(gl.ARRAY_BUFFER, ruv, gl.STATIC_DRAW)
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0)
        const idxBuf = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
        gl.bindVertexArray(null)
        const fullVao = gl.createVertexArray()

        // print texture
        const printCanvas = document.createElement("canvas")
        printCanvas.width = TEX_W
        printCanvas.height = TEX_H
        const printTex = gl.createTexture()
        const aniso = gl.getExtension("EXT_texture_filter_anisotropic")
        let texKey = ""
        const imgCache = new Map<string, { img: HTMLImageElement; ok: boolean }>()
        const getImage = (src: string) => {
            if (!src) return null
            let e = imgCache.get(src)
            if (!e) {
                const img = new Image()
                img.crossOrigin = "anonymous"
                const entry = { img, ok: false }
                img.onload = () => {
                    entry.ok = true
                }
                img.src = src
                imgCache.set(src, entry)
                e = entry
            }
            return e.ok ? e.img : null
        }
        const syncTexture = (live: any, a: any) => {
            const img = getImage(live.imageSrc)
            const key = [
                live.paperColor,
                live.inkColor,
                live.caption,
                a.panelColor,
                a.captionColor,
                a.margin,
                a.squareSize,
                a.colPitch,
                a.rowPitch,
                a.gridTop,
                a.stipple,
                a.squareTilt,
                a.seed,
                live.imageSrc,
                img ? 1 : 0,
            ].join("|")
            if (key === texKey) return
            texKey = key
            drawPrint(printCanvas, live, a, img)
            gl.bindTexture(gl.TEXTURE_2D, printTex)
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
            try {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, printCanvas)
            } catch (e) {
                return
            }
            gl.generateMipmap(gl.TEXTURE_2D)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            if (aniso)
                gl.texParameterf(
                    gl.TEXTURE_2D,
                    aniso.TEXTURE_MAX_ANISOTROPY_EXT,
                    Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))
                )
        }

        // shadow targets
        type Target = { tex: WebGLTexture | null; fb: WebGLFramebuffer | null; w: number; h: number }
        const makeTarget = (w: number, h: number): Target => {
            const tex = gl.createTexture()
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            const fb = gl.createFramebuffer()
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
            gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            return { tex, fb, w, h }
        }
        const dropTarget = (t: Target | null) => {
            if (!t) return
            gl.deleteTexture(t.tex)
            gl.deleteFramebuffer(t.fb)
        }
        let tA: Target | null = null
        let tB: Target | null = null

        // ── view ──
        let W = 0
        let H = 0
        let dpr = 1
        let S = 600
        let Wn = 2
        let Hn = 1.333
        let Dcam = 2.5
        const readAdv = () => ({ ...ADVANCED_DEFAULTS, ...(liveRef.current?.advanced ?? {}) })
        const computeView = (a: any) => {
            const live = liveRef.current
            S = Math.max(60, Math.min(live.size ?? 600, H * 0.95, (W * 0.95) / ASPECT))
            Wn = W / S
            Hn = H / S
            const fov = (clamp(a.fov, 5, 90) * Math.PI) / 180
            Dcam = Hn / 2 / Math.tan(fov / 2)
        }
        const project = (x: number, y: number, z: number) => {
            const k = Dcam / Math.max(Dcam - z, 0.2 * Dcam)
            return [W / 2 + x * k * S, H / 2 + y * k * S, k]
        }
        const unproject = (sx: number, sy: number, z: number) => {
            const f = Math.max(Dcam - z, 0.2 * Dcam) / Dcam
            return [((sx - W / 2) / S) * f, ((sy - H / 2) / S) * f]
        }

        const layFlat = (cx: number, cy: number, rot: number, z: number) => {
            const c = Math.cos(rot)
            const s = Math.sin(rot)
            for (let j = 0; j < NY; j++)
                for (let i = 0; i < NX; i++) {
                    const lx = (i / (NX - 1) - 0.5) * ASPECT
                    const ly = j / (NY - 1) - 0.5
                    const k = (j * NX + i) * 3
                    pos[k] = prev[k] = cx + lx * c - ly * s
                    pos[k + 1] = prev[k + 1] = cy + lx * s + ly * c
                    pos[k + 2] = prev[k + 2] = z
                }
        }
        const layHome = (a: any, z: number) =>
            layFlat(
                (a.sheetX / 100 - 0.5) * Wn,
                (a.sheetY / 100 - 0.5) * Hn,
                (a.restRotation * Math.PI) / 180,
                z
            )

        // ── hand ──
        const hand = {
            idx: -1,
            owner: "",
            x: 0,
            y: 0,
            z: 0,
            px: 0,
            py: 0,
            pz: 0,
            yaw: 0,
            pyaw: 0,
            yawBase: 0,
            patch: null as null | { idx: number[]; off: number[] },
        }
        const releasePatch = () => {
            if (hand.patch) for (const k of hand.patch.idx) if (k !== hand.idx) inv[k] = 1
            hand.patch = null
        }
        const release = () => {
            releasePatch()
            if (hand.idx >= 0) inv[hand.idx] = 1
            hand.idx = -1
            hand.owner = ""
        }
        const grab = (i: number, owner: string) => {
            release()
            hand.idx = i
            hand.owner = owner
            hand.x = hand.px = pos[i * 3]
            hand.y = hand.py = pos[i * 3 + 1]
            hand.z = hand.pz = pos[i * 3 + 2]
            hand.yaw = hand.pyaw = hand.yawBase = 0
            inv[i] = 0
        }
        const capturePatch = () => {
            const c = hand.idx
            if (c < 0) return
            const list: number[] = []
            const off: number[] = []
            for (let dj = -1; dj <= 1; dj++)
                for (let di = -1; di <= 1; di++) {
                    if (!di && !dj) continue
                    const ii = gi[c] + di
                    const jj = gj[c] + dj
                    if (ii < 0 || jj < 0 || ii >= NX || jj >= NY) continue
                    const k = jj * NX + ii
                    list.push(k)
                    off.push(
                        pos[k * 3] - pos[c * 3],
                        pos[k * 3 + 1] - pos[c * 3 + 1],
                        pos[k * 3 + 2] - pos[c * 3 + 2]
                    )
                    inv[k] = 0
                }
            hand.patch = { idx: list, off }
            hand.yawBase = hand.yaw
        }
        const pin = (i: number, x: number, y: number, z: number) => {
            const k = i * 3
            prev[k] = pos[k]
            prev[k + 1] = pos[k + 1]
            prev[k + 2] = pos[k + 2]
            pos[k] = x
            pos[k + 1] = y
            pos[k + 2] = Math.max(0, z)
        }

        const argmax = (score: (x: number, y: number) => number) => {
            let best = 0
            let bv = -1e9
            for (let i = 0; i < N; i++) {
                const v = score(pos[i * 3], pos[i * 3 + 1])
                if (v > bv) {
                    bv = v
                    best = i
                }
            }
            return best
        }
        const inset = (i: number) => {
            let ii = gi[i]
            let jj = gj[i]
            if (ii === 0) ii = 1
            else if (ii === NX - 1) ii = NX - 2
            if (jj === 0) jj = 1
            else if (jj === NY - 1) jj = NY - 2
            return jj * NX + ii
        }
        const centroid = () => {
            let x = 0
            let y = 0
            for (let i = 0; i < N; i++) {
                x += pos[i * 3]
                y += pos[i * 3 + 1]
            }
            return [x / N, y / N]
        }
        const needsRelay = () => {
            const [cx, cy] = centroid()
            let area = 0
            for (let j = 0; j < NY - 1; j++)
                for (let i = 0; i < NX - 1; i++) {
                    const a = (j * NX + i) * 3
                    const b = a + 3
                    const c = a + NX * 3
                    const ux = pos[b] - pos[a]
                    const uy = pos[b + 1] - pos[a + 1]
                    const vx = pos[c] - pos[a]
                    const vy = pos[c + 1] - pos[a + 1]
                    area += ux * vy - uy * vx
                }
            const ratio = area / ASPECT
            return ratio < 0.6 || Math.abs(cx) > 0.45 * Wn || Math.abs(cy) > 0.45 * Hn
        }

        // pick the top-most particle under a screen point
        const pick = (sx: number, sy: number) => {
            let best = -1
            let bz = -1e9
            let bd = 1e9
            const thr = Math.max(12, DXS * S * 1.15)
            for (let i = 0; i < N; i++) {
                const z = pos[i * 3 + 2]
                const [px, py, k] = project(pos[i * 3], pos[i * 3 + 1], z)
                const d = Math.hypot(px - sx, py - sy)
                if (d < thr * k) {
                    if (z > bz + 0.01 || (Math.abs(z - bz) <= 0.01 && d < bd)) {
                        best = i
                        bz = z
                        bd = d
                    }
                }
            }
            return best
        }

        // ── physics ──
        const env = {
            grav: 16,
            damp: 0.994,
            iters: 10,
            kSh: 0.2,
            kB: 0.05,
            fr: 0.1,
            hoverH: 0,
            hx: 0,
            hy: 0,
        }
        const selfCollide = () => {
            const invR = 1 / COL_R
            hStart.fill(0)
            for (let i = 0; i < N; i++) {
                const k = i * 3
                const key = hk(
                    Math.floor(pos[k] * invR),
                    Math.floor(pos[k + 1] * invR),
                    Math.floor(pos[k + 2] * invR)
                )
                hKey[i] = key
                hStart[key + 1]++
            }
            for (let k = 1; k <= HS; k++) hStart[k] += hStart[k - 1]
            hFill.set(hStart.subarray(0, HS))
            for (let i = 0; i < N; i++) hItems[hFill[hKey[i]]++] = i
            const r2 = COL_R * COL_R
            for (let i = 0; i < N; i++) {
                const k = i * 3
                const cx = Math.floor(pos[k] * invR)
                const cy = Math.floor(pos[k + 1] * invR)
                const cz = Math.floor(pos[k + 2] * invR)
                for (let dz = -1; dz <= 1; dz++)
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++) {
                            const key = hk(cx + dx, cy + dy, cz + dz)
                            for (let s = hStart[key]; s < hStart[key + 1]; s++) {
                                const j = hItems[s]
                                if (j <= i) continue
                                if (Math.abs(gi[i] - gi[j]) <= 1 && Math.abs(gj[i] - gj[j]) <= 1) continue
                                const q = j * 3
                                const ex = pos[q] - pos[k]
                                const ey = pos[q + 1] - pos[k + 1]
                                const ez = pos[q + 2] - pos[k + 2]
                                const d2 = ex * ex + ey * ey + ez * ez
                                if (d2 >= r2 || d2 < 1e-12) continue
                                const wi = inv[i]
                                const wj = inv[j]
                                const w = wi + wj
                                if (w === 0) continue
                                const d = Math.sqrt(d2)
                                const c = (COL_R - d) / d / w
                                pos[k] -= ex * c * wi
                                pos[k + 1] -= ey * c * wi
                                pos[k + 2] -= ez * c * wi
                                pos[q] += ex * c * wj
                                pos[q + 1] += ey * c * wj
                                pos[q + 2] += ez * c * wj
                            }
                        }
            }
        }
        const physStep = (h: number, f: number) => {
            if (hand.idx >= 0) {
                const hx = lerp(hand.px, hand.x, f)
                const hy = lerp(hand.py, hand.y, f)
                const hz = Math.max(0, lerp(hand.pz, hand.z, f))
                pin(hand.idx, hx, hy, hz)
                if (hand.patch) {
                    const yw = lerp(hand.pyaw, hand.yaw, f) - hand.yawBase
                    const c = Math.cos(yw)
                    const s = Math.sin(yw)
                    const pi = hand.patch.idx
                    const off = hand.patch.off
                    for (let q = 0; q < pi.length; q++) {
                        const ox = off[q * 3]
                        const oy = off[q * 3 + 1]
                        const oz = off[q * 3 + 2]
                        pin(pi[q], hx + ox * c - oy * s, hy + ox * s + oy * c, hz + oz)
                    }
                }
            }
            const g = env.grav * h * h
            const damp = env.damp
            for (let i = 0; i < N; i++) {
                if (inv[i] === 0) continue
                const k = i * 3
                const vx = (pos[k] - prev[k]) * damp
                const vy = (pos[k + 1] - prev[k + 1]) * damp
                const vz = (pos[k + 2] - prev[k + 2]) * damp
                prev[k] = pos[k]
                prev[k + 1] = pos[k + 1]
                prev[k + 2] = pos[k + 2]
                pos[k] += vx
                pos[k + 1] += vy
                pos[k + 2] += vz - g
            }
            if (env.hoverH > 1e-4) {
                const r = 0.16
                const r2 = r * r
                for (let i = 0; i < N; i++) {
                    if (inv[i] === 0) continue
                    const k = i * 3
                    const dx = pos[k] - env.hx
                    const dy = pos[k + 1] - env.hy
                    const d2 = dx * dx + dy * dy
                    if (d2 > 4 * r2) continue
                    const t = env.hoverH * Math.exp(-d2 / r2)
                    if (pos[k + 2] < t) pos[k + 2] += (t - pos[k + 2]) * 0.08
                }
            }
            const iters = env.iters
            const kSh = env.kSh
            const kB = env.kB
            for (let it = 0; it < iters; it++) {
                const rev = (it & 1) === 1
                for (let q = 0; q < NC; q++) {
                    const c = rev ? NC - 1 - q : q
                    const a = CA[c]
                    const b = CB[c]
                    const wa = inv[a]
                    const wb = inv[b]
                    const w = wa + wb
                    if (w === 0) continue
                    const ka = a * 3
                    const kb = b * 3
                    const dx = pos[kb] - pos[ka]
                    const dy = pos[kb + 1] - pos[ka + 1]
                    const dz = pos[kb + 2] - pos[ka + 2]
                    const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
                    if (d < 1e-9) continue
                    const kind = CK[c]
                    const st = kind === 0 ? 1 : kind === 1 ? kSh : kB
                    const s = (((d - CR[c]) / d) * st) / w
                    pos[ka] += dx * s * wa
                    pos[ka + 1] += dy * s * wa
                    pos[ka + 2] += dz * s * wa
                    pos[kb] -= dx * s * wb
                    pos[kb + 1] -= dy * s * wb
                    pos[kb + 2] -= dz * s * wb
                }
                // Resolve layer contact inside the solve, so stretch and contact settle together instead
                // of contact being applied once at the end and leaving layers pressed through each other.
                if (it % 3 === 2 || it === iters - 1) selfCollide()
            }
            const keep = 1 - env.fr
            for (let i = 0; i < N; i++) {
                const k = i * 3
                if (pos[k + 2] < 0) {
                    pos[k + 2] = 0
                    prev[k + 2] = 0
                }
                if (inv[i] !== 0 && pos[k + 2] < 0.0015) {
                    prev[k] = pos[k] - (pos[k] - prev[k]) * keep
                    prev[k + 1] = pos[k + 1] - (pos[k + 1] - prev[k + 1]) * keep
                }
            }
        }
        const syncEnv = (a: any) => {
            const live = liveRef.current
            const it = clamp(Math.round(a.iterations), 2, 30)
            env.iters = it
            env.grav = 16 * (0.25 + 0.75 * (clamp(live.weight ?? 50, 0, 100) / 50))
            env.damp = 1 - (clamp(a.airDrag, 0, 100) / 100) * 0.02
            env.fr = clamp(a.friction, 0, 100) / 100
            const bend = 0.05 + (clamp(live.stiffness ?? 40, 0, 100) / 100) * 0.85
            env.kSh = 1 - Math.pow(1 - 0.9, 1 / it)
            env.kB = 1 - Math.pow(1 - Math.min(bend, 0.99), 1 / it)
        }

        // ── ghost hand: the measured beats ──
        const ghost = {
            gt: 0,
            beat: -1,
            wait: 0,
            A0: [0, 0, 0],
            A1: [0, 0],
            B0: [0, 0, 0],
            B1: [0, 0],
            C1: [0, 0],
            D1: [0, 0],
            F1: [0, 0],
        }
        let relay = -1
        let relaid = false
        let sheetAlpha = 1
        const setHand = (x: number, y: number, z: number, yaw: number) => {
            hand.x = x
            hand.y = y
            hand.z = Math.max(0, z)
            hand.yaw = yaw
        }
        const updateGhost = (dtS: number, a: any) => {
            let gt = ghost.gt + dtS
            if (gt >= CYCLE) {
                gt = 0
                ghost.beat = -1
                if (hand.owner === "ghost") release()
                if (needsRelay()) {
                    relay = 0
                    relaid = false
                    ghost.gt = 0
                    return
                }
            }
            ghost.gt = gt
            const sx = (fx: number) => (fx - 0.5) * Wn
            const sy = (fy: number) => (fy - 0.5) * Hn
            if (gt < 2.0) {
                if (ghost.beat !== 0) {
                    ghost.beat = 0
                    const i = inset(argmax((x, y) => x + 1.2 * y))
                    grab(i, "ghost")
                    ghost.A0 = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
                    ghost.A1 = [
                        Math.min(ghost.A0[0] + (a.dragDistance / 100) * Wn, 0.42 * Wn),
                        Math.min(ghost.A0[1] + 0.02 * Hn, 0.44 * Hn),
                    ]
                }
                const e = EZ_A(gt / 2.0)
                const [x0, y0, z0] = ghost.A0
                setHand(
                    lerp(x0, ghost.A1[0], e),
                    lerp(y0, ghost.A1[1], e),
                    z0 + 0.07 * sm(0, 0.35, gt) * (1 - sm(1.55, 2.0, gt)),
                    0
                )
            } else if (gt < 2.4) {
                if (ghost.beat !== 1) {
                    ghost.beat = 1
                    release()
                }
            } else if (gt < 7.9) {
                if (ghost.beat !== 2) {
                    ghost.beat = 2
                    const [cx0, cy0] = centroid()
                    const i = argmax((x, y) => x - 0.25 * Math.abs(y - cy0))
                    grab(i, "ghost")
                    ghost.B0 = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
                    ghost.B1 = [ghost.B0[0] - 0.03, ghost.B0[1] - 0.028]
                    ghost.C1 = [Math.max(ghost.B1[0] - 0.78, -0.46 * Wn), ghost.B1[1] - 0.08]
                    ghost.D1 = [sx(0.28), sy(0.4)]
                    ghost.F1 = [sx(0.74), sy(0.6)]
                    void cx0
                }
                if (hand.owner !== "ghost") return
                const carry = a.carryHeight / 100
                const [B0x, B0y, B0z] = ghost.B0
                const [B1x, B1y] = ghost.B1
                const [C1x, C1y] = ghost.C1
                const drift = sm(5.6, 7.0, gt)
                const Dx = ghost.D1[0] + 0.05 * drift
                const Dy = ghost.D1[1] + 0.05 * drift
                let x = 0
                let y = 0
                let z = 0
                if (gt < 2.8) {
                    const u = (gt - 2.4) / 0.4
                    const e = EZ_B(u)
                    x = lerp(B0x, B1x, e)
                    y = lerp(B0y, B1y, e)
                    z = B0z + 0.12 * (1 - (1 - u) * (1 - u))
                } else if (gt < 3.27) {
                    x = B1x
                    y = B1y
                    z = B0z + 0.12 + 0.04 * sm(2.8, 3.27, gt)
                } else if (gt < 3.73) {
                    const u = (gt - 3.27) / 0.46
                    const e = EZ_C(u)
                    x = lerp(B1x, C1x, e)
                    y = lerp(B1y, C1y, e)
                    z = B0z + 0.16 + 0.14 * u
                } else if (gt < 3.93) {
                    x = C1x
                    y = C1y
                    z = B0z + 0.3
                } else if (gt < 7.0) {
                    const u = clamp((gt - 3.93) / 2, 0, 1)
                    const e = EZ_D(u)
                    x = lerp(C1x, Dx, e)
                    y = lerp(C1y, Dy, e)
                    z = lerp(B0z + 0.3, carry, sm(0, 1, u))
                } else if (gt < 7.7) {
                    const u = (gt - 7.0) / 0.7
                    const e = EZ_IO(u)
                    x = lerp(Dx, ghost.F1[0], e)
                    y = lerp(Dy, ghost.F1[1], e)
                    z = lerp(carry, 0.04, sm(0.3, 1, u))
                } else {
                    const u = (gt - 7.7) / 0.2
                    x = ghost.F1[0]
                    y = ghost.F1[1]
                    z = 0.04 * (1 - u)
                }
                const tw = (a.twist * Math.PI) / 180
                const yaw = tw * (sm(5.6, 6.4, gt) - sm(6.5, 7.2, gt))
                setHand(x, y, z, yaw)
                if (gt > 5.55 && gt < 7.25 && !hand.patch) capturePatch()
                if ((gt >= 7.25 || gt <= 5.55) && hand.patch) releasePatch()
            } else if (ghost.beat !== 3) {
                ghost.beat = 3
                release()
            }
        }

        // ── pointer ──
        const ptr = { x: 0, y: 0, in: false }
        const user = { active: false }
        let over = 0
        let overT = 0
        const onDown = (e: PointerEvent) => {
            const sx = e.offsetX
            const sy = e.offsetY
            ptr.x = sx
            ptr.y = sy
            ptr.in = true
            const i = pick(sx, sy)
            if (i < 0) return
            try {
                canvas.setPointerCapture(e.pointerId)
            } catch (err) {
                /* ignore */
            }
            user.active = true
            grab(i, "user")
            relay = -1
            sheetAlpha = 1
            e.preventDefault()
        }
        const onMove = (e: PointerEvent) => {
            ptr.x = e.offsetX
            ptr.y = e.offsetY
            ptr.in = true
        }
        const onLeave = () => {
            if (!user.active) ptr.in = false
        }
        const onUp = () => {
            if (!user.active) return
            user.active = false
            if (hand.owner === "user") release()
            if (reduced) prev.set(pos)
            ghost.wait = 3
            ghost.beat = -1
        }
        canvas.addEventListener("pointerdown", onDown)
        canvas.addEventListener("pointermove", onMove)
        canvas.addEventListener("pointerleave", onLeave)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        // ── layout & resize ──
        let laid = false
        const light = (() => {
            const l = [-0.4, -0.5, 0.75]
            const n = Math.hypot(l[0], l[1], l[2])
            return [l[0] / n, l[1] / n, l[2] / n]
        })()

        const buildRender = () => {
            for (let rj = 0; rj < RY; rj++) {
                for (let ri = 0; ri < RX; ri++) {
                    let x = 0
                    let y = 0
                    let z = 0
                    for (let b = 0; b < 4; b++) {
                        const wy = rowW[rj * 4 + b]
                        if (wy === 0) continue
                        const rowBase = rowI[rj * 4 + b] * NX
                        for (let a = 0; a < 4; a++) {
                            const w = wy * colW[ri * 4 + a]
                            if (w === 0) continue
                            const k = (rowBase + colI[ri * 4 + a]) * 3
                            x += pos[k] * w
                            y += pos[k + 1] * w
                            z += pos[k + 2] * w
                        }
                    }
                    const o = (rj * RX + ri) * 3
                    rpos[o] = x
                    rpos[o + 1] = y
                    rpos[o + 2] = Math.max(z, 0)
                }
            }
            for (let rj = 0; rj < RY; rj++) {
                const u = rj > 0 ? rj - 1 : rj
                const d = rj < RY - 1 ? rj + 1 : rj
                for (let ri = 0; ri < RX; ri++) {
                    const l = ri > 0 ? ri - 1 : ri
                    const r = ri < RX - 1 ? ri + 1 : ri
                    const kl = (rj * RX + l) * 3
                    const kr = (rj * RX + r) * 3
                    const ku = (u * RX + ri) * 3
                    const kd = (d * RX + ri) * 3
                    const ax = rpos[kr] - rpos[kl]
                    const ay = rpos[kr + 1] - rpos[kl + 1]
                    const az = rpos[kr + 2] - rpos[kl + 2]
                    const bx = rpos[kd] - rpos[ku]
                    const by = rpos[kd + 1] - rpos[ku + 1]
                    const bz = rpos[kd + 2] - rpos[ku + 2]
                    let nx = ay * bz - az * by
                    let ny = az * bx - ax * bz
                    let nz = ax * by - ay * bx
                    const n = Math.hypot(nx, ny, nz) || 1
                    nx /= n
                    ny /= n
                    nz /= n
                    const o = (rj * RX + ri) * 3
                    rnor[o] = nx
                    rnor[o + 1] = ny
                    rnor[o + 2] = nz
                }
            }
        }

        const render = (time: number) => {
            if (!tA || !tB || W === 0) return
            const live = liveRef.current
            const a = readAdv()
            syncTexture(live, a)
            buildRender()
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, rpos)
            gl.bindBuffer(gl.ARRAY_BUFFER, norBuf)
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, rnor)
            const halfX = Wn / 2
            const halfY = Hn / 2
            const idxCount = indices.length

            // shadow
            gl.bindFramebuffer(gl.FRAMEBUFFER, tA.fb)
            gl.viewport(0, 0, tA.w, tA.h)
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT)
            gl.disable(gl.DEPTH_TEST)
            gl.disable(gl.CULL_FACE)
            gl.enable(gl.BLEND)
            gl.blendEquation(gl.MAX)
            gl.blendFunc(gl.ONE, gl.ONE)
            gl.useProgram(P.shadow.p)
            gl.uniform2f(P.shadow.u.uHalf, halfX, halfY)
            gl.uniform4f(
                P.shadow.u.uOff,
                (a.shadowOffset * 0.6) / S,
                a.shadowOffset / S,
                0.3,
                0.42
            )
            gl.uniform1f(P.shadow.u.uFade, 1.0)
            gl.bindVertexArray(meshVao)
            gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0)
            gl.blendEquation(gl.FUNC_ADD)
            gl.disable(gl.BLEND)

            // blur
            gl.bindVertexArray(fullVao)
            gl.useProgram(P.blur.p)
            gl.activeTexture(gl.TEXTURE0)
            gl.uniform1i(P.blur.u.uT, 0)
            const r1 = Math.max(0.5, (a.shadowBlur * dpr) / 2)
            const r2 = Math.max(0.5, (a.liftBlur * dpr) / 2)
            gl.uniform2f(P.blur.u.uR, r1, r2)
            gl.bindFramebuffer(gl.FRAMEBUFFER, tB.fb)
            gl.viewport(0, 0, tB.w, tB.h)
            gl.bindTexture(gl.TEXTURE_2D, tA.tex)
            gl.uniform2f(P.blur.u.uStep, 1 / tA.w, 0)
            gl.drawArrays(gl.TRIANGLES, 0, 3)
            gl.bindFramebuffer(gl.FRAMEBUFFER, tA.fb)
            gl.viewport(0, 0, tA.w, tA.h)
            gl.bindTexture(gl.TEXTURE_2D, tB.tex)
            gl.uniform2f(P.blur.u.uStep, 0, 1 / tA.h)
            gl.drawArrays(gl.TRIANGLES, 0, 3)

            // table + shadow
            gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.clearDepth(1)
            gl.clear(gl.DEPTH_BUFFER_BIT)
            gl.useProgram(P.bg.p)
            gl.bindTexture(gl.TEXTURE_2D, tA.tex)
            gl.uniform1i(P.bg.u.uS, 0)
            const bg = parseColor(live.background, [0, 0, 0])
            gl.uniform3f(P.bg.u.uBg, bg[0], bg[1], bg[2])
            gl.uniform1f(P.bg.u.uOp, (clamp(a.shadowOpacity, 0, 100) / 100) * sheetAlpha)
            gl.drawArrays(gl.TRIANGLES, 0, 3)

            // sheet
            gl.enable(gl.DEPTH_TEST)
            gl.depthFunc(gl.LESS)
            gl.frontFace(gl.CW)
            if (sheetAlpha < 1) {
                gl.enable(gl.BLEND)
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
            }
            gl.useProgram(P.sheet.p)
            const su = P.sheet.u
            gl.uniform2f(su.uHalf, halfX, halfY)
            gl.uniform1f(su.uD, Dcam)
            gl.bindTexture(gl.TEXTURE_2D, printTex)
            gl.uniform1i(su.uTex, 0)
            const back = parseColor(a.backColor, [0.925, 0.91, 0.88])
            gl.uniform3f(su.uBack, back[0], back[1], back[2])
            const rim = parseColor(a.rimColor, [0.85, 0.835, 0.815])
            gl.uniform3f(su.uRim, rim[0], rim[1], rim[2])
            gl.uniform3f(su.uLight, light[0], light[1], light[2])
            gl.uniform4f(
                su.uShade,
                clamp(a.ambient, 0, 100) / 100,
                clamp(a.specular, 0, 100) / 100,
                clamp(a.sheen, 0, 100) / 100,
                Math.max(0.01, a.sheenWidth / 100)
            )
            gl.uniform2f(su.uSheenC, (a.sheenX / 100 - 0.5) * Wn, (a.sheenY / 100 - 0.5) * Hn)
            gl.uniform2f(su.uRimPx, ASPECT * S * dpr, S * dpr)
            gl.uniform1f(su.uAlpha, sheetAlpha)
            gl.bindVertexArray(meshVao)
            gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0)
            gl.disable(gl.DEPTH_TEST)
            gl.disable(gl.BLEND)

            // grain + vignette
            const vig = clamp(a.vignette, 0, 100) / 100
            const grain = clamp(a.grain, 0, 100) / 100
            if (vig > 0 || grain > 0) {
                gl.enable(gl.BLEND)
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
                gl.useProgram(P.over.p)
                gl.uniform2f(P.over.u.uRes, canvas.width, canvas.height)
                gl.uniform1f(P.over.u.uVig, vig)
                gl.uniform1f(P.over.u.uGrain, grain)
                gl.uniform1f(P.over.u.uTime, time / 1000)
                gl.bindVertexArray(fullVao)
                gl.drawArrays(gl.TRIANGLES, 0, 3)
                gl.disable(gl.BLEND)
            }
            gl.bindVertexArray(null)
        }

        const presimRest = (a: any) => {
            const i = inset(argmax((x, y) => x + 1.2 * y))
            grab(i, "rest")
            hand.z = hand.pz = 0.04
            syncEnv(a)
            for (let s = 0; s < 300; s++) physStep(STEP, 1)
        }

        const resize = () => {
            const w = root.offsetWidth
            const h = root.offsetHeight
            if (!w || !h) return
            W = w
            H = h
            dpr = Math.min(2, window.devicePixelRatio || 1)
            canvas.width = Math.max(1, Math.round(W * dpr))
            canvas.height = Math.max(1, Math.round(H * dpr))
            dropTarget(tA)
            dropTarget(tB)
            const sw = Math.max(1, Math.round(canvas.width / 2))
            const sh = Math.max(1, Math.round(canvas.height / 2))
            tA = makeTarget(sw, sh)
            tB = makeTarget(sw, sh)
            const a = readAdv()
            computeView(a)
            if (!laid) {
                laid = true
                layHome(a, 0)
                if (reduced) presimRest(a)
            }
            render(performance.now())
        }
        const ro = new ResizeObserver(resize)
        ro.observe(root)
        resize()

        // ── loop ──
        let raf = 0
        let last = 0
        let acc = 0
        let ringOp = 0
        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0
            last = now
            if (!laid || W === 0) return
            const live = liveRef.current
            const a = readAdv()
            computeView(a)
            syncEnv(a)

            hand.px = hand.x
            hand.py = hand.y
            hand.pz = hand.z
            hand.pyaw = hand.yaw

            // relay (only when the sheet got lost or crumpled)
            if (relay >= 0) {
                relay += dt
                if (relay >= 0.25 && !relaid) {
                    relaid = true
                    release()
                    layHome(a, 0.12)
                }
                sheetAlpha = relay < 0.25 ? 1 - relay / 0.25 : Math.min(1, (relay - 0.25) / 0.3)
                if (relay >= 0.55) {
                    relay = -1
                    sheetAlpha = 1
                }
            }

            if (user.active && hand.owner === "user") {
                const lift = a.liftHeight / 100
                hand.z += (lift - hand.z) * (1 - Math.exp(-dt / 0.12))
                const [tx, ty] = unproject(ptr.x, ptr.y, hand.z)
                const kf = 1 - Math.exp(-dt * 35)
                hand.x += (tx - hand.x) * kf
                hand.y += (ty - hand.y) * kf
            } else if (!reduced && relay < 0) {
                if (ghost.wait > 0) {
                    ghost.wait -= dt
                    if (ghost.wait <= 0) {
                        ghost.wait = 0
                        ghost.gt = 0
                        ghost.beat = -1
                        if (needsRelay()) {
                            relay = 0
                            relaid = false
                        }
                    }
                } else {
                    const spd = clamp(live.speed ?? 50, 0, 100) / 50
                    const dtS = dt * spd * (CYCLE / Math.max(0.5, a.cycleMs / 1000))
                    updateGhost(dtS, a)
                }
            }

            // pointer hover
            overT = ptr.in && !user.active && pick(ptr.x, ptr.y) >= 0 ? 1 : 0
            over += (overT - over) * (1 - Math.exp(-dt / 0.1))
            const hv = clamp(a.hover, 0, 100) / 50
            env.hoverH = user.active ? 0 : 0.035 * hv * over
            if (env.hoverH > 0) {
                const [hx, hy] = unproject(ptr.x, ptr.y, 0)
                env.hx = hx
                env.hy = hy
            }
            canvas.style.cursor = user.active ? "grabbing" : overT && hv > 0 ? "grab" : "default"

            // physics
            acc += dt
            let n = Math.floor(acc / STEP)
            if (n > 8) {
                n = 8
                acc = 0
            } else acc -= n * STEP
            for (let s = 0; s < n; s++) physStep(STEP, (s + 1) / n)
            if (n === 0 && hand.idx >= 0) {
                pin(hand.idx, hand.x, hand.y, hand.z)
                prev[hand.idx * 3] = pos[hand.idx * 3]
                prev[hand.idx * 3 + 1] = pos[hand.idx * 3 + 1]
                prev[hand.idx * 3 + 2] = pos[hand.idx * 3 + 2]
            }

            render(now)

            // ghost grab ring
            const showRing = hand.owner === "ghost" ? clamp(a.ringOpacity, 0, 100) / 100 : 0
            ringOp += (showRing - ringOp) * (1 - Math.exp(-dt / 0.08))
            if (hand.idx >= 0) {
                const k = hand.idx * 3
                const [sx, sy] = project(pos[k], pos[k + 1], pos[k + 2])
                ring.style.transform = `translate(${sx - 6}px, ${sy - 6}px)`
            }
            ring.style.opacity = String(ringOp)
        }
        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            canvas.removeEventListener("pointerdown", onDown)
            canvas.removeEventListener("pointermove", onMove)
            canvas.removeEventListener("pointerleave", onLeave)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            dropTarget(tA)
            dropTarget(tB)
            gl.deleteTexture(printTex)
            gl.deleteBuffer(posBuf)
            gl.deleteBuffer(norBuf)
            gl.deleteBuffer(uvBuf)
            gl.deleteBuffer(idxBuf)
            gl.deleteVertexArray(meshVao)
            gl.deleteVertexArray(fullVao)
            gl.deleteProgram(P.sheet.p)
            gl.deleteProgram(P.shadow.p)
            gl.deleteProgram(P.blur.p)
            gl.deleteProgram(P.bg.p)
            gl.deleteProgram(P.over.p)
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
                overflow: "hidden",
                background,
                ...style,
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
                }}
            />
            <div
                ref={ringRef}
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: 12,
                    height: 12,
                    boxSizing: "border-box",
                    borderRadius: "50%",
                    border: "1.5px solid #6B6765",
                    background: "rgba(255,255,255,0.55)",
                    pointerEvents: "none",
                    opacity: 0,
                    willChange: "transform, opacity",
                }}
            />
        </div>
    )
}

addPropertyControls(DraggableClothPrint, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Table colour under the sheet.",
    },
    paperColor: {
        type: ControlType.Color,
        title: "Paper",
        defaultValue: "#F4F2EE",
        description: "Colour of the print's paper border.",
    },
    inkColor: {
        type: ControlType.Color,
        title: "Ink",
        defaultValue: "#0F0E0C",
        description: "Colour of the stippled squares.",
    },
    caption: {
        type: ControlType.String,
        title: "Caption",
        defaultValue: "Turn",
        description: "Small label in the print's bottom-left corner.",
    },
    image: {
        defaultValue: DEFAULT_IMAGE,
        type: ControlType.ResponsiveImage,
        title: "Image",
        description: "Your own artwork on the print, fitted inside the panel. Empty draws the stippled squares.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 300,
        max: 1000,
        step: 1,
        unit: "px",
        defaultValue: 600,
        description: "Height of the sheet.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 23,
        description: "Tempo of the hand that moves the print. 0 stops it.",
    },
    stiffness: {
        type: ControlType.Number,
        title: "Stiffness",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 40,
        description: "How much the paper resists bending. Low is cloth, high is card.",
    },
    weight: {
        type: ControlType.Number,
        title: "Weight",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "Gravity on the sheet: how fast a lifted part falls.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "How far the paper rises toward the pointer. 0 is off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening." },
            panelColor: { type: ControlType.Color, title: "Panel", defaultValue: "#E9E5DD", description: "Inner artwork panel colour." },
            backColor: { type: ControlType.Color, title: "Back", defaultValue: "#ECE8E1", description: "Colour of the sheet's blank back." },
            rimColor: { type: ControlType.Color, title: "Rim", defaultValue: "#D8D5D0", description: "Hairline at the paper's edge." },
            captionColor: { type: ControlType.Color, title: "Caption Color", defaultValue: "#6B6765", description: "Caption text colour." },
            margin: { type: ControlType.Number, title: "Margin", min: 0, max: 20, step: 1, unit: "%", defaultValue: 6, description: "Paper border around the panel." },
            squareSize: { type: ControlType.Number, title: "Square Size", min: 3, max: 20, step: 1, unit: "%", defaultValue: 10, description: "Square side, % of sheet width." },
            colPitch: { type: ControlType.Number, title: "Column Pitch", min: 8, max: 30, step: 1, unit: "%", defaultValue: 16, description: "Distance between columns, % of sheet width." },
            rowPitch: { type: ControlType.Number, title: "Row Pitch", min: 6, max: 25, step: 1, unit: "%", defaultValue: 12, description: "Distance between rows, % of sheet height." },
            gridTop: { type: ControlType.Number, title: "Grid Top", min: 5, max: 50, step: 1, unit: "%", defaultValue: 23, description: "First row's centre, % of sheet height." },
            stipple: { type: ControlType.Number, title: "Stipple", min: 1, max: 8, step: 1, unit: "px", defaultValue: 2, description: "Dot size of the dither, in texture px." },
            squareTilt: { type: ControlType.Number, title: "Square Tilt", min: 0, max: 20, step: 1, unit: "°", defaultValue: 4, description: "Random tilt of each square." },
            seed: { type: ControlType.Number, title: "Seed", min: 0, max: 999, step: 1, defaultValue: 7, description: "Changes each square's light direction." },
            airDrag: { type: ControlType.Number, title: "Air Drag", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30, description: "How much air slows the sheet." },
            friction: { type: ControlType.Number, title: "Friction", min: 0, max: 100, step: 1, unit: "%", defaultValue: 10, description: "Table grip on the paper." },
            iterations: { type: ControlType.Number, title: "Iterations", min: 2, max: 30, step: 1, defaultValue: 10, description: "Constraint passes per step: higher stretches less." },
            liftHeight: { type: ControlType.Number, title: "Lift Height", min: 0, max: 80, step: 1, unit: "%", defaultValue: 14, description: "How high your grab lifts the sheet." },
            carryHeight: { type: ControlType.Number, title: "Carry Height", min: 10, max: 120, step: 1, unit: "%", defaultValue: 55, description: "How high the hand carries the sheet." },
            twist: { type: ControlType.Number, title: "Twist", min: 0, max: 360, step: 1, unit: "°", defaultValue: 180, description: "Wrist turn while carrying." },
            dragDistance: { type: ControlType.Number, title: "Drag Distance", min: 0, max: 40, step: 1, unit: "%", defaultValue: 15, description: "First drag to the right, % of width." },
            cycleMs: { type: ControlType.Number, title: "Cycle", min: 3000, max: 20000, step: 10, unit: "ms", defaultValue: 9000, description: "Length of one hand cycle at speed 50." },
            restRotation: { type: ControlType.Number, title: "Rest Rotation", min: -45, max: 45, step: 1, unit: "°", defaultValue: -2, description: "Starting angle of the sheet." },
            sheetX: { type: ControlType.Number, title: "Sheet X", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Starting centre, % of width." },
            sheetY: { type: ControlType.Number, title: "Sheet Y", min: 0, max: 100, step: 1, unit: "%", defaultValue: 52, description: "Starting centre, % of height." },
            shadowOpacity: { type: ControlType.Number, title: "Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30, description: "Shadow strength on the table." },
            shadowOffset: { type: ControlType.Number, title: "Shadow Offset", min: 0, max: 60, step: 1, unit: "px", defaultValue: 10, description: "Shadow offset of the flat sheet." },
            shadowBlur: { type: ControlType.Number, title: "Shadow Blur", min: 0, max: 40, step: 1, unit: "px", defaultValue: 5, description: "Blur of the contact shadow." },
            liftBlur: { type: ControlType.Number, title: "Lift Blur", min: 0, max: 80, step: 1, unit: "px", defaultValue: 26, description: "Blur of the shadow under lifted parts." },
            ambient: { type: ControlType.Number, title: "Ambient", min: 0, max: 100, step: 1, unit: "%", defaultValue: 55, description: "Brightness of faces turned from the light." },
            specular: { type: ControlType.Number, title: "Specular", min: 0, max: 100, step: 1, unit: "%", defaultValue: 25, description: "Soft sheen on faces toward the light." },
            sheen: { type: ControlType.Number, title: "Sheen", min: 0, max: 100, step: 1, unit: "%", defaultValue: 35, description: "Diagonal highlight band strength." },
            sheenWidth: { type: ControlType.Number, title: "Sheen Width", min: 2, max: 60, step: 1, unit: "%", defaultValue: 15, description: "Highlight band width, % of sheet height." },
            sheenX: { type: ControlType.Number, title: "Sheen X", min: 0, max: 100, step: 1, unit: "%", defaultValue: 56, description: "Highlight band centre, % of width." },
            sheenY: { type: ControlType.Number, title: "Sheen Y", min: 0, max: 100, step: 1, unit: "%", defaultValue: 58, description: "Highlight band centre, % of height." },
            fov: { type: ControlType.Number, title: "Field of View", min: 5, max: 90, step: 1, unit: "°", defaultValue: 30, description: "Camera lens: higher makes lifted parts grow more." },
            ringOpacity: { type: ControlType.Number, title: "Hand Ring", min: 0, max: 100, step: 1, unit: "%", defaultValue: 80, description: "Ring marking the demo hand's grip." },
        },
    },
})
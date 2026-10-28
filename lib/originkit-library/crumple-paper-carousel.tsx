import * as React from "react"
import { useEffect, useMemo, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

const DEFAULT_IMAGES = [{"src":"https://images.unsplash.com/photo-1791965558115-58fb666a7850?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792187790722-66db7d13a53f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792592108795-076164280be6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792614268370-d7a7046adbcf?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792964785281-0397544a4245?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""}]

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    stepMs: 1270,
    restMs: 250,
    resumeMs: 2500,
    easeX1: 23,
    easeY1: 8,
    easeX2: 28,
    easeY2: 85,
    flatZone: 20,
    ballSize: 75,
    edgeBallSize: 50,
    foldWrap: 140,
    creaseDepth: 15,
    facetJitter: 7,
    foldScale: 3,
    gridX: 12,
    gridY: 16,
    tiltRange: 8,
    tumble: 10,
    depthStep: 450,
    perspective: 2400,
    lightAngle: 135,
    ambient: 35,
    shadeContrast: 100,
    highlight: 60,
    paperColor: "#E9E8E8",
    seed: 7,
    wheelThreshold: 40,
    dragThreshold: 60,
    offsetY: 0,
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

const TW = 480
const TH = 632
const BUILTIN_TILTS = [4, -6, 7, 4, 8, -5, 5]

const VS = `#version 300 es
precision highp float;
in vec2 aUV;
uniform vec2 uRes;
uniform vec2 uSize;
uniform vec2 uCenter;
uniform float uBaseZ;
uniform float uC;
uniform float uR;
uniform float uSeed;
uniform float uPhase;
uniform float uRot;
uniform vec2 uTilt;
uniform float uWrap;
uniform float uCrease;
uniform float uJitter;
uniform float uFold;
uniform float uPersp;
uniform vec2 uGrid;
out vec2 vUV;
out vec3 vPos;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 17.13) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
    vUV = aUV;
    vec2 q = aUV - 0.5;
    vec3 flat3 = vec3(q * uSize, 0.0);
    vec2 g = floor(aUV * uGrid + 0.5);
    vec3 rnd = vec3(hash(g), hash(g + 17.3), hash(g + 41.9)) * 2.0 - 1.0;
    vec2 np = aUV * uFold + vec2(uPhase * 0.7, uSeed * 3.1);
    float ridge = 0.0;
    float amp = 1.0;
    float fr = 1.0;
    for (int i = 0; i < 3; i++) {
        ridge += amp * (0.5 - abs(vnoise(np * fr) * 2.0 - 1.0));
        amp *= 0.5;
        fr *= 2.1;
    }
    float aspect = uSize.x / max(uSize.y, 1.0);
    float a = q.x * 2.0 * uWrap * aspect;
    float b = clamp(q.y * 2.0 * uWrap * 0.9, -1.45, 1.45);
    float rr = uR * (1.0 + 0.22 * (vnoise(np * 0.8 + 5.0) - 0.5) * 2.0);
    vec3 sph = vec3(sin(a) * cos(b), sin(b), cos(a) * cos(b));
    vec3 ball = sph * rr - vec3(0.0, 0.0, uR * 0.5);
    float c = uC;
    float m = smoothstep(0.0, 1.0, c);
    vec3 p = mix(flat3, ball, m);
    vec3 n = normalize(mix(vec3(0.0, 0.0, 1.0), sph, m));
    p += n * (ridge * uCrease + rnd.x * uJitter) * uSize.y * c;
    p.xy += rnd.yz * uJitter * 0.6 * uSize.y * c;
    float wav = c * (1.0 - c) * 4.0;
    float edge = max(abs(q.x), abs(q.y)) * 2.0;
    p.z += sin(q.y * 9.0 + q.x * 3.0 + uPhase * 4.0 + uSeed) * uSize.y * 0.05 * wav * edge;
    p.x += sin(q.y * 7.0 + uPhase * 3.0 + uSeed) * uSize.x * 0.02 * wav * abs(q.x) * 2.0;
    float cz = cos(uRot);
    float sz = sin(uRot);
    p.xy = vec2(cz * p.x - sz * p.y, sz * p.x + cz * p.y);
    float cy = cos(uTilt.y);
    float sy = sin(uTilt.y);
    p.xz = vec2(cy * p.x + sy * p.z, -sy * p.x + cy * p.z);
    float cx = cos(uTilt.x);
    float sx = sin(uTilt.x);
    p.yz = vec2(cx * p.y - sx * p.z, sx * p.y + cx * p.z);
    vPos = p;
    float s = uPersp / max(uPersp - p.z, 1.0);
    vec2 scr = uCenter + p.xy * s;
    gl_Position = vec4(scr / (uRes * 0.5), -(uBaseZ + p.z) / 6000.0, 1.0);
}`

const FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vPos;
uniform sampler2D uTex;
uniform vec3 uBack;
uniform vec3 uLight;
uniform float uAmbient;
uniform float uContrast;
uniform float uHigh;
out vec4 outColor;
void main() {
    vec3 N = normalize(cross(dFdx(vPos), dFdy(vPos)));
    if (N.z < 0.0) N = -N;
    vec3 base = gl_FrontFacing ? texture(uTex, vUV).rgb : uBack;
    float d = max(dot(N, uLight), 0.0);
    float ref = uAmbient + (1.0 - uAmbient) * max(uLight.z, 0.05);
    float sh = (uAmbient + (1.0 - uAmbient) * d) / max(ref, 0.001);
    sh = mix(1.0, sh, uContrast);
    vec3 col = base * min(sh, 1.0) + vec3(max(sh - 1.0, 0.0) * uHigh);
    outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

function parseColor(c: any, fb: number[] = [0.91, 0.91, 0.91]): number[] {
    if (typeof c !== "string") return fb
    const s = c.trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((x) => x + x)
                .join("")
        const n = parseInt(h.slice(0, 6), 16)
        if (isNaN(n)) return fb
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    }
    const m = s.match(/rgba?\(([^)]+)\)/i)
    if (m) {
        const p = m[1]
            .split(/[\s,/]+/)
            .filter(Boolean)
            .map(parseFloat)
        if (p.length >= 3) return [p[0] / 255, p[1] / 255, p[2] / 255]
    }
    return fb
}

function rand(seed: number) {
    let s = seed >>> 0 || 1
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return s / 4294967296
    }
}

function hash1(n: number) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return x - Math.floor(x)
}

function smoothstep(a: number, b: number, x: number) {
    const t = Math.min(1, Math.max(0, (x - a) / Math.max(b - a, 1e-4)))
    return t * t * (3 - 2 * t)
}

function bezier(x1: number, y1: number, x2: number, y2: number, t: number) {
    if (t <= 0) return 0
    if (t >= 1) return 1
    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx
    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by
    let u = t
    for (let i = 0; i < 8; i++) {
        const x = ((ax * u + bx) * u + cx) * u - t
        const d = (3 * ax * u + 2 * bx) * u + cx
        if (Math.abs(x) < 1e-5 || Math.abs(d) < 1e-6) break
        u -= x / d
    }
    u = Math.min(1, Math.max(0, u))
    return ((ay * u + by) * u + cy) * u
}

function makeCanvas(w: number, h: number) {
    const c = document.createElement("canvas")
    c.width = w
    c.height = h
    return c
}

// ── built-in poster art (no text) ──
function drawSwirl(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#EDECEC"
    ctx.fillRect(0, 0, TW, TH)
    ctx.strokeStyle = "#0A0A0A"
    ctx.lineCap = "round"
    ctx.lineWidth = 30
    ctx.beginPath()
    for (let a = 0; a < 5 * Math.PI * 2; a += 0.05) {
        const r = 10 + (64 * a) / (Math.PI * 2)
        const x = 250 + Math.cos(a) * r
        const y = 300 + Math.sin(a) * r * 1.15
        if (a === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
    }
    ctx.stroke()
}

function drawPortrait(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 0, TW, TH)
    g.addColorStop(0, "#E8801A")
    g.addColorStop(0.25, "#CA3605")
    g.addColorStop(1, "#C23204")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, TW, TH)
    const c = makeCanvas(TW, TH)
    const h = c.getContext("2d")!
    const r = rand(11)
    h.fillStyle = "#050505"
    for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * 150
        h.beginPath()
        h.arc(240 + Math.cos(a) * d * 1.1, 250 + Math.sin(a) * d * 0.9, 34 + r() * 30, 0, Math.PI * 2)
        h.fill()
    }
    h.beginPath()
    h.ellipse(245, 340, 92, 120, 0, 0, Math.PI * 2)
    h.fill()
    h.beginPath()
    h.moveTo(190, 420)
    h.lineTo(300, 420)
    h.lineTo(320, 520)
    h.quadraticCurveTo(440, 560, 470, TH)
    h.lineTo(20, TH)
    h.quadraticCurveTo(60, 560, 170, 520)
    h.closePath()
    h.fill()
    h.globalCompositeOperation = "source-atop"
    h.fillStyle = "rgba(255,255,255,0.55)"
    for (let i = 0; i < 9000; i++) {
        const s = r() < 0.15 ? 1.8 : 1
        h.fillRect(r() * TW, r() * TH, s, s)
    }
    for (let i = 0; i < 1500; i++) {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * 60
        h.fillRect(200 + Math.cos(a) * d, 360 + Math.sin(a) * d * 1.3, 1.5, 1.5)
    }
    ctx.drawImage(c, 0, 0)
    ctx.strokeStyle = "#F2B400"
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.arc(205, 325, 36, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(290, 325, 36, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(241, 322)
    ctx.lineTo(254, 322)
    ctx.stroke()
}

function drawPriceBars(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#1E1124"
    ctx.fillRect(0, 0, TW, TH)
    ctx.fillStyle = "#C9B8F0"
    let y = 34
    for (let i = 0; i < 7; i++) {
        const hgt = 28 + i * 10
        const r = rand(30 + i)
        let x = -14
        const maxX = 330 + i * 20
        while (x < maxX) {
            const w = hgt * (0.45 + r() * 0.35)
            ctx.fillRect(x, y, w, hgt)
            x += w + hgt * 0.22
        }
        y += hgt + 18
    }
}

function drawFigure(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#EEEDED"
    ctx.fillRect(0, 0, TW, TH)
    ctx.strokeStyle = "#0A0A0A"
    ctx.lineWidth = 5
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.ellipse(232, 170, 40, 50, -0.2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = "#0A0A0A"
    ctx.beginPath()
    ctx.arc(250, 165, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(222, 218)
    ctx.lineTo(214, 242)
    ctx.quadraticCurveTo(178, 300, 182, 420)
    ctx.lineTo(190, 560)
    ctx.lineTo(168, 575)
    ctx.lineTo(216, 575)
    ctx.lineTo(225, 470)
    ctx.quadraticCurveTo(240, 448, 252, 470)
    ctx.lineTo(258, 575)
    ctx.lineTo(302, 575)
    ctx.lineTo(292, 430)
    ctx.quadraticCurveTo(306, 340, 268, 246)
    ctx.lineTo(244, 222)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(205, 258)
    ctx.quadraticCurveTo(140, 300, 136, 330)
    ctx.quadraticCurveTo(150, 368, 184, 372)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(276, 258)
    ctx.quadraticCurveTo(342, 298, 348, 330)
    ctx.quadraticCurveTo(336, 366, 298, 372)
    ctx.stroke()
}

function drawSlab(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#F1F0F0"
    ctx.fillRect(0, 0, TW, TH)
    const r = rand(55)
    for (let row = 0; row < 4; row++) {
        const y = 40 + row * 140
        let x = -8
        for (let l = 0; l < 4; l++) {
            const w = 96 + r() * 18
            ctx.fillStyle = "#0A0A0A"
            ctx.fillRect(x, y, w, 118)
            ctx.fillStyle = "#F1F0F0"
            const cw = w * (0.28 + r() * 0.2)
            const ch = 118 * (0.3 + r() * 0.25)
            ctx.fillRect(x + (w - cw) * (0.3 + r() * 0.4), y + (118 - ch) * (0.2 + r() * 0.6), cw, ch)
            x += w + 14
        }
    }
}

function drawCubes(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(TW, 0, 0, TH)
    g.addColorStop(0, "#DF6552")
    g.addColorStop(0.4, "#D93706")
    g.addColorStop(1, "#C83004")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, TW, TH)
    const c = makeCanvas(TW, TH)
    const h = c.getContext("2d")!
    const cube = (cx: number, cy: number, s: number) => {
        const k = 0.87 * s
        const face = (pts: number[][], col: string) => {
            h.fillStyle = col
            h.beginPath()
            h.moveTo(pts[0][0], pts[0][1])
            for (let i = 1; i < pts.length; i++) h.lineTo(pts[i][0], pts[i][1])
            h.closePath()
            h.fill()
        }
        face([[cx, cy - s], [cx + k, cy - s / 2], [cx, cy], [cx - k, cy - s / 2]], "#FFFFFF")
        face([[cx - k, cy - s / 2], [cx, cy], [cx, cy + s], [cx - k, cy + s / 2]], "#E9E8E8")
        face([[cx + k, cy - s / 2], [cx, cy], [cx, cy + s], [cx + k, cy + s / 2]], "#C4C0BE")
    }
    cube(245, 250, 62)
    cube(190, 310, 62)
    cube(300, 310, 62)
    h.globalCompositeOperation = "source-atop"
    const f = h.createLinearGradient(0, 300, 0, 400)
    f.addColorStop(0, "rgba(217,55,6,0)")
    f.addColorStop(1, "rgba(217,55,6,1)")
    h.fillStyle = f
    h.fillRect(0, 0, TW, TH)
    ctx.drawImage(c, 0, 0)
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(34, 560, 120, 6)
    ctx.fillRect(34, 574, 90, 6)
    ctx.fillRect(420, 30, 26, 6)
}

function drawGreen(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#1E5A3C"
    ctx.fillRect(0, 0, TW, TH)
    const poly = (pts: number[][], col: string) => {
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.closePath()
        ctx.fill()
    }
    poly([[0, 300], [TW, 60], [TW, 220], [0, 470]], "#8BE04B")
    poly([[60, TH], [TW, 330], [TW, 430], [200, TH]], "#3E9A4A")
    poly([[0, 0], [180, 0], [0, 160]], "#3E9A4A")
}

const BUILTINS = [drawSwirl, drawPortrait, drawPriceBars, drawFigure, drawSlab, drawCubes, drawGreen]

function srcOf(v: any): string {
    if (!v) return ""
    if (typeof v === "string") return v
    return typeof v.src === "string" ? v.src : ""
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
    const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!
        gl.shaderSource(s, src)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader")
        return s
    }
    const p = gl.createProgram()!
    const v = sh(gl.VERTEX_SHADER, vs)
    const f = sh(gl.FRAGMENT_SHADER, fs)
    gl.attachShader(p, v)
    gl.attachShader(p, f)
    gl.bindAttribLocation(p, 0, "aUV")
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link")
    gl.deleteShader(v)
    gl.deleteShader(f)
    return p
}

function buildGrid(gl: WebGL2RenderingContext, gx: number, gy: number) {
    const verts = new Float32Array((gx + 1) * (gy + 1) * 2)
    let k = 0
    for (let j = 0; j <= gy; j++)
        for (let i = 0; i <= gx; i++) {
            verts[k++] = i / gx
            verts[k++] = j / gy
        }
    const idx: number[] = []
    for (let j = 0; j < gy; j++)
        for (let i = 0; i < gx; i++) {
            const a = j * (gx + 1) + i
            const b = a + 1
            const d = a + gx + 1
            const c = d + 1
            if ((i + j) % 2 === 0) idx.push(a, b, c, a, c, d)
            else idx.push(a, b, d, b, c, d)
        }
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)
    const vbo = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    const ibo = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    return { vao, vbo, ibo, count: idx.length, gx, gy }
}

function makeTexture(gl: WebGL2RenderingContext, src: HTMLCanvasElement) {
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
}

/**
 * Crumple Paper Carousel — posters lie flat in the centre and crumple into
 * faceted paper balls as they slide away. Scroll, swipe or let it step on its own.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function CrumplePaperCarousel(props: any) {
    props = withMovedControls(props)
    const {
        images = DEFAULT_IMAGES,
        background = "#000000",
        speed = 22,
        crumple = 70,
        scale = 100,
        itemWidth = 294,
        itemHeight = 344,
        spacing = 30,
        autoplay = true,
        arrows = false,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const live = useRef<any>(null)
    live.current = { images, speed, crumple, scale, itemWidth, itemHeight, spacing, autoplay, adv }
    const redrawRef = useRef<(() => void) | null>(null)
    const stepRef = useRef<((dir: number) => void) | null>(null)

    const grainUrl = useMemo(() => {
        if (typeof document === "undefined") return ""
        const c = makeCanvas(140, 140)
        const x = c.getContext("2d")
        if (!x) return ""
        const d = x.createImageData(140, 140)
        for (let i = 0; i < d.data.length; i += 4) {
            const v = Math.random() * 255
            d.data[i] = d.data[i + 1] = d.data[i + 2] = v
            d.data[i + 3] = 255
        }
        x.putImageData(d, 0, 0)
        return c.toDataURL()
    }, [])

    useEffect(() => {
        redrawRef.current?.()
    })

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return
        const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true })
        if (!gl) return
        const target = RenderTarget.current()
        const isStatic = target === RenderTarget.thumbnail || target === RenderTarget.export
        const reduced =
            typeof window !== "undefined" &&
            !!window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches

        const prog = createProgram(gl, VS, FS)
        const U = (n: string) => {
            const l = gl.getUniformLocation(prog, n)
            if (!l) throw new Error("Missing uniform " + n)
            return l
        }
        const loc = {
            uRes: U("uRes"),
            uSize: U("uSize"),
            uCenter: U("uCenter"),
            uBaseZ: U("uBaseZ"),
            uC: U("uC"),
            uR: U("uR"),
            uSeed: U("uSeed"),
            uPhase: U("uPhase"),
            uRot: U("uRot"),
            uTilt: U("uTilt"),
            uWrap: U("uWrap"),
            uCrease: U("uCrease"),
            uJitter: U("uJitter"),
            uFold: U("uFold"),
            uPersp: U("uPersp"),
            uGrid: U("uGrid"),
            uTex: U("uTex"),
            uBack: U("uBack"),
            uLight: U("uLight"),
            uAmbient: U("uAmbient"),
            uContrast: U("uContrast"),
            uHigh: U("uHigh"),
        }

        const builtinTex = BUILTINS.map((fn) => {
            const c = makeCanvas(TW, TH)
            fn(c.getContext("2d")!)
            return makeTexture(gl, c)
        })

        const cache = new Map<string, { tex: WebGLTexture | null; state: string }>()
        let disposed = false
        const ensure = (src: string) => {
            let e = cache.get(src)
            if (e) return e
            e = { tex: null, state: "loading" }
            cache.set(src, e)
            const entry = e
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.onload = () => {
                if (disposed) return
                try {
                    const c = makeCanvas(TW, TH)
                    const x = c.getContext("2d")!
                    x.fillStyle = live.current.adv.paperColor
                    x.fillRect(0, 0, TW, TH)
                    let iw = img.naturalWidth
                    let ih = img.naturalHeight
                    if (!iw || !ih) {
                        iw = TW * 0.9
                        ih = TW * 0.9
                    }
                    const s = Math.max(TW / iw, TH / ih)
                    x.drawImage(img, (TW - iw * s) / 2, (TH - ih * s) / 2, iw * s, ih * s)
                    entry.tex = makeTexture(gl, c)
                    entry.state = "ready"
                } catch {
                    entry.state = "failed"
                }
                redrawRef.current?.()
            }
            img.onerror = () => {
                entry.state = "failed"
            }
            img.src = src
            return entry
        }

        let grid = buildGrid(gl, ADVANCED_DEFAULTS.gridX, ADVANCED_DEFAULTS.gridY)
        let W = 0
        let H = 0

        const st = {
            pos: isStatic || reduced ? 4 : 1.6,
            from: 1.6,
            to: 2,
            t0: 0,
            dur: 0.53,
            tweening: !(isStatic || reduced),
            firstRest: true,
            nextAuto: 1e9,
            lastUser: -99,
            clock: 0,
            wheelAcc: 0,
            lastWheelStep: -99,
            px: 0,
            py: 0,
            tpx: 0,
            tpy: 0,
            over: 0,
            tover: 0,
            press: 0,
            tpress: 0,
            dragging: false,
            lastX: 0,
        }
        if (!st.tweening) st.to = st.pos

        const step = (dir: number, user: boolean) => {
            const L = live.current
            const sf = L.speed > 0 ? L.speed / 50 : 1
            const base = st.tweening ? st.to : Math.round(st.pos)
            const next = base + dir
            if (Math.abs(next - Math.round(st.pos)) > 3) return
            st.from = st.pos
            st.to = next
            st.t0 = st.clock
            st.dur = Math.max(0.05, L.adv.stepMs / 1000 / sf)
            if (reduced) {
                st.pos = st.to
                st.tweening = false
            } else st.tweening = true
            if (user) st.lastUser = st.clock
        }
        stepRef.current = (dir) => step(dir, true)

        const draw = () => {
            if (!W || !H) return
            const L = live.current
            const a = L.adv
            const gx = Math.max(2, Math.min(40, Math.round(a.gridX)))
            const gy = Math.max(2, Math.min(40, Math.round(a.gridY)))
            if (gx !== grid.gx || gy !== grid.gy) {
                gl.deleteVertexArray(grid.vao)
                gl.deleteBuffer(grid.vbo)
                gl.deleteBuffer(grid.ibo)
                grid = buildGrid(gl, gx, gy)
            }
            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
            gl.enable(gl.DEPTH_TEST)
            gl.depthFunc(gl.LEQUAL)
            gl.disable(gl.CULL_FACE)
            gl.useProgram(prog)
            gl.bindVertexArray(grid.vao)
            gl.activeTexture(gl.TEXTURE0)
            gl.uniform1i(loc.uTex, 0)

            const k = Math.min(W / 1200, H / 800) * (L.scale / 100)
            const sw = L.itemWidth * k
            const shh = L.itemHeight * k
            const pitch = (L.spacing / 100) * W
            const h = Math.max(0, a.hover / 50)
            const la = (a.lightAngle * Math.PI) / 180
            const lv = [Math.cos(la) * 0.6, Math.sin(la) * 0.6, 0.8]
            const ll = Math.hypot(lv[0], lv[1], lv[2])
            const back = parseColor(a.paperColor)

            gl.uniform2f(loc.uRes, W, H)
            gl.uniform2f(loc.uSize, sw, shh)
            gl.uniform1f(loc.uWrap, (a.foldWrap * Math.PI) / 180)
            gl.uniform1f(loc.uJitter, a.facetJitter / 100)
            gl.uniform1f(loc.uFold, Math.max(0.5, a.foldScale))
            gl.uniform1f(loc.uPersp, Math.max(300, a.perspective * k))
            gl.uniform2f(loc.uGrid, gx, gy)
            gl.uniform3f(loc.uBack, back[0], back[1], back[2])
            gl.uniform3f(loc.uLight, lv[0] / ll, lv[1] / ll, lv[2] / ll)
            gl.uniform1f(loc.uAmbient, a.ambient / 100)
            gl.uniform1f(loc.uContrast, a.shadeContrast / 100)
            gl.uniform1f(loc.uHigh, a.highlight / 100)

            const uploads: string[] = (Array.isArray(L.images) ? L.images : []).map(srcOf).filter(Boolean)
            const N = uploads.length ? uploads.length * Math.ceil(7 / uploads.length) : 7
            const cm = L.crumple / 70
            const pxc = (st.px * W) / 2
            const base = Math.floor(st.pos)
            const slots: number[] = []
            for (let s = base - 3; s <= base + 4; s++) slots.push(s)
            slots.sort((p, q) => Math.abs(q - st.pos) - Math.abs(p - st.pos))

            for (const kk of slots) {
                const o = kk - st.pos
                const x = o * pitch
                if (Math.abs(x) - sw > W / 2) continue
                const ao = Math.abs(o)
                let c = smoothstep(a.flatZone / 100, 1, ao)
                const prox = Math.exp(-Math.pow((x - pxc) / Math.max(pitch * 0.55, 1), 2)) * st.over
                c *= Math.max(0, 1 - 0.45 * h * prox)
                c += st.press * h * 0.12 * (1 - Math.min(ao, 1))
                const uC = Math.min(1, Math.max(0, c * Math.min(cm, 1)))
                const bs = ao <= 1 ? a.ballSize : a.ballSize + (a.edgeBallSize - a.ballSize) * Math.min(ao - 1, 1)
                const idx = ((kk % N) + N) % N
                const seedV = hash1(idx * 7.13 + a.seed) * 10
                const tiltDeg =
                    uploads.length || idx >= BUILTIN_TILTS.length
                        ? (hash1(idx * 3.7 + a.seed * 1.3) * 2 - 1) * a.tiltRange
                        : (BUILTIN_TILTS[idx] / 8) * a.tiltRange
                const rot = ((tiltDeg - o * a.tumble * uC) * Math.PI) / 180
                const tiltAmt = h * st.over
                let tex: WebGLTexture = builtinTex[idx % 7]
                if (uploads.length) {
                    const e = ensure(uploads[idx % uploads.length])
                    if (e.state === "ready" && e.tex) tex = e.tex
                }
                gl.bindTexture(gl.TEXTURE_2D, tex)
                gl.uniform1f(loc.uC, uC)
                gl.uniform1f(loc.uR, (shh * bs) / 200)
                gl.uniform1f(loc.uCrease, (a.creaseDepth / 100) * Math.max(cm, 1))
                gl.uniform1f(loc.uSeed, seedV)
                gl.uniform1f(loc.uPhase, o)
                gl.uniform1f(loc.uRot, rot)
                gl.uniform2f(
                    loc.uTilt,
                    ((st.py * 8 * Math.PI) / 180) * tiltAmt,
                    ((st.px * 12 * Math.PI) / 180) * tiltAmt
                )
                gl.uniform2f(loc.uCenter, x, a.offsetY * k)
                gl.uniform1f(loc.uBaseZ, -ao * a.depthStep * k)
                gl.drawElements(gl.TRIANGLES, grid.count, gl.UNSIGNED_SHORT, 0)
            }
            gl.bindVertexArray(null)
        }
        redrawRef.current = isStatic ? draw : null

        const size = () => {
            W = root.offsetWidth
            H = root.offsetHeight
            const dpr = Math.min(2, window.devicePixelRatio || 1)
            canvas.width = Math.max(1, Math.round(W * dpr))
            canvas.height = Math.max(1, Math.round(H * dpr))
            if (isStatic) draw()
        }
        const ro = new ResizeObserver(size)
        ro.observe(root)
        size()

        const onWheel = (e: WheelEvent) => {
            e.preventDefault()
            const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
            const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * m
            st.wheelAcc += d
            st.lastUser = st.clock
            if (Math.abs(st.wheelAcc) >= live.current.adv.wheelThreshold && st.clock - st.lastWheelStep > 0.28) {
                step(Math.sign(st.wheelAcc), true)
                st.wheelAcc = 0
                st.lastWheelStep = st.clock
            }
        }
        const onMove = (e: PointerEvent) => {
            if (!W || !H) return
            st.tpx = (e.offsetX / W) * 2 - 1
            st.tpy = -((e.offsetY / H) * 2 - 1)
            st.tover = 1
        }
        const onLeave = () => {
            st.tover = 0
        }
        const onDown = (e: PointerEvent) => {
            if ((e.target as HTMLElement | null)?.closest?.("[data-arrow]")) return
            st.dragging = true
            st.lastX = e.clientX
            st.tpress = 1
            st.lastUser = st.clock
        }
        const onWinMove = (e: PointerEvent) => {
            if (!st.dragging) return
            const dx = e.clientX - st.lastX
            if (Math.abs(dx) > live.current.adv.dragThreshold) {
                step(dx < 0 ? 1 : -1, true)
                st.lastX = e.clientX
            }
        }
        const onUp = () => {
            st.dragging = false
            st.tpress = 0
        }
        if (!isStatic) {
            root.addEventListener("wheel", onWheel, { passive: false })
            root.addEventListener("pointermove", onMove)
            root.addEventListener("pointerleave", onLeave)
            root.addEventListener("pointerdown", onDown)
            window.addEventListener("pointermove", onWinMove)
            window.addEventListener("pointerup", onUp)
            window.addEventListener("pointercancel", onUp)
        }

        let raf = 0
        let last: number | null = null
        const frame = (now: number) => {
            const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000)
            last = now
            st.clock += dt
            const L = live.current
            const a = L.adv
            const kp = 1 - Math.exp(-dt * 6)
            st.px += (st.tpx - st.px) * kp
            st.py += (st.tpy - st.py) * kp
            st.over += (st.tover - st.over) * kp
            st.press += (st.tpress - st.press) * (1 - Math.exp(-dt * 10))
            st.wheelAcc *= Math.exp(-dt * 4)

            const sf = L.speed > 0 ? L.speed / 50 : 1
            if (st.tweening) {
                const u = (st.clock - st.t0) / Math.max(st.dur, 1e-3)
                if (u >= 1) {
                    st.pos = st.to
                    st.tweening = false
                    st.nextAuto = st.clock + (st.firstRest ? 0.47 : a.restMs / 1000) / sf
                    st.firstRest = false
                } else {
                    const e = bezier(a.easeX1 / 100, a.easeY1 / 100, a.easeX2 / 100, a.easeY2 / 100, u)
                    st.pos = st.from + (st.to - st.from) * e
                }
            } else if (st.nextAuto > 1e8) {
                st.nextAuto = st.clock + a.restMs / 1000 / sf
            }
            if (
                !st.tweening &&
                L.autoplay &&
                L.speed > 0 &&
                !reduced &&
                st.clock >= st.nextAuto &&
                st.clock - st.lastUser > a.resumeMs / 1000
            ) {
                step(1, false)
            }
            draw()
            raf = requestAnimationFrame(frame)
        }
        if (!isStatic) raf = requestAnimationFrame(frame)
        else draw()

        return () => {
            disposed = true
            cancelAnimationFrame(raf)
            ro.disconnect()
            redrawRef.current = null
            stepRef.current = null
            root.removeEventListener("wheel", onWheel)
            root.removeEventListener("pointermove", onMove)
            root.removeEventListener("pointerleave", onLeave)
            root.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointermove", onWinMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            builtinTex.forEach((t) => gl.deleteTexture(t))
            cache.forEach((e) => e.tex && gl.deleteTexture(e.tex))
            gl.deleteVertexArray(grid.vao)
            gl.deleteBuffer(grid.vbo)
            gl.deleteBuffer(grid.ibo)
            gl.deleteProgram(prog)
        }
    }, [])

    const grainA = Math.max(0, Math.min(100, adv.grain)) / 100
    const vigA = Math.max(0, Math.min(100, adv.vignette)) / 100

    const btnStyle: React.CSSProperties = {
        width: 44,
        height: 44,
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
        <svg width={18} height={18} viewBox="0 0 16 16" fill="none">
            <path
                d={dir < 0 ? "M10 3 L5 8 L10 13" : "M6 3 L11 8 L6 13"}
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )

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
                touchAction: "pan-y",
                isolation: "isolate",
                cursor: "grab",
                userSelect: "none",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
            />
            {vigA > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,${vigA * 0.85}) 100%)`,
                    }}
                />
            )}
            {grainA > 0 && grainUrl && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        backgroundImage: `url(${grainUrl})`,
                        backgroundRepeat: "repeat",
                        opacity: grainA * 0.5,
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
                        gap: 12,
                        zIndex: 2,
                        cursor: "default",
                    }}
                >
                    <button data-arrow="prev" aria-label="Previous poster" style={btnStyle} onClick={() => stepRef.current?.(-1)}>
                        {chevron(-1)}
                    </button>
                    <button data-arrow="next" aria-label="Next poster" style={btnStyle} onClick={() => stepRef.current?.(1)}>
                        {chevron(1)}
                    </button>
                </div>
            )}
        </div>
    )
}

addPropertyControls(CrumplePaperCarousel, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Colour behind the posters.",
    },
    images: {
        defaultValue: DEFAULT_IMAGES,
        type: ControlType.Array,
        title: "Images",
        control: { type: ControlType.ResponsiveImage },
        maxCount: 26,
        description: "Poster artwork. Empty draws the built-in posters; one image goes on every poster, several go round in turn.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 22,
        description: "How fast each step slides and how often it advances. 0 stops the auto-advance.",
    },
    crumple: {
        type: ControlType.Number,
        title: "Crumple",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 70,
        description: "How crumpled the posters away from the centre get. 0 leaves them flat, 70 is a full paper ball, above 70 adds deeper creases.",
    },
    scale: {
        type: ControlType.Number,
        title: "Scale",
        min: 30,
        max: 200,
        step: 1,
        unit: "%",
        defaultValue: 100,
        description: "Overall size of the posters.",
    },
    itemWidth: {
        type: ControlType.Number,
        title: "Width",
        min: 160,
        max: 900,
        step: 1,
        unit: "px",
        defaultValue: 294,
        description: "Width of a flat poster at 1200×800.",
    },
    itemHeight: {
        type: ControlType.Number,
        title: "Height",
        min: 200,
        max: 1000,
        step: 1,
        unit: "px",
        defaultValue: 344,
        description: "Height of a flat poster at 1200×800.",
    },
    spacing: {
        type: ControlType.Number,
        title: "Spacing",
        min: 10,
        max: 60,
        step: 1,
        unit: "%",
        defaultValue: 30,
        description: "Distance between poster centres, as a % of the width.",
    },
    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: true,
        description: "Step on its own when nobody scrolls or swipes.",
    },
    arrows: {
        type: ControlType.Boolean,
        title: "Arrows",
        defaultValue: false,
        description: "Show previous / next buttons at the bottom. Swiping and scrolling always work.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Pointer response: tilt, uncrumple near the pointer, squeeze on press." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            stepMs: { type: ControlType.Number, title: "Step Time", min: 100, max: 4000, step: 10, unit: "ms", defaultValue: 1270, description: "Duration of one slide." },
            restMs: { type: ControlType.Number, title: "Rest", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 250, description: "Pause between auto steps." },
            resumeMs: { type: ControlType.Number, title: "Resume After", min: 0, max: 10000, step: 100, unit: "ms", defaultValue: 2500, description: "Idle time before autoplay resumes after input." },
            easeX1: { type: ControlType.Number, title: "Ease X1", min: 0, max: 100, step: 1, defaultValue: 23, description: "Bezier x1 ×100." },
            easeY1: { type: ControlType.Number, title: "Ease Y1", min: -50, max: 150, step: 1, defaultValue: 8, description: "Bezier y1 ×100." },
            easeX2: { type: ControlType.Number, title: "Ease X2", min: 0, max: 100, step: 1, defaultValue: 28, description: "Bezier x2 ×100." },
            easeY2: { type: ControlType.Number, title: "Ease Y2", min: -50, max: 150, step: 1, defaultValue: 85, description: "Bezier y2 ×100." },
            flatZone: { type: ControlType.Number, title: "Flat Zone", min: 0, max: 90, step: 1, unit: "%", defaultValue: 20, description: "Slot fraction around the centre that stays flat." },
            ballSize: { type: ControlType.Number, title: "Ball Size", min: 20, max: 100, step: 1, unit: "%", defaultValue: 75, description: "Ball height next to the centre, % of a sheet." },
            edgeBallSize: { type: ControlType.Number, title: "Edge Ball", min: 10, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Ball height two slots out." },
            foldWrap: { type: ControlType.Number, title: "Fold Wrap", min: 30, max: 200, step: 1, unit: "°", defaultValue: 140, description: "How far the sheet wraps around the ball." },
            creaseDepth: { type: ControlType.Number, title: "Creases", min: 0, max: 50, step: 1, unit: "%", defaultValue: 15, description: "Depth of fold ridges." },
            facetJitter: { type: ControlType.Number, title: "Facets", min: 0, max: 30, step: 1, unit: "%", defaultValue: 7, description: "Random facet displacement." },
            foldScale: { type: ControlType.Number, title: "Fold Scale", min: 1, max: 10, step: 1, defaultValue: 3, description: "Fold noise frequency." },
            gridX: { type: ControlType.Number, title: "Grid X", min: 2, max: 40, step: 1, defaultValue: 12, description: "Mesh columns (facet size)." },
            gridY: { type: ControlType.Number, title: "Grid Y", min: 2, max: 40, step: 1, defaultValue: 16, description: "Mesh rows (facet size)." },
            tiltRange: { type: ControlType.Number, title: "Tilt", min: 0, max: 30, step: 1, unit: "°", defaultValue: 8, description: "Resting tilt of the flat sheets." },
            tumble: { type: ControlType.Number, title: "Tumble", min: 0, max: 45, step: 1, unit: "°", defaultValue: 10, description: "Extra spin while crumpled." },
            depthStep: { type: ControlType.Number, title: "Depth Step", min: 0, max: 1500, step: 10, unit: "px", defaultValue: 450, description: "How far back each slot sits." },
            perspective: { type: ControlType.Number, title: "Perspective", min: 400, max: 8000, step: 50, unit: "px", defaultValue: 2400, description: "Camera distance." },
            lightAngle: { type: ControlType.Number, title: "Light Angle", min: 0, max: 360, step: 1, unit: "°", defaultValue: 135, description: "Light direction (135 = upper left)." },
            ambient: { type: ControlType.Number, title: "Ambient", min: 0, max: 100, step: 1, unit: "%", defaultValue: 35, description: "Light in the shadow facets." },
            shadeContrast: { type: ControlType.Number, title: "Shading", min: 0, max: 200, step: 1, unit: "%", defaultValue: 100, description: "Facet shading strength." },
            highlight: { type: ControlType.Number, title: "Highlight", min: 0, max: 200, step: 1, unit: "%", defaultValue: 60, description: "Brightening on lit facets." },
            paperColor: { type: ControlType.Color, title: "Paper", defaultValue: "#E9E8E8", description: "Back of the paper and behind uploads." },
            seed: { type: ControlType.Number, title: "Seed", min: 0, max: 100, step: 1, defaultValue: 7, description: "Fold pattern variation." },
            wheelThreshold: { type: ControlType.Number, title: "Wheel Step", min: 5, max: 400, step: 1, unit: "px", defaultValue: 40, description: "Scroll distance for one step." },
            dragThreshold: { type: ControlType.Number, title: "Drag Step", min: 10, max: 400, step: 1, unit: "px", defaultValue: 60, description: "Swipe distance for one step." },
            offsetY: { type: ControlType.Number, title: "Offset Y", min: -300, max: 300, step: 1, unit: "px", defaultValue: 0, description: "Vertical shift of the row." },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain overlay." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening." },
        },
    },
})

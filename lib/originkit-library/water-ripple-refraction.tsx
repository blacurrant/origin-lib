import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    grain: 41,
    vignette: 0,
    periodMs: 2000,
    spacing: 227,
    band: 25,
    shift: 154,
    glow: 0,
    rimWidth: 1,
    rimColor: "#D1D1D1",
    shadowWidth: 0,
    shadowAmount: 18,
    tintAmount: 22,
    tintColor: "#CCC7DB",
    fade: 100,
    centerX: 50,
    centerY: 84,
}

// Ring phase at t = 0: rims at 1.25 / 2.25 / 3.25 spacings from the centre, as in the reference.
const TIME0 = 0.25
const DESIGN_H = 768
const PAINT_W = 1440
const PAINT_H = 900

const VERT = `#version 300 es
void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform sampler2D uImg;
uniform float uImgAspect;
uniform vec2 uCenter;
uniform float uSpacing;
uniform float uTime;
uniform float uBand;
uniform float uShift;
uniform float uGlow;
uniform float uRimW;
uniform float uRimA;
uniform vec3 uRimColor;
uniform float uShadowW;
uniform float uShadowA;
uniform float uTintA;
uniform vec3 uTint;
uniform float uFade;
uniform float uMaxR;
out vec4 outColor;

vec3 img(vec2 p) {
    vec2 uv = p / max(uRes, vec2(1.0));
    float c = uRes.x / max(uRes.y, 1.0);
    float a = max(uImgAspect, 1e-3);
    if (c > a) uv.y = (uv.y - 0.5) * (a / c) + 0.5;
    else uv.x = (uv.x - 0.5) * (c / a) + 0.5;
    return texture(uImg, clamp(uv, 0.001, 0.999)).rgb;
}

// Concentric water rings flowing out of the centre: each ring is a rounded swell whose slope
// bends the picture, with a soft light on its inner shoulder and a soft shade on its outer one.
void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 d = p - uCenter;
    float r = length(d);
    vec2 dir = d / max(r, 1e-4);
    float s = max(uSpacing, 1.0);
    float ph = fract(r / s - uTime);
    float band = clamp(uBand, 0.05, 1.0);
    float q = clamp((ph - (1.0 - band)) / band, 0.0, 1.0);
    float life = smoothstep(s * 0.25, s * 0.9, r) * (1.0 - uFade * clamp(r / max(uMaxR, 1.0), 0.0, 1.0));
    // Rounded swell: height rises and falls smoothly to zero at both ends of the band.
    float h = 0.5 - 0.5 * cos(6.2831853 * q);
    float slope = sin(6.2831853 * q);
    float env = sin(3.14159265 * q);
    vec3 col = img(p - dir * uShift * slope * life);

    float L = 0.4 + 0.6 * max(0.0, dot(dir, normalize(vec2(-0.35, -0.94))));
    col = mix(col, vec3(1.0), clamp(uGlow * h * life * (0.5 + 0.5 * L), 0.0, 1.0));
    col = mix(col, uTint, clamp(uTintA * h * life * max(0.0, -dir.x), 0.0, 1.0));

    float ws = 0.08 + 0.02 * max(uShadowW / uDpr, 0.0);
    float shQ = (q - 0.75) / ws;
    float sh = exp(-shQ * shQ) * env * uShadowA * life;
    col *= 1.0 - clamp(sh, 0.0, 1.0);
    float wr = 0.06 + 0.03 * max(uRimW / uDpr, 0.0);
    float rimQ = (q - 0.3) / wr;
    float rimMask = exp(-rimQ * rimQ) * env * uRimA * L * life;
    col = mix(col, uRimColor, clamp(rimMask, 0.0, 1.0));
    outColor = vec4(col, 1.0);
}`

const UNIFORMS = [
    "uRes", "uDpr", "uImg", "uImgAspect", "uCenter", "uSpacing", "uTime", "uBand", "uShift", "uGlow",
    "uRimW", "uRimA", "uRimColor", "uShadowW", "uShadowA", "uTintA", "uTint", "uFade", "uMaxR",
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

function rgb01(c: any): [number, number, number] {
    if (typeof c !== "string") return [1, 1, 1]
    const s = c.trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("")
        const n = parseInt(h.slice(0, 6), 16)
        if (isNaN(n)) return [1, 1, 1]
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    }
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (m) {
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat)
        return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255]
    }
    return [1, 1, 1]
}

/** Built-in stand-in for the reference's impressionist landscape, framed for the full-width stage. */
function makePainting(): HTMLCanvasElement {
    const W = PAINT_W
    const H = PAINT_H
    const c = document.createElement("canvas")
    c.width = W
    c.height = H
    const g = c.getContext("2d")
    if (!g) return c
    const r = rng(7)
    const pick = (a: string[]) => a[Math.floor(r() * a.length)]
    const dab = (x: number, y: number, len: number, th: number, ang: number, col: string, al: number) => {
        g.globalAlpha = al
        g.fillStyle = col
        g.beginPath()
        g.ellipse(x, y, Math.max(1, len / 2), Math.max(1, th / 2), ang, 0, Math.PI * 2)
        g.fill()
    }
    const base = g.createLinearGradient(0, 0, 0, H)
    base.addColorStop(0, "#A9AE98")
    base.addColorStop(0.08, "#C2BFA2")
    base.addColorStop(0.35, "#B9B596")
    base.addColorStop(0.5, "#8F8A86")
    base.addColorStop(0.62, "#7F8A55")
    base.addColorStop(0.85, "#4E6A3A")
    base.addColorStop(1, "#3A6532")
    g.fillStyle = base
    g.fillRect(0, 0, W, H)

    // Sky: long horizontal khaki strokes, greener at the very top.
    for (let i = 0; i < 1800; i++) {
        const y = r() * H * 0.44
        dab(r() * W, y, 30 + r() * 70, 5 + r() * 8, (r() - 0.5) * 0.25,
            y < H * 0.06 ? pick(["#A9AE98", "#B3B49C", "#9FA690"]) : pick(["#C8C4A8", "#BDB99A", "#B0AF92", "#D2CDB2", "#C4BE9C", "#ABA98C"]), 0.4)
    }
    // Distant purple-grey hills.
    const hillTop = (x: number) => H * (0.37 + 0.02 * Math.sin((x / W) * 7) + 0.015 * Math.sin((x / W) * 19))
    for (let i = 0; i < 1300; i++) {
        const x = r() * W * 0.7
        const y0 = hillTop(x)
        dab(x, y0 + r() * (H * 0.6 - y0), 16 + r() * 36, 5 + r() * 8, (r() - 0.5) * 0.5,
            pick(["#8E8590", "#7E7682", "#9C93A0", "#A89AA6", "#857D86", "#968C94"]), 0.55)
    }
    // Pink buildings on the hillside.
    for (let i = 0; i < 5; i++) {
        const x = W * (0.17 + r() * 0.22)
        const y = H * (0.352 + r() * 0.04)
        const w = 18 + r() * 26
        const h = 12 + r() * 16
        g.globalAlpha = 0.9
        g.fillStyle = pick(["#C49A8E", "#B5857A", "#D0A898"])
        g.fillRect(x, y, w, h)
        for (let j = 0; j < 5; j++) dab(x + r() * w, y + r() * h, 8 + r() * 12, 3 + r() * 4, 0, pick(["#C99A8A", "#E0B4A4", "#A87466"]), 0.6)
    }
    // Yellow-green foliage, lower left.
    for (let i = 0; i < 2600; i++) {
        const y = H * (0.5 + r() * 0.38)
        const x = r() * W * (0.42 + 0.12 * ((y / H - 0.5) / 0.38))
        dab(x, y, 10 + r() * 22, 6 + r() * 10, r() * Math.PI,
            pick(["#B8A93A", "#A4A13A", "#C9B850", "#8C8B3E", "#6B7A3A", "#D2C25A"]), 0.75)
    }
    for (let i = 0; i < 400; i++) {
        dab(r() * W * 0.45, H * (0.52 + r() * 0.36), 8 + r() * 14, 5 + r() * 8, r() * Math.PI, pick(["#4E5E34", "#3A4A2A", "#5C6E3C"]), 0.7)
    }
    // Dark tree on the right, widening downwards.
    const edge = (v: number) =>
        v < 0.08 ? 2
            : v < 0.2 ? 0.92 - ((v - 0.08) / 0.12) * 0.3
                : v < 0.32 ? 0.62 - ((v - 0.2) / 0.12) * 0.12
                    : v < 0.7 ? 0.5 + 0.03 * Math.sin(v * 40)
                        : 0.5 + ((v - 0.7) / 0.08) * 0.2
    for (let i = 0; i < 5200; i++) {
        const x = W * (0.4 + r() * 0.6)
        const y = H * (0.07 + r() * 0.73)
        if (x / W + (r() - 0.5) * 0.06 < edge(y / H)) continue
        dab(x, y, 10 + r() * 26, 6 + r() * 12, r() * Math.PI,
            r() < 0.1 ? pick(["#4F6248", "#5C6E4E"]) : pick(["#16201F", "#1E2A26", "#253430", "#2C3A2E", "#1A2622", "#344036"]), 0.82)
    }
    // Red-brown trunk at the centre.
    for (let i = 0; i < 300; i++) {
        const u = r()
        dab(W * (0.52 - 0.03 * u) + (r() - 0.5) * W * 0.04, H * (0.48 + 0.44 * u), 22 + r() * 16, 7 + r() * 7, 1.5 + (r() - 0.5) * 0.3,
            pick(["#8A5A44", "#7A4A3A", "#9A6A50", "#6E4434"]), 0.8)
    }
    // Greens under the tree and along the bottom.
    for (let i = 0; i < 1200; i++) {
        dab(W * (0.45 + r() * 0.55), H * (0.7 + r() * 0.2), 12 + r() * 24, 6 + r() * 10, r() * Math.PI,
            pick(["#3E5E3A", "#4A6A40", "#355432", "#5A7A44", "#2E4A2C"]), 0.78)
    }
    for (let i = 0; i < 900; i++) {
        dab(r() * W, H * (0.86 + r() * 0.14), 14 + r() * 26, 6 + r() * 10, (r() - 0.5) * 0.8,
            pick(["#3B6B35", "#2E5A2C", "#4A7A3C", "#2A4A26", "#5E8A40"]), 0.8)
    }
    // The small dark bird at the top right.
    for (let i = 0; i < 40; i++) dab(W * (0.93 + (r() - 0.5) * 0.05), H * (0.112 + (r() - 0.5) * 0.012), 5 + r() * 8, 2 + r() * 4, r() * Math.PI, "#16201F", 0.85)
    // Canvas weave.
    for (let i = 0; i < 5000; i++) dab(r() * W, r() * H, 6 + r() * 12, 2 + r() * 3, r() * Math.PI, r() < 0.5 ? "#FFFFFF" : "#000000", 0.05)
    g.globalAlpha = 1
    return c
}

function makeNoise(): string {
    if (typeof document === "undefined") return ""
    const c = document.createElement("canvas")
    c.width = 160
    c.height = 160
    const g = c.getContext("2d")
    if (!g) return ""
    const d = g.createImageData(160, 160)
    const r = rng(3)
    for (let i = 0; i < d.data.length; i += 4) {
        const v = Math.floor(r() * 255)
        d.data[i] = v
        d.data[i + 1] = v
        d.data[i + 2] = v
        d.data[i + 3] = 255
    }
    g.putImageData(d, 0, 0)
    return c.toDataURL()
}

/**
 * Water Ripple Refraction
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function WaterRippleRefraction(props: any) {
    const {
        background = "#000000",
        image = {"src":"https://images.unsplash.com/photo-1792187790722-66db7d13a53f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},
        speed = 35,
        scale = 76,
        strength = 5,
        rim = 32,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const propsRef = React.useRef(props)
    propsRef.current = props
    const cardRef = React.useRef<HTMLDivElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const shared = React.useRef<any>({ userImg: null, userDirty: false, hasUser: false, userAspect: 1, fallback: false, src: "" })
    const noise = React.useMemo(() => makeNoise(), [])

    const imgSrc: string = typeof image === "string" ? image : image?.src ?? ""

    React.useEffect(() => {
        const S = shared.current
        S.src = imgSrc
        S.hasUser = false
        S.userImg = null
        S.userDirty = true
        if (!imgSrc) return
        let dead = false
        const im = new Image()
        im.crossOrigin = "anonymous"
        im.onload = () => {
            if (dead) return
            S.userImg = im
            S.userDirty = true
        }
        im.src = imgSrc
        return () => {
            dead = true
        }
    }, [imgSrc])

    React.useEffect(() => {
        const canvas = canvasRef.current
        const card = cardRef.current
        if (!canvas || !card) return
        const S = shared.current
        const painting = makePainting()
        let gl: WebGL2RenderingContext | null = null
        let prog: WebGLProgram | null = null
        let vao: WebGLVertexArrayObject | null = null
        let texB: WebGLTexture | null = null
        let texU: WebGLTexture | null = null
        const U: Record<string, WebGLUniformLocation> = {}

        const upload = (tex: WebGLTexture, src: TexImageSource) => {
            if (!gl) return
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        }

        const goFallback = () => {
            S.fallback = true
            canvas.style.visibility = "hidden"
            card.style.backgroundImage = `url(${S.userImg ? S.src : painting.toDataURL()})`
            card.style.backgroundSize = "cover"
            card.style.backgroundPosition = "center"
        }

        try {
            gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, alpha: false })
            if (!gl) throw new Error("no webgl2")
            const compile = (type: number, src: string) => {
                const s = gl!.createShader(type)!
                gl!.shaderSource(s, src)
                gl!.compileShader(s)
                if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
                    const log = gl!.getShaderInfoLog(s)
                    gl!.deleteShader(s)
                    throw new Error(log || "shader")
                }
                return s
            }
            const vs = compile(gl.VERTEX_SHADER, VERT)
            const fs = compile(gl.FRAGMENT_SHADER, FRAG)
            prog = gl.createProgram()!
            gl.attachShader(prog, vs)
            gl.attachShader(prog, fs)
            gl.linkProgram(prog)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link")
            for (const n of UNIFORMS) {
                const loc = gl.getUniformLocation(prog, n)
                if (!loc) throw new Error("uniform " + n)
                U[n] = loc
            }
            vao = gl.createVertexArray()
            texB = gl.createTexture()
            texU = gl.createTexture()
            upload(texB!, painting)
        } catch {
            gl = null
            goFallback()
        }

        let cw = 1
        let ch = 1
        let dpr = 1
        const ro = new ResizeObserver(() => {
            cw = Math.max(1, card.offsetWidth)
            ch = Math.max(1, card.offsetHeight)
            dpr = Math.min(2, window.devicePixelRatio || 1)
            canvas.width = Math.round(cw * dpr)
            canvas.height = Math.round(ch * dpr)
        })
        ro.observe(card)

        const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
        let t = 0
        let last = 0
        let raf = 0

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
            last = now
            const p = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const reduce = !!mq?.matches
            const spd = Math.max(0, Math.min(100, p.speed ?? 50)) / 50
            if (reduce) t = 0.75
            else t += dt * spd

            if (S.userDirty) {
                S.userDirty = false
                if (S.userImg && gl && texU) {
                    try {
                        upload(texU, S.userImg)
                        S.hasUser = true
                        S.userAspect = S.userImg.naturalWidth / Math.max(1, S.userImg.naturalHeight)
                    } catch {
                        S.hasUser = false
                    }
                } else {
                    S.hasUser = false
                }
                if (S.fallback) card.style.backgroundImage = `url(${S.userImg ? S.src : painting.toDataURL()})`
            }

            if (!gl || !prog) return
            const k = (ch / DESIGN_H) * (Math.max(20, Math.min(200, p.scale ?? 100)) / 100)
            const cx = (cw * a.centerX) / 100
            const cy = (ch * a.centerY) / 100
            const spacing = Math.max(4, a.spacing * k)
            const period = Math.max(100, a.periodMs) / 1000
            const waveTime = (((TIME0 + t / period) % 1) + 1) % 1
            const shift = a.shift * k * (Math.max(0, p.strength ?? 50) / 50)
            const maxR = Math.max(Math.hypot(cx, cy), Math.hypot(cw - cx, cy), Math.hypot(cx, ch - cy), Math.hypot(cw - cx, ch - cy))
            const rimC = rgb01(a.rimColor)
            const tintC = rgb01(a.tintColor)

            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.useProgram(prog)
            gl.bindVertexArray(vao)
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, S.hasUser ? texU : texB)
            gl.uniform1i(U.uImg, 0)
            gl.uniform2f(U.uRes, canvas.width, canvas.height)
            gl.uniform1f(U.uDpr, dpr)
            gl.uniform1f(U.uImgAspect, S.hasUser ? S.userAspect : PAINT_W / PAINT_H)
            gl.uniform2f(U.uCenter, cx * dpr, cy * dpr)
            gl.uniform1f(U.uSpacing, spacing * dpr)
            gl.uniform1f(U.uTime, waveTime)
            gl.uniform1f(U.uBand, Math.max(5, a.band) / 100)
            gl.uniform1f(U.uShift, shift * dpr)
            gl.uniform1f(U.uGlow, Math.max(0, a.glow) / 100)
            gl.uniform1f(U.uRimW, Math.max(0.5, a.rimWidth * k) * dpr)
            gl.uniform1f(U.uRimA, Math.max(0, Math.min(100, p.rim ?? 60)) / 100)
            gl.uniform3f(U.uRimColor, rimC[0], rimC[1], rimC[2])
            gl.uniform1f(U.uShadowW, a.shadowWidth * k * dpr)
            gl.uniform1f(U.uShadowA, a.shadowAmount / 100)
            gl.uniform1f(U.uTintA, a.tintAmount / 100)
            gl.uniform3f(U.uTint, tintC[0], tintC[1], tintC[2])
            gl.uniform1f(U.uFade, Math.max(0, Math.min(100, a.fade)) / 100)
            gl.uniform1f(U.uMaxR, maxR * dpr)
            gl.drawArrays(gl.TRIANGLES, 0, 3)
        }
        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            if (gl) {
                if (texB) gl.deleteTexture(texB)
                if (texU) gl.deleteTexture(texU)
                if (vao) gl.deleteVertexArray(vao)
                if (prog) gl.deleteProgram(prog)
            }
        }
    }, [])

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 1200,
                minHeight: 800,
                ...style,
                background,
                overflow: "hidden",
                isolation: "isolate",
            }}
        >
            <div
                ref={cardRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    background: "#2B3A2E",
                    isolation: "isolate",
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none" }}
                />
                {adv.vignette > 0 && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${(Math.min(100, adv.vignette) / 100) * 0.7}) 100%)`,
                        }}
                    />
                )}
                {adv.grain > 0 && noise && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            backgroundImage: `url(${noise})`,
                            backgroundSize: "160px 160px",
                            opacity: (Math.min(100, adv.grain) / 100) * 0.35,
                            mixBlendMode: "overlay",
                        }}
                    />
                )}
            </div>
        </div>
    )
}

addPropertyControls(WaterRippleRefraction, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    image: {
        defaultValue: {"src":"https://images.unsplash.com/photo-1792187790722-66db7d13a53f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""}, type: ControlType.ResponsiveImage, title: "Image" },
    speed: { type: ControlType.Number, title: "Speed", min: 0, max: 100, step: 1, defaultValue: 35 },
    scale: { type: ControlType.Number, title: "Scale", min: 20, max: 125, step: 1, unit: "%", defaultValue: 76 },
    strength: { type: ControlType.Number, title: "Refraction", min: 0, max: 100, step: 1, defaultValue: 5 },
    rim: { type: ControlType.Number, title: "Rim", min: 0, max: 100, step: 1, unit: "%", defaultValue: 32 },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 41 },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0 },
            periodMs: { type: ControlType.Number, title: "Ring Period", min: 300, max: 8000, step: 10, unit: "ms", defaultValue: 2000 },
            spacing: { type: ControlType.Number, title: "Spacing", min: 30, max: 400, step: 1, defaultValue: 227 },
            band: { type: ControlType.Number, title: "Band", min: 5, max: 100, step: 1, unit: "%", defaultValue: 25 },
            shift: { type: ControlType.Number, title: "Shift", min: 0, max: 200, step: 1, defaultValue: 154 },
            glow: { type: ControlType.Number, title: "Glass Glow", min: 0, max: 60, step: 1, unit: "%", defaultValue: 0 },
            rimWidth: { type: ControlType.Number, title: "Rim Width", min: 1, max: 10, step: 1, defaultValue: 1 },
            rimColor: { type: ControlType.Color, title: "Rim Color", defaultValue: "#D1D1D1" },
            shadowWidth: { type: ControlType.Number, title: "Shadow Width", min: 0, max: 30, step: 1, defaultValue: 0 },
            shadowAmount: { type: ControlType.Number, title: "Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 18 },
            tintAmount: { type: ControlType.Number, title: "Tint", min: 0, max: 100, step: 1, unit: "%", defaultValue: 22 },
            tintColor: { type: ControlType.Color, title: "Tint Color", defaultValue: "#CCC7DB" },
            fade: { type: ControlType.Number, title: "Fade", min: 0, max: 100, step: 1, unit: "%", defaultValue: 100 },
            centerX: { type: ControlType.Number, title: "Center X", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50 },
            centerY: { type: ControlType.Number, title: "Center Y", min: 0, max: 100, step: 1, unit: "%", defaultValue: 84 },
        },
    },
})

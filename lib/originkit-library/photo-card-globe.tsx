import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

const DEFAULT_IMAGES = [{"src":"https://images.unsplash.com/photo-1791965558115-58fb666a7850?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792187790722-66db7d13a53f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792592108795-076164280be6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792614268370-d7a7046adbcf?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792676818211-6ab6ccfd86c4?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},{"src":"https://images.unsplash.com/photo-1792964785281-0397544a4245?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""}]

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    spinRate: 16,
    startAngle: 0,
    tilt: 6,
    distance: 32,
    offsetX: 0,
    offsetY: 0,
    cardSize: 100,
    cardMin: 27,
    cardMax: 43,
    jitter: 15,
    roll: 4,
    seed: 7,
    cardBrightness: 100,
    groundColor: "#F4F4F3",
    imagePad: 8,
    sideColor: "#625A56",
    extrude: 4,
    condense: 80,
    textOffset: 0,
    textOpacity: 100,
    dragStrength: 50,
    damping: 50,
    hoverTilt: 12,
    hoverEase: 40,
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

const DEG = Math.PI / 180
const ATLAS = 2048
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

const GRAIN_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.4 -0.2'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
)}")`

// ── colour + random helpers ──
function rgbOf(s: any): [number, number, number] {
    const v = String(s || "").trim()
    if (v[0] === "#") {
        let h = v.slice(1)
        if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("")
        const n = parseInt(h.slice(0, 6), 16)
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const m = v.match(/rgba?\(([^)]+)\)/)
    if (m) {
        const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat)
        return [p[0] || 0, p[1] || 0, p[2] || 0]
    }
    return [168, 168, 169]
}
function mixColor(a: any, b: any, t: number) {
    const A = rgbOf(a), B = rgbOf(b)
    return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`
}
function rng(seed: number) {
    let s = seed >>> 0 || 1
    return () => {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

// ── built-in product stills ──
type C2 = CanvasRenderingContext2D
function lg(c: C2, x0: number, y0: number, x1: number, y1: number, s: [number, string][]) {
    const g = c.createLinearGradient(x0, y0, x1, y1)
    for (const [o, v] of s) g.addColorStop(o, v)
    return g
}
function rg(c: C2, x: number, y: number, r0: number, r1: number, s: [number, string][]) {
    const g = c.createRadialGradient(x, y, r0, x, y, r1)
    for (const [o, v] of s) g.addColorStop(o, v)
    return g
}
function rr(c: C2, x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2)
    c.beginPath()
    c.moveTo(x + r, y)
    c.arcTo(x + w, y, x + w, y + h, r)
    c.arcTo(x + w, y + h, x, y + h, r)
    c.arcTo(x, y + h, x, y, r)
    c.arcTo(x, y, x + w, y, r)
    c.closePath()
}
function el(c: C2, x: number, y: number, rx: number, ry: number, rot = 0) {
    c.beginPath()
    c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2)
}
function shadow(c: C2, x: number, y: number, rx: number, ry: number) {
    c.fillStyle = "rgba(0,0,0,0.10)"
    el(c, x, y, rx, ry)
    c.fill()
}
const metal = (c: C2, x0: number, x1: number) =>
    lg(c, x0, 0, x1, 0, [[0, "#B9B9B9"], [0.45, "#FAFAFA"], [1, "#A9A9A9"]])

type Art = { a: number; g: string; d: (c: C2, w: number, h: number) => void }
const ARTS: Art[] = [
    { a: 0.8, g: "#F4F4F3", d: (c, w, h) => {
        const bw = w * 0.44, x = (w - bw) / 2, y = h * 0.2, bh = h * 0.48
        shadow(c, w / 2, y + bh + h * 0.1, bw * 0.62, h * 0.025)
        c.fillStyle = lg(c, x, 0, x + bw, 0, [[0, "#DCDCDA"], [0.35, "#FFFFFF"], [1, "#D2D2D0"]])
        rr(c, x, y, bw, bh, bw * 0.28); c.fill()
        c.fillStyle = lg(c, x, 0, x + bw, 0, [[0, "#BDB8B2"], [0.4, "#E3DFDA"], [1, "#B5AFA6"]])
        rr(c, x + bw * 0.02, y + bh - 2, bw * 0.96, h * 0.09, 4); c.fill()
    } },
    { a: 0.9, g: "#DCDAD9", d: (c, w, h) => {
        const pw = w * 0.36, ph = h * 0.58, x = (w - pw) / 2, y = h * 0.18
        shadow(c, w / 2, y + ph + h * 0.04, pw * 0.6, h * 0.03)
        c.fillStyle = lg(c, x, y, x + pw, y + ph, [[0, "#F2C0AE"], [0.5, "#D0907C"], [1, "#A9604F"]])
        rr(c, x, y, pw, ph, pw / 2); c.fill()
        c.strokeStyle = "#8C4E40"; c.lineWidth = w * 0.014
        el(c, w / 2, y + ph * 0.32, pw * 0.22, pw * 0.22); c.stroke()
        c.fillStyle = "#7A4034"; el(c, w / 2, y + ph * 0.32, pw * 0.07, pw * 0.07); c.fill()
    } },
    { a: 0.78, g: "#978C84", d: (c, w, h) => {
        c.fillStyle = lg(c, 0, 0, w, h, [[0, "#B0A69D"], [1, "#847970"]]); c.fillRect(0, 0, w, h)
        let x = w * 0.28
        c.fillStyle = metal(c, x - w * 0.05, x + w * 0.05)
        rr(c, x - w * 0.045, h * 0.12, w * 0.09, h * 0.36, w * 0.04); c.fill()
        rr(c, x - w * 0.03, h * 0.46, w * 0.06, h * 0.42, w * 0.03); c.fill()
        x = w * 0.5
        c.fillStyle = metal(c, x - w * 0.06, x + w * 0.06)
        for (let k = 0; k < 4; k++) c.fillRect(x - w * 0.05 + k * w * 0.028, h * 0.12, w * 0.016, h * 0.16)
        rr(c, x - w * 0.055, h * 0.26, w * 0.11, h * 0.08, w * 0.03); c.fill()
        rr(c, x - w * 0.025, h * 0.32, w * 0.05, h * 0.56, w * 0.025); c.fill()
        x = w * 0.72
        c.fillStyle = metal(c, x - w * 0.09, x + w * 0.09)
        el(c, x, h * 0.24, w * 0.085, h * 0.12); c.fill()
        rr(c, x - w * 0.022, h * 0.34, w * 0.044, h * 0.54, w * 0.022); c.fill()
    } },
    { a: 0.85, g: "#F7F7F6", d: (c, w, h) => {
        const r = w * 0.36, cx = w / 2, cy = h * 0.42
        c.fillStyle = lg(c, 0, h * 0.78, 0, h * 0.95, [[0, "#B08A5A"], [1, "#7A5A34"]])
        c.fillRect(w * 0.3, h * 0.8, w * 0.4, h * 0.12)
        c.fillStyle = rg(c, cx, cy, r * 0.1, r, [[0, "#FFD58A"], [0.5, "#F0AE52"], [0.85, "#E3A34F"], [1, "#C47A2C"]])
        el(c, cx, cy, r, r); c.fill()
        c.fillStyle = lg(c, cx - r, cy - r, cx + r, cy + r, [[0, "rgba(255,255,255,0)"], [0.45, "rgba(255,240,200,0.45)"], [0.55, "rgba(255,255,255,0)"]])
        el(c, cx, cy, r, r); c.fill()
        c.strokeStyle = "rgba(160,90,20,0.25)"; c.lineWidth = w * 0.006
        el(c, cx, cy, r * 0.5, r * 0.5); c.stroke(); el(c, cx, cy, r * 0.72, r * 0.72); c.stroke()
        c.fillStyle = "#F2C27A"; el(c, cx, cy, r * 0.24, r * 0.24); c.fill()
        c.fillStyle = "#F7F7F6"; el(c, cx, cy, r * 0.09, r * 0.09); c.fill()
    } },
    { a: 0.8, g: "#FAFAFA", d: (c, w, h) => {
        shadow(c, w * 0.5, h * 0.88, w * 0.3, h * 0.03)
        c.save(); c.translate(w * 0.5, h * 0.5); c.rotate(-0.1)
        const fw = w * 0.66, fh = h * 0.68
        c.fillStyle = "#E3A34F"; c.fillRect(-fw / 2, -fh / 2, fw, fh)
        c.fillStyle = "#CF8A36"; c.fillRect(-fw / 2, -fh / 2, fw, fh * 0.07)
        c.fillStyle = "#FAFAFA"
        for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) { el(c, -fw * 0.32 + k * fw * 0.16, -fh * 0.28 + r * fh * 0.12, fw * 0.025, fw * 0.025); c.fill() }
        c.fillStyle = "#C47E30"
        for (let k = 0; k < 4; k++) c.fillRect(-fw * 0.36, fh * 0.08 + k * fh * 0.08, fw * (0.5 - k * 0.08), fh * 0.02)
        c.restore()
    } },
    { a: 0.85, g: "#6E6E6E", d: (c, w, h) => {
        c.fillStyle = lg(c, 0, 0, 0, h, [[0, "#8C8C8C"], [1, "#4A4A4A"]]); c.fillRect(0, 0, w, h)
        const x0 = w * 0.3, cw = w * 0.4, top = h * 0.3, bot = h * 0.76
        c.fillStyle = "rgba(0,0,0,0.25)"; el(c, w / 2, bot + h * 0.03, cw * 0.6, h * 0.04); c.fill()
        c.fillStyle = lg(c, x0, 0, x0 + cw, 0, [[0, "#8A8A8A"], [0.3, "#F4F4F4"], [0.55, "#A4A4A4"], [0.8, "#E2E2E2"], [1, "#7A7A7A"]])
        c.fillRect(x0, top, cw, bot - top); el(c, w / 2, bot, cw / 2, h * 0.05); c.fill()
        c.beginPath()
        for (let k = 0; k < 10; k++) { const x = x0 + (cw * k) / 10; c.moveTo(x, top); c.lineTo(x + cw / 20, top - h * 0.045); c.lineTo(x + cw / 10, top) }
        c.fillStyle = "#D0D0D0"; c.fill()
        c.fillStyle = "#2B2B2B"; el(c, w / 2, top, cw / 2, h * 0.05); c.fill()
        c.strokeStyle = "#DCDCDC"; c.lineWidth = w * 0.01; c.stroke()
    } },
    { a: 1.45, g: "#F4F4F3", d: (c, w, h) => {
        c.strokeStyle = "#241F1F"; c.lineWidth = h * 0.07; c.lineCap = "round"
        c.beginPath(); c.arc(w * 0.5, h * 0.72, w * 0.27, Math.PI * 1.08, Math.PI * 1.92); c.stroke()
        c.fillStyle = "#050304"
        el(c, w * 0.25, h * 0.66, w * 0.07, h * 0.16, -0.35); c.fill()
        el(c, w * 0.75, h * 0.66, w * 0.07, h * 0.16, 0.35); c.fill()
        c.fillStyle = "#5A5450"; el(c, w * 0.26, h * 0.62, w * 0.025, h * 0.05, -0.35); c.fill()
    } },
    { a: 0.72, g: "#CFCAC4", d: (c, w, h) => {
        c.fillStyle = lg(c, 0, 0, 0, h, [[0, "#DCD7D1"], [0.72, "#BDB6AE"], [0.72, "#9E968D"], [1, "#8A8279"]]); c.fillRect(0, 0, w, h)
        c.fillStyle = "#625A56"; c.fillRect(w * 0.08, h * 0.12, w * 0.1, h * 0.62)
        c.fillStyle = "#8A817C"
        for (let k = 0; k < 4; k++) c.fillRect(w * 0.08, h * (0.2 + k * 0.14), w * 0.1, h * 0.015)
        c.fillStyle = "#D9C6A8"; c.fillRect(w * 0.42, h * 0.28, w * 0.32, h * 0.26)
        c.fillStyle = "#C9B391"; c.fillRect(w * 0.38, h * 0.54, w * 0.4, h * 0.06)
        c.fillStyle = "#8E7A5E"; c.fillRect(w * 0.4, h * 0.6, w * 0.03, h * 0.18); c.fillRect(w * 0.73, h * 0.6, w * 0.03, h * 0.18)
    } },
    { a: 0.85, g: "#F2F0EC", d: (c, w, h) => {
        const cols = ["#22B8D8", "#E0408A", "#F2D02A", "#6CC04A", "#F07A2A", "#7A4CE0"]
        const pts = [[0.35, 0.35, 0.2], [0.62, 0.3, 0.16], [0.5, 0.58, 0.22], [0.28, 0.7, 0.14], [0.72, 0.66, 0.15], [0.55, 0.84, 0.1]]
        pts.forEach(([x, y, r], k) => { c.fillStyle = cols[k]; el(c, w * x, h * y, w * r, w * r * 0.9); c.fill() })
        c.fillStyle = "#1A1A1A"; el(c, w * 0.5, h * 0.5, w * 0.03, w * 0.03); c.fill()
    } },
    { a: 1.2, g: "#2A1E18", d: (c, w, h) => {
        c.fillStyle = lg(c, 0, 0, 0, h, [[0, "#3A2A20"], [1, "#1A120E"]]); c.fillRect(0, 0, w, h)
        c.fillStyle = lg(c, 0, h * 0.12, 0, h * 0.7, [[0, "#FFD58A"], [1, "#E8782A"]]); c.fillRect(w * 0.3, h * 0.12, w * 0.55, h * 0.58)
        c.fillStyle = "#1E140F"; c.fillRect(w * 0.56, h * 0.12, w * 0.025, h * 0.58); c.fillRect(w * 0.3, h * 0.4, w * 0.55, h * 0.02)
        c.fillStyle = rg(c, w * 0.58, h * 0.85, 0, w * 0.4, [[0, "rgba(240,150,60,0.6)"], [1, "rgba(240,150,60,0)"]]); c.fillRect(0, h * 0.7, w, h * 0.3)
    } },
    { a: 1.5, g: "#F4F4F3", d: (c, w, h) => {
        const xs = [0.24, 0.5, 0.76], hs = [0.42, 0.34, 0.38]
        const cs = [["#EADBC2", "#C7B08C"], ["#E8D6BC", "#BFA682"], ["#E9B9A4", "#B87A64"]]
        xs.forEach((x, k) => {
            const cx = w * x, rw = w * 0.1, top = h * (0.8 - hs[k])
            shadow(c, cx, h * 0.8, rw * 1.1, h * 0.03)
            c.fillStyle = lg(c, cx - rw, 0, cx + rw, 0, [[0, cs[k][1]], [0.4, cs[k][0]], [1, cs[k][1]]])
            c.fillRect(cx - rw, top, rw * 2, h * 0.8 - top); el(c, cx, h * 0.8, rw, h * 0.035); c.fill()
            c.fillStyle = cs[k][0]; el(c, cx, top, rw, h * 0.035); c.fill()
        })
    } },
    { a: 0.72, g: "#EDEDEC", d: (c, w, h) => {
        const cx = w / 2
        shadow(c, cx, h * 0.87, w * 0.22, h * 0.03)
        c.beginPath(); c.moveTo(cx - w * 0.08, h * 0.18); c.lineTo(cx + w * 0.08, h * 0.18)
        c.bezierCurveTo(cx + w * 0.08, h * 0.32, cx + w * 0.3, h * 0.42, cx + w * 0.24, h * 0.66)
        c.bezierCurveTo(cx + w * 0.2, h * 0.8, cx + w * 0.14, h * 0.86, cx, h * 0.86)
        c.bezierCurveTo(cx - w * 0.14, h * 0.86, cx - w * 0.2, h * 0.8, cx - w * 0.24, h * 0.66)
        c.bezierCurveTo(cx - w * 0.3, h * 0.42, cx - w * 0.08, h * 0.32, cx - w * 0.08, h * 0.18)
        c.closePath()
        c.fillStyle = lg(c, cx - w * 0.3, 0, cx + w * 0.3, 0, [[0, "#D4D4D2"], [0.4, "#FFFFFF"], [1, "#C8C8C6"]]); c.fill()
    } },
    { a: 1.15, g: "#EFE9E2", d: (c, w, h) => {
        c.fillStyle = lg(c, 0, h * 0.2, w, h, [[0, "#D98C72"], [1, "#A6563F"]])
        c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.38); c.quadraticCurveTo(w * 0.5, h * 0.02, w, h * 0.34); c.lineTo(w, h); c.closePath(); c.fill()
        c.fillStyle = "rgba(255,220,200,0.35)"
        c.beginPath(); c.moveTo(0, h * 0.38); c.quadraticCurveTo(w * 0.5, h * 0.02, w, h * 0.34); c.lineTo(w, h * 0.42); c.quadraticCurveTo(w * 0.5, h * 0.12, 0, h * 0.46); c.closePath(); c.fill()
    } },
    { a: 0.55, g: "#E6E6E6", d: (c, w, h) => {
        c.fillStyle = "#0E0E0E"; c.fillRect(w * 0.14, h * 0.06, w * 0.72, h * 0.88)
        c.fillStyle = "#F2F2F2"; el(c, w * 0.5, h * 0.3, w * 0.14, h * 0.08); c.fill(); el(c, w * 0.5, h * 0.6, w * 0.14, h * 0.1); c.fill()
        c.fillStyle = "#9A9A9A"; c.fillRect(w * 0.47, h * 0.38, w * 0.06, h * 0.12)
    } },
    { a: 1.1, g: "#F6F6F5", d: (c, w, h) => {
        shadow(c, w * 0.5, h * 0.8, w * 0.3, h * 0.05)
        c.fillStyle = rg(c, w * 0.46, h * 0.44, 0, w * 0.38, [[0, "#FFFFFF"], [0.55, "#C4C4C4"], [0.85, "#ECECEC"], [1, "#A8A8A8"]])
        el(c, w * 0.5, h * 0.5, w * 0.36, h * 0.3, -0.2); c.fill()
        c.fillStyle = "#8A8A8A"; el(c, w * 0.5, h * 0.5, w * 0.06, h * 0.05, -0.2); c.fill()
    } },
    { a: 1.0, g: "#FBFBFB", d: (c, w, h) => {
        shadow(c, w * 0.54, h * 0.82, w * 0.3, h * 0.04)
        c.fillStyle = "#0A0A0A"; c.beginPath()
        c.moveTo(w * 0.3, h * 0.2); c.lineTo(w * 0.42, h * 0.2); c.lineTo(w * 0.46, h * 0.55); c.lineTo(w * 0.74, h * 0.55)
        c.lineTo(w * 0.74, h * 0.8); c.lineTo(w * 0.68, h * 0.8); c.lineTo(w * 0.68, h * 0.64); c.lineTo(w * 0.42, h * 0.64)
        c.lineTo(w * 0.4, h * 0.8); c.lineTo(w * 0.34, h * 0.8); c.closePath(); c.fill()
    } },
    { a: 1.3, g: "#EEEEED", d: (c, w, h) => {
        c.fillStyle = lg(c, 0, h * 0.42, 0, h * 0.48, [[0, "#C9C9C9"], [1, "#8E8E8E"]]); c.fillRect(w * 0.12, h * 0.42, w * 0.76, h * 0.06)
        c.fillStyle = metal(c, w * 0.42, w * 0.58); rr(c, w * 0.43, h * 0.48, w * 0.14, h * 0.22, w * 0.03); c.fill()
        shadow(c, w * 0.5, h * 0.74, w * 0.2, h * 0.03)
    } },
    { a: 1.45, g: "#C4C4C4", d: (c, w, h) => {
        c.fillStyle = lg(c, 0, 0, 0, h, [[0, "#D0D0D0"], [1, "#A8A8A8"]]); c.fillRect(0, 0, w, h)
        c.fillStyle = "#7A7A7A"; c.fillRect(w * 0.06, h * 0.15, w * 0.38, h * 0.7)
        c.fillStyle = "#E8E8E8"; c.fillRect(w * 0.1, h * 0.2, w * 0.14, h * 0.3)
        c.fillStyle = "#3A3A3A"; c.fillRect(w * 0.28, h * 0.55, w * 0.12, h * 0.25)
        c.fillStyle = lg(c, w * 0.55, 0, w * 0.95, 0, [[0, "#BDBDBD"], [0.5, "#F4F4F4"], [1, "#A0A0A0"]]); c.fillRect(w * 0.58, h * 0.35, w * 0.3, h * 0.3)
        c.fillStyle = "#E6E6E6"; el(c, w * 0.88, h * 0.5, w * 0.06, h * 0.15); c.fill()
        c.strokeStyle = "#8A8A8A"; c.lineWidth = w * 0.008
        for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(w * (0.58 + k * 0.06), h * 0.35); c.lineTo(w * (0.58 + k * 0.06), h * 0.65); c.stroke() }
    } },
    { a: 0.85, g: "#F7F7F6", d: (c, w, h) => {
        for (const k of [0, 1]) {
            c.save(); c.translate(w * (0.4 + 0.2 * k), h * 0.5); c.rotate(k ? 0.06 : -0.06)
            c.fillStyle = lg(c, -w * 0.03, 0, w * 0.03, 0, [[0, "#C8B48E"], [0.5, "#E8D8B8"], [1, "#BCA27A"]]); c.fillRect(-w * 0.03, -h * 0.36, w * 0.06, h * 0.6)
            c.fillStyle = "#3A3A3A"; c.fillRect(-w * 0.03, h * 0.24, w * 0.06, h * 0.12)
            c.restore()
        }
    } },
    { a: 0.6, g: "#6A6A6A", d: (c, w, h) => {
        c.fillStyle = lg(c, 0, 0, 0, h, [[0, "#7A7A7A"], [1, "#4E4E4E"]]); c.fillRect(0, 0, w, h)
        c.fillStyle = "#111111"; el(c, w * 0.5, h * 0.3, w * 0.16, w * 0.16); c.fill()
        rr(c, w * 0.36, h * 0.42, w * 0.28, h * 0.4, w * 0.06); c.fill()
        c.fillStyle = "rgba(255,255,255,0.7)"; el(c, w * 0.45, h * 0.27, w * 0.04, w * 0.06); c.fill()
    } },
]
const VARIANTS: [number, string][] = [[0, "#CFCAC4"], [2, "#B5AFA6"], [3, "#FFFFFF"], [11, "#DCDAD9"], [4, "#F0EEEA"]]

type Cell = { a: number; uv: number[] }
function buildArtAtlas(cv: HTMLCanvasElement): Cell[] {
    const c = cv.getContext("2d")!
    const C = Math.floor(ATLAS / 5), g = 6
    const list = ARTS.map((art) => ({ art, ground: art.g, flip: false })).concat(
        VARIANTS.map(([i, ground]) => ({ art: ARTS[i], ground, flip: true }))
    )
    return list.map((it, k) => {
        const cx = (k % 5) * C, cy = Math.floor(k / 5) * C
        c.fillStyle = it.ground
        c.fillRect(cx, cy, C, C)
        const m = C - 2 * g
        let w: number, h: number
        if (it.art.a >= 1) { w = m; h = m / it.art.a } else { h = m; w = m * it.art.a }
        const x = cx + (C - w) / 2, y = cy + (C - h) / 2
        c.save()
        c.beginPath(); c.rect(x, y, w, h); c.clip()
        c.translate(x, y)
        if (it.flip) { c.translate(w, 0); c.scale(-1, 1) }
        c.fillStyle = it.ground; c.fillRect(0, 0, w, h)
        it.art.d(c, w, h)
        c.restore()
        return { a: it.art.a, uv: [(x + 1) / ATLAS, (y + 1) / ATLAS, (x + w - 1) / ATLAS, (y + h - 1) / ATLAS] }
    })
}

function fontOf(f: any) {
    let family = f?.fontFamily ? String(f.fontFamily) : `"Helvetica Neue", Helvetica, Arial`
    if (!/sans-serif|serif|monospace/.test(family)) family += ", sans-serif"
    const size = parseFloat(f?.fontSize) || 60
    let ls = 0
    const l = f?.letterSpacing
    if (typeof l === "string") {
        if (l.endsWith("em")) ls = parseFloat(l) || 0
        else if (l.endsWith("px")) ls = (parseFloat(l) || 0) / size
    } else if (typeof l === "number") ls = l / size
    return { family, weight: f?.fontWeight ?? 700, style: f?.fontStyle ?? "normal", size, ls }
}

function paintWord(cv: HTMLCanvasElement, text: string, f: ReturnType<typeof fontOf>, px: number, face: string, side: string, extrude: number, condense: number, dpr: number) {
    const ctx = cv.getContext("2d")!
    const P = px * dpr
    const big = `${f.style} ${f.weight} ${P}px ${f.family}`
    const small = `${f.style} ${f.weight} ${P * 0.42}px ${f.family}`
    const runs: { t: string; s: boolean }[] = []
    for (const ch of text) {
        const s = /[®™©°]/.test(ch)
        const last = runs[runs.length - 1]
        if (last && last.s === s) last.t += ch
        else runs.push({ t: ch, s })
    }
    const setLs = (c: any) => { if ("letterSpacing" in c) c.letterSpacing = `${f.ls * P}px` }
    setLs(ctx)
    const widths = runs.map((r) => { ctx.font = r.s ? small : big; return ctx.measureText(r.t).width })
    ctx.font = big
    const cap = ctx.measureText("H").actualBoundingBoxAscent || P * 0.72
    const k = condense / 100
    const ex = Math.max(0, extrude * dpr * (px / 60))
    const total = widths.reduce((s, w) => s + w, 0) * k
    const pad = Math.ceil(P * 0.2)
    cv.width = Math.max(2, Math.ceil(total + ex + pad * 2))
    cv.height = Math.max(2, Math.ceil(P * 1.3 + ex + pad * 2))
    const base = cv.height / 2 + cap / 2 - ex / 2
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.textBaseline = "alphabetic"
    const drawAll = (dx: number, dy: number, color: string) => {
        ctx.fillStyle = color
        let x = pad
        runs.forEach((r, i) => {
            ctx.font = r.s ? small : big
            setLs(ctx)
            ctx.save()
            ctx.translate(x + dx, (r.s ? base - cap + cap * 0.42 : base) + dy)
            ctx.scale(k, 1)
            ctx.fillText(r.t, 0, 0)
            ctx.restore()
            x += widths[i] * k
        })
    }
    const steps = Math.ceil(ex)
    for (let s = steps; s >= 1; s--) drawAll(s * 0.7, s, mixColor(side, face, 0.35 * (1 - s / steps)))
    drawAll(0, 0, face)
    return { w: cv.width / dpr, h: cv.height / dpr }
}

const toSrcs = (v: any): string[] =>
    (Array.isArray(v) ? v : [])
        .map((x: any) => (typeof x === "string" ? x : x?.src))
        .filter((s: any) => typeof s === "string" && s.length > 0)

const CARD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aCenter;
layout(location=2) in vec3 aRight;
layout(location=3) in vec3 aUp;
layout(location=4) in vec4 aUv;
layout(location=5) in float aWhich;
uniform mat3 uRot;
uniform float uDist;
uniform vec2 uF;
uniform vec2 uOff;
uniform vec2 uNF;
out vec2 vUv;
out float vWhich;
out float vFace;
void main(){
  vec3 local = aCenter + aCorner.x * aRight + aCorner.y * aUp;
  vec3 wp = uRot * local;
  vec3 nc = uRot * aCenter;
  vec3 toCam = vec3(0.0, 0.0, uDist) - nc;
  vFace = dot(nc, toCam);
  vec3 v = wp - vec3(0.0, 0.0, uDist);
  float w = max(-v.z, 1e-4);
  float n = uNF.x, f = uNF.y;
  float zc = (w * (f + n) - 2.0 * f * n) / max(f - n, 1e-4);
  gl_Position = vec4(v.x * uF.x + uOff.x * w, v.y * uF.y + uOff.y * w, zc, w);
  vUv = mix(aUv.xy, aUv.zw, vec2(aCorner.x * 0.5 + 0.5, 0.5 - aCorner.y * 0.5));
  vWhich = aWhich;
}`
const CARD_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vWhich;
in float vFace;
uniform sampler2D uArt;
uniform sampler2D uUp;
uniform float uBright;
out vec4 o;
void main(){
  if (vFace <= 0.0) discard;
  vec3 a = texture(uArt, vUv).rgb;
  vec3 b = texture(uUp, vUv).rgb;
  vec3 c = mix(a, b, step(0.5, vWhich));
  o = vec4(clamp(c * uBright, 0.0, 1.0), 1.0);
}`
const WORD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uZ;
out vec2 vUv;
void main(){
  gl_Position = vec4(uCenter + aCorner * uHalf, uZ, 1.0);
  vUv = vec2(aCorner.x * 0.5 + 0.5, 0.5 - aCorner.y * 0.5);
}`
const WORD_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uAlpha;
out vec4 o;
void main(){ o = texture(uTex, vUv) * uAlpha; }`

/**
 * Photo Card Globe — a sphere of product photo cards turning around a fixed 3D word.
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function PhotoCardGlobe(props: any) {
    props = withMovedControls(props)
    const { background = "#000000", style } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const propsRef = useRef(props)
    propsRef.current = props

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return
        const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true }) as WebGL2RenderingContext | null
        if (!gl) return

        const sh = (type: number, src: string) => {
            const s = gl.createShader(type)!
            gl.shaderSource(s, src)
            gl.compileShader(s)
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader")
            return s
        }
        const mkProg = (vs: string, fs: string) => {
            const p = gl.createProgram()!
            const a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs)
            gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p)
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link")
            gl.deleteShader(a); gl.deleteShader(b)
            return p
        }
        const uni = (p: WebGLProgram, n: string) => {
            const l = gl.getUniformLocation(p, n)
            if (l === null) throw new Error("uniform " + n)
            return l
        }

        const cardProg = mkProg(CARD_VS, CARD_FS)
        const wordProg = mkProg(WORD_VS, WORD_FS)
        const U = {
            rot: uni(cardProg, "uRot"), dist: uni(cardProg, "uDist"), f: uni(cardProg, "uF"),
            off: uni(cardProg, "uOff"), nf: uni(cardProg, "uNF"), art: uni(cardProg, "uArt"),
            up: uni(cardProg, "uUp"), bright: uni(cardProg, "uBright"),
        }
        const W_ = {
            center: uni(wordProg, "uCenter"), half: uni(wordProg, "uHalf"), z: uni(wordProg, "uZ"),
            tex: uni(wordProg, "uTex"), alpha: uni(wordProg, "uAlpha"),
        }

        const quad = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, quad)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const inst = gl.createBuffer()

        const cardVao = gl.createVertexArray()
        gl.bindVertexArray(cardVao)
        gl.bindBuffer(gl.ARRAY_BUFFER, quad)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        gl.bindBuffer(gl.ARRAY_BUFFER, inst)
        const STRIDE = 14 * 4
        const attrs: [number, number, number][] = [[1, 3, 0], [2, 3, 12], [3, 3, 24], [4, 4, 36], [5, 1, 52]]
        for (const [loc, size, off] of attrs) {
            gl.enableVertexAttribArray(loc)
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, off)
            gl.vertexAttribDivisor(loc, 1)
        }
        const wordVao = gl.createVertexArray()
        gl.bindVertexArray(wordVao)
        gl.bindBuffer(gl.ARRAY_BUFFER, quad)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        gl.bindVertexArray(null)

        const aniso: any = gl.getExtension("EXT_texture_filter_anisotropic")
        const mkTex = () => {
            const t = gl.createTexture()!
            gl.bindTexture(gl.TEXTURE_2D, t)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([244, 244, 243, 255]))
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            return t
        }
        const uploadTex = (t: WebGLTexture, src: TexImageSource, mip: boolean) => {
            gl.bindTexture(gl.TEXTURE_2D, t)
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
            if (mip) {
                gl.generateMipmap(gl.TEXTURE_2D)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
                if (aniso) {
                    const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1
                    gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max))
                }
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            }
        }

        const artTex = mkTex(), upTex = mkTex(), wordTex = mkTex()
        const artCv = document.createElement("canvas")
        artCv.width = artCv.height = ATLAS
        const arts = buildArtAtlas(artCv)
        uploadTex(artTex, artCv, true)

        // ── uploads ──
        const cache = new Map<string, { img: HTMLImageElement; ok: boolean }>()
        let upVer = 0
        const upCv = document.createElement("canvas")
        upCv.width = upCv.height = ATLAS
        let upKey = ""
        let ups: (Cell | null)[] = []
        const syncUploads = (srcs: string[], ground: string, padPct: number) => {
            for (const src of srcs) {
                if (cache.has(src)) continue
                const img = new Image()
                img.crossOrigin = "anonymous"
                const entry = { img, ok: false }
                img.onload = () => { entry.ok = true; upVer++ }
                img.onerror = () => { upVer++ }
                img.src = src
                cache.set(src, entry)
            }
            const key = srcs.join("|") + "#" + upVer + ground + padPct
            if (key === upKey) return
            upKey = key
            const c = upCv.getContext("2d")!
            c.clearRect(0, 0, ATLAS, ATLAS)
            const CW = Math.floor(ATLAS / 6), CH = Math.floor(ATLAS / 5), g = 6
            let any = false
            ups = srcs.slice(0, 30).map((src, k) => {
                const e = cache.get(src)
                if (!e || !e.ok) return null
                const iw = e.img.naturalWidth || 512, ih = e.img.naturalHeight || 512
                const ia = iw / ih
                const a = clamp(ia, 0.65, 1.45)
                const cx = (k % 6) * CW, cy = Math.floor(k / 6) * CH
                c.fillStyle = ground
                c.fillRect(cx, cy, CW, CH)
                const mw = CW - 2 * g, mh = CH - 2 * g
                let w = mw, h = w / a
                if (h > mh) { h = mh; w = h * a }
                const x = cx + (CW - w) / 2, y = cy + (CH - h) / 2
                const pad = (padPct / 100) * Math.min(w, h)
                const bw = w - 2 * pad, bh = h - 2 * pad
                // cover: fill the padded box, cropping the longer side of the photo
                const bk = Math.max(bw / iw, bh / ih)
                const sw = bw / bk, sh = bh / bk
                try { c.drawImage(e.img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x + pad, y + pad, bw, bh) } catch { return null }
                any = true
                return { a, uv: [(x + 1) / ATLAS, (y + 1) / ATLAS, (x + w - 1) / ATLAS, (y + h - 1) / ATLAS] }
            })
            if (any) {
                try { uploadTex(upTex, upCv, true) } catch { ups = ups.map(() => null) }
            }
        }

        // ── card layout on a jittered Fibonacci sphere ──
        let layoutKey = ""
        let instCount = 0
        const buildLayout = (N: number, a: typeof ADVANCED_DEFAULTS) => {
            const rnd = rng(Math.round(a.seed))
            const order = arts.map((_, i) => i)
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(rnd() * (i + 1))
                const t = order[i]; order[i] = order[j]; order[j] = t
            }
            const sp = Math.sqrt((4 * Math.PI) / N)
            const sizeK = Math.sqrt(64 / N) * (a.cardSize / 100)
            const data = new Float32Array(N * 14)
            for (let i = 0; i < N; i++) {
                const y0 = 1 - (2 * (i + 0.5)) / N
                const r0 = Math.sqrt(Math.max(0, 1 - y0 * y0))
                const phi = i * GOLDEN
                let nx = r0 * Math.cos(phi), ny = y0, nz = r0 * Math.sin(phi)
                // east = Y × n, north = n × east
                let ex = nz, ey = 0, ez = -nx
                const elen = Math.hypot(ex, ey, ez) || 1
                ex /= elen; ez /= elen
                const qx = ny * ez - nz * ey, qy = nz * ex - nx * ez, qz = nx * ey - ny * ex
                const j = (a.jitter / 100) * sp
                const j1 = (rnd() * 2 - 1) * j, j2 = (rnd() * 2 - 1) * j
                nx += ex * j1 + qx * j2; ny += ey * j1 + qy * j2; nz += ez * j1 + qz * j2
                const nl = Math.hypot(nx, ny, nz) || 1
                nx /= nl; ny /= nl; nz /= nl
                let ux = -nx * ny, uy = 1 - ny * ny, uz = -nz * ny
                let ul = Math.hypot(ux, uy, uz)
                if (ul < 1e-4) { ux = 0; uy = 0; uz = 1; ul = 1 }
                ux /= ul; uy /= ul; uz /= ul
                const rx = uy * nz - uz * ny, ry = uz * nx - ux * nz, rz = ux * ny - uy * nx
                const roll = (rnd() * 2 - 1) * a.roll * DEG
                const cr = Math.cos(roll), sr = Math.sin(roll)
                const Rx = rx * cr + ux * sr, Ry = ry * cr + uy * sr, Rz = rz * cr + uz * sr
                const Ux = ux * cr - rx * sr, Uy = uy * cr - ry * sr, Uz = uz * cr - rz * sr
                const L = ((a.cardMin + (a.cardMax - a.cardMin) * rnd()) / 100) * sizeK
                const up = ups.length ? ups[i % ups.length] : null
                const cell = up || arts[order[i % arts.length]]
                const asp = cell.a
                const w = asp >= 1 ? L : L * asp
                const h = asp >= 1 ? L / asp : L
                const lift = 1 + 0.003 * (i % 4)
                const o = i * 14
                data[o] = nx * lift; data[o + 1] = ny * lift; data[o + 2] = nz * lift
                data[o + 3] = Rx * w / 2; data[o + 4] = Ry * w / 2; data[o + 5] = Rz * w / 2
                data[o + 6] = Ux * h / 2; data[o + 7] = Uy * h / 2; data[o + 8] = Uz * h / 2
                data[o + 9] = cell.uv[0]; data[o + 10] = cell.uv[1]; data[o + 11] = cell.uv[2]; data[o + 12] = cell.uv[3]
                data[o + 13] = up ? 1 : 0
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, inst)
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
            instCount = N
        }

        // ── word texture ──
        const wordCv = document.createElement("canvas")
        let wordKey = ""
        let wordSize = { w: 0, h: 0 }
        let fontsVer = 0
        const fonts: any = (document as any).fonts
        const onFonts = () => { fontsVer++ }
        fonts?.addEventListener?.("loadingdone", onFonts)
        fonts?.ready?.then?.(onFonts)

        // ── motion + pointer state ──
        const isStatic = RenderTarget.current() === RenderTarget.export || RenderTarget.current() === RenderTarget.thumbnail
        const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
        let theta = 0, dragVel = 0, dragging = false, lastX = 0, lastT = 0
        let over = false, hx = 0, hy = 0, curYaw = 0, curPitch = 0
        let currentRpx = 300

        const readAdv = () => ({ ...ADVANCED_DEFAULTS, ...(propsRef.current.advanced ?? {}) })

        const onMove = (e: PointerEvent) => {
            if (e.target !== canvas) return
            const w = canvas.offsetWidth || 1, h = canvas.offsetHeight || 1
            hx = (e.offsetX / w) * 2 - 1
            hy = (e.offsetY / h) * 2 - 1
            over = true
        }
        const onLeave = () => { over = false }
        const onDrag = (e: PointerEvent) => {
            const a = readAdv()
            const now = performance.now()
            const dx = e.clientX - lastX
            lastX = e.clientX
            const dth = (dx / Math.max(50, currentRpx)) * (a.dragStrength / 50) * (a.hover / 50)
            theta += dth
            const dtt = Math.max(0.008, (now - lastT) / 1000)
            lastT = now
            dragVel = clamp(dragVel * 0.6 + (dth / dtt) * 0.4, -6, 6)
        }
        const onUp = () => {
            dragging = false
            window.removeEventListener("pointermove", onDrag)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            if (performance.now() - lastT > 120) dragVel = 0
        }
        const onDown = (e: PointerEvent) => {
            if (readAdv().hover <= 0) return
            dragging = true
            lastX = e.clientX
            lastT = performance.now()
            dragVel = 0
            window.addEventListener("pointermove", onDrag)
            window.addEventListener("pointerup", onUp)
            window.addEventListener("pointercancel", onUp)
        }
        root.addEventListener("pointermove", onMove)
        root.addEventListener("pointerleave", onLeave)
        root.addEventListener("pointerdown", onDown)

        let W = root.offsetWidth, H = root.offsetHeight
        const ro = new ResizeObserver(() => { W = root.offsetWidth; H = root.offsetHeight })
        ro.observe(root)

        gl.useProgram(cardProg)
        gl.uniform1i(U.art, 0)
        gl.uniform1i(U.up, 1)
        gl.useProgram(wordProg)
        gl.uniform1i(W_.tex, 2)

        const render = (dt: number) => {
            const p = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            if (!W || !H) return
            const dpr = Math.min(2, window.devicePixelRatio || 1)
            const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr))
            if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch }

            syncUploads(toSrcs(p.images ?? DEFAULT_IMAGES), a.groundColor, a.imagePad)
            const N = clamp(Math.round(p.count ?? 72), 4, 200)
            const lk = [N, a.seed, a.cardSize, a.cardMin, a.cardMax, a.jitter, a.roll, upKey].join("|")
            if (lk !== layoutKey) { layoutKey = lk; buildLayout(N, a) }

            // spin
            const speed = p.speed ?? 50
            const base = isStatic || (mq && mq.matches) ? 0 : a.spinRate * DEG * (speed / 50)
            if (!dragging) dragVel *= Math.exp(-(0.5 + (a.damping / 100) * 6) * dt)
            theta += (base + (dragging ? 0 : dragVel)) * dt

            // hover tilt toward the pointer
            const hk = a.hover / 50
            const tYaw = over ? hx * a.hoverTilt * DEG * hk : 0
            const tPitch = over ? hy * a.hoverTilt * DEG * hk : 0
            const e = 1 - Math.exp(-dt * (1 + (a.hoverEase / 100) * 12))
            curYaw += (tYaw - curYaw) * e
            curPitch += (tPitch - curPitch) * e
            const yaw = a.startAngle * DEG + theta + curYaw
            const pitch = -a.tilt * DEG + curPitch
            const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
            const rot = new Float32Array([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy])

            // projection: silhouette radius = Rpx
            const d = Math.max(1.5, a.distance / 10)
            const Rpx = Math.min(H * 0.425, W * 0.45) * ((p.scale ?? 100) / 100)
            currentRpx = Rpx
            const fy = (Rpx / (H / 2)) * Math.sqrt(d * d - 1)
            const fx = (fy * H) / W
            const offX = a.offsetX / 50, offY = -a.offsetY / 50
            const nn = Math.max(0.05, d - 1.6), ff = d + 1.6

            gl.viewport(0, 0, cw, ch)
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
            gl.enable(gl.DEPTH_TEST)
            gl.depthFunc(gl.LESS)
            gl.depthMask(true)
            gl.disable(gl.BLEND)
            gl.disable(gl.CULL_FACE)

            gl.useProgram(cardProg)
            gl.uniformMatrix3fv(U.rot, false, rot)
            gl.uniform1f(U.dist, d)
            gl.uniform2f(U.f, fx, fy)
            gl.uniform2f(U.off, offX, offY)
            gl.uniform2f(U.nf, nn, ff)
            gl.uniform1f(U.bright, a.cardBrightness / 100)
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, artTex)
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, upTex)
            gl.bindVertexArray(cardVao)
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instCount)

            // word at the sphere's centre plane, occluded by nearer cards
            const text = String(p.text ?? "OBJECTS®")
            if (text.trim().length) {
                const f = fontOf(p.font)
                const px = f.size * (Rpx / 340)
                const face = String(p.textColor ?? "#A8A8A9")
                const wk = [text, f.family, f.weight, f.style, f.ls, Math.round(px * dpr), face, a.sideColor, a.extrude, a.condense, fontsVer].join("|")
                if (wk !== wordKey) {
                    wordKey = wk
                    wordSize = paintWord(wordCv, text, f, px, face, a.sideColor, a.extrude, a.condense, dpr)
                    uploadTex(wordTex, wordCv, false)
                }
                const zN = (ff + nn) / (ff - nn) - (2 * ff * nn) / ((ff - nn) * d)
                gl.depthMask(false)
                gl.enable(gl.BLEND)
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
                gl.useProgram(wordProg)
                gl.uniform2f(W_.center, offX, offY - (a.textOffset / 100) * (Rpx / (H / 2)))
                gl.uniform2f(W_.half, wordSize.w / W, wordSize.h / H)
                gl.uniform1f(W_.z, zN)
                gl.uniform1f(W_.alpha, a.textOpacity / 100)
                gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, wordTex)
                gl.bindVertexArray(wordVao)
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
                gl.depthMask(true)
            }
            gl.bindVertexArray(null)
        }

        let raf = 0
        let last = 0
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop)
            const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0
            last = now
            render(dt)
        }
        render(0)
        raf = requestAnimationFrame(loop)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            root.removeEventListener("pointermove", onMove)
            root.removeEventListener("pointerleave", onLeave)
            root.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointermove", onDrag)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            fonts?.removeEventListener?.("loadingdone", onFonts)
            gl.deleteTexture(artTex); gl.deleteTexture(upTex); gl.deleteTexture(wordTex)
            gl.deleteBuffer(quad); gl.deleteBuffer(inst)
            gl.deleteVertexArray(cardVao); gl.deleteVertexArray(wordVao)
            gl.deleteProgram(cardProg); gl.deleteProgram(wordProg)
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
                touchAction: "pan-y",
                userSelect: "none",
                ...style,
            }}
        >
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
            {adv.vignette > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${(adv.vignette / 100) * 0.85}) 100%)`,
                    }}
                />
            )}
            {adv.grain > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        backgroundImage: GRAIN_URL,
                        backgroundSize: "160px 160px",
                        opacity: (adv.grain / 100) * 0.3,
                    }}
                />
            )}
        </div>
    )
}

addPropertyControls(PhotoCardGlobe, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Page colour behind the globe.",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#A8A8A9",
        description: "Face colour of the word at the centre.",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 60, variant: "Bold", letterSpacing: "0em", lineHeight: "1em" },
        description: "Typeface and size of the centre word. Size is at the default globe size and scales with it.",
    },
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "OBJECTS®",
        description: "Word inside the globe. Cards passing in front hide parts of it. ® ™ © ° are drawn small and raised.",
    },
    images: {
        defaultValue: DEFAULT_IMAGES,
        type: ControlType.Array,
        title: "Images",
        maxCount: 30,
        control: { type: ControlType.ResponsiveImage },
        description: "Your photos for the cards, used in turn around the globe. Leave empty for the built-in product stills.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "How fast the globe turns. 50 is the shipped rate, 0 stops it.",
    },
    scale: {
        type: ControlType.Number,
        title: "Scale",
        min: 40,
        max: 160,
        step: 1,
        unit: "%",
        defaultValue: 100,
        description: "Globe size. 100% fills about 85% of the height.",
    },
    count: {
        type: ControlType.Number,
        title: "Cards",
        min: 20,
        max: 120,
        step: 1,
        defaultValue: 72,
        description: "Number of photo cards on the whole sphere. Card size adjusts to keep the coverage.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Strength of the pointer response (lean and drag). 0 turns it off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            spinRate: { type: ControlType.Number, title: "Spin Rate", min: 0, max: 90, step: 1, unit: "°", defaultValue: 16, description: "Degrees per second at Speed 50." },
            startAngle: { type: ControlType.Number, title: "Start Angle", min: 0, max: 360, step: 1, unit: "°", defaultValue: 0, description: "Which side of the globe faces you at the start." },
            tilt: { type: ControlType.Number, title: "Axis Tilt", min: -30, max: 30, step: 1, unit: "°", defaultValue: 6, description: "Tilt of the spin axis." },
            distance: { type: ControlType.Number, title: "Camera Distance", min: 18, max: 80, step: 1, defaultValue: 32, description: "Camera distance in tenths of the radius. Lower gives stronger perspective." },
            offsetX: { type: ControlType.Number, title: "Offset X", min: -30, max: 30, step: 1, unit: "%", defaultValue: 0, description: "Moves the globe sideways." },
            offsetY: { type: ControlType.Number, title: "Offset Y", min: -30, max: 30, step: 1, unit: "%", defaultValue: 0, description: "Moves the globe up or down." },
            cardSize: { type: ControlType.Number, title: "Card Size", min: 50, max: 150, step: 1, unit: "%", defaultValue: 100, description: "Scales every card." },
            cardMin: { type: ControlType.Number, title: "Card Min", min: 10, max: 60, step: 1, unit: "%", defaultValue: 27, description: "Smallest card long side, as % of the radius." },
            cardMax: { type: ControlType.Number, title: "Card Max", min: 10, max: 80, step: 1, unit: "%", defaultValue: 43, description: "Largest card long side, as % of the radius." },
            jitter: { type: ControlType.Number, title: "Jitter", min: 0, max: 50, step: 1, unit: "%", defaultValue: 15, description: "How far cards stray from the even layout." },
            roll: { type: ControlType.Number, title: "Card Roll", min: 0, max: 30, step: 1, unit: "°", defaultValue: 4, description: "Random rotation of each card in its own plane." },
            seed: { type: ControlType.Number, title: "Seed", min: 1, max: 999, step: 1, defaultValue: 7, description: "Shuffles the layout and which photo goes where." },
            cardBrightness: { type: ControlType.Number, title: "Card Brightness", min: 50, max: 130, step: 1, unit: "%", defaultValue: 100, description: "Brightness of the photos." },
            groundColor: { type: ControlType.Color, title: "Card Ground", defaultValue: "#F4F4F3", description: "Card colour behind your uploaded photos." },
            imagePad: { type: ControlType.Number, title: "Image Padding", min: 0, max: 30, step: 1, unit: "%", defaultValue: 8, description: "Margin around uploaded photos on their card." },
            sideColor: { type: ControlType.Color, title: "Text Side", defaultValue: "#625A56", description: "Colour of the word's extruded side." },
            extrude: { type: ControlType.Number, title: "Extrude", min: 0, max: 16, step: 1, unit: "px", defaultValue: 4, description: "Depth of the word's 3D side." },
            condense: { type: ControlType.Number, title: "Condense", min: 50, max: 120, step: 1, unit: "%", defaultValue: 80, description: "Horizontal squeeze of the word." },
            textOffset: { type: ControlType.Number, title: "Text Offset", min: -50, max: 50, step: 1, unit: "%", defaultValue: 0, description: "Moves the word down (positive) or up, as % of the radius." },
            textOpacity: { type: ControlType.Number, title: "Text Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 100, description: "Opacity of the word." },
            dragStrength: { type: ControlType.Number, title: "Drag", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "How much a horizontal drag spins the globe." },
            damping: { type: ControlType.Number, title: "Damping", min: 0, max: 100, step: 1, defaultValue: 50, description: "Higher settles a flick back to the base spin faster." },
            hoverTilt: { type: ControlType.Number, title: "Hover Tilt", min: 0, max: 30, step: 1, unit: "°", defaultValue: 12, description: "Most the globe leans toward the pointer." },
            hoverEase: { type: ControlType.Number, title: "Hover Ease", min: 0, max: 100, step: 1, unit: "%", defaultValue: 40, description: "How quickly the lean follows the pointer." },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over the whole component." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening over the whole component." },
        },
    },
})

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    spinDeg: 14,
    startAngle: 0,
    perspective: 1800,
    eyeLevel: 0,
    tilt: 0,
    offsetX: 0,
    offsetY: 0,
    cornerRadius: 22,
    rimColor: "#A6B2C4",
    plateColor: "#1C1F24",
    ambient: 88,
    light: 12,
    depthShade: 10,
    highlight: 18,
    falloff: 8,
    hideAfter: 96,
    fadeSpan: 14,
    leanDeg: 8,
    hoverBoost: 40,
    pressBoost: 150,
    hoverEase: 250,
    dragCoast: 400,
    grain: 0,
    vignette: 0,
    hover: 50,
    faceFront: 8,
    waveAmp: 12,
}

// ── moved controls (builder) ──
/**
 * Controls moved in the builder: into Advanced, out of it, or into groups of
 * their own. The code reads each one where it was first written, so the props
 * are put back in that shape before anything reads them.
 */
const MOVED_CONTROLS: { into: Record<string, string>; out: Record<string, string> } = {"into":{},"out":{"hover":"advanced","cornerRadius":"advanced"}}
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

// ── built-in icon art (drawn once per page into data URLs) ──

const S = 256
type C = CanvasRenderingContext2D

function lin(c: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
    const g = c.createLinearGradient(x0 * S, y0 * S, x1 * S, y1 * S)
    stops.forEach(([o, col]) => g.addColorStop(o, col))
    return g
}
function rad(c: C, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, stops: [number, string][]) {
    const g = c.createRadialGradient(x0 * S, y0 * S, r0 * S, x1 * S, y1 * S, r1 * S)
    stops.forEach(([o, col]) => g.addColorStop(o, col))
    return g
}
function fillBg(c: C, top: string, bottom: string) {
    c.fillStyle = lin(c, 0, 0, 0, 1, [[0, top], [1, bottom]])
    c.fillRect(0, 0, S, S)
}
function disc(c: C, x: number, y: number, r: number, fill: any) {
    c.beginPath()
    c.arc(x * S, y * S, r * S, 0, Math.PI * 2)
    c.fillStyle = fill
    c.fill()
}
function ring(c: C, x: number, y: number, r: number, w: number, color: string, a0 = 0, a1 = Math.PI * 2) {
    c.beginPath()
    c.arc(x * S, y * S, r * S, a0, a1)
    c.strokeStyle = color
    c.lineWidth = w * S
    c.lineCap = "round"
    c.stroke()
}
function rrect(c: C, x: number, y: number, w: number, h: number, r: number) {
    const X = x * S, Y = y * S, W = w * S, H = h * S, R = r * S
    c.beginPath()
    c.moveTo(X + R, Y)
    c.arcTo(X + W, Y, X + W, Y + H, R)
    c.arcTo(X + W, Y + H, X, Y + H, R)
    c.arcTo(X, Y + H, X, Y, R)
    c.arcTo(X, Y, X + W, Y, R)
    c.closePath()
}
function pen(c: C) {
    return {
        m: (x: number, y: number) => c.moveTo(x * S, y * S),
        l: (x: number, y: number) => c.lineTo(x * S, y * S),
        q: (a: number, b: number, x: number, y: number) => c.quadraticCurveTo(a * S, b * S, x * S, y * S),
        b: (a: number, b: number, d: number, e: number, x: number, y: number) =>
            c.bezierCurveTo(a * S, b * S, d * S, e * S, x * S, y * S),
    }
}
function hline(c: C, x0: number, x1: number, y: number, w: number, color: string) {
    c.beginPath()
    c.moveTo(x0 * S, y * S)
    c.lineTo(x1 * S, y * S)
    c.strokeStyle = color
    c.lineWidth = w * S
    c.lineCap = "round"
    c.stroke()
}

const GREEN_TOP = "#5CF074"
const GREEN_BOTTOM = "#23C13B"

const DESIGNS: Record<string, { rim: string; draw: (c: C) => void }> = {
    reminders: {
        rim: "#B8C0CC",
        draw: (c) => {
            fillBg(c, "#FFFFFF", "#F1F3F6")
            const rows: [number, string][] = [[0.27, "#1B74E6"], [0.5, "#FF3B30"], [0.73, "#FF9500"]]
            rows.forEach(([y, col]) => {
                ring(c, 0.27, y, 0.075, 0.03, col)
                disc(c, 0.27, y, 0.042, col)
                hline(c, 0.42, 0.8, y, 0.022, "#D3D8DF")
            })
        },
    },
    weather: {
        rim: "#1458B8",
        draw: (c) => {
            fillBg(c, "#36B4F5", "#1B6FE0")
            disc(c, 0.64, 0.34, 0.17, rad(c, 0.6, 0.3, 0.02, 0.64, 0.34, 0.17, [[0, "#FFF2A0"], [1, "#FFC93A"]]))
            const cloud = lin(c, 0, 0.4, 0, 0.82, [[0, "#FFFFFF"], [1, "#D6E6F7"]])
            disc(c, 0.36, 0.66, 0.14, cloud)
            disc(c, 0.53, 0.56, 0.18, cloud)
            disc(c, 0.7, 0.66, 0.13, cloud)
            c.fillStyle = cloud
            c.fillRect(0.36 * S, 0.62 * S, 0.34 * S, 0.18 * S)
        },
    },
    chess: {
        rim: "#1A1D20",
        draw: (c) => {
            fillBg(c, "#3A4249", "#0A0C0E")
            const silver = lin(c, 0.3, 0.15, 0.72, 0.88, [[0, "#FFFFFF"], [0.5, "#B9C0C7"], [1, "#5E666E"]])
            const p = pen(c)
            c.beginPath()
            p.m(0.34, 0.72)
            p.b(0.36, 0.6, 0.42, 0.54, 0.4, 0.48)
            p.l(0.28, 0.5)
            p.l(0.25, 0.44)
            p.l(0.36, 0.3)
            p.b(0.4, 0.22, 0.46, 0.17, 0.52, 0.18)
            p.l(0.54, 0.12)
            p.l(0.58, 0.19)
            p.b(0.72, 0.26, 0.74, 0.5, 0.66, 0.72)
            c.closePath()
            c.fillStyle = silver
            c.fill()
            rrect(c, 0.29, 0.72, 0.42, 0.06, 0.02)
            c.fill()
            rrect(c, 0.25, 0.8, 0.5, 0.07, 0.025)
            c.fill()
            disc(c, 0.43, 0.28, 0.018, "#1A1D20")
        },
    },
    home: {
        rim: "#C9CED6",
        draw: (c) => {
            fillBg(c, "#FFFFFF", "#F1F2F4")
            const p = pen(c)
            c.beginPath()
            p.m(0.5, 0.2)
            p.l(0.82, 0.5)
            p.l(0.72, 0.5)
            p.l(0.72, 0.8)
            p.l(0.28, 0.8)
            p.l(0.28, 0.5)
            p.l(0.18, 0.5)
            c.closePath()
            c.fillStyle = lin(c, 0, 0.2, 0, 0.8, [[0, "#FFB340"], [1, "#FF7A00"]])
            c.fill()
            rrect(c, 0.44, 0.6, 0.12, 0.2, 0.03)
            c.fillStyle = "#FFFFFF"
            c.fill()
        },
    },
    freeform: {
        rim: "#27353D",
        draw: (c) => {
            fillBg(c, "#3D8F99", "#1A3F46")
            rrect(c, 0.2, 0.18, 0.6, 0.64, 0.08)
            c.fillStyle = "rgba(120,220,230,0.18)"
            c.fill()
            const p = pen(c)
            c.beginPath()
            p.m(0.26, 0.62)
            p.b(0.32, 0.3, 0.38, 0.3, 0.42, 0.6)
            p.b(0.46, 0.85, 0.52, 0.3, 0.58, 0.45)
            p.b(0.64, 0.6, 0.68, 0.35, 0.76, 0.4)
            c.strokeStyle = "#8AF5FF"
            c.lineWidth = 0.04 * S
            c.lineCap = "round"
            c.stroke()
        },
    },
    camera: {
        rim: "#8A9099",
        draw: (c) => {
            fillBg(c, "#EEF0F2", "#A2A8B0")
            disc(c, 0.5, 0.5, 0.34, "#2A2E35")
            disc(c, 0.5, 0.5, 0.3, rad(c, 0.45, 0.42, 0.02, 0.5, 0.5, 0.3, [[0, "#C9D4FF"], [0.25, "#6F86FF"], [0.7, "#1C2350"], [1, "#06070D"]]))
            disc(c, 0.42, 0.4, 0.05, "rgba(255,255,255,0.75)")
        },
    },
    phone: {
        rim: "#17932B",
        draw: (c) => {
            fillBg(c, GREEN_TOP, GREEN_BOTTOM)
            ring(c, 0.66, 0.34, 0.3, 0.12, "#FFFFFF", 0.55 * Math.PI, 1.05 * Math.PI)
        },
    },
    photos: {
        rim: "#C9CED6",
        draw: (c) => {
            fillBg(c, "#FFFFFF", "#F1F2F4")
            const cols = ["#FF9500", "#FFCC00", "#A5D63A", "#34C759", "#30B0C7", "#5856D6", "#AF52DE", "#FF2D55"]
            c.globalCompositeOperation = "multiply"
            cols.forEach((col, i) => {
                c.save()
                c.translate(0.5 * S, 0.5 * S)
                c.rotate((i * Math.PI) / 4)
                c.beginPath()
                c.ellipse(0, -0.17 * S, 0.1 * S, 0.17 * S, 0, 0, Math.PI * 2)
                c.fillStyle = col
                c.globalAlpha = 0.85
                c.fill()
                c.restore()
            })
            c.globalCompositeOperation = "source-over"
            c.globalAlpha = 1
        },
    },
    findmy: {
        rim: "#17932B",
        draw: (c) => {
            fillBg(c, "#4BE05A", "#1FAE3A")
            ring(c, 0.5, 0.55, 0.32, 0.035, "rgba(255,255,255,0.5)")
            ring(c, 0.5, 0.55, 0.22, 0.035, "rgba(255,255,255,0.7)")
            ring(c, 0.5, 0.55, 0.12, 0.035, "rgba(255,255,255,0.9)")
            disc(c, 0.5, 0.55, 0.05, "#FFFFFF")
            disc(c, 0.84, 0.16, 0.09, "#FFD60A")
        },
    },
    photobooth: {
        rim: "#0E0E12",
        draw: (c) => {
            fillBg(c, "#2A2A34", "#050507")
            disc(c, 0.5, 0.5, 0.33, "#8E949E")
            disc(c, 0.5, 0.5, 0.29, "#15161C")
            disc(c, 0.5, 0.5, 0.24, rad(c, 0.46, 0.44, 0.02, 0.5, 0.5, 0.24, [[0, "#D8D0FF"], [0.35, "#7B68F0"], [1, "#140F33"]]))
            disc(c, 0.43, 0.41, 0.04, "rgba(255,255,255,0.7)")
        },
    },
    podcasts: {
        rim: "#5B1A9A",
        draw: (c) => {
            fillBg(c, "#D38CFF", "#8A2BE2")
            ring(c, 0.5, 0.45, 0.28, 0.045, "#FFFFFF", 0.8 * Math.PI, 2.2 * Math.PI)
            ring(c, 0.5, 0.45, 0.17, 0.045, "#FFFFFF", 0.8 * Math.PI, 2.2 * Math.PI)
            disc(c, 0.5, 0.45, 0.07, "#FFFFFF")
            rrect(c, 0.465, 0.55, 0.07, 0.25, 0.035)
            c.fillStyle = "#FFFFFF"
            c.fill()
        },
    },
    mail: {
        rim: "#1458B8",
        draw: (c) => {
            fillBg(c, "#5ACBFF", "#1C77F0")
            rrect(c, 0.2, 0.3, 0.6, 0.42, 0.05)
            c.fillStyle = "#FFFFFF"
            c.fill()
            const p = pen(c)
            c.beginPath()
            p.m(0.22, 0.33)
            p.l(0.5, 0.55)
            p.l(0.78, 0.33)
            c.strokeStyle = "#B7D4F5"
            c.lineWidth = 0.025 * S
            c.stroke()
        },
    },
    settings: {
        rim: "#6B7078",
        draw: (c) => {
            fillBg(c, "#D4D8DE", "#8D939B")
            c.fillStyle = "#3E434B"
            for (let i = 0; i < 12; i++) {
                c.save()
                c.translate(0.5 * S, 0.5 * S)
                c.rotate((i * Math.PI) / 6)
                c.fillRect(-0.045 * S, -0.34 * S, 0.09 * S, 0.12 * S)
                c.restore()
            }
            disc(c, 0.5, 0.5, 0.27, "#3E434B")
            disc(c, 0.5, 0.5, 0.17, "#C3C8CF")
            disc(c, 0.5, 0.5, 0.08, "#3E434B")
        },
    },
    calendar: {
        rim: "#C9CED6",
        draw: (c) => {
            fillBg(c, "#FFFFFF", "#EEF0F3")
            c.textAlign = "center"
            c.fillStyle = "#FF3B30"
            c.font = `600 ${0.1 * S}px -apple-system, Helvetica, Arial, sans-serif`
            c.fillText("MONDAY", 0.5 * S, 0.27 * S)
            c.fillStyle = "#111111"
            c.font = `300 ${0.44 * S}px -apple-system, Helvetica, Arial, sans-serif`
            c.fillText("26", 0.5 * S, 0.72 * S)
        },
    },
    safari: {
        rim: "#C9CED6",
        draw: (c) => {
            fillBg(c, "#FFFFFF", "#E8EBEF")
            disc(c, 0.5, 0.5, 0.38, lin(c, 0, 0.12, 0, 0.88, [[0, "#20C8FF"], [1, "#1A66EE"]]))
            c.save()
            c.translate(0.5 * S, 0.5 * S)
            c.rotate(Math.PI / 4)
            c.beginPath()
            c.moveTo(0, -0.3 * S)
            c.lineTo(0.06 * S, 0)
            c.lineTo(-0.06 * S, 0)
            c.closePath()
            c.fillStyle = "#FF3B30"
            c.fill()
            c.beginPath()
            c.moveTo(0, 0.3 * S)
            c.lineTo(0.06 * S, 0)
            c.lineTo(-0.06 * S, 0)
            c.closePath()
            c.fillStyle = "#FFFFFF"
            c.fill()
            c.restore()
        },
    },
    clock: {
        rim: "#1A1D20",
        draw: (c) => {
            fillBg(c, "#1E2126", "#050608")
            disc(c, 0.5, 0.5, 0.38, "#FFFFFF")
            const p = pen(c)
            c.beginPath()
            p.m(0.5, 0.5)
            p.l(0.5, 0.26)
            p.m(0.5, 0.5)
            p.l(0.66, 0.58)
            c.strokeStyle = "#111111"
            c.lineWidth = 0.03 * S
            c.lineCap = "round"
            c.stroke()
            c.beginPath()
            p.m(0.5, 0.5)
            p.l(0.34, 0.7)
            c.strokeStyle = "#FF9500"
            c.lineWidth = 0.012 * S
            c.stroke()
            disc(c, 0.5, 0.5, 0.025, "#FF9500")
        },
    },
    facetime: {
        rim: "#17932B",
        draw: (c) => {
            fillBg(c, GREEN_TOP, GREEN_BOTTOM)
            rrect(c, 0.18, 0.34, 0.42, 0.32, 0.07)
            c.fillStyle = "#FFFFFF"
            c.fill()
            const p = pen(c)
            c.beginPath()
            p.m(0.62, 0.46)
            p.l(0.82, 0.34)
            p.l(0.82, 0.66)
            p.l(0.62, 0.54)
            c.closePath()
            c.fill()
        },
    },
    messages: {
        rim: "#17932B",
        draw: (c) => {
            fillBg(c, GREEN_TOP, GREEN_BOTTOM)
            c.beginPath()
            c.ellipse(0.5 * S, 0.48 * S, 0.32 * S, 0.26 * S, 0, 0, Math.PI * 2)
            c.fillStyle = "#FFFFFF"
            c.fill()
            const p = pen(c)
            c.beginPath()
            p.m(0.28, 0.62)
            p.q(0.26, 0.74, 0.18, 0.79)
            p.q(0.32, 0.79, 0.4, 0.7)
            c.closePath()
            c.fill()
        },
    },
    notes: {
        rim: "#C9CED6",
        draw: (c) => {
            fillBg(c, "#FFFFFF", "#F2F3F5")
            c.fillStyle = lin(c, 0, 0, 0, 0.24, [[0, "#FFE066"], [1, "#FFC800"]])
            c.fillRect(0, 0, S, 0.24 * S)
            disc(c, 0.62, 0.33, 0.018, "#C4C8CE")
            disc(c, 0.7, 0.33, 0.018, "#C4C8CE")
            disc(c, 0.78, 0.33, 0.018, "#C4C8CE")
            ;[0.45, 0.58, 0.71, 0.84].forEach((y) => hline(c, 0.12, 0.88, y, 0.012, "#D6D9DE"))
        },
    },
    keynote: {
        rim: "#1458B8",
        draw: (c) => {
            fillBg(c, "#2BAAEE", "#1B74E6")
            c.strokeStyle = "rgba(255,255,255,0.22)"
            c.lineWidth = 2
            for (let i = 1; i < 8; i++) {
                c.beginPath()
                c.moveTo((i / 8) * S, 0)
                c.lineTo((i / 8) * S, S)
                c.moveTo(0, (i / 8) * S)
                c.lineTo(S, (i / 8) * S)
                c.stroke()
            }
            const p = pen(c)
            c.beginPath()
            p.m(0.2, 0.75)
            p.l(0.55, 0.2)
            p.l(0.8, 0.3)
            p.l(0.45, 0.85)
            c.closePath()
            c.fillStyle = "rgba(200,232,255,0.55)"
            c.fill()
        },
    },
    pages: {
        rim: "#C9CED6",
        draw: (c) => {
            fillBg(c, "#FFFFFF", "#EEF0F3")
            for (let y = 0.2; y < 0.95; y += 0.11) hline(c, 0.08, 0.92, y, 0.012, "#C8CDD4")
            c.fillStyle = "#FF3B30"
            c.fillRect(0.22 * S, 0, 0.015 * S, S)
        },
    },
    music: {
        rim: "#B3102A",
        draw: (c) => {
            fillBg(c, "#FF6079", "#F01F3C")
            c.fillStyle = "#FFFFFF"
            c.beginPath()
            c.ellipse(0.38 * S, 0.7 * S, 0.09 * S, 0.075 * S, -0.3, 0, Math.PI * 2)
            c.fill()
            c.beginPath()
            c.ellipse(0.69 * S, 0.63 * S, 0.09 * S, 0.075 * S, -0.3, 0, Math.PI * 2)
            c.fill()
            c.fillRect(0.44 * S, 0.27 * S, 0.035 * S, 0.43 * S)
            c.fillRect(0.75 * S, 0.2 * S, 0.035 * S, 0.43 * S)
            const p = pen(c)
            c.beginPath()
            p.m(0.44, 0.27)
            p.l(0.785, 0.2)
            p.l(0.785, 0.28)
            p.l(0.44, 0.35)
            c.closePath()
            c.fill()
        },
    },
}

// Ring order: index 0 sits at the front at t = 0, positive indices to the right, negative to the left.
const ORDER = [
    "reminders", "weather", "chess", "home", "freeform", "camera", "phone", "photos",
    "findmy", "photobooth", "podcasts", "mail", "settings", "calendar", "safari", "clock",
    "facetime", "findmy", "photobooth", "messages", "notes", "keynote", "pages", "music",
]

let ICONS: Record<string, string> | null = null
function builtInIcons(): Record<string, string> | null {
    if (ICONS) return ICONS
    if (typeof document === "undefined") return null
    try {
        const cv = document.createElement("canvas")
        cv.width = S
        cv.height = S
        const c = cv.getContext("2d")
        if (!c) return null
        const out: Record<string, string> = {}
        Object.keys(DESIGNS).forEach((k) => {
            c.save()
            c.clearRect(0, 0, S, S)
            DESIGNS[k].draw(c)
            c.restore()
            out[k] = cv.toDataURL("image/png")
        })
        ICONS = out
        return out
    } catch {
        return null
    }
}

let NOISE: string | null = null
function noiseUrl(): string | null {
    if (NOISE) return NOISE
    if (typeof document === "undefined") return null
    const cv = document.createElement("canvas")
    cv.width = 128
    cv.height = 128
    const c = cv.getContext("2d")
    if (!c) return null
    const img = c.createImageData(128, 128)
    for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255
        img.data[i] = v
        img.data[i + 1] = v
        img.data[i + 2] = v
        img.data[i + 3] = 255
    }
    c.putImageData(img, 0, 0)
    NOISE = cv.toDataURL("image/png")
    return NOISE
}

const IMG_STATE = new Map<string, "loading" | "ok" | "err">()

function srcOf(v: any): string | null {
    if (!v) return null
    if (typeof v === "string") return v
    return typeof v.src === "string" && v.src ? v.src : null
}

const mod = (a: number, n: number) => ((a % n) + n) % n
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const wrapDeg = (d: number) => mod(d + 180, 360) - 180

const LX = -0.25
const LZ = 0.968

function finPose(
    j: number,
    N: number,
    angle: number,
    adv: typeof ADVANCED_DEFAULTS,
    R: number,
    waveAmp = 0
) {
    const th = wrapDeg((j * 360) / N + adv.startAngle + angle)
    const a = Math.abs(th)
    const r = (th * Math.PI) / 180
    const cs = Math.cos(r)
    // few tiles face the front; more turn toward the radial paddle pose
    const t = clamp((N - adv.faceFront) / 16, 0, 1)
    const local = -th * (1 - t) + 90 * t
    const ry = ((th + local) * Math.PI) / 180
    let nx = Math.sin(ry)
    let nz = Math.cos(ry)
    if (nz < 0) {
        nx = -nx
        nz = -nz
    }
    const lam = Math.max(0, nx * LX + nz * LZ)
    const bright = adv.ambient / 100 + (adv.light / 100) * lam
    const depth = (adv.depthShade / 100) * (1 - Math.max(0, cs))
    let shade = clamp(1 - bright + depth, 0, 0.95)
    const fade = clamp((adv.hideAfter - a) / Math.max(1, adv.fadeSpan), 0, 1)
    shade = 1 - (1 - shade) * fade
    const wk = Math.min(0.9, (2 * Math.PI * 3) / N)
    const y = waveAmp * Math.sin((th / 360) * N * wk)
    return {
        transform: `translateY(${y.toFixed(2)}px) rotateY(${th.toFixed(3)}deg) translateZ(${R.toFixed(2)}px) rotateY(${local.toFixed(3)}deg)`,
        shade,
        visible: a < adv.hideAfter,
    }
}

/**
 * A paddle wheel of thick app-icon tiles turning about a vertical axis.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function AppIconPaddleWheel(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        speed = 29,
        direction = "left",
        size = 186,
        ringRadius = 240,
        count = 24,
        thickness = 7,
        dragSensitivity = 50,
        images,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const propsRef = useRef(props)
    propsRef.current = props
    const rootRef = useRef<HTMLDivElement>(null)
    const ringRef = useRef<HTMLDivElement>(null)
    const finEls = useRef<(HTMLDivElement | null)[]>([])
    const shadeEls = useRef<(HTMLDivElement | null)[]>([])
    const angleRef = useRef(0)
    const ptr = useRef({ x: 0, y: 0, tx: 0, ty: 0, over: 0, tOver: 0, down: 0, tDown: 0 })
    // drag: offset (°) added to the wheel angle, coasting velocity (°/s) after release
    const drag = useRef({ active: false, lastX: 0, lastT: 0, moved: 0, offset: 0, vel: 0 })
    // wave: smoothed rotation speed, last wheel angle
    const energy = useRef(0)
    const prevSigned = useRef<number | null>(null)

    const [fit, setFit] = useState(1)
    const fitRef = useRef(1)
    const [icons, setIcons] = useState<Record<string, string> | null>(() => builtInIcons())
    const [noise, setNoise] = useState<string | null>(() => noiseUrl())
    const [, setLoadTick] = useState(0)

    const N = clamp(Math.round(count), 6, 48)
    const nRef = useRef(N)
    nRef.current = N

    useEffect(() => {
        if (!icons) setIcons(builtInIcons())
        if (!noise) setNoise(noiseUrl())
    }, [])

    // size to the frame (design stage 1200 × 800)
    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const measure = () => {
            const w = el.offsetWidth
            const h = el.offsetHeight
            if (!w || !h) return
            const f = Math.min(w / 1200, h / 800)
            if (Math.abs(f - fitRef.current) > 0.001) {
                fitRef.current = f
                setFit(f)
            }
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // uploaded pictures: load each src once
    const srcs: string[] = Array.isArray(images) ? (images.map(srcOf).filter(Boolean) as string[]) : []
    const srcKey = srcs.join("|")
    useEffect(() => {
        let alive = true
        srcs.forEach((src) => {
            if (IMG_STATE.has(src)) return
            IMG_STATE.set(src, "loading")
            const im = new Image()
            im.onload = () => {
                IMG_STATE.set(src, "ok")
                if (alive) setLoadTick((t) => t + 1)
            }
            im.onerror = () => {
                IMG_STATE.set(src, "err")
                if (alive) setLoadTick((t) => t + 1)
            }
            im.src = src
        })
        return () => {
            alive = false
        }
    }, [srcKey])

    // drag and pointer release on window
    useEffect(() => {
        const move = (e: PointerEvent) => {
            const D = drag.current
            if (!D.active) return
            const p = propsRef.current
            const sens = Math.max(0, p.dragSensitivity ?? 50) / 50
            const now = performance.now()
            const dx = e.clientX - D.lastX
            const dtm = Math.max(1, now - D.lastT)
            D.lastX = e.clientX
            D.lastT = now
            if (sens <= 0) return
            D.moved += Math.abs(dx)
            if (D.moved > 4) ptr.current.tDown = 0
            const Rpx = Math.max(1, (p.ringRadius ?? 240) * fitRef.current)
            const deg = (dx / Rpx) * (180 / Math.PI) * sens
            D.offset += deg
            D.vel = D.vel * 0.6 + (deg / (dtm / 1000)) * 0.4
        }
        const up = () => {
            ptr.current.tDown = 0
            const D = drag.current
            if (D.active && performance.now() - D.lastT > 80) D.vel = 0
            D.active = false
        }
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up)
        window.addEventListener("pointercancel", up)
        return () => {
            window.removeEventListener("pointermove", move)
            window.removeEventListener("pointerup", up)
            window.removeEventListener("pointercancel", up)
        }
    }, [])

    // frame loop
    useEffect(() => {
        let raf = 0
        let last = -1
        const target = RenderTarget.current()
        const isStatic = target === RenderTarget.thumbnail || target === RenderTarget.export
        const mq =
            typeof window !== "undefined" && window.matchMedia
                ? window.matchMedia("(prefers-reduced-motion: reduce)")
                : null
        const frame = (now: number) => {
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            last = now
            const p = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const h = Math.max(0, a.hover) / 50
            const P = ptr.current
            const k = dt > 0 ? 1 - Math.exp(-dt / Math.max(0.01, a.hoverEase / 1000)) : 0
            P.over += (P.tOver - P.over) * k
            P.down += (P.tDown - P.down) * k
            P.x += (P.tx * P.tOver - P.x) * k
            P.y += (P.ty * P.tOver - P.y) * k

            const dirLeft = (p.direction ?? "left") !== "right"
            const still = isStatic || (mq ? mq.matches : false)
            const spd = Math.max(0, p.speed ?? 50) / 50
            const mult = Math.max(
                0,
                1 + (a.hoverBoost / 100) * h * P.over * (dirLeft ? -P.x : P.x) + (a.pressBoost / 100) * h * P.down
            )
            if (!still) angleRef.current += a.spinDeg * spd * mult * dt
            const D = drag.current
            if (!D.active && D.vel !== 0) {
                D.offset += D.vel * dt
                D.vel *= Math.exp(-dt / Math.max(0.02, a.dragCoast / 1000))
                if (Math.abs(D.vel) < 0.5) D.vel = 0
            }

            const f = fitRef.current
            const R = (p.ringRadius ?? 240) * f
            const n = nRef.current
            const signed = (dirLeft ? -angleRef.current : angleRef.current) + D.offset
            const side = (p.size ?? 186) * f
            // wave sits in space and the tiles ride through it; wheel speed (spin, drag or coast) sets its height
            const prev = prevSigned.current
            prevSigned.current = signed
            const omega = prev === null || dt <= 0 ? 0 : (signed - prev) / dt
            energy.current += (clamp(Math.abs(omega) / 10, 0, 1) - energy.current) * (dt > 0 ? 1 - Math.exp(-dt / 0.25) : 0)
            const waveAmp = side * (a.waveAmp / 100) * energy.current
            for (let j = 0; j < n; j++) {
                const el = finEls.current[j]
                if (!el) continue
                const pose = finPose(j, n, signed, a, R, waveAmp)
                el.style.visibility = pose.visible ? "visible" : "hidden"
                el.style.transform = pose.transform
                const s0 = shadeEls.current[j * 2]
                const s1 = shadeEls.current[j * 2 + 1]
                const o = pose.shade.toFixed(3)
                el.style.setProperty("--shade", o)
                if (s0) s0.style.opacity = o
                if (s1) s1.style.opacity = o
            }
            const ringEl = ringRef.current
            if (ringEl) {
                const lean = a.tilt - P.y * a.leanDeg * h * P.over
                ringEl.style.transform = `rotateX(${lean.toFixed(3)}deg)`
            }
            raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
        return () => cancelAnimationFrame(raf)
    }, [])

    const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = e.currentTarget
        const w = el.offsetWidth || 1
        const hh = el.offsetHeight || 1
        ptr.current.tx = clamp((e.nativeEvent.offsetX / w) * 2 - 1, -1, 1)
        ptr.current.ty = clamp((e.nativeEvent.offsetY / hh) * 2 - 1, -1, 1)
        ptr.current.tOver = 1
    }

    // geometry for this render
    const side = size * fit
    const tPx = Math.max(0, (thickness / 100) * size * fit)
    const R = ringRadius * fit
    const radius = `${clamp(adv.cornerRadius, 0, 50)}%`
    const signed = (direction === "right" ? angleRef.current : -angleRef.current) + drag.current.offset
    const h = Math.max(0, adv.hover) / 50
    const lean0 = adv.tilt - ptr.current.y * adv.leanDeg * h * ptr.current.over

    const glossFront = `linear-gradient(to right, rgba(0,0,0,${adv.falloff / 100}) 0%, rgba(0,0,0,0) 45%, rgba(255,255,255,0) 70%, rgba(255,255,255,${adv.highlight / 100}) 90%, rgba(255,255,255,${adv.highlight / 250}) 100%)`
    const glossBack = glossFront.replace("to right", "to left")
    const rimShadow = "inset 0 1.5px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(255,255,255,0.2)"

    // thickness: opaque layers about a pixel apart, so the edge reads as one solid slab
    const nSlices = tPx < 1 ? 0 : clamp(Math.ceil(tPx), 2, 40)
    const walls: React.ReactNode[] = []
    for (let k = 0; k < nSlices; k++) {
        const z = -tPx / 2 + (tPx * (k + 1)) / (nSlices + 1)
        walls.push(
            <div
                key={k}
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: radius,
                    background: "linear-gradient(rgb(0 0 0 / var(--shade, 0)), rgb(0 0 0 / var(--shade, 0))), var(--rim)",
                    transform: `translateZ(${z.toFixed(2)}px)`,
                }}
            />
        )
    }

    const fins: React.ReactNode[] = []
    for (let j = 0; j < N; j++) {
        const kIdx = j <= N / 2 ? j : j - N
        const key = ORDER[mod(kIdx, ORDER.length)]
        const design = DESIGNS[key]
        const upload = srcs.length ? srcs[mod(kIdx, srcs.length)] : null
        const useUpload = !!upload && IMG_STATE.get(upload) === "ok"
        const icon = icons ? icons[key] : null
        const faceBg = useUpload
            ? `url("${upload}") center / contain no-repeat, ${adv.plateColor}`
            : icon
              ? `url(${icon}) center / cover no-repeat, ${design.rim}`
              : design.rim
        const rimCol = useUpload ? adv.rimColor : design.rim
        const pose = finPose(j, N, signed, adv, R)

        const face = (back: boolean) => (
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: radius,
                    overflow: "hidden",
                    background: faceBg,
                    boxShadow: rimShadow,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: back ? `rotateY(180deg) translateZ(${tPx / 2}px)` : `translateZ(${tPx / 2}px)`,
                }}
            >
                <div style={{ position: "absolute", inset: 0, background: back ? glossBack : glossFront }} />
                <div
                    ref={(el) => {
                        shadeEls.current[j * 2 + (back ? 1 : 0)] = el
                    }}
                    style={{ position: "absolute", inset: 0, background: "#000", opacity: pose.shade }}
                />
            </div>
        )

        const slices = walls
        fins.push(
            <div
                key={j}
                ref={(el) => {
                    finEls.current[j] = el
                }}
                style={{
                    position: "absolute",
                    left: -side / 2,
                    top: -side / 2,
                    width: side,
                    height: side,
                    transformStyle: "preserve-3d",
                    transform: pose.transform,
                    visibility: pose.visible ? "visible" : "hidden",
                    ["--rim" as any]: rimCol,
                    ["--shade" as any]: pose.shade.toFixed(3),
                }}
            >
                {slices}
                {face(false)}
                {face(true)}
            </div>
        )
    }

    return (
        <div
            ref={rootRef}
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
                style={{
                    position: "absolute",
                    inset: 0,
                    perspective: `${Math.max(200, adv.perspective) * fit}px`,
                    perspectiveOrigin: `50% ${50 + adv.eyeLevel}%`,
                }}
            >
                <div
                    ref={ringRef}
                    style={{
                        position: "absolute",
                        left: `${50 + adv.offsetX}%`,
                        top: `${50 + adv.offsetY}%`,
                        width: 0,
                        height: 0,
                        transformStyle: "preserve-3d",
                        transform: `rotateX(${lean0}deg)`,
                    }}
                >
                    {fins}
                </div>
            </div>
            {adv.vignette > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.9) 100%)",
                        opacity: adv.vignette / 100,
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
                        backgroundSize: "128px 128px",
                        mixBlendMode: "overlay",
                        opacity: adv.grain / 100,
                    }}
                />
            )}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 3,
                    cursor: dragSensitivity > 0 ? "grab" : undefined,
                    touchAction: dragSensitivity > 0 ? "pan-y" : undefined,
                }}
                onPointerEnter={onMove}
                onPointerMove={onMove}
                onPointerLeave={() => {
                    ptr.current.tOver = 0
                }}
                onPointerDown={(e) => {
                    onMove(e)
                    ptr.current.tDown = 1
                    const D = drag.current
                    D.active = true
                    D.lastX = e.clientX
                    D.lastT = performance.now()
                    D.moved = 0
                    D.vel = 0
                }}
            />
        </div>
    )
}

addPropertyControls(AppIconPaddleWheel, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Colour behind the wheel.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 29,
        description: "How fast the wheel turns. 50 is the reference rate, 0 stops it.",
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["left", "right"],
        optionTitles: ["Left", "Right"],
        displaySegmentedControl: true,
        defaultValue: "left",
        description: "Which way the front of the wheel travels.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 60,
        max: 400,
        step: 1,
        unit: "px",
        defaultValue: 186,
        description: "Side of each icon tile, at a 1200 × 800 frame.",
    },
    ringRadius: {
        type: ControlType.Number,
        title: "Radius",
        min: 100,
        max: 480,
        step: 1,
        unit: "px",
        defaultValue: 240,
        description: "Distance from the axis to each tile's centre, at a 1200 × 800 frame.",
    },
    count: {
        type: ControlType.Number,
        title: "Tiles",
        min: 8,
        max: 36,
        step: 1,
        defaultValue: 24,
        description: "Number of tiles round the whole wheel.",
    },
    thickness: {
        type: ControlType.Number,
        title: "Thickness",
        min: 0,
        max: 20,
        step: 1,
        unit: "%",
        defaultValue: 7,
        description: "Slab depth of each tile, as a % of its side.",
    },
    images: {
        defaultValue: [],
        type: ControlType.Array,
        title: "Images",
        maxCount: 24,
        control: { type: ControlType.ResponsiveImage },
        description: "Your own icons. Used round the tiles in turn; empty shows the built-in app icons.",
    },
    dragSensitivity: {
        type: ControlType.Number,
        title: "Drag",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "How far the wheel turns per pixel dragged. 50 makes the front tile follow the pointer, 0 turns dragging off.",
    },
    cornerRadius: { type: ControlType.Number, title: "Corner Radius", min: 0, max: 50, step: 1, unit: "%", defaultValue: 22, description: "Rounding of each icon card, as a % of its side." },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Strength of the pointer response; 0 turns it off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            spinDeg: { type: ControlType.Number, title: "Spin", min: 1, max: 90, step: 1, unit: "°/s", defaultValue: 14, description: "Turn rate at Speed 50." },
            startAngle: { type: ControlType.Number, title: "Start Angle", min: -180, max: 180, step: 1, unit: "°", defaultValue: 0, description: "Wheel angle at the first frame." },
            perspective: { type: ControlType.Number, title: "Perspective", min: 400, max: 6000, step: 10, unit: "px", defaultValue: 1800, description: "Camera distance; lower makes the front tiles bigger." },
            eyeLevel: { type: ControlType.Number, title: "Eye Level", min: -50, max: 50, step: 1, unit: "%", defaultValue: 0, description: "Camera height relative to the frame's middle." },
            tilt: { type: ControlType.Number, title: "Tilt", min: -30, max: 30, step: 1, unit: "°", defaultValue: 0, description: "Resting forward or back lean of the wheel." },
            offsetX: { type: ControlType.Number, title: "Offset X", min: -50, max: 50, step: 1, unit: "%", defaultValue: 0, description: "Horizontal shift of the wheel." },
            offsetY: { type: ControlType.Number, title: "Offset Y", min: -50, max: 50, step: 1, unit: "%", defaultValue: 0, description: "Vertical shift of the wheel." },
            rimColor: { type: ControlType.Color, title: "Rim", defaultValue: "#A6B2C4", description: "Slab side colour behind uploaded icons." },
            plateColor: { type: ControlType.Color, title: "Plate", defaultValue: "#1C1F24", description: "Face colour behind an uploaded icon." },
            ambient: { type: ControlType.Number, title: "Ambient", min: 0, max: 100, step: 1, unit: "%", defaultValue: 88, description: "Base brightness of the faces." },
            light: { type: ControlType.Number, title: "Light", min: 0, max: 100, step: 1, unit: "%", defaultValue: 12, description: "Brightness added by the front-left light." },
            depthShade: { type: ControlType.Number, title: "Depth Shade", min: 0, max: 100, step: 1, unit: "%", defaultValue: 10, description: "How much darker the tiles at the sides are." },
            highlight: { type: ControlType.Number, title: "Gloss", min: 0, max: 100, step: 1, unit: "%", defaultValue: 18, description: "Highlight band on each face's inner edge." },
            falloff: { type: ControlType.Number, title: "Falloff", min: 0, max: 100, step: 1, unit: "%", defaultValue: 8, description: "Darkening toward each face's outer edge." },
            hideAfter: { type: ControlType.Number, title: "Hide After", min: 60, max: 180, step: 1, unit: "°", defaultValue: 96, description: "Angle from the front past which tiles are hidden." },
            fadeSpan: { type: ControlType.Number, title: "Fade Span", min: 1, max: 60, step: 1, unit: "°", defaultValue: 14, description: "Angle over which tiles darken before hiding." },
            leanDeg: { type: ControlType.Number, title: "Hover Lean", min: 0, max: 30, step: 1, unit: "°", defaultValue: 8, description: "Wheel lean following the pointer's height." },
            hoverBoost: { type: ControlType.Number, title: "Hover Boost", min: 0, max: 100, step: 1, unit: "%", defaultValue: 40, description: "Speed change as the pointer moves toward or away from the direction of travel." },
            pressBoost: { type: ControlType.Number, title: "Press Boost", min: 0, max: 400, step: 1, unit: "%", defaultValue: 150, description: "Extra speed while pressed." },
            hoverEase: { type: ControlType.Number, title: "Hover Ease", min: 20, max: 2000, step: 10, unit: "ms", defaultValue: 250, description: "How quickly the pointer response settles." },
            dragCoast: { type: ControlType.Number, title: "Drag Coast", min: 20, max: 2000, step: 10, unit: "ms", defaultValue: 400, description: "How long the wheel keeps turning after a flick." },
            faceFront: { type: ControlType.Number, title: "Face Front Up To", min: 4, max: 36, step: 1, defaultValue: 8, description: "With this many tiles or fewer, every tile faces the front. Above it the tiles turn edge-on to the front more and more, reaching the paddle-wheel look 16 tiles later." },
            waveAmp: { type: ControlType.Number, title: "Wave", min: 0, max: 50, step: 1, unit: "%", defaultValue: 12, description: "Height of the up-and-down wave that runs round the wheel as it turns, as a % of tile size. 0 turns it off." },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening." },
        },
    },
})

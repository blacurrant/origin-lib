import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    hover: 50,
    grain: 0,
    vignette: 0,
    rowY: 50,
    loopPadX: 130,
    loopHeight: 264,
    loopOffsetY: 0,
    startAngle: 240,
    sweep: 310,
    spiral: 4,
    leadIn: 130,
    curl: 75,
    topFlatten: 8,
    bottomBulge: 6,
    tilt: -2,
    seed: 7,
    detail: 140,
    connectorSag: 15,
    moveMs: 850,
    skipExtra: 30,
    drawMs: 650,
    demoFirstMs: 1400,
    demoEveryMs: 2400,
    demoHideMs: 900,
    leanPx: 6,
    pressSquash: 6,
    strokeOpacity: 100,
    glow: 0,
    textOpacity: 100,
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

const DEFAULT_ITEMS = ["Home", "About", "Services", "Portfolio", "Contact"]
const TAU = Math.PI * 2
const DEG = Math.PI / 180

type Pt = { x: number; y: number }
type Box = { x: number; y: number; w: number; h: number }
type Loop = { cx: number; cy: number; rx: number; ry: number }
type Chain = {
    xs: Float32Array
    ys: Float32Array
    cum: Float32Array
    bounds: number[]
    loops: Loop[]
}
/** One end of the visible stroke: a Hermite tween in arc length, endpoints kept in chain units. */
type End = { fromU: number; toU: number; t0: number; dur: number; v0: number }

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const num = (v: any, d: number) => (typeof v === "number" && isFinite(v) ? v : d)

function itemList(v: any): string[] {
    if (!Array.isArray(v)) return DEFAULT_ITEMS
    const out = v.map((s: any) => (typeof s === "string" ? s : String(s ?? ""))).filter((s: string) => s.length > 0)
    return out.length ? out.slice(0, 8) : DEFAULT_ITEMS
}

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

function norm(x: number, y: number): Pt {
    const l = Math.hypot(x, y) || 1
    return { x: x / l, y: y / l }
}

function quad(a: Pt, c: Pt, b: Pt, steps: number): Pt[] {
    const out: Pt[] = []
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        out.push({
            x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
            y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
        })
    }
    return out
}

function cubic(a: Pt, b: Pt, c: Pt, d: Pt, steps: number): Pt[] {
    const out: Pt[] = []
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t
        out.push({
            x: w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x,
            y: w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y,
        })
    }
    return out
}

/**
 * One continuous stroke: for each item a lead-in rising from inside the loop, the loop drawn
 * clockwise, and a short curl flicking right; between items a smooth, nearly straight
 * connector at text height running from one curl into the next lead-in.
 * Item i spans chain units [2i, 2i + 1]; the connector after it spans [2i + 1, 2i + 2].
 */
function buildChain(boxes: Box[], f: number, wob: number, adv: typeof ADVANCED_DEFAULTS): Chain {
    const loops: Loop[] = []
    const loopPts: Pt[][] = []
    const starts: Pt[] = []
    const startDirs: Pt[] = []
    const ends: Pt[] = []
    const endDirs: Pt[] = []
    const detail = Math.max(24, Math.round(adv.detail))

    boxes.forEach((b, i) => {
        const rnd = rng(Math.round(adv.seed) * 977 + i * 131 + 1)
        const p1 = rnd() * TAU, p2 = rnd() * TAU, tj = rnd() - 0.5
        const cx = b.x + b.w / 2
        const cy = b.y + b.h / 2 + (f * adv.loopOffsetY) / 100
        const rx = b.w / 2 + (f * adv.loopPadX) / 100
        const ry = (f * adv.loopHeight) / 200
        const th0 = adv.startAngle * DEG
        const th1 = th0 + Math.max(90, adv.sweep) * DEG
        const tiltR = (adv.tilt + tj * 4 * wob) * DEG
        const ct = Math.cos(tiltR), st = Math.sin(tiltR)
        const at = (th: number, t: number): Pt => {
            const r = 1 + wob * (0.035 * Math.sin(2 * th + p1) + 0.022 * Math.sin(3 * th + p2)) + (adv.spiral / 100) * (t - 0.5)
            const s = Math.sin(th), c = Math.cos(th)
            const dx = rx * r * c
            let dy = ry * r * s
            if (s < 0) dy *= 1 - (adv.topFlatten / 100) * -s
            if (s > 0 && c > 0) dy += ry * (adv.bottomBulge / 100) * 2 * s * c
            return { x: cx + dx * ct - dy * st, y: cy + dx * st + dy * ct }
        }

        // lead-in: from inside, left of the label, rising into the top arc's tangent
        const J = at(th0, 0)
        const J2 = at(th0 + 0.01, 0)
        const T0 = norm(J2.x - J.x, J2.y - J.y)
        const li = (f * adv.leadIn) / 100
        const L0 = { x: J.x - 0.6 * li, y: J.y + 0.8 * li }
        const C0 = { x: J.x - T0.x * li * 0.45, y: J.y - T0.y * li * 0.45 }
        const lead = quad(L0, C0, J, 12)

        const body: Pt[] = []
        for (let k = 1; k <= detail; k++) {
            const t = k / detail
            body.push(at(th0 + (th1 - th0) * t, t))
        }

        // end curl: up the left side, then a short flick to the right
        const E = at(th1, 1)
        const E0 = at(th1 - 0.01, 1)
        const T1 = norm(E.x - E0.x, E.y - E0.y)
        const cl = (f * adv.curl) / 100
        const C2 = { x: E.x + T1.x * cl * 0.45, y: E.y + T1.y * cl * 0.45 }
        const TE = { x: E.x + cl * 0.95, y: E.y - cl * 0.45 }
        const curl = quad(E, C2, TE, 10).slice(1)

        loops.push({ cx, cy, rx, ry })
        loopPts.push([...lead, ...body, ...curl])
        starts.push(L0)
        startDirs.push(norm(C0.x - L0.x, C0.y - L0.y))
        ends.push(TE)
        endDirs.push(norm(TE.x - C2.x, TE.y - C2.y))
    })

    const segs: Pt[][] = []
    const sag = (f * adv.connectorSag) / 100
    for (let i = 0; i < boxes.length; i++) {
        segs.push(loopPts[i])
        if (i < boxes.length - 1) {
            const A = ends[i]
            const B = starts[i + 1]
            const D = Math.hypot(B.x - A.x, B.y - A.y)
            const c1 = { x: A.x + endDirs[i].x * D * 0.35, y: A.y + endDirs[i].y * D * 0.35 + sag }
            const c2 = { x: B.x - startDirs[i + 1].x * D * 0.1, y: B.y - startDirs[i + 1].y * D * 0.1 + sag }
            segs.push(cubic(A, c1, c2, B, 32))
        }
    }

    const all: Pt[] = []
    const startIdx: number[] = []
    for (const s of segs) {
        if (all.length === 0) {
            startIdx.push(0)
            all.push(...s)
        } else {
            startIdx.push(all.length - 1)
            for (let k = 1; k < s.length; k++) all.push(s[k])
        }
    }
    startIdx.push(all.length - 1)

    const xs = new Float32Array(all.length)
    const ys = new Float32Array(all.length)
    const cum = new Float32Array(all.length)
    for (let i = 0; i < all.length; i++) {
        xs[i] = all[i].x
        ys[i] = all[i].y
        cum[i] = i === 0 ? 0 : cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])
    }
    const bounds = startIdx.map((k) => cum[k])
    return { xs, ys, cum, bounds, loops }
}

function search(cum: Float32Array, s: number) {
    let lo = 0, hi = cum.length - 1
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (cum[mid] <= s) lo = mid
        else hi = mid - 1
    }
    return lo
}

function pointAt(ch: Chain, s: number): Pt {
    const n = ch.cum.length
    const i = search(ch.cum, s)
    if (i >= n - 1) return { x: ch.xs[n - 1], y: ch.ys[n - 1] }
    const span = ch.cum[i + 1] - ch.cum[i] || 1
    const t = clamp((s - ch.cum[i]) / span, 0, 1)
    return { x: ch.xs[i] + (ch.xs[i + 1] - ch.xs[i]) * t, y: ch.ys[i] + (ch.ys[i + 1] - ch.ys[i]) * t }
}

function uToS(ch: Chain, u: number) {
    const last = ch.bounds.length - 1
    const uu = clamp(u, 0, last)
    const m = Math.min(Math.floor(uu), last - 1)
    const fr = uu - m
    return ch.bounds[m] + fr * (ch.bounds[m + 1] - ch.bounds[m])
}

function sToU(ch: Chain, s: number) {
    const b = ch.bounds
    if (s <= b[0]) return 0
    for (let m = 0; m < b.length - 1; m++) {
        if (s < b[m + 1]) return m + (s - b[m]) / (b[m + 1] - b[m] || 1)
    }
    return b.length - 1
}

function tracePath(ctx: CanvasRenderingContext2D, ch: Chain, a: number, b: number) {
    const total = ch.cum[ch.cum.length - 1]
    const lo = clamp(a, 0, total), hi = clamp(b, 0, total)
    const p0 = pointAt(ch, lo)
    ctx.moveTo(p0.x, p0.y)
    let j = search(ch.cum, lo) + 1
    while (j < ch.cum.length && ch.cum[j] < hi) {
        ctx.lineTo(ch.xs[j], ch.ys[j])
        j++
    }
    const p1 = pointAt(ch, hi)
    ctx.lineTo(p1.x, p1.y)
}

function makeEnd(): End {
    return { fromU: 0, toU: 0, t0: 0, dur: 0, v0: 0 }
}

/** Arc length of an end at time t: cubic Hermite from the start point and velocity to rest at the goal. */
function endS(ch: Chain, e: End, t: number) {
    const to = uToS(ch, e.toU)
    if (e.dur <= 0 || t >= e.t0 + e.dur) return to
    const from = uToS(ch, e.fromU)
    if (t <= e.t0) return from
    const s = (t - e.t0) / e.dur
    const s2 = s * s, s3 = s2 * s
    return from * (2 * s3 - 3 * s2 + 1) + to * (-2 * s3 + 3 * s2) + e.v0 * e.dur * (s3 - 2 * s2 + s)
}

/**
 * Scribble Loop Nav — a hand-drawn loop circles the hovered menu item and travels
 * along one continuous stroke (loop → line through the labels → next loop) when the item changes.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function ScribbleLoopNav(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        textColor = "#F2F2F2",
        strokeColor = "#EEC12A",
        font,
        items = ["Home", "About", "Services", "Portfolio", "Contact"],
        active = 4,
        size = 24,
        gap = 72,
        strokeWidth = 3,
        speed = 32,
        stretch = 35,
        wobble = 50,
        leave = "hide",
        demo = true,
        style,
    } = props

    const propsRef = useRef<any>(props)
    propsRef.current = { ...props, background, textColor, strokeColor, items, active, size, gap, strokeWidth, speed, stretch, wobble, leave, demo }

    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rowRef = useRef<HTMLDivElement>(null)
    const hitRef = useRef<HTMLDivElement>(null)
    const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
    const [grainUrl, setGrainUrl] = useState("")

    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }
    const list = itemList(items)
    labelRefs.current.length = list.length

    useEffect(() => {
        try {
            const c = document.createElement("canvas")
            c.width = c.height = 128
            const g = c.getContext("2d")
            if (!g) return
            const img = g.createImageData(128, 128)
            const d = img.data
            for (let i = 0; i < d.length; i += 4) {
                const v = Math.random() * 255
                d[i] = d[i + 1] = d[i + 2] = v
                d[i + 3] = 255
            }
            g.putImageData(img, 0, 0)
            setGrainUrl(c.toDataURL())
        } catch (e) {}
    }, [])

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        const row = rowRef.current
        const hit = hitRef.current
        if (!root || !canvas || !row || !hit) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let w = 1, h = 1, dpr = 1
        const resize = () => {
            w = Math.max(1, root.offsetWidth)
            h = Math.max(1, root.offsetHeight)
            dpr = Math.min(2, window.devicePixelRatio || 1)
            canvas.width = Math.max(1, Math.round(w * dpr))
            canvas.height = Math.max(1, Math.round(h * dpr))
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(root)

        const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null

        const ptr = { x: 0, y: 0, inside: false, down: false }
        const onMove = (e: PointerEvent) => {
            ptr.x = e.offsetX
            ptr.y = e.offsetY
            ptr.inside = true
        }
        const onLeave = () => {
            ptr.inside = false
            ptr.down = false
        }
        let hovered = -1
        let chosen = -1
        const onDown = (e: PointerEvent) => {
            onMove(e)
            ptr.down = true
            if (hovered >= 0) chosen = hovered
        }
        const onUp = () => {
            ptr.down = false
        }
        hit.addEventListener("pointermove", onMove)
        hit.addEventListener("pointerenter", onMove)
        hit.addEventListener("pointerleave", onLeave)
        hit.addEventListener("pointerdown", onDown)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        let chain: Chain | null = null
        let sig = ""
        let clock = 0
        let last = -1
        let raf = 0
        const head = makeEnd()
        const tail = makeEnd()
        let target = -1
        let hidden = false
        let wasIn = false
        let prevAct = -1
        let demoDir = -1
        let nextDemo = -1
        let curMove = 850, curDraw = 650, curSkip = 30, curStretch = 0.35
        let over = 0, press = 0, leanX = 0, leanY = 0
        let lastCursor = ""

        const setEnd = (e: End, u: number) => {
            e.fromU = u
            e.toU = u
            e.dur = 0
            e.v0 = 0
            e.t0 = clock
        }
        // retarget from wherever the end is now, carrying its velocity so the stroke never kinks
        const aim = (e: End, u: number, dur: number, delay: number) => {
            if (!chain) return
            const ch = chain
            const cur = endS(ch, e, clock)
            const v = (cur - endS(ch, e, clock - 8)) / 8
            e.fromU = sToU(ch, cur)
            e.toU = u
            e.dur = Math.max(0, dur)
            e.v0 = e.dur > 0 ? v : 0
            e.t0 = clock + (Math.abs(v) > 0.001 ? 0 : delay)
            if (e.dur <= 0) e.fromU = u
        }
        const go = (k: number) => {
            if (!chain) return
            if (hidden) {
                setEnd(tail, 2 * k)
                setEnd(head, 2 * k)
                aim(head, 2 * k + 1, curDraw, 0)
                hidden = false
                target = k
                return
            }
            if (k === target) return
            const steps = Math.max(1, Math.abs(k - target))
            const D = curMove * (1 + (curSkip / 100) * (steps - 1))
            const lag = D * curStretch
            const curU = sToU(chain, endS(chain, tail, clock))
            if (2 * k > curU) {
                aim(head, 2 * k + 1, D, 0)
                aim(tail, 2 * k, D, lag)
            } else {
                aim(tail, 2 * k, D, 0)
                aim(head, 2 * k + 1, D, lag)
            }
            target = k
        }
        const hide = () => {
            if (hidden) return
            hidden = true
            aim(tail, head.toU, curDraw, 0)
        }

        const frame = (t: number) => {
            raf = requestAnimationFrame(frame)
            const p = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const dt = last < 0 ? 0 : Math.min((t - last) / 1000, 1 / 20)
            last = t
            const spd = clamp(num(p.speed, 50), 0, 100) / 50
            clock += dt * 1000 * spd
            const reduce = !!(mq && mq.matches)
            const hk = clamp(num(a.hover, 50), 0, 100) / 50

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, w, h)

            const names = itemList(p.items)
            const n = names.length
            const boxes: Box[] = []
            for (let i = 0; i < n; i++) {
                const el = labelRefs.current[i]
                if (!el) break
                boxes.push({ x: row.offsetLeft + el.offsetLeft, y: row.offsetTop + el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })
            }
            if (boxes.length !== n || n === 0) return

            const f = Math.max(4, num(p.size, 24))
            const wob = clamp(num(p.wobble, 50), 0, 100) / 50
            const nextSig = JSON.stringify([
                boxes.map((b) => [Math.round(b.x * 2), Math.round(b.y * 2), Math.round(b.w * 2), Math.round(b.h * 2)]),
                f, wob, a.loopPadX, a.loopHeight, a.loopOffsetY, a.startAngle, a.sweep, a.spiral,
                a.leadIn, a.curl, a.topFlatten, a.bottomBulge, a.tilt, a.seed, a.detail, a.connectorSag,
            ])
            if (nextSig !== sig) {
                chain = buildChain(boxes, f, wob, a)
                sig = nextSig
            }
            const ch = chain as Chain

            curMove = reduce ? 0 : Math.max(0, num(a.moveMs, 850))
            curDraw = reduce ? 0 : Math.max(0, num(a.drawMs, 650))
            curSkip = Math.max(0, num(a.skipExtra, 30))
            curStretch = clamp(num(p.stretch, 35), 0, 100) / 100
            const demoFirst = Math.max(0, num(a.demoFirstMs, 1400))
            const demoEvery = Math.max(200, num(a.demoEveryMs, 2400))
            const demoHide = Math.max(0, num(a.demoHideMs, 900))

            const act = clamp(Math.round(num(p.active, 4)) - 1, 0, n - 1)
            if (target < 0 || target >= n) {
                target = act
                hidden = false
                setEnd(tail, 2 * act)
                setEnd(head, 2 * act + 1)
                demoDir = act > 0 ? -1 : 1
                nextDemo = clock + demoFirst
                prevAct = act
            }
            if (prevAct !== act) {
                prevAct = act
                if (!ptr.inside) {
                    chosen = -1
                    go(act)
                    demoDir = act > 0 ? -1 : 1
                    nextDemo = clock + demoEvery
                }
            }

            // which item is under the pointer
            hovered = -1
            if (ptr.inside) {
                const gp = Math.max(0, num(p.gap, 72))
                let best = Infinity
                ch.loops.forEach((L, i) => {
                    if (Math.abs(ptr.y - L.cy) > L.ry * 1.3) return
                    const dx = Math.abs(ptr.x - L.cx)
                    if (dx <= L.rx + gp / 2 && dx < best) {
                        best = dx
                        hovered = i
                    }
                })
            }
            const cursor = hovered >= 0 ? "pointer" : "default"
            if (cursor !== lastCursor) {
                hit.style.cursor = cursor
                lastCursor = cursor
            }
            if (hovered >= 0 && (hidden || hovered !== target)) go(hovered)

            if (ptr.inside) {
                wasIn = true
                nextDemo = clock + demoEvery
            } else if (wasIn) {
                wasIn = false
                if (p.leave === "return") go(chosen >= 0 ? clamp(chosen, 0, n - 1) : act)
                else if (p.leave === "hide") hide()
                nextDemo = clock + demoEvery
            }

            // demo: walk item by item toward one end, wipe the loop away, redraw it on the active item
            if (p.demo && !reduce && !ptr.inside && clock >= nextDemo) {
                if (hidden) {
                    demoDir = act > 0 ? -1 : 1
                    go(act)
                    nextDemo = clock + demoFirst
                } else {
                    const i = target + demoDir
                    if (n > 1 && i >= 0 && i < n) {
                        go(i)
                        nextDemo = clock + demoEvery
                    } else {
                        hide()
                        nextDemo = clock + curDraw + demoHide
                    }
                }
            }

            // pointer response: the stroke leans toward the pointer and squashes on press
            const kk = 1 - Math.exp(-dt * 8)
            over += ((ptr.inside ? 1 : 0) - over) * kk
            press += ((ptr.down ? 1 : 0) - press) * (1 - Math.exp(-dt * 14))
            const L = ch.loops[clamp(target, 0, n - 1)]
            const lp = Math.max(0, num(a.leanPx, 6)) * hk * over
            const tx = ptr.inside ? clamp((ptr.x - L.cx) / Math.max(1, L.rx * 2), -1, 1) * lp : 0
            const ty = ptr.inside ? clamp((ptr.y - L.cy) / Math.max(1, L.ry * 2), -1, 1) * lp * 0.6 : 0
            leanX += (tx - leanX) * kk
            leanY += (ty - leanY) * kk
            const sq = press * (clamp(num(a.pressSquash, 6), 0, 100) / 100) * hk

            const sT = endS(ch, tail, clock)
            const sH = endS(ch, head, clock)
            const lo = Math.min(sT, sH)
            const hi = Math.max(sT, sH)
            if (hi - lo > 0.5) {
                ctx.save()
                ctx.translate(leanX, leanY)
                if (sq > 0.0005) {
                    ctx.translate(L.cx, L.cy)
                    ctx.scale(1 + sq * 0.5, 1 - sq)
                    ctx.translate(-L.cx, -L.cy)
                }
                ctx.globalAlpha = clamp(num(a.strokeOpacity, 100), 0, 100) / 100
                ctx.strokeStyle = p.strokeColor
                ctx.lineWidth = Math.max(0.5, num(p.strokeWidth, 3))
                ctx.lineCap = "round"
                ctx.lineJoin = "round"
                const g = clamp(num(a.glow, 0), 0, 100)
                if (g > 0) {
                    ctx.shadowColor = p.strokeColor
                    ctx.shadowBlur = g * 0.3
                }
                ctx.beginPath()
                tracePath(ctx, ch, lo, hi)
                ctx.stroke()
                ctx.restore()
            }
        }
        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            hit.removeEventListener("pointermove", onMove)
            hit.removeEventListener("pointerenter", onMove)
            hit.removeEventListener("pointerleave", onLeave)
            hit.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
        }
    }, [])

    const fontCss: React.CSSProperties = {}
    if (font && typeof font === "object") {
        if (font.fontFamily) fontCss.fontFamily = font.fontFamily
        if (font.fontWeight) fontCss.fontWeight = font.fontWeight
        if (font.fontStyle) fontCss.fontStyle = font.fontStyle
        if (font.letterSpacing !== undefined) fontCss.letterSpacing = font.letterSpacing
        if (font.lineHeight !== undefined) fontCss.lineHeight = font.lineHeight
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
                isolation: "isolate",
            }}
        >
            <div
                ref={rowRef}
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${adv.rowY - 50}%`,
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap,
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                }}
            >
                {list.map((label, i) => (
                    <span
                        key={i}
                        ref={(el) => {
                            labelRefs.current[i] = el
                        }}
                        style={{
                            display: "block",
                            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                            lineHeight: 1.2,
                            ...fontCss,
                            fontSize: size,
                            color: textColor,
                            opacity: clamp(adv.textOpacity, 0, 100) / 100,
                        }}
                    >
                        {label}
                    </span>
                ))}
            </div>
            <canvas
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
            />
            {adv.grain > 0 && grainUrl ? (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: `url(${grainUrl})`,
                        backgroundSize: "128px 128px",
                        opacity: (clamp(adv.grain, 0, 100) / 100) * 0.35,
                        mixBlendMode: "overlay",
                        pointerEvents: "none",
                    }}
                />
            ) : null}
            {adv.vignette > 0 ? (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${clamp(adv.vignette, 0, 100) / 100}) 100%)`,
                        pointerEvents: "none",
                    }}
                />
            ) : null}
            <div ref={hitRef} style={{ position: "absolute", inset: 0 }} />
        </div>
    )
}

addPropertyControls(ScribbleLoopNav, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    textColor: { type: ControlType.Color, title: "Text", defaultValue: "#F2F2F2" },
    strokeColor: { type: ControlType.Color, title: "Stroke", defaultValue: "#EEC12A" },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 24, variant: "Medium", letterSpacing: "-0.01em", lineHeight: "1.2em" },
    },
    items: {
        type: ControlType.Array,
        title: "Items",
        control: { type: ControlType.String },
        maxCount: 8,
        defaultValue: ["Home", "About", "Services", "Portfolio", "Contact"],
    },
    active: { type: ControlType.Number, title: "Active", defaultValue: 4, min: 1, max: 8, step: 1, displayStepper: true },
    size: { type: ControlType.Number, title: "Size", defaultValue: 24, min: 10, max: 80, step: 1, unit: "px" },
    gap: { type: ControlType.Number, title: "Gap", defaultValue: 72, min: 0, max: 200, step: 1, unit: "px" },
    strokeWidth: { type: ControlType.Number, title: "Stroke Width", defaultValue: 3, min: 1, max: 12, step: 1, unit: "px" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 32, min: 0, max: 100, step: 1 },
    stretch: { type: ControlType.Number, title: "Stretch", defaultValue: 35, min: 0, max: 100, step: 1, unit: "%" },
    wobble: { type: ControlType.Number, title: "Wobble", defaultValue: 50, min: 0, max: 100, step: 1, unit: "%" },
    leave: {
        type: ControlType.Enum,
        title: "On Leave",
        options: ["stay", "return", "hide"],
        optionTitles: ["Stay", "Return", "Hide"],
        defaultValue: "hide",
    },
    demo: { type: ControlType.Boolean, title: "Demo", defaultValue: true, enabledTitle: "On", disabledTitle: "Off" },
    hover: { type: ControlType.Number, title: "Hover", defaultValue: 50, min: 0, max: 100, step: 1, unit: "%" },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", defaultValue: 0, min: 0, max: 100, step: 1, unit: "%" },
            vignette: { type: ControlType.Number, title: "Vignette", defaultValue: 0, min: 0, max: 100, step: 1, unit: "%" },
            rowY: { type: ControlType.Number, title: "Row Y", defaultValue: 50, min: 0, max: 100, step: 1, unit: "%" },
            loopPadX: { type: ControlType.Number, title: "Loop Pad X", defaultValue: 130, min: 0, max: 400, step: 1, unit: "%" },
            loopHeight: { type: ControlType.Number, title: "Loop Height", defaultValue: 264, min: 100, max: 600, step: 1, unit: "%" },
            loopOffsetY: { type: ControlType.Number, title: "Loop Offset Y", defaultValue: 0, min: -100, max: 100, step: 1, unit: "%" },
            startAngle: { type: ControlType.Number, title: "Start Angle", defaultValue: 240, min: 0, max: 360, step: 1, unit: "°" },
            sweep: { type: ControlType.Number, title: "Sweep", defaultValue: 310, min: 90, max: 420, step: 1, unit: "°" },
            spiral: { type: ControlType.Number, title: "Spiral", defaultValue: 4, min: -30, max: 30, step: 1, unit: "%" },
            leadIn: { type: ControlType.Number, title: "Lead-in", defaultValue: 130, min: 0, max: 300, step: 1, unit: "%" },
            curl: { type: ControlType.Number, title: "End Curl", defaultValue: 75, min: 0, max: 200, step: 1, unit: "%" },
            topFlatten: { type: ControlType.Number, title: "Top Flatten", defaultValue: 8, min: 0, max: 50, step: 1, unit: "%" },
            bottomBulge: { type: ControlType.Number, title: "Bottom Bulge", defaultValue: 6, min: 0, max: 50, step: 1, unit: "%" },
            tilt: { type: ControlType.Number, title: "Tilt", defaultValue: -2, min: -20, max: 20, step: 1, unit: "°" },
            seed: { type: ControlType.Number, title: "Seed", defaultValue: 7, min: 1, max: 999, step: 1 },
            detail: { type: ControlType.Number, title: "Detail", defaultValue: 140, min: 24, max: 400, step: 1 },
            connectorSag: { type: ControlType.Number, title: "Line Sag", defaultValue: 15, min: -100, max: 200, step: 1, unit: "%" },
            moveMs: { type: ControlType.Number, title: "Move", defaultValue: 850, min: 0, max: 4000, step: 10, unit: "ms" },
            skipExtra: { type: ControlType.Number, title: "Skip Extra", defaultValue: 30, min: 0, max: 100, step: 1, unit: "%" },
            drawMs: { type: ControlType.Number, title: "Draw", defaultValue: 650, min: 0, max: 4000, step: 10, unit: "ms" },
            demoFirstMs: { type: ControlType.Number, title: "Demo First", defaultValue: 1400, min: 0, max: 10000, step: 100, unit: "ms" },
            demoEveryMs: { type: ControlType.Number, title: "Demo Every", defaultValue: 2400, min: 200, max: 10000, step: 100, unit: "ms" },
            demoHideMs: { type: ControlType.Number, title: "Demo Hidden", defaultValue: 900, min: 0, max: 10000, step: 100, unit: "ms" },
            leanPx: { type: ControlType.Number, title: "Lean", defaultValue: 6, min: 0, max: 40, step: 1, unit: "px" },
            pressSquash: { type: ControlType.Number, title: "Press Squash", defaultValue: 6, min: 0, max: 40, step: 1, unit: "%" },
            strokeOpacity: { type: ControlType.Number, title: "Stroke Opacity", defaultValue: 100, min: 0, max: 100, step: 1, unit: "%" },
            glow: { type: ControlType.Number, title: "Glow", defaultValue: 0, min: 0, max: 100, step: 1, unit: "%" },
            textOpacity: { type: ControlType.Number, title: "Text Opacity", defaultValue: 100, min: 0, max: 100, step: 1, unit: "%" },
        },
    },
})

import * as React from "react"
import { useEffect, useMemo, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    hover: 50,
    grain: 0,
    vignette: 0,
    fanBuildMs: 1000,
    dustBuildMs: 1100,
    holdMs: 1800,
    gapMs: 450,
    stagger: 40,
    jitterMs: 40,
    landPower: 3,
    seedOffset: 20,
    fanWidth: 100,
    fanHeight: 60,
    bow: 35,
    barLength: 250,
    barWidth: 50,
    trailColor: "#6E6E6E",
    trailOpacity: 40,
    trailWidth: 1,
    particles: 14,
    particleSize: 2,
    particleColor: "#9A9A9A",
    particleOpacity: 70,
    dustWidth: 105,
    dustHeight: 110,
    dustJitter: 50,
    pointerPush: 40,
    buttonSize: 15,
    buttonGap: 33,
    buttonRadius: 25,
    buttonFill: "#121212",
    buttonBorder: "#2C2C2C",
    glyphColor: "#E5E5E5",
    lift: 0,
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

// ── QR encoder (byte mode, error correction M, versions 1–10) ──
const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]

function rawModules(v: number) {
    let r = (16 * v + 128) * v + 64
    if (v >= 2) {
        const a = Math.floor(v / 7) + 2
        r -= (25 * a - 10) * a - 55
        if (v >= 7) r -= 36
    }
    return r
}
function gfMul(x: number, y: number) {
    let z = 0
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d)
        z ^= ((y >>> i) & 1) * x
    }
    return z
}
function rsDivisor(deg: number) {
    const r: number[] = new Array(deg).fill(0)
    r[deg - 1] = 1
    let root = 1
    for (let i = 0; i < deg; i++) {
        for (let j = 0; j < deg; j++) {
            r[j] = gfMul(r[j], root)
            if (j + 1 < deg) r[j] ^= r[j + 1]
        }
        root = gfMul(root, 2)
    }
    return r
}
function rsRemainder(data: number[], div: number[]) {
    const r: number[] = div.map(() => 0)
    for (const b of data) {
        const f = b ^ (r.shift() as number)
        r.push(0)
        for (let i = 0; i < div.length; i++) r[i] ^= gfMul(div[i], f)
    }
    return r
}

const MASKS: ((x: number, y: number) => boolean)[] = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function encodeQR(text: string): { n: number; cells: Uint8Array } {
    const bytes = Array.from(new TextEncoder().encode(text || " "))
    const dataCap = (v: number) => (Math.floor(rawModules(v) / 8) - ECC_M[v] * BLOCKS_M[v]) * 8
    const need = (v: number, len: number) => 4 + (v < 10 ? 8 : 16) + len * 8
    let ver = 1
    while (ver < 10 && need(ver, bytes.length) > dataCap(ver)) ver++
    while (need(ver, bytes.length) > dataCap(ver)) bytes.pop()

    const bits: number[] = []
    const push = (val: number, len: number) => {
        for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
    }
    push(4, 4)
    push(bytes.length, ver < 10 ? 8 : 16)
    for (const b of bytes) push(b, 8)
    const cap = dataCap(ver)
    push(0, Math.min(4, cap - bits.length))
    push(0, (8 - (bits.length % 8)) % 8)
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8)
    const data: number[] = []
    for (let i = 0; i < bits.length; i += 8) {
        let b = 0
        for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]
        data.push(b)
    }

    const nb = BLOCKS_M[ver]
    const ecl = ECC_M[ver]
    const raw = Math.floor(rawModules(ver) / 8)
    const nShort = nb - (raw % nb)
    const shortLen = Math.floor(raw / nb)
    const div = rsDivisor(ecl)
    const blocks: number[][] = []
    for (let i = 0, k = 0; i < nb; i++) {
        const dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1))
        k += dat.length
        const ecc = rsRemainder(dat, div)
        if (i < nShort) dat.push(0)
        blocks.push(dat.concat(ecc))
    }
    const words: number[] = []
    for (let i = 0; i < blocks[0].length; i++)
        for (let j = 0; j < blocks.length; j++)
            if (i !== shortLen - ecl || j >= nShort) words.push(blocks[j][i])

    const n = ver * 4 + 17
    const mod = new Uint8Array(n * n)
    const fn = new Uint8Array(n * n)
    const set = (x: number, y: number, d: boolean) => {
        mod[y * n + x] = d ? 1 : 0
        fn[y * n + x] = 1
    }
    for (let i = 0; i < n; i++) {
        set(6, i, i % 2 === 0)
        set(i, 6, i % 2 === 0)
    }
    const finder = (cx: number, cy: number) => {
        for (let dy = -4; dy <= 4; dy++)
            for (let dx = -4; dx <= 4; dx++) {
                const d = Math.max(Math.abs(dx), Math.abs(dy))
                const x = cx + dx
                const y = cy + dy
                if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4)
            }
    }
    finder(3, 3)
    finder(n - 4, 3)
    finder(3, n - 4)
    if (ver > 1) {
        const na = Math.floor(ver / 7) + 2
        const step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2
        const pos = [6]
        for (let p = n - 7; pos.length < na; p -= step) pos.splice(1, 0, p)
        for (let i = 0; i < na; i++)
            for (let j = 0; j < na; j++) {
                if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue
                for (let dy = -2; dy <= 2; dy++)
                    for (let dx = -2; dx <= 2; dx++)
                        set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
            }
    }
    const writeFormat = (target: Uint8Array, mask: number, mark: boolean) => {
        const d = (0 << 3) | mask
        let r = d
        for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
        const b = ((d << 10) | r) ^ 0x5412
        const w = (x: number, y: number, i: number) => {
            target[y * n + x] = (b >>> i) & 1
            if (mark) fn[y * n + x] = 1
        }
        for (let i = 0; i <= 5; i++) w(8, i, i)
        w(8, 7, 6)
        w(8, 8, 7)
        w(7, 8, 8)
        for (let i = 9; i < 15; i++) w(14 - i, 8, i)
        for (let i = 0; i < 8; i++) w(n - 1 - i, 8, i)
        for (let i = 8; i < 15; i++) w(8, n - 15 + i, i)
        target[(n - 8) * n + 8] = 1
        if (mark) fn[(n - 8) * n + 8] = 1
    }
    writeFormat(mod, 0, true)
    if (ver >= 7) {
        let r = ver
        for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25)
        const b = (ver << 12) | r
        for (let i = 0; i < 18; i++) {
            const bit = ((b >>> i) & 1) === 1
            const a = n - 11 + (i % 3)
            const c = Math.floor(i / 3)
            set(a, c, bit)
            set(c, a, bit)
        }
    }
    let bi = 0
    for (let right = n - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5
        for (let v = 0; v < n; v++)
            for (let j = 0; j < 2; j++) {
                const x = right - j
                const up = ((right + 1) & 2) === 0
                const y = up ? n - 1 - v : v
                if (!fn[y * n + x] && bi < words.length * 8) {
                    mod[y * n + x] = (words[bi >>> 3] >>> (7 - (bi & 7))) & 1
                    bi++
                }
            }
    }
    const penalty = (a: Uint8Array) => {
        let p = 0
        let dark = 0
        for (let y = 0; y < n; y++) {
            let runX = 1
            let runY = 1
            for (let x = 0; x < n; x++) {
                dark += a[y * n + x]
                if (x > 0) {
                    if (a[y * n + x] === a[y * n + x - 1]) runX++
                    else {
                        if (runX >= 5) p += runX - 2
                        runX = 1
                    }
                    if (a[x * n + y] === a[(x - 1) * n + y]) runY++
                    else {
                        if (runY >= 5) p += runY - 2
                        runY = 1
                    }
                }
            }
            if (runX >= 5) p += runX - 2
            if (runY >= 5) p += runY - 2
        }
        for (let y = 0; y < n - 1; y++)
            for (let x = 0; x < n - 1; x++) {
                const v = a[y * n + x]
                if (v === a[y * n + x + 1] && v === a[(y + 1) * n + x] && v === a[(y + 1) * n + x + 1]) p += 3
            }
        p += Math.max(0, Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10
        return p
    }
    let best = mod
    let bestScore = Infinity
    for (let m = 0; m < 8; m++) {
        const out = mod.slice()
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) if (!fn[y * n + x] && MASKS[m](x, y)) out[y * n + x] ^= 1
        writeFormat(out, m, false)
        const sc = penalty(out)
        if (sc < bestScore) {
            bestScore = sc
            best = out
        }
    }
    return { n, cells: best }
}

// ── helpers ──
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (a: number, b: number, x: number) => {
    const t = clamp01((x - a) / (b - a))
    return t * t * (3 - 2 * t)
}
function bezier(x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx
    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by
    const sx = (t: number) => ((ax * t + bx) * t + cx) * t
    const sy = (t: number) => ((ay * t + by) * t + cy) * t
    const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let t = x
        for (let i = 0; i < 8; i++) {
            const e = sx(t) - x
            const d = dx(t)
            if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break
            t -= e / d
        }
        return sy(Math.min(1, Math.max(0, t)))
    }
}
const flyEase = bezier(0.42, 0, 0.22, 1)

type ImgEntry = { img: HTMLImageElement; ok: boolean; tints: Record<string, HTMLCanvasElement> }
const IMG_CACHE = new Map<string, ImgEntry>()
function getImage(src: string): ImgEntry {
    let e = IMG_CACHE.get(src)
    if (!e) {
        const img = new Image()
        e = { img, ok: false, tints: {} }
        const entry = e
        img.onload = () => {
            entry.ok = true
        }
        img.src = src
        IMG_CACHE.set(src, e)
    }
    return e
}
function tinted(e: ImgEntry, color: string) {
    if (e.tints[color]) return e.tints[color]
    const iw = e.img.naturalWidth || 128
    const ih = e.img.naturalHeight || 128
    const sc = 256 / Math.max(iw, ih)
    const c = document.createElement("canvas")
    c.width = Math.max(1, Math.round(iw * sc))
    c.height = Math.max(1, Math.round(ih * sc))
    const g = c.getContext("2d")
    if (g) {
        g.drawImage(e.img, 0, 0, c.width, c.height)
        g.globalCompositeOperation = "source-in"
        g.fillStyle = color
        g.fillRect(0, 0, c.width, c.height)
    }
    e.tints[color] = c
    return c
}
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
}

/**
 * QR Code Assemble — every module of a QR code flies out of the button on its
 * own curved path and settles straight into its cell, as thin bars (Fan) or
 * fine dust (Dust). Click to rebuild.
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function QRCodeAssemble(props: any) {
    props = withMovedControls(props)
    const {
        variant = "fan",
        text = "https://originkit.dev",
        background = "#000000",
        color = "#F2F2F2",
        size = 380,
        speed = 50,
        spread = 50,
        showButton = true,
        loop = true,
        tint = true,
        play = false,
        style,
    } = props

    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const qr = useMemo(() => encodeQR(String(text)), [text])
    const propsRef = useRef<any>(null)
    propsRef.current = { ...props, variant, background, color, size, speed, spread, showButton, loop, tint, play, qr }

    useEffect(() => {
        const canvas = canvasRef.current
        const root = rootRef.current
        if (!canvas || !root) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const rt = RenderTarget.current()
        const isCanvas = rt === RenderTarget.canvas
        const isStatic = rt === RenderTarget.export || rt === RenderTarget.thumbnail
        const reduce =
            typeof window !== "undefined" && window.matchMedia
                ? window.matchMedia("(prefers-reduced-motion: reduce)")
                : null

        const st = {
            w: 1,
            h: 1,
            dpr: 1,
            clock: 0,
            cycleStart: 0,
            pending: false,
            completed: -1,
            lastVariant: "",
            lastPlay: propsRef.current.play,
            lastQR: null as any,
            D: 1000,
            hold: 1800,
            mx: -9999,
            my: -9999,
            overT: 0,
            over: 0,
            downT: 0,
            press: 0,
            btnT: 0,
            btn: 0,
            bx: 0,
            by: 0,
            bs: 0,
            // module data
            modKey: "",
            mc: new Int16Array(0),
            mr: new Int16Array(0),
            m1: new Float32Array(0),
            m2: new Float32Array(0),
            solid: new Float32Array(0),
            // particle data
            pKey: "",
            pm: new Int32Array(0),
            pd: new Float32Array(0),
            px: new Float32Array(0),
            py: new Float32Array(0),
            pb: new Uint8Array(0),
            noise: null as HTMLCanvasElement | null,
            pattern: null as CanvasPattern | null,
        }

        const resize = () => {
            const w = root.offsetWidth
            const h = root.offsetHeight
            const dpr = Math.min(2, window.devicePixelRatio || 1)
            st.w = Math.max(1, w)
            st.h = Math.max(1, h)
            st.dpr = dpr
            canvas.width = Math.max(1, Math.round(st.w * dpr))
            canvas.height = Math.max(1, Math.round(st.h * dpr))
            canvas.style.width = st.w + "px"
            canvas.style.height = st.h + "px"
        }
        const ro = new ResizeObserver(resize)
        ro.observe(root)
        resize()

        const hash = (i: number, seed: number) => {
            const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453
            return x - Math.floor(x)
        }

        const ensureData = (q: { n: number; cells: Uint8Array }, adv: any) => {
            const key = q.n + ":" + adv.seed
            if (st.lastQR !== q || st.modKey !== key) {
                const list: number[] = []
                for (let i = 0; i < q.cells.length; i++) if (q.cells[i]) list.push(i)
                st.mc = new Int16Array(list.length)
                st.mr = new Int16Array(list.length)
                st.m1 = new Float32Array(list.length)
                st.m2 = new Float32Array(list.length)
                st.solid = new Float32Array(list.length)
                list.forEach((idx, k) => {
                    st.mc[k] = idx % q.n
                    st.mr[k] = Math.floor(idx / q.n)
                    st.m1[k] = hash(k + 1, adv.seed)
                    st.m2[k] = hash(k + 911, adv.seed)
                })
                st.modKey = key
                st.pKey = ""
            }
            const ppm = Math.max(1, Math.round(adv.particles))
            const pkey = st.modKey + ":" + ppm + ":" + st.mc.length
            if (st.pKey !== pkey || st.lastQR !== q) {
                const count = st.mc.length * ppm
                st.pm = new Int32Array(count)
                st.pd = new Float32Array(count * 8)
                st.px = new Float32Array(count)
                st.py = new Float32Array(count)
                st.pb = new Uint8Array(count)
                for (let i = 0; i < count; i++) {
                    st.pm[i] = Math.floor(i / ppm)
                    const o = i * 8
                    const a = hash(i * 7 + 3, adv.seed) * Math.PI * 2
                    const r = Math.sqrt(hash(i * 7 + 4, adv.seed))
                    st.pd[o] = Math.cos(a) * r
                    st.pd[o + 1] = Math.sin(a) * r
                    st.pd[o + 2] = Math.PI * (1.02 + 0.96 * hash(i * 7 + 5, adv.seed))
                    st.pd[o + 3] = Math.pow(hash(i * 7 + 6, adv.seed), 0.6)
                    st.pd[o + 4] = hash(i * 7 + 7, adv.seed)
                    st.pd[o + 5] = hash(i * 7 + 8, adv.seed)
                    st.pd[o + 6] = hash(i * 7 + 9, adv.seed) * Math.PI * 2
                    st.pd[o + 7] = hash(i * 7 + 10, adv.seed)
                }
                st.pKey = pkey
            }
            st.lastQR = q
        }

        const restart = () => {
            st.cycleStart = st.clock - (st.D + st.hold)
            st.pending = true
            st.completed = -1
        }

        const onMove = (e: PointerEvent) => {
            st.mx = e.offsetX
            st.my = e.offsetY
            st.overT = 1
            st.btnT =
                Math.abs(st.mx - st.bx) < st.bs / 2 && Math.abs(st.my - st.by) < st.bs / 2 ? 1 : 0
        }
        const onLeave = () => {
            st.overT = 0
            st.btnT = 0
        }
        const onDown = (e: PointerEvent) => {
            onMove(e)
            st.downT = 1
        }
        const onUp = () => {
            st.downT = 0
        }
        const onClick = () => restart()
        canvas.addEventListener("pointermove", onMove)
        canvas.addEventListener("pointerenter", onMove)
        canvas.addEventListener("pointerleave", onLeave)
        canvas.addEventListener("pointerdown", onDown)
        canvas.addEventListener("click", onClick)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        const makeNoise = () => {
            const c = document.createElement("canvas")
            c.width = 128
            c.height = 128
            const g = c.getContext("2d")
            if (g) {
                const id = g.createImageData(128, 128)
                for (let i = 0; i < id.data.length; i += 4) {
                    const v = Math.random() * 255
                    id.data[i] = v
                    id.data[i + 1] = v
                    id.data[i + 2] = v
                    id.data[i + 3] = 255 * Math.random()
                }
                g.putImageData(id, 0, 0)
            }
            st.noise = c
            st.pattern = ctx.createPattern(c, "repeat")
        }

        const draw = (dt: number) => {
            const p = propsRef.current
            const adv = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const q = p.qr as { n: number; cells: Uint8Array }
            ensureData(q, adv)
            const hk = adv.hover / 50
            const isFan = p.variant !== "dust"
            const still = isStatic || (reduce && reduce.matches)

            st.D = Math.max(100, isFan ? adv.fanBuildMs : adv.dustBuildMs)
            st.hold = Math.max(0, adv.holdMs)
            const D = st.D
            const cycle = D + st.hold + Math.max(0, adv.gapMs)

            st.clock += dt * 1000 * (Math.max(0, p.speed) / 50)
            if (st.lastVariant !== p.variant || st.lastPlay !== p.play) {
                if (st.lastVariant !== "" || st.lastPlay !== p.play) st.cycleStart = st.clock
                st.lastVariant = p.variant
                st.lastPlay = p.play
                st.pending = false
                st.completed = -1
            }
            if (st.lastQR !== q) st.cycleStart = st.clock

            const loopOn = p.loop || isCanvas
            let t = st.clock - st.cycleStart
            if (t >= cycle && (loopOn || st.pending)) {
                st.cycleStart += cycle * Math.floor(t / cycle)
                t = st.clock - st.cycleStart
                st.pending = false
                st.completed = -1
            }
            let mode: "build" | "done" | "empty"
            if (still) mode = "done"
            else if (t < D) mode = "build"
            else if (!loopOn && !st.pending) mode = "done"
            else if (t < D + st.hold) mode = "done"
            else mode = "empty"
            if (!still && t >= D && st.completed !== st.cycleStart && mode === "done") {
                st.completed = st.cycleStart
                if (typeof p.onComplete === "function") p.onComplete()
            }

            // pointer easing
            const k6 = 1 - Math.exp(-dt * 6)
            st.over += (st.overT - st.over) * k6
            st.btn += (st.btnT - st.btn) * (1 - Math.exp(-dt * 10))
            st.press += (st.downT * st.btnT - st.press) * (1 - Math.exp(-dt * 14))

            // layout
            const W = st.w
            const H = st.h
            const bsF = adv.buttonSize / 100
            const gapF = adv.buttonGap / 100
            const extra = p.showButton ? gapF + bsF / 2 : adv.seedOffset / 100
            const fit = Math.min(1, (H * 0.92) / (p.size * (1 + extra)), (W * 0.9) / p.size)
            const s = Math.max(40, p.size * fit)
            const n = q.n
            const m = s / n
            const groupH = s * (1 + extra)
            const qx = (W - s) / 2
            const qy = (H - groupH) / 2 + (adv.lift / 100) * H
            const Sx = qx + s / 2
            st.bx = Sx
            st.by = qy + s + gapF * s
            st.bs = bsF * s
            // everything leaves from the button (or the seed point when it is hidden)
            const Sy = p.showButton ? st.by : qy + s + (adv.seedOffset / 100) * s
            const spreadK = 0.5 + p.spread / 100

            // pointer push on finished modules
            const pushAmt = (adv.pointerPush / 100) * m * st.over * hk
            const R2 = (s * 0.22) * (s * 0.22)

            const dpr = st.dpr
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.globalAlpha = 1
            ctx.fillStyle = p.background
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

            const count = st.mc.length
            const drawSquare = (k: number, alpha: number) => {
                let x = qx + st.mc[k] * m
                let y = qy + st.mr[k] * m
                if (pushAmt > 0) {
                    const dx = x + m / 2 - st.mx
                    const dy = y + m / 2 - st.my
                    const d2 = dx * dx + dy * dy
                    const f = Math.exp(-d2 / R2) * pushAmt
                    const d = Math.sqrt(d2) + 1e-3
                    x += (dx / d) * f
                    y += (dy / d) * f
                }
                ctx.globalAlpha = alpha
                ctx.fillRect(x - 0.25, y - 0.25, m + 0.5, m + 0.5)
            }

            if (mode === "done") {
                ctx.fillStyle = p.color
                for (let k = 0; k < count; k++) drawSquare(k, 1)
            } else if (mode === "build" && isFan) {
                // One continuous flight per module: out of the button along a curve,
                // turning from a thin bar into its square as it settles. Bottom rows go first.
                const stagD = (adv.stagger / 100) * D
                const jit = adv.jitterMs
                const flyD = Math.max(0.25 * D, D - stagD - jit)
                const bulgeX = (adv.bow / 100) * (adv.fanWidth / 100) * spreadK * 1.6
                const bulgeY = (adv.fanHeight / 100) * spreadK * 0.5
                const lean = 0.08 * st.over * hk
                const pw = Math.max(1, adv.landPower)
                const barL = (adv.barLength / 100) * m
                const barW = (adv.barWidth / 100) * m
                ctx.lineWidth = adv.trailWidth
                ctx.strokeStyle = adv.trailColor
                const bars: number[] = []
                for (let k = 0; k < count; k++) {
                    const c = st.mc[k]
                    const r = st.mr[k]
                    const rowFrac = n > 1 ? (n - 1 - r) / (n - 1) : 0
                    const tl = (t - (rowFrac * stagD + st.m1[k] * jit)) / flyD
                    if (tl >= 1) {
                        st.solid[k] = 1
                        continue
                    }
                    st.solid[k] = 0
                    if (tl <= 0) continue
                    const el = 1 - Math.pow(1 - flyEase(tl), pw / 3)
                    const Tx = qx + (c + 0.5) * m
                    const Ty = qy + (r + 0.5) * m
                    let Cx = Sx + (Tx - Sx) * (1 + bulgeX * (0.8 + 0.4 * st.m2[k]))
                    let Cy = Sy + (Ty - Sy) * (0.5 + bulgeY)
                    if (lean > 0) {
                        Cx += (st.mx - Sx) * lean
                        Cy += (st.my - Sy) * lean
                    }
                    const u = 1 - el
                    const x = u * u * Sx + 2 * u * el * Cx + el * el * Tx
                    const y = u * u * Sy + 2 * u * el * Cy + el * el * Ty
                    const vx = 2 * u * (Cx - Sx) + 2 * el * (Tx - Cx)
                    const vy = 2 * u * (Cy - Sy) + 2 * el * (Ty - Cy)
                    const phi = Math.atan2(vy, vx)
                    const shape = smooth(0.55, 1, el)
                    const a1 = Math.round(phi / (Math.PI / 2)) * (Math.PI / 2)
                    const ang = phi + (a1 - phi) * shape
                    const grow = smooth(0, 0.3, el)
                    const len = (barL + (m - barL) * shape) * (0.35 + 0.65 * grow)
                    const wid = (barW + (m - barW) * shape) * (0.5 + 0.5 * grow)
                    const ta = (adv.trailOpacity / 100) * smooth(0, 0.15, el) * (1 - smooth(0.3, 0.8, el))
                    if (ta > 0.01 && adv.trailWidth > 0) {
                        ctx.globalAlpha = ta
                        ctx.beginPath()
                        ctx.moveTo(Sx, Sy)
                        ctx.lineTo(x, y)
                        ctx.stroke()
                    }
                    bars.push(x, y, ang, len, wid, 0.35 + 0.65 * grow)
                }
                ctx.fillStyle = p.color
                for (let k = 0; k < count; k++) if (st.solid[k] >= 1) drawSquare(k, 1)
                for (let i = 0; i < bars.length; i += 6) {
                    const ca = Math.cos(bars[i + 2])
                    const sa = Math.sin(bars[i + 2])
                    ctx.setTransform(dpr * ca, dpr * sa, -dpr * sa, dpr * ca, dpr * bars[i], dpr * bars[i + 1])
                    ctx.globalAlpha = bars[i + 5]
                    ctx.fillRect(-bars[i + 3] / 2, -bars[i + 4] / 2, bars[i + 3], bars[i + 4])
                }
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            } else if (mode === "build") {
                // One continuous flight per particle: out of the button along a loose curve
                // straight into its module, which fills in as its dust arrives.
                const stagD = (adv.stagger / 100) * D
                const spreadIn = 0.15 * D
                const flyD = Math.max(0.25 * D, D - stagD - spreadIn)
                const rxD = s * 0.5 * (adv.dustWidth / 100) * spreadK * 0.6
                const ryD = s * (adv.dustHeight / 100) * spreadK * 0.3
                const jAmp = (adv.dustJitter / 100) * m
                const swirl = (adv.pointerPush / 100) * m * 3 * st.over * hk
                const R2d = (s * 0.18) * (s * 0.18)
                const pw = Math.max(1, adv.landPower)
                for (let k = 0; k < count; k++) {
                    const rowFrac = n > 1 ? (n - 1 - st.mr[k]) / (n - 1) : 0
                    const modEnd = rowFrac * stagD + spreadIn + flyD
                    st.solid[k] = clamp01((t - (modEnd - 0.12 * D)) / (0.12 * D))
                }
                const pc = st.pm.length
                const clk = st.clock * 0.001
                for (let i = 0; i < pc; i++) {
                    const k = st.pm[i]
                    if (st.solid[k] >= 1) {
                        st.pb[i] = 0
                        continue
                    }
                    const o = i * 8
                    const rowFrac = n > 1 ? (n - 1 - st.mr[k]) / (n - 1) : 0
                    const tl = (t - (rowFrac * stagD + st.pd[o + 7] * spreadIn)) / flyD
                    if (tl <= 0) {
                        st.pb[i] = 0
                        continue
                    }
                    const el = 1 - Math.pow(1 - flyEase(Math.min(1, tl)), pw / 3)
                    const spx = Sx + st.pd[o] * s * 0.04
                    const spy = Sy + st.pd[o + 1] * s * 0.03
                    const tx = qx + (st.mc[k] + 0.075 + 0.85 * st.pd[o + 4]) * m
                    const ty = qy + (st.mr[k] + 0.075 + 0.85 * st.pd[o + 5]) * m
                    const cx = (spx + tx) / 2 + Math.cos(st.pd[o + 2]) * rxD * st.pd[o + 3]
                    const cy = (spy + ty) / 2 + Math.sin(st.pd[o + 2]) * ryD * st.pd[o + 3]
                    const u = 1 - el
                    const ph = st.pd[o + 6]
                    const amp = jAmp * Math.sin(Math.PI * el)
                    let x0 = u * u * spx + 2 * u * el * cx + el * el * tx + (Math.sin(clk * 3.1 + ph) + 0.5 * Math.sin(clk * 5.3 + ph * 1.7)) * amp
                    let y0 = u * u * spy + 2 * u * el * cy + el * el * ty + (Math.cos(clk * 2.7 + ph * 1.3) + 0.5 * Math.sin(clk * 4.9 + ph)) * amp
                    if (swirl > 0) {
                        const dx = x0 - st.mx
                        const dy = y0 - st.my
                        const d2 = dx * dx + dy * dy
                        const f = Math.exp(-d2 / R2d) * swirl * (1 - el)
                        const d = Math.sqrt(d2) + 1e-3
                        x0 += (dx / d - (dy / d) * 0.6) * f
                        y0 += (dy / d + (dx / d) * 0.6) * f
                    }
                    st.px[i] = x0
                    st.py[i] = y0
                    st.pb[i] = el > 0.75 ? 3 : st.pd[o + 7] < 0.5 ? 1 : 2
                }
                const ps = Math.max(1, adv.particleSize)
                const po = adv.particleOpacity / 100
                const passes: [number, string, number][] = [
                    [1, adv.particleColor, po * 0.75],
                    [2, adv.particleColor, Math.min(1, po * 1.15)],
                    [3, p.color, 0.9],
                ]
                for (const [b, col, al] of passes) {
                    ctx.fillStyle = col
                    ctx.globalAlpha = al
                    for (let i = 0; i < pc; i++) if (st.pb[i] === b) ctx.fillRect(st.px[i] - ps / 2, st.py[i] - ps / 2, ps, ps)
                }
                ctx.fillStyle = p.color
                for (let k = 0; k < count; k++) if (st.solid[k] > 0) drawSquare(k, st.solid[k])
            }
            ctx.globalAlpha = 1

            // trigger button
            if (p.showButton) {
                const sc = 1 - 0.06 * st.press
                const b = st.bs * sc
                const x = st.bx - b / 2
                const y = st.by - b / 2
                const rad = (adv.buttonRadius / 100) * b
                ctx.save()
                ctx.shadowColor = "rgba(0,0,0,0.35)"
                ctx.shadowBlur = 8
                ctx.shadowOffsetY = 2
                roundRectPath(ctx, x, y, b, b, rad)
                ctx.fillStyle = adv.buttonFill
                ctx.fill()
                ctx.restore()
                roundRectPath(ctx, x + 0.5, y + 0.5, b - 1, b - 1, rad)
                ctx.lineWidth = 1
                ctx.strokeStyle = adv.buttonBorder
                ctx.stroke()
                const glow = st.btn * Math.min(1, hk)
                if (glow > 0.01) {
                    ctx.globalAlpha = glow * 0.45
                    ctx.strokeStyle = adv.glyphColor
                    ctx.stroke()
                    ctx.globalAlpha = 1
                }
                const raw = p.image
                const src = typeof raw === "string" ? raw : raw && raw.src
                let drew = false
                if (src) {
                    const e = getImage(src)
                    if (e.ok) {
                        const iw = e.img.naturalWidth || 1
                        const ih = e.img.naturalHeight || 1
                        const box = b * 0.42
                        const f = e.img.naturalWidth ? Math.min(box / iw, box / ih) : box
                        const dw = e.img.naturalWidth ? iw * f : box
                        const dh = e.img.naturalWidth ? ih * f : box
                        const srcImg: CanvasImageSource = p.tint ? tinted(e, adv.glyphColor) : e.img
                        ctx.drawImage(srcImg, st.bx - dw / 2, st.by - dh / 2, dw, dh)
                        drew = true
                    }
                }
                if (!drew) {
                    const u = (b * 0.36) / 7
                    const gx = st.bx - 3.5 * u
                    const gy = st.by - 3.5 * u
                    ctx.strokeStyle = adv.glyphColor
                    ctx.fillStyle = adv.glyphColor
                    ctx.lineWidth = u * 0.7
                    for (const [fx, fy] of [
                        [0, 0],
                        [4, 0],
                        [0, 4],
                    ]) {
                        ctx.strokeRect(gx + fx * u + 0.35 * u, gy + fy * u + 0.35 * u, 3 * u - 0.7 * u, 3 * u - 0.7 * u)
                        ctx.fillRect(gx + (fx + 1.05) * u, gy + (fy + 1.05) * u, 0.9 * u, 0.9 * u)
                    }
                    for (const [dx, dy] of [
                        [4, 4],
                        [6, 4],
                        [5, 5],
                        [4, 6],
                        [6, 6],
                    ])
                        ctx.fillRect(gx + dx * u, gy + dy * u, u, u)
                }
            }

            // grain + vignette
            if (adv.grain > 0) {
                if (!st.pattern) makeNoise()
                if (st.pattern) {
                    ctx.save()
                    ctx.globalAlpha = (adv.grain / 100) * 0.35
                    const ox = Math.floor(Math.random() * 128)
                    const oy = Math.floor(Math.random() * 128)
                    ctx.translate(-ox, -oy)
                    ctx.fillStyle = st.pattern
                    ctx.fillRect(0, 0, W + 128, H + 128)
                    ctx.restore()
                }
            }
            if (adv.vignette > 0) {
                const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.hypot(W, H) * 0.6)
                g.addColorStop(0, "rgba(0,0,0,0)")
                g.addColorStop(1, `rgba(0,0,0,${(adv.vignette / 100) * 0.85})`)
                ctx.globalAlpha = 1
                ctx.fillStyle = g
                ctx.fillRect(0, 0, W, H)
            }
            ctx.globalAlpha = 1
        }

        let raf = 0
        let last = -1
        const frame = (now: number) => {
            const dt = last < 0 ? 0 : Math.min(1 / 20, (now - last) / 1000)
            last = now
            draw(dt)
            raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            canvas.removeEventListener("pointermove", onMove)
            canvas.removeEventListener("pointerenter", onMove)
            canvas.removeEventListener("pointerleave", onLeave)
            canvas.removeEventListener("pointerdown", onDown)
            canvas.removeEventListener("click", onClick)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
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
                ...style,
                background,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, display: "block", cursor: "pointer", touchAction: "none" }}
            />
        </div>
    )
}

addPropertyControls(QRCodeAssemble, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Fill behind the code.",
    },
    color: {
        type: ControlType.Color,
        title: "Code",
        defaultValue: "#F2F2F2",
        description: "Colour of the QR modules and the fan bars.",
    },
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "https://originkit.dev",
        description: "The URL or text the QR code encodes (up to about 200 characters).",
    },
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        options: ["fan", "dust"],
        optionTitles: ["Fan", "Dust"],
        displaySegmentedControl: true,
        defaultValue: "fan",
        description: "Fan: modules fly from the button as thin bars that settle into squares. Dust: fine particles fly from the button into each module.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 160,
        max: 760,
        step: 1,
        unit: "px",
        defaultValue: 380,
        description: "Side of the QR code.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "50 is the designed tempo, 0 stops.",
    },
    spread: {
        type: ControlType.Number,
        title: "Spread",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 50,
        description: "How far the flight paths swing out between the button and the code.",
    },
    showButton: {
        type: ControlType.Boolean,
        title: "Button",
        defaultValue: true,
        description: "Show the rounded rebuild button under the code.",
    },
    loop: {
        type: ControlType.Boolean,
        title: "Replay",
        defaultValue: true,
        description: "Rebuild by itself after a pause. Off: rebuilds only on click.",
    },
    image: {
        type: ControlType.ResponsiveImage,
        title: "Logo",
        description: "Your own icon for the button. Empty draws the built-in QR glyph.",
    },
    tint: {
        type: ControlType.Boolean,
        title: "Tint",
        defaultValue: true,
        description: "Draw the uploaded icon as a silhouette in the glyph colour.",
    },
    play: {
        type: ControlType.Boolean,
        title: "Play",
        defaultValue: false,
        description: "Toggle to restart the build.",
    },
    onComplete: {
        type: ControlType.EventHandler,
        description: "Fires when the code has finished building.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Strength of the pointer response. 0 is off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening." },
            fanBuildMs: { type: ControlType.Number, title: "Fan Build", min: 200, max: 5000, step: 10, unit: "ms", defaultValue: 1000, description: "Length of one Fan build." },
            dustBuildMs: { type: ControlType.Number, title: "Dust Build", min: 200, max: 5000, step: 10, unit: "ms", defaultValue: 1100, description: "Length of one Dust build." },
            holdMs: { type: ControlType.Number, title: "Hold", min: 0, max: 10000, step: 50, unit: "ms", defaultValue: 1800, description: "Time the finished code stays before replaying." },
            gapMs: { type: ControlType.Number, title: "Empty Gap", min: 0, max: 3000, step: 10, unit: "ms", defaultValue: 450, description: "Empty pause after clearing, before building." },
            stagger: { type: ControlType.Number, title: "Row Stagger", min: 0, max: 80, step: 1, unit: "%", defaultValue: 40, description: "Share of the build between the bottom row leaving the button and the top row." },
            jitterMs: { type: ControlType.Number, title: "Jitter", min: 0, max: 300, step: 1, unit: "ms", defaultValue: 40, description: "Random delay per bar." },
            landPower: { type: ControlType.Number, title: "Land Ease", min: 1, max: 6, step: 1, defaultValue: 3, description: "Ease-out strength of the landing." },
            seedOffset: { type: ControlType.Number, title: "Seed Offset", min: 0, max: 60, step: 1, unit: "%", defaultValue: 20, description: "Where modules start when the button is hidden: distance below the code, % of its size." },
            fanWidth: { type: ControlType.Number, title: "Fan Width", min: 20, max: 200, step: 1, unit: "%", defaultValue: 100, description: "How far bar paths swing sideways past their cell." },
            fanHeight: { type: ControlType.Number, title: "Fan Height", min: 10, max: 150, step: 1, unit: "%", defaultValue: 60, description: "How early bar paths climb before curving in." },
            bow: { type: ControlType.Number, title: "Bow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 35, description: "Outward curve of each bar's flight." },
            barLength: { type: ControlType.Number, title: "Bar Length", min: 100, max: 500, step: 5, unit: "%", defaultValue: 250, description: "In-flight bar length, % of a module." },
            barWidth: { type: ControlType.Number, title: "Bar Width", min: 10, max: 100, step: 1, unit: "%", defaultValue: 50, description: "In-flight bar width, % of a module." },
            trailColor: { type: ControlType.Color, title: "Trail", defaultValue: "#6E6E6E", description: "Hair lines from the seed to each bar." },
            trailOpacity: { type: ControlType.Number, title: "Trail Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 40, description: "Opacity of the hair lines." },
            trailWidth: { type: ControlType.Number, title: "Trail Width", min: 0, max: 4, step: 1, unit: "px", defaultValue: 1, description: "Hair line weight." },
            particles: { type: ControlType.Number, title: "Particles", min: 2, max: 40, step: 1, defaultValue: 14, description: "Dust particles per module." },
            particleSize: { type: ControlType.Number, title: "Particle Size", min: 1, max: 6, step: 1, unit: "px", defaultValue: 2, description: "Dust particle size." },
            particleColor: { type: ControlType.Color, title: "Dust", defaultValue: "#9A9A9A", description: "Colour of flying dust." },
            particleOpacity: { type: ControlType.Number, title: "Dust Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 70, description: "Opacity of flying dust." },
            dustWidth: { type: ControlType.Number, title: "Dust Width", min: 20, max: 200, step: 1, unit: "%", defaultValue: 105, description: "Sideways scatter of the dust paths." },
            dustHeight: { type: ControlType.Number, title: "Dust Height", min: 20, max: 200, step: 1, unit: "%", defaultValue: 110, description: "Upward scatter of the dust paths." },
            dustJitter: { type: ControlType.Number, title: "Dust Jitter", min: 0, max: 200, step: 1, unit: "%", defaultValue: 50, description: "Drift of flying dust, % of a module." },
            pointerPush: { type: ControlType.Number, title: "Pointer Push", min: 0, max: 100, step: 1, unit: "%", defaultValue: 40, description: "How far modules and dust shy away from the pointer." },
            buttonSize: { type: ControlType.Number, title: "Button Size", min: 5, max: 40, step: 1, unit: "%", defaultValue: 15, description: "Button side, % of the code." },
            buttonGap: { type: ControlType.Number, title: "Button Gap", min: 10, max: 80, step: 1, unit: "%", defaultValue: 33, description: "Button centre below the code, % of its size." },
            buttonRadius: { type: ControlType.Number, title: "Button Radius", min: 0, max: 50, step: 1, unit: "%", defaultValue: 25, description: "Button corner radius." },
            buttonFill: { type: ControlType.Color, title: "Button Fill", defaultValue: "#121212", description: "Button fill." },
            buttonBorder: { type: ControlType.Color, title: "Button Border", defaultValue: "#2C2C2C", description: "Button border." },
            glyphColor: { type: ControlType.Color, title: "Glyph", defaultValue: "#E5E5E5", description: "Button glyph and tint colour." },
            lift: { type: ControlType.Number, title: "Lift", min: -30, max: 30, step: 1, unit: "%", defaultValue: 0, description: "Vertical offset of the whole group, % of height." },
            seed: { type: ControlType.Number, title: "Seed", min: 0, max: 999, step: 1, defaultValue: 7, description: "Random seed for paths and dust." },
        },
    },
})

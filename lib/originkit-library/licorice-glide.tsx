import { addPropertyControls, ControlType } from "./framer-shim"
import { animate, cancelFrame, frame, motion, useMotionValue, useReducedMotion } from "framer-motion"
import type { MotionValue, Transition, ValueAnimationTransition } from "framer-motion"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, FocusEvent as ReactFocusEvent, PointerEvent as ReactPointerEvent } from "react"

/*
 * LicoriceGlide — a liquorice-black toolbar of line icons with one tooltip
 * that glides between them.
 *
 * Hover an icon and a soft grey disc lights behind it while a black tag above
 * the bar slides over to it. The tag is a window onto a strip of every label
 * laid end to end, so as it travels its width eases to the new label and the
 * words scroll through it ("…ent C  Inbox") instead of cross-fading. Leave the
 * bar and the tag fades out where it is; come back on another icon and it
 * fades in already gliding from there.
 *
 * Built after vid24.mp4 (a 728×442 screen recording of a developer toolbar),
 * measured frame by frame at 50 fps:
 * - Bar 275×63 clip px, #212121, buttons on a 42.2 px pitch, hover disc
 *   #404040 at 42 px that switches within one frame (no fade).
 * - Tag #000, 42 tall, 12 radius, 11 above the bar, 11 side padding, label
 *   type 17.5 px (Inter Medium matched the ink widths: Comment/Menu 1.78 vs
 *   1.76 measured), key caps 25 square, radius 5, 1 px border ≈ 42 % white.
 * - Left edge, width and strip scroll all ride one curve, a front-loaded
 *   ease-out (23 % of the way in the first 20 ms), not a spring:
 *   cubic-bezier(0.11, 0.83, 0.4, 1) over 0.5 s. Rendered and traced back
 *   against the clip it lands within 2.6 px rms on the first slide and
 *   3.8 px across a full hover sweep.
 * - Fades are opacity only, on the same curve: in 0.38 s, out 0.40 s, so
 *   Fade is 78 % of the glide. The edges stay one pixel sharp all the way
 *   out (the blur in the clip is compression), and the tag does not move
 *   vertically or scale.
 * - Icons were fitted shape by shape against the clip's pixels (Chrome
 *   render sweeps); the comment bubble and the ⌘ cap start from Lucide
 *   (ISC). Each keeps the small offset it has in the clip, and the badge
 *   cuts a ring out of the strokes in the button's own colour.
 *
 * How it is built: plain DOM. The bar, buttons and labels are real elements,
 * so hit-testing, keyboard focus and screen readers are the browser's own,
 * and hover stays under the cursor through any Placement or canvas zoom.
 * Everything paints as ordinary page content (3D only while Tilt is set) and
 * sits on whole device pixels, so type and edges stay sharp at any size. The
 * tag is driven by framer-motion values, written once per frame: its black
 * box is an anti-aliased SVG rounded rect, and the transparent label strip
 * slides under a plain rectangular clip, so nothing black is ever clipped
 * and no dark fringe can show round the corners. Nothing runs at rest; label
 * widths are re-measured only by a ResizeObserver.
 */

// ---------------------------------------------------------------- constants

// The clip's frame. Every length below is in its pixels at Scale 100 %.
const REF_W = 728
const REF_H = 442
const REF_ASPECT = REF_W / REF_H
const BAR_Y = 17 // the bar sits this far below the frame's centre in the clip
const PITCH = 42.2 // button pitch; the hover disc fills it
const BAR_PAD_X = 10.9 // 2 × 10.9 + 6 × 42.2 = 275, the clip's bar
const BAR_H = 63
const ICON_BOX = 32 // icon viewBox, centred on the button
const STROKE = 2.05 // fitted per icon at 2.0–2.13
const TIP_H = 42
const KEY_LEAD = 12 // text to first key cap
const KEY_GAP = 4.5 // between key caps
const KEY_PAD_X = 5.5 // a wide glyph (⌘) grows its cap past the minimum
const KEY_RADIUS = 5
const KEY_TEXT = 15 / 17.5 // key glyphs are drawn smaller than the label
const PERSPECTIVE = 900 // ref px: the lens Tilt leans the bar under
const REDUCED_FADE = 0.15 // s, the only motion left under reduced motion

const WEB_FONT = "Inter"
const WEB_FONT_CSS = "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
const FALLBACK_STACK = '"Inter", "SF Pro Text", system-ui, sans-serif'

// ---------------------------------------------------------------- types

type IconKind = "comment" | "inbox" | "toggle" | "draft" | "share" | "menu"

interface ImageValue {
    src?: string
    srcSet?: string
    alt?: string
}

interface FontValue {
    fontFamily?: string
    fontWeight?: number | string
    fontStyle?: string
    letterSpacing?: string | number
}

export interface Item {
    /** Shown in the tooltip. */
    label: string
    /** Key caps after the label, split on spaces or "+" (⌘ K, ⇧+C). */
    keys?: string
    icon?: IconKind
    /** Replaces the drawn icon. */
    image?: ImageValue | string
    /** The blue notification dot. */
    badge?: boolean
    link?: string
    newTab?: boolean
}

export interface Colors {
    bar: string
    /** Hairline round the bar, so it holds its edge on a dark page. */
    border: string
    hover: string
    icons: string
    tooltip: string
    keyBorder: string
    badge: string
}

export interface Placement {
    x: number
    y: number
    angle: number
    tilt: number
}

export interface Advanced {
    textSize: number
    keySize: number
    tipPadding: number
    tipRadius: number
    tipGap: number
    fade: number
    touchHold: number
}

export interface LicoriceGlideProps {
    items?: Item[]
    background?: string
    font?: FontValue
    textColor?: string
    /** How big the bar draws in its frame. 100 % is the clip's framing. */
    scale?: number
    colors?: Partial<Colors>
    placement?: Partial<Placement>
    /**
     * Drives the tooltip's glide between buttons (position, width and label
     * scroll together) and, at Advanced → Fade of its duration, its fade.
     */
    transition?: Transition
    advanced?: Partial<Advanced>
    style?: CSSProperties
}

// ---------------------------------------------------------------- defaults

const DEFAULT_ITEMS: Item[] = [
    { label: "Comment", keys: "C", icon: "comment", badge: false, link: "", newTab: false },
    { label: "Inbox", keys: "", icon: "inbox", badge: false, link: "", newTab: false },
    { label: "Feature Flags", keys: "", icon: "toggle", badge: false, link: "", newTab: false },
    { label: "Draft Mode", keys: "", icon: "draft", badge: false, link: "", newTab: false },
    { label: "Share", keys: "", icon: "share", badge: false, link: "", newTab: false },
    { label: "Menu", keys: "⌘ K", icon: "menu", badge: false, link: "", newTab: false },
]

const DEFAULT_FONT: FontValue = { fontFamily: WEB_FONT, fontWeight: 500 }

// Set for a black page. The clip sat on white with a black tag, white
// label and 42 %-white key borders; on black that tag would vanish, so the
// tag is inverted (white, near-black label, dark key borders) and the bar,
// still the clip's #212121, gets a faint light hairline to hold its edge.
const DEFAULT_COLORS: Colors = {
    bar: "#212121",
    border: "rgba(255, 255, 255, 0.14)",
    hover: "#404040",
    icons: "#FFFFFF",
    tooltip: "#FFFFFF",
    keyBorder: "rgba(0, 0, 0, 0.28)",
    badge: "#00ACFB",
}

const DEFAULT_PLACEMENT: Placement = { x: 0, y: 0, angle: 0, tilt: 0 }

const DEFAULT_ADVANCED: Advanced = {
    textSize: 17.5,
    keySize: 25,
    tipPadding: 11,
    tipRadius: 12,
    tipGap: 11,
    fade: 78,
    touchHold: 1.6,
}

// Fitted to the clip; see the header.
const DEFAULT_TRANSITION: Transition = { type: "tween", ease: [0.11, 0.83, 0.4, 1], duration: 0.5 }

// ---------------------------------------------------------------- icons

// Paths are in each icon's measured 32 px window of the clip; `dx` is where
// that window sat relative to its button, so the icon keeps its offset.
interface IconDef {
    dx: number
    dot: [number, number]
    draw: JSX.Element
}

const ICONS: Record<IconKind, IconDef> = {
    comment: {
        dx: 1.5,
        dot: [24.5, 8],
        draw: <path d="M10.34 25.3A9.9 9.9 0 1 0 6.05 21.01L3.85 27.5Z" />,
    },
    inbox: {
        dx: -0.7,
        dot: [24.7, 8.1],
        draw: (
            <>
                <path d="M27.85 16.45H21.48L19.23 19.68H14.73L12.48 16.45H6.1" />
                <path d="M6.1 16.45L10.3 7.6H23.65L27.85 16.45V23.08Q27.85 25.2 25.73 25.2H8.23Q6.1 25.2 6.1 23.08Z" />
            </>
        ),
    },
    toggle: {
        dx: 0.1,
        dot: [24.5, 8],
        draw: (
            <>
                <rect x={5.5} y={8.35} width={22.2} height={16.08} rx={8.04} />
                <circle cx={13.29} cy={16.45} r={3.28} />
            </>
        ),
    },
    draft: {
        dx: -0.1,
        dot: [24.5, 8],
        // An almond drawn in seven dashes, the end ones folding round its
        // points as < and >; the pupil is two arcs of one circle.
        draw: (
            <>
                <path
                    d="M5.65 16.3C11.3 6.15 22.5 6.15 28.15 16.3C22.5 26.9 11.3 26.9 5.65 16.3Z"
                    pathLength={70}
                    strokeDasharray="4.6 5.4"
                    strokeDashoffset={2.4}
                />
                <path d="M17.44 13.25A3.33 3.33 0 0 1 17.44 19.65M13.67 14.79A3.33 3.33 0 0 0 13.67 18.11" />
            </>
        ),
    },
    share: {
        dx: 0.7,
        dot: [24.5, 8],
        draw: (
            <>
                <path d="M16.25 20V6.6M10.55 12.3L16.25 6.6L21.95 12.3" />
                <path d="M6.25 19.9V23.9A2.4 2.4 0 0 0 8.65 26.3H23.85A2.4 2.4 0 0 0 26.25 23.9V19.9" />
            </>
        ),
    },
    menu: {
        dx: 0.5,
        dot: [23.95, 8.1],
        draw: <path d="M7.18 9.64H25.17M7.18 16.5H25.17M7.18 23.26H25.17" />,
    },
}

const DOT_R = 3.4
const DOT_CUT = 5 // the ring the badge cuts out of the strokes

// ---------------------------------------------------------------- helpers

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

function imageSrc(v: Item["image"]): string {
    if (!v) return ""
    return typeof v === "string" ? v : v.src || ""
}

function splitKeys(s: string | undefined): string[] {
    if (!s) return []
    const out: string[] = []
    for (const part of s.split(/[\s+]+/)) {
        // "⌘K" reads as two caps, the way it is pressed.
        const m = part.match(/[⌘⌥⇧⌃]|[^⌘⌥⇧⌃]+/g)
        if (m) out.push(...m)
    }
    return out
}

function fadeOf(t: Transition, share: number, reduced: boolean): Transition {
    if (reduced) return { type: "tween", ease: "linear", duration: REDUCED_FADE }
    const tt = t as { type?: string; duration?: number }
    if (tt.type === "spring" || tt.type === "inertia") return t
    return { ...t, duration: (tt.duration ?? 0.5) * (share / 100) }
}

// The panel hands over a general Transition; a single value takes the same.
function glide(mv: MotionValue<number>, to: number, tr: Transition) {
    return animate(mv, to, tr as ValueAnimationTransition<number>)
}

// One button's icon, as a group in the bar's shared SVG (ref px, button
// centre at x). One SVG for the bar means one pixel snap for every icon.
function Glyph({ item, x, color, ring, badge }: { item: Item; x: number; color: string; ring: string; badge: string }) {
    const src = imageSrc(item.image)
    const def = ICONS[item.icon ?? "comment"] ?? ICONS.comment
    const [dotX, dotY] = def.dot
    return (
        <g transform={`translate(${(x - ICON_BOX / 2 + (src ? 0 : def.dx)).toFixed(3)} ${-ICON_BOX / 2})`}>
            {src ? (
                <image href={src} x={3} y={3} width={26} height={26} preserveAspectRatio="xMidYMid meet" />
            ) : (
                <g fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
                    {def.draw}
                </g>
            )}
            {item.badge && (
                <>
                    <circle cx={dotX} cy={dotY} r={DOT_CUT} fill={ring} />
                    <circle cx={dotX} cy={dotY} r={DOT_R} fill={badge} />
                </>
            )}
        </g>
    )
}

// The ⌘ cap is drawn, not typed: few faces carry the glyph, and a fallback
// one comes out wider than the clip's (Lucide "command", ISC).
function CommandMark() {
    return (
        <svg width="0.87em" height="0.87em" viewBox="0 0 24 24" style={{ display: "block" }} aria-hidden="true">
            <path
                d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

// ---------------------------------------------------------------- component

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 728
 * @framerIntrinsicHeight 442
 */
export default function LicoriceGlide(props: LicoriceGlideProps) {
    const {
        items: itemsProp = DEFAULT_ITEMS,
        background = "#000000",
        font,
        textColor = "#0A0A0A",
        scale = 180,
        colors,
        placement,
        transition = DEFAULT_TRANSITION,
        advanced,
        style,
    } = props
    const items = itemsProp && itemsProp.length ? itemsProp : DEFAULT_ITEMS
    const col = { ...DEFAULT_COLORS, ...colors }
    const pl = { ...DEFAULT_PLACEMENT, ...placement }
    const adv = { ...DEFAULT_ADVANCED, ...advanced }
    const f = { ...DEFAULT_FONT, ...font }
    const reduced = !!useReducedMotion()

    const rootRef = useRef<HTMLDivElement>(null)
    const barRef = useRef<HTMLDivElement>(null)
    const itemEls = useRef<(HTMLDivElement | null)[]>([])
    const [size, setSize] = useState({ w: REF_W, h: REF_H })
    const [hot, setHot] = useState(-1)

    // One unit for the whole composition: the clip's frame, contained.
    const u = Math.min(size.h, size.w / REF_ASPECT) / REF_H
    const k = u * Math.max(0.05, scale / 100)
    const n = items.length
    const barW = 2 * BAR_PAD_X + n * PITCH
    const tipTop = -BAR_H / 2 - adv.tipGap - TIP_H
    const family =
        f.fontFamily && !/^(sans-serif|system-ui)$/i.test(String(f.fontFamily).trim()) ? String(f.fontFamily) : WEB_FONT

    // The tag, in ref px relative to the bar's centre. L/W are the window,
    // O is how far along the label strip it looks, T the strip's length.
    const mL = useMotionValue(0)
    const mW = useMotionValue(0)
    const mO = useMotionValue(0)
    const mT = useMotionValue(0)
    const mOp = useMotionValue(0)
    const rectRef = useRef<SVGRectElement>(null)
    const stripRef = useRef<HTMLDivElement>(null)

    // Device pixels per CSS pixel: boxes are snapped to them so edges and
    // type land on the pixel grid instead of straddling two pixels.
    const [dpr, setDpr] = useState(1)
    useEffect(() => {
        const upd = () => setDpr(Math.min(4, Math.max(1, window.devicePixelRatio || 1)))
        upd()
        window.addEventListener("resize", upd)
        return () => window.removeEventListener("resize", upd)
    }, [])
    const snap = (v: number) => Math.round(v * dpr) / dpr

    // Label widths in ref px, kept by a ResizeObserver; estimates until then.
    const widths = useRef<number[]>([])
    const tip = useRef(-1)
    const shown = useRef(false)
    const touchTimer = useRef(0)
    const live = useRef({ transition, adv, reduced, n })
    live.current = { transition, adv, reduced, n }

    const targetOf = (i: number) => {
        const ws = widths.current
        const w = ws[i] ?? 0
        let o = 0
        for (let j = 0; j < i; j++) o += ws[j] ?? 0
        const cx = (i - (live.current.n - 1) / 2) * PITCH
        return { l: cx - w / 2, w, o }
    }

    const moveTo = (i: number, instant: boolean) => {
        const t = targetOf(i)
        const { transition: tr, reduced: rm } = live.current
        if (instant || rm) {
            mL.jump(t.l)
            mW.jump(t.w)
            mO.jump(t.o)
        } else {
            glide(mL, t.l, tr)
            glide(mW, t.w, tr)
            glide(mO, t.o, tr)
        }
    }

    const show = (i: number) => {
        if (i < 0) return
        const first = tip.current < 0
        if (i !== tip.current || first) moveTo(i, first)
        tip.current = i
        if (!shown.current) {
            shown.current = true
            const { transition: tr, adv: a, reduced: rm } = live.current
            glide(mOp, 1, fadeOf(tr, a.fade, rm))
        }
    }

    const hide = () => {
        if (!shown.current) return
        shown.current = false
        const { transition: tr, adv: a, reduced: rm } = live.current
        glide(mOp, 0, fadeOf(tr, a.fade, rm))
    }

    // Frame size.
    useIsoLayoutEffect(() => {
        const root = rootRef.current
        if (!root) return
        const ro = new ResizeObserver((es) => {
            const r = es[0].contentRect
            if (r.width > 0 && r.height > 0) setSize((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }))
        })
        ro.observe(root)
        return () => ro.disconnect()
    }, [])

    // Label widths: re-measured on font load, edits and resizes only.
    const kRef = useRef(k)
    kRef.current = k
    useIsoLayoutEffect(() => {
        const els = itemEls.current.slice(0, n)
        const measure = () => {
            const kk = kRef.current
            // Layout width, not the bounding rect: the strip is laid out in
            // these pixels whatever Placement or the canvas does to it.
            widths.current = els.map((el) => (el ? el.offsetWidth / kk : 0))
            mT.jump(widths.current.reduce((a, b) => a + b, 0))
            if (tip.current >= n) tip.current = n - 1
            if (tip.current >= 0) moveTo(tip.current, true)
        }
        measure()
        const ro = new ResizeObserver(measure)
        for (const el of els) if (el) ro.observe(el)
        return () => ro.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [n, k, family, f.fontWeight, f.fontStyle, f.letterSpacing, adv.textSize, adv.keySize, adv.tipPadding, items.map((it) => `${it.label}|${it.keys}`).join("\n")])

    // The default face comes from Google Fonts; Framer loads any other itself.
    useEffect(() => {
        if (family !== WEB_FONT || document.querySelector("link[data-licorice-glide-font]")) return
        const l = document.createElement("link")
        l.rel = "stylesheet"
        l.href = WEB_FONT_CSS
        l.dataset.licoriceGlideFont = "1"
        document.head.appendChild(l)
    }, [family])

    useEffect(() => () => window.clearTimeout(touchTimer.current), [])

    // ---------------------------------------------------------- input

    const onEnter = (i: number) => (e: ReactPointerEvent) => {
        if (e.pointerType === "touch") return
        setHot(i)
        show(i)
    }
    const onLeave = (e: ReactPointerEvent) => {
        if (e.pointerType === "touch") return
        setHot(-1)
    }
    const onDown = (i: number) => (e: ReactPointerEvent) => {
        if (e.pointerType !== "touch") return
        window.clearTimeout(touchTimer.current)
        setHot(i)
        show(i)
    }
    const onUp = (e: ReactPointerEvent) => {
        if (e.pointerType !== "touch") return
        setHot(-1)
        window.clearTimeout(touchTimer.current)
        touchTimer.current = window.setTimeout(hide, live.current.adv.touchHold * 1000)
    }
    const onBarLeave = (e: ReactPointerEvent) => {
        if (e.pointerType === "touch") return
        setHot(-1)
        if (!barRef.current?.contains(document.activeElement)) hide()
    }
    const onFocus = (i: number) => (e: ReactFocusEvent<HTMLElement>) => {
        let visible = true
        try {
            visible = e.currentTarget.matches(":focus-visible")
        } catch {
            // older engines: treat every focus as visible
        }
        if (!visible) return
        setHot(i)
        show(i)
    }
    const onBlur = (e: ReactFocusEvent<HTMLElement>) => {
        setHot(-1)
        if (!barRef.current?.contains(e.relatedTarget as Node | null)) hide()
    }

    // ---------------------------------------------------------- render

    const px = (v: number) => `${(v * k).toFixed(3)}px`
    // Whole-pixel box round the bar, so in a whole-pixel frame nothing snaps.
    const halfW = Math.ceil((barW * k) / 2)
    const halfH = Math.ceil((BAR_H * k) / 2)
    const svgBox = { x: -halfW, y: -halfH, w: 2 * halfW, h: 2 * halfH }
    const barWpx = snap(barW * k)
    const barHpx = snap(BAR_H * k)
    const tipHpx = snap(TIP_H * k)
    const tipTopPx = snap(tipTop * k)
    const cx = snap(size.w / 2 + (pl.x / 100) * size.w)
    const cy = snap(size.h / 2 + BAR_Y * u + (pl.y / 100) * size.h)
    // Angle and Tilt turn the bar about its own centre; the offsets come last.
    // Only a real Tilt gets a 3D transform: any 3D transform, even rotateX(0),
    // lifts the bar onto a GPU layer that is resampled when scaled or zoomed,
    // which is what made type and edges soft.
    let turn = `translate(${cx}px, ${cy}px)`
    if (pl.tilt) turn += ` perspective(${(PERSPECTIVE * k).toFixed(1)}px) rotateX(${pl.tilt}deg)`
    if (pl.angle) turn += ` rotate(${pl.angle}deg)`
    const stage: CSSProperties = {
        position: "absolute",
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        transformOrigin: "0 0",
        transform: turn,
    }

    // The tag is drawn straight from the motion values, once per frame: the
    // black box is an SVG rounded rect (anti-aliased, nothing clipped), and
    // only the transparent label strip is clipped, by a plain rectangle. A
    // black strip under a rounded clip-path bled dark slivers round the
    // corners while it moved. At rest every edge is snapped to the pixel grid.
    const geo = useRef({ k, dpr, r: adv.tipRadius * k, h: tipHpx, sx: svgBox.x })
    geo.current = { k, dpr, r: adv.tipRadius * k, h: tipHpx, sx: svgBox.x }
    const draw = useRef(() => {})
    draw.current = () => {
        const rect = rectRef.current
        const strip = stripRef.current
        if (!rect || !strip) return
        const g = geo.current
        const moving = mL.isAnimating() || mW.isAnimating() || mO.isAnimating()
        const sn = (v: number) => (moving ? v : Math.round(v * g.dpr) / g.dpr)
        const l = mL.get()
        const left = sn(l * g.k)
        const right = sn((l + mW.get()) * g.k)
        const w = Math.max(0, right - left)
        const shift = sn((l - mO.get()) * g.k)
        const total = mT.get() * g.k
        rect.setAttribute("x", (left - g.sx).toFixed(3))
        rect.setAttribute("width", w.toFixed(3))
        rect.setAttribute("rx", Math.min(g.r, w / 2, g.h / 2).toFixed(3))
        strip.style.transform = `translateX(${shift.toFixed(3)}px)`
        const cl = Math.max(0, left - shift)
        const cr = Math.max(0, total - (right - shift))
        strip.style.clipPath = `inset(0px ${cr.toFixed(3)}px 0px ${cl.toFixed(3)}px)`
    }
    useEffect(() => {
        const run = () => draw.current()
        const kick = () => frame.render(run)
        const offs = [mL, mW, mO, mT].flatMap((m) => [m.on("change", kick), m.on("animationComplete", kick)])
        return () => {
            offs.forEach((off) => off())
            cancelFrame(run)
        }
    }, [mL, mW, mO, mT])
    useIsoLayoutEffect(() => {
        draw.current()
    })
    const typeFace: CSSProperties = {
        fontFamily: family === WEB_FONT ? FALLBACK_STACK : `"${family}", ${FALLBACK_STACK}`,
        fontWeight: f.fontWeight ?? 500,
        fontStyle: f.fontStyle,
        letterSpacing: f.letterSpacing,
        color: textColor,
        lineHeight: 1,
        whiteSpace: "nowrap",
    }

    return (
        <div
            ref={rootRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                aspectRatio: `${REF_W} / ${REF_H}`,
                overflow: "hidden",
                background,
                ...style,
            }}
        >
            <div style={stage}>
                {/* The tag: one strip of every label, seen through a moving window. */}
                <motion.div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        left: 0,
                        top: tipTopPx,
                        width: 0,
                        height: tipHpx,
                        pointerEvents: "none",
                        userSelect: "none",
                        opacity: mOp,
                    }}
                >
                    <svg
                        width={svgBox.w}
                        height={tipHpx}
                        style={{ position: "absolute", left: svgBox.x, top: 0, display: "block", overflow: "visible" }}
                    >
                        <rect ref={rectRef} x={0} y={0} width={0} height={tipHpx} fill={col.tooltip} />
                    </svg>
                    <div
                        ref={stripRef}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            height: "100%",
                            display: "flex",
                            ...typeFace,
                            fontSize: px(adv.textSize),
                        }}
                    >
                        {items.map((it, i) => {
                            const caps = splitKeys(it.keys)
                            return (
                                <div
                                    key={i}
                                    ref={(el) => {
                                        itemEls.current[i] = el
                                    }}
                                    style={{
                                        flex: "none",
                                        display: "flex",
                                        alignItems: "center",
                                        height: "100%",
                                        boxSizing: "border-box",
                                        padding: `0 ${px(adv.tipPadding)}`,
                                    }}
                                >
                                    <span>{it.label}</span>
                                    {caps.map((c, j) => (
                                        <span
                                            key={j}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                boxSizing: "border-box",
                                                minWidth: px(adv.keySize),
                                                height: px(adv.keySize),
                                                marginLeft: px(j === 0 ? KEY_LEAD : KEY_GAP),
                                                padding: `0 ${px(KEY_PAD_X)}`,
                                                border: `${px(1)} solid ${col.keyBorder}`,
                                                borderRadius: px(KEY_RADIUS),
                                                fontSize: px(adv.textSize * KEY_TEXT),
                                            }}
                                        >
                                            {c === "⌘" ? <CommandMark /> : c}
                                        </span>
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                </motion.div>

                <div
                    ref={barRef}
                    role="toolbar"
                    onPointerLeave={onBarLeave}
                    style={{
                        position: "absolute",
                        left: snap(-barWpx / 2),
                        top: snap(-barHpx / 2),
                        width: barWpx,
                        height: barHpx,
                        boxSizing: "border-box",
                        padding: `0 ${px(BAR_PAD_X)}`,
                        display: "flex",
                        alignItems: "center",
                        borderRadius: barHpx / 2,
                        // Inset, so the hairline never changes the bar's size.
                        boxShadow: `inset 0 0 0 ${Math.max(1 / dpr, snap(k)).toFixed(3)}px ${col.border}`,
                        background: col.bar,
                        userSelect: "none",
                        WebkitTapHighlightColor: "transparent",
                        touchAction: "manipulation",
                    }}
                >
                    {items.map((it, i) => {
                        const on = hot === i
                        const btn: CSSProperties = {
                            flex: "none",
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: px(PITCH),
                            height: px(PITCH),
                            padding: 0,
                            margin: 0,
                            border: "none",
                            borderRadius: "50%",
                            background: on ? col.hover : "transparent",
                            color: "inherit",
                            cursor: "pointer",
                            outline: "none",
                            textDecoration: "none",
                            font: "inherit",
                        }
                        const handlers = {
                            onPointerEnter: onEnter(i),
                            onPointerLeave: onLeave,
                            onPointerDown: onDown(i),
                            onPointerUp: onUp,
                            onPointerCancel: onUp,
                            onFocus: onFocus(i),
                            onBlur,
                        }
                        return it.link ? (
                            <a
                                key={i}
                                href={it.link}
                                target={it.newTab ? "_blank" : undefined}
                                rel={it.newTab ? "noopener noreferrer" : undefined}
                                aria-label={it.label}
                                style={btn}
                                {...handlers}
                            />
                        ) : (
                            <button key={i} type="button" aria-label={it.label} style={btn} {...handlers} />
                        )
                    })}
                </div>

                {/* Icons over the buttons; the buttons below take the pointer. */}
                <svg
                    aria-hidden="true"
                    width={svgBox.w}
                    height={svgBox.h}
                    viewBox={`${(svgBox.x / k).toFixed(4)} ${(svgBox.y / k).toFixed(4)} ${(svgBox.w / k).toFixed(4)} ${(svgBox.h / k).toFixed(4)}`}
                    style={{ position: "absolute", left: svgBox.x, top: svgBox.y, display: "block", overflow: "visible", pointerEvents: "none" }}
                >
                    {items.map((it, i) => (
                        <Glyph
                            key={i}
                            item={it}
                            x={(i - (n - 1) / 2) * PITCH}
                            color={col.icons}
                            ring={hot === i ? col.hover : col.bar}
                            badge={col.badge}
                        />
                    ))}
                </svg>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------- controls

// Control order arranged in the builder.
addPropertyControls(LicoriceGlide, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    textColor: { type: ControlType.Color, title: "Text Color", defaultValue: "#0A0A0A" },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        controls: {
            bar: { type: ControlType.Color, title: "Bar", defaultValue: "#212121" },
            border: { type: ControlType.Color, title: "Border", defaultValue: "rgba(255, 255, 255, 0.14)" },
            hover: { type: ControlType.Color, title: "Hover", defaultValue: "#404040" },
            icons: { type: ControlType.Color, title: "Icons", defaultValue: "#FFFFFF" },
            tooltip: { type: ControlType.Color, title: "Tooltip", defaultValue: "#FFFFFF" },
            keyBorder: { type: ControlType.Color, title: "Key Border", defaultValue: "rgba(0, 0, 0, 0.28)" },
            badge: { type: ControlType.Color, title: "Badge", defaultValue: "#00ACFB" },
        },
    },

    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {"fontFamily":"Inter","variant":"Regular","fontWeight":500,"fontSize":"16px","lineHeight":"1.5em","letterSpacing":"0em","textAlign":"left"},
        description: "Size follows Scale (Advanced → Text Size).",
    },
    items: {
        type: ControlType.Array,
        title: "Items",
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, title: "Label", defaultValue: "Comment" },
                keys: {
                    type: ControlType.String,
                    title: "Keys",
                    defaultValue: "",
                    placeholder: "⌘ K",
                    description: "Key caps after the label. Separate keys with spaces.",
                },
                icon: {
                    type: ControlType.Enum,
                    title: "Icon",
                    defaultValue: "comment",
                    options: ["comment", "inbox", "toggle", "draft", "share", "menu"],
                    optionTitles: ["Comment", "Inbox", "Toggle", "Dashed Eye", "Share", "Menu"],
                },
                image: {
                    type: ControlType.ResponsiveImage,
                    title: "Image",
                    description: "Replaces the drawn icon.",
                },
                badge: {
                    type: ControlType.Boolean,
                    title: "Badge",
                    defaultValue: false,
                    enabledTitle: "On",
                    disabledTitle: "Off",
                },
                link: { type: ControlType.Link, title: "Link" },
                newTab: {
                    type: ControlType.Boolean,
                    title: "New Tab",
                    defaultValue: false,
                    enabledTitle: "Yes",
                    disabledTitle: "No",
                    hidden: (p: Item) => !p.link,
                },
            },
        },
        maxCount: 12,
        defaultValue: [{"label":"Comment","keys":"C","icon":"comment","badge":false,"link":"","newTab":false},{"label":"Inbox","keys":"","icon":"inbox","badge":false,"link":"","newTab":false},{"label":"Feature Flags","keys":"","icon":"toggle","badge":false,"link":"","newTab":false},{"label":"Draft Mode","keys":"","icon":"draft","badge":false,"link":"","newTab":false},{"label":"Share","keys":"","icon":"share","badge":false,"link":"","newTab":false},{"label":"Menu","keys":"⌘ K","icon":"menu","badge":false,"link":"","newTab":false}],
    },

    scale: {
        type: ControlType.Number,
        title: "Scale",
        unit: "%",
        min: 25,
        max: 200,
        step: 1,
        defaultValue: 180,
        description: "How big the bar draws in its frame. 100 % is the clip's framing.",
    },

    placement: {
        type: ControlType.Object,
        title: "Placement",
        controls: {
            x: {
                type: ControlType.Number,
                title: "X Offset",
                unit: "%",
                min: -50,
                max: 50,
                step: 0.5,
                defaultValue: 0,
                description: "Share of the frame's width. Positive moves right.",
            },
            y: {
                type: ControlType.Number,
                title: "Y Offset",
                unit: "%",
                min: -50,
                max: 50,
                step: 0.5,
                defaultValue: 0,
                description: "Share of the frame's height. Positive moves down.",
            },
            angle: {
                type: ControlType.Number,
                title: "Angle",
                unit: "°",
                min: -180,
                max: 180,
                step: 1,
                defaultValue: 0,
                description: "Turns the bar about its centre. Positive is clockwise.",
            },
            tilt: {
                type: ControlType.Number,
                title: "Tilt",
                unit: "°",
                min: -80,
                max: 80,
                step: 1,
                defaultValue: 0,
                description: "Leans the bar about the frame's horizontal axis. Positive tips its top away.",
            },
        },
    },

    transition: {
        type: ControlType.Transition,
        title: "Transition",
        defaultValue: {"type":"tween","stiffness":800,"damping":60,"mass":1,"ease":[0.11,0.83,0.4,1],"duration":0.5},
        description: "The tooltip's glide between buttons, and its fade (at Advanced → Fade of the duration).",
    },

    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            textSize: {
                type: ControlType.Number,
                title: "Text Size",
                unit: "px",
                min: 8,
                max: 40,
                step: 0.5,
                defaultValue: 17.5,
                description: "Label size at Scale 100 % in the 728×442 reference frame.",
            },
            keySize: {
                type: ControlType.Number,
                title: "Key Size",
                unit: "px",
                min: 12,
                max: 50,
                step: 0.5,
                defaultValue: 25,
                description: "Minimum side of a key cap, in reference px.",
            },
            tipPadding: {
                type: ControlType.Number,
                title: "Tip Padding",
                unit: "px",
                min: 0,
                max: 40,
                step: 0.5,
                defaultValue: 11,
                description: "Space either side of each label, in reference px.",
            },
            tipRadius: {
                type: ControlType.Number,
                title: "Tip Radius",
                unit: "px",
                min: 0,
                max: 21,
                step: 0.5,
                defaultValue: 12,
                description: "Corner radius of the tooltip, in reference px.",
            },
            tipGap: {
                type: ControlType.Number,
                title: "Tip Gap",
                unit: "px",
                min: 0,
                max: 60,
                step: 0.5,
                defaultValue: 11,
                description: "Space between the tooltip and the bar, in reference px.",
            },
            fade: {
                type: ControlType.Number,
                title: "Fade",
                unit: "%",
                min: 10,
                max: 200,
                step: 1,
                defaultValue: 78,
                description: "Fade in/out time as a share of the Transition's duration (a spring fades on the spring).",
            },
            touchHold: {
                type: ControlType.Number,
                title: "Touch Hold",
                unit: "s",
                min: 0.3,
                max: 5,
                step: 0.1,
                defaultValue: 1.6,
                description: "How long a tapped label stays up on touch screens.",
            },
        },
    },
})

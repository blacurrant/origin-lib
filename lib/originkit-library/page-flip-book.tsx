/**
 * 3D Page Flip Book
 * A picture book seen face-on: single leaves hinge about the spine in real
 * perspective, the back of each leaf carries the next spread, and the book
 * closes onto its centred cover.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
import * as React from "react"
import { memo, useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

const DEFAULT_SPREADS = [{"image":{"src":"https://images.unsplash.com/photo-1791965558115-58fb666a7850?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"fit":"cover","x":50,"y":50},{"image":{"src":"https://images.unsplash.com/photo-1792187790722-66db7d13a53f?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"fit":"cover","x":50,"y":50},{"image":{"src":"https://images.unsplash.com/photo-1792592108795-076164280be6?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"fit":"cover","x":50,"y":50},{"image":{"src":"https://images.unsplash.com/photo-1792614268370-d7a7046adbcf?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"fit":"cover","x":50,"y":50},{"image":{"src":"https://images.unsplash.com/photo-1792676818211-6ab6ccfd86c4?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"fit":"cover","x":50,"y":50},{"image":{"src":"https://images.unsplash.com/photo-1792964785281-0397544a4245?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""},"fit":"cover","x":50,"y":50}]

const DEFAULT_IMAGE = {"src":"https://images.unsplash.com/photo-1792964785281-0397544a4245?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D","alt":""}

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    turnMs: 480,
    startRestMs: 670,
    coverRestMs: 2400,
    holdMs: 4000,
    easeX1: 30,
    easeY1: 70,
    easeX2: 30,
    easeY2: 100,
    pageAspect: 86,
    maxWidth: 64,
    maxHeight: 82,
    offsetY: 0,
    shade: 25,
    spineShade: 18,
    liftDeg: 12,
    arrowColor: "#EDEDED",
    arrowOpacity: 88,
    arrowDim: 45,
    arrowWeight: 2,
    arrowSize: 45,
    arrowInset: 30,
    pageFill: "#121214",
    grain: 0,
    vignette: 15,
    hover: 50,
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

const HAND = "'Chalkboard SE', 'Marker Felt', 'Segoe Print', 'Comic Sans MS', sans-serif"
const SCRIPT = "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive"
const SERIF = "'Iowan Old Style', Georgia, 'Times New Roman', serif"
const DISPLAY = "Didot, 'Bodoni 72', 'Bodoni MT', Georgia, serif"
const CONDENSED = "Impact, Haettenschweiler, 'Arial Narrow Bold', 'Oswald', sans-serif"
const ROUNDED = "'Arial Rounded MT Bold', 'Chalkboard SE', 'Trebuchet MS', sans-serif"

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const num = (v: any, d: number) => (typeof v === "number" && isFinite(v) ? v : d)
const srcOf = (v: any): string | undefined =>
    typeof v === "string" ? v || undefined : v && typeof v.src === "string" ? v.src || undefined : undefined

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

function bz(s: number, a: number, b: number) {
    const m = 1 - s
    return 3 * a * s * m * m + 3 * b * s * s * m + s * s * s
}
function bezier(x1: number, y1: number, x2: number, y2: number, t: number) {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let lo = 0,
        hi = 1,
        s = t
    for (let i = 0; i < 26; i++) {
        const x = bz(s, x1, x2)
        if (Math.abs(x - t) < 1e-5) break
        if (x < t) lo = s
        else hi = s
        s = (lo + hi) / 2
    }
    return bz(s, y1, y2)
}

// Each spread is { image, fit, x, y }; a bare picture (older saves) reads as
// Cover, centred.
type SpreadItem = { src: string; fit: string; x: number; y: number }
function spreadItemsOf(p: any): SpreadItem[] {
    return (Array.isArray(p.images) ? p.images : [])
        .map((it: any) => {
            const obj = it && typeof it === "object" && "image" in it
            return {
                src: srcOf(obj ? it.image : it),
                fit: obj && it.fit === "contain" ? "contain" : "cover",
                x: clamp(num(obj ? it.x : undefined, 50), 0, 100),
                y: clamp(num(obj ? it.y : undefined, 50), 0, 100),
            }
        })
        .filter((it: any) => !!it.src)
        .slice(0, 12) as SpreadItem[]
}
function spreadSrcsOf(p: any): string[] {
    return spreadItemsOf(p).map((it) => it.src)
}
function countOf(p: any) {
    const n = spreadSrcsOf(p).length
    return n >= 2 ? n : 5
}

type Box = { w: number; h: number; bx: number; by: number; bw: number; bh: number }

// Composition lives in the visible box: the root, or its parent when the root
// overflows a smaller frame (the size floor), so the book and arrows stay in view.
function layoutOf(d: Box, p: any, a: any) {
    const aspect = clamp(num(a.pageAspect, 86), 40, 140) / 100
    const sz = clamp(num(p.size, 600), 100, 2400)
    const pageH = Math.max(
        40,
        Math.min(
            sz,
            (d.bh * clamp(num(a.maxHeight, 82), 20, 100)) / 100,
            (d.bw * clamp(num(a.maxWidth, 64), 20, 100)) / 100 / (2 * aspect)
        )
    )
    const pageW = pageH * aspect
    return {
        pageW,
        pageH,
        bookLeft: d.bx + d.bw / 2 - pageW,
        bookTop: d.by + d.bh / 2 - pageH / 2 + (d.bh * num(a.offsetY, 0)) / 100,
    }
}

// Progress of the turning leaf, 0..1. A dragged leaf follows the pointer; on
// release it eases on from where it was let go (p0), forward or back.
function easeOf(s: any, a: any) {
    const an = s.anim
    if (!an) return 0
    if (an.drag) return clamp(num(an.p, 0), 0, 1)
    const e = bezier(
        clamp(a.easeX1, 0, 100) / 100,
        num(a.easeY1, 70) / 100,
        clamp(a.easeX2, 0, 100) / 100,
        num(a.easeY2, 100) / 100,
        clamp(an.t, 0, 1)
    )
    const p0 = clamp(num(an.p0, 0), 0, 1)
    return an.back ? p0 * (1 - e) : p0 + (1 - p0) * e
}

function txOf(s: any, pageW: number, e: number) {
    const closed = -pageW / 2
    if (s.anim) {
        if (s.anim.from === 0) return closed * (1 - e)
        if (s.anim.to === 0) return closed * e
    }
    return s.cur === 0 ? closed : 0
}

// ── built-in art ──────────────────────────────────────────────────────────

const BOKEH = (() => {
    const r = rng(11)
    const out: { x: number; y: number; r: number }[] = []
    for (let i = 0; i < 30; i++) {
        out.push({ x: (i % 6) * 300 + 30 + r() * 220, y: Math.floor(i / 6) * 210 + 10 + r() * 170, r: 34 + r() * 38 })
    }
    return out
})()

const BUTTERFLIES = [
    [170, 140, 1],
    [270, 90, 0.8],
    [110, 260, 0.7],
    [690, 120, 0.6],
    [1580, 830, 0.9],
    [1650, 740, 0.7],
    [1490, 905, 0.6],
    [1650, 130, 0.7],
]
const BUTTERFLY = "M0 0 C -14 -18 -32 -12 -24 4 C -18 13 -7 9 0 2 C 7 9 18 13 24 4 C 32 -12 14 -18 0 0 Z"

function Bear({ x, y, s, sign, signW, tilt }: any) {
    const fill = "#C88478",
        ink = "#8E4A3E"
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
            <line x1={74} y1={-40} x2={74} y2={-260} stroke="#6B4A3A" strokeWidth={9} strokeLinecap="round" />
            <g transform={`translate(74 -300) rotate(${tilt})`}>
                <rect x={-signW / 2} y={-44} width={signW} height={88} rx={6} fill="#3A2A28" />
                <text
                    x={0}
                    y={11}
                    textAnchor="middle"
                    fontFamily={HAND}
                    fontSize={30}
                    fontWeight={700}
                    fill="#FFFFFF"
                    textLength={signW - 40}
                    lengthAdjust="spacingAndGlyphs"
                >
                    {sign}
                </text>
            </g>
            <ellipse cx={-34} cy={90} rx={28} ry={18} fill={fill} stroke={ink} strokeWidth={4} />
            <ellipse cx={34} cy={90} rx={28} ry={18} fill={fill} stroke={ink} strokeWidth={4} />
            <ellipse cx={0} cy={0} rx={72} ry={96} fill={fill} stroke={ink} strokeWidth={4} />
            <ellipse cx={0} cy={14} rx={40} ry={56} fill="#E3A497" opacity={0.6} />
            <path d="M 40 -30 L 70 -120" stroke={ink} strokeWidth={34} strokeLinecap="round" />
            <path d="M 40 -30 L 70 -120" stroke={fill} strokeWidth={26} strokeLinecap="round" />
            <circle cx={-44} cy={-172} r={22} fill={fill} stroke={ink} strokeWidth={4} />
            <circle cx={44} cy={-172} r={22} fill={fill} stroke={ink} strokeWidth={4} />
            <circle cx={-44} cy={-172} r={10} fill="#E7A79A" />
            <circle cx={44} cy={-172} r={10} fill="#E7A79A" />
            <circle cx={0} cy={-122} r={62} fill={fill} stroke={ink} strokeWidth={4} />
            <ellipse cx={0} cy={-104} rx={26} ry={18} fill="#E7A79A" />
            <ellipse cx={0} cy={-112} rx={8} ry={6} fill="#5A2E28" />
            <circle cx={-21} cy={-136} r={5} fill="#3A2420" />
            <circle cx={21} cy={-136} r={5} fill="#3A2420" />
        </g>
    )
}

function Rabbit({ x, y, s, fill, ink }: any) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill} stroke={ink} strokeWidth={4}>
            <ellipse cx={-16} cy={-190} rx={13} ry={56} transform="rotate(-12 -16 -190)" />
            <ellipse cx={16} cy={-190} rx={13} ry={56} transform="rotate(12 16 -190)" />
            <ellipse cx={-26} cy={70} rx={26} ry={14} />
            <ellipse cx={26} cy={70} rx={26} ry={14} />
            <ellipse cx={0} cy={0} rx={46} ry={74} />
            <circle cx={0} cy={-110} r={40} />
            <circle cx={14} cy={-116} r={5} fill={ink} stroke="none" />
            <circle cx={-48} cy={20} r={14} />
        </g>
    )
}

function Cat({ x, y, s, fill, ink, mask, cape }: any) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
            {cape && (
                <g>
                    <path d="M -30 -100 C -170 -50 -200 70 -130 130 L 40 40 Z" fill="#2E3470" />
                    {[
                        [-110, 40],
                        [-80, -20],
                        [-140, 90],
                        [-60, 60],
                        [-30, -60],
                    ].map(([cx, cy], i) => (
                        <circle key={i} cx={cx} cy={cy} r={9} fill="#D4D7EE" />
                    ))}
                </g>
            )}
            <path d="M 50 40 C 130 30 140 -60 110 -100" stroke={fill} strokeWidth={16} fill="none" strokeLinecap="round" />
            <g fill={fill} stroke={ink} strokeWidth={4}>
                <ellipse cx={0} cy={0} rx={50} ry={80} />
                <path d="M -42 -150 L -34 -205 L -8 -165 Z" />
                <path d="M 42 -150 L 34 -205 L 8 -165 Z" />
                <circle cx={0} cy={-125} r={50} />
                <ellipse cx={-24} cy={78} rx={20} ry={12} />
                <ellipse cx={24} cy={78} rx={20} ry={12} />
            </g>
            {mask && <rect x={-48} y={-142} width={96} height={24} rx={10} fill="#11163A" />}
            <circle cx={-18} cy={-130} r={6} fill={mask ? "#FFFFFF" : ink} />
            <circle cx={18} cy={-130} r={6} fill={mask ? "#FFFFFF" : ink} />
        </g>
    )
}

function Squirrel({ x, y, s }: any) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`} stroke="#5A2E10" strokeWidth={4}>
            <path d="M 30 40 C 150 20 160 -150 60 -180 C 10 -190 -10 -140 30 -122 C 86 -100 76 -20 20 0 Z" fill="#A65A24" />
            <ellipse cx={0} cy={10} rx={46} ry={66} fill="#8A4A1E" />
            <circle cx={-6} cy={-80} r={40} fill="#8A4A1E" />
            <path d="M -30 -110 L -26 -146 L -6 -116 Z" fill="#8A4A1E" />
            <ellipse cx={-4} cy={20} rx={22} ry={36} fill="#E9B98A" stroke="none" />
            <circle cx={-20} cy={-86} r={5} fill="#2A160A" stroke="none" />
        </g>
    )
}

function Fox({ x, y, s }: any) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`} stroke="#7A3410" strokeWidth={4}>
            <path d="M -40 30 C -160 40 -170 -40 -120 -60 C -110 -20 -80 0 -40 0 Z" fill="#D96A2A" />
            <path d="M -150 -30 C -170 -50 -150 -70 -128 -58 Z" fill="#FFF4E2" />
            <ellipse cx={0} cy={0} rx={56} ry={74} fill="#D96A2A" />
            <path d="M -46 -110 L -40 -170 L -10 -126 Z" fill="#D96A2A" />
            <path d="M 46 -110 L 40 -170 L 10 -126 Z" fill="#D96A2A" />
            <path d="M -52 -110 C -40 -170 40 -170 52 -110 L 0 -60 Z" fill="#D96A2A" />
            <path d="M -30 -92 L 0 -60 L 30 -92 Z" fill="#FFF4E2" stroke="none" />
            <circle cx={-18} cy={-112} r={5} fill="#2A160A" stroke="none" />
            <circle cx={18} cy={-112} r={5} fill="#2A160A" stroke="none" />
        </g>
    )
}

const SPREAD_ART: ((u: string) => any)[] = [
    // 1 — FOR KIDS & PARENTS (pink)
    (u) => (
        <g>
            <rect width={1720} height={1000} fill={`url(#${u}-p1)`} />
            <g filter={`url(#${u}-blur)`} opacity={0.7}>
                {BOKEH.map((b, i) => (
                    <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#EFC4B8" />
                ))}
            </g>
            <circle cx={460} cy={640} r={300} fill="#F6D6CC" opacity={0.55} filter={`url(#${u}-blur)`} />
            {BUTTERFLIES.map(([bx, by, bs], i) => (
                <path key={i} d={BUTTERFLY} fill="#F6EEF0" transform={`translate(${bx} ${by}) scale(${bs})`} />
            ))}
            <Bear x={300} y={770} s={1} sign="I'M UNCOMFORTABLE" signW={300} tilt={-15} />
            <Bear x={570} y={800} s={0.85} sign="SO AM I…" signW={200} tilt={-10} />
            <text x={1040} y={230} fontFamily={HAND} fontSize={64} fontWeight={700} fill="#3A2A2A">
                FOR KIDS
            </text>
            <text x={1040} y={302} fontFamily={HAND} fontSize={64} fontWeight={700} fill="#3A2A2A">
                <tspan fontFamily={SCRIPT} fontWeight={400}>
                    &amp;
                </tspan>{" "}
                PARENTS
            </text>
            <g fontFamily={SERIF} fontSize={25} fill="#2E2222">
                <text x={1000} y={410}>Have you ever discussed racism with your kids?</text>
                <text x={1000} y={480}>You're probably like most of us and concerned</text>
                <text x={1000} y={512}>about saying the wrong things. That's okay.</text>
                <text x={1000} y={544}>You will say the wrong things.</text>
                <text x={1000} y={614}>When two Mondaymen presented the idea to</text>
                <text x={1000} y={646}>spark conversations around this tricky subject,</text>
                <text x={1000} y={678}>we decided to make this book.</text>
                <text x={1000} y={748}>We're still learning, and we hope this simple</text>
                <text x={1000} y={780}>guide can make a difference for someone.</text>
            </g>
        </g>
    ),
    // 2 — EDUCATE yourself (red-orange)
    (u) => (
        <g>
            <rect width={1720} height={1000} fill={`url(#${u}-p2)`} />
            <rect width={1720} height={760} fill={`url(#${u}-dots)`} opacity={0.55} />
            <rect y={760} width={1720} height={240} fill="#A1412F" />
            <rect y={752} width={1720} height={12} fill="#8E3626" />
            {[
                [110, 110, 150, 120],
                [690, 70, 110, 90],
                [1380, 90, 130, 160],
                [1545, 300, 140, 110],
            ].map(([x, y, w, h], i) => (
                <g key={i}>
                    <rect x={x} y={y} width={w} height={h} fill="#B5503A" stroke="#7A2E20" strokeWidth={10} />
                    <rect x={x + 18} y={y + 18} width={w - 36} height={h - 36} fill="#D9785A" opacity={0.6} />
                </g>
            ))}
            <text
                x={868}
                y={568}
                textAnchor="middle"
                fontFamily={DISPLAY}
                fontStyle="italic"
                fontWeight={700}
                fontSize={320}
                fill="#8E3626"
                textLength={1440}
                lengthAdjust="spacingAndGlyphs"
            >
                EDUCATE
            </text>
            <text
                x={860}
                y={560}
                textAnchor="middle"
                fontFamily={DISPLAY}
                fontStyle="italic"
                fontWeight={700}
                fontSize={320}
                fill="#F2E6D0"
                textLength={1440}
                lengthAdjust="spacingAndGlyphs"
            >
                EDUCATE
            </text>
            <text x={1000} y={690} fontFamily={SCRIPT} fontSize={120} fill="#F2E6D0">
                Yourself
            </text>
            <rect x={1230} y={640} width={18} height={220} fill="#3A1F18" />
            <rect x={1580} y={640} width={18} height={220} fill="#3A1F18" />
            <path d="M 1240 660 Q 1415 740 1590 660" stroke="#7A1E1E" strokeWidth={10} fill="none" />
            <Rabbit x={300} y={850} s={1} fill="#F2E6D0" ink="#C9A88A" />
            <Rabbit x={430} y={880} s={0.78} fill="#F2E6D0" ink="#C9A88A" />
            <text x={1100} y={860} fontFamily={SERIF} fontSize={30} fill="#F6E9DA">
                Educate Yourself
            </text>
            <g fontFamily={SERIF} fontSize={18} fill="#F2D9C8">
                <text x={1100} y={896}>Learn about racism, its history and how it</text>
                <text x={1100} y={922}>shows up today, in big and small ways.</text>
            </g>
        </g>
    ),
    // 3 — Address PRIVILEGE (green)
    (u) => (
        <g>
            <rect width={1720} height={1000} fill={`url(#${u}-p3)`} />
            <path
                d="M 1250 -60 C 1650 150 1150 420 1500 620 S 1800 900 1760 1060"
                stroke="#24452F"
                strokeWidth={80}
                fill="none"
                strokeLinecap="round"
            />
            <path d="M -40 220 C 200 120 380 260 520 120" stroke="#2B5136" strokeWidth={40} fill="none" strokeLinecap="round" />
            {[
                [120, 940, 30],
                [260, 960, -20],
                [1350, 950, 15],
                [1500, 930, -30],
                [80, 880, 60],
            ].map(([x, y, r], i) => (
                <ellipse key={i} cx={x} cy={y} rx={22} ry={60} fill="#2B5136" transform={`rotate(${r} ${x} ${y})`} />
            ))}
            <text x={250} y={170} fontFamily={SCRIPT} fontSize={76} fill="#A9D6B2">
                Address
            </text>
            <text
                x={870}
                y={700}
                textAnchor="middle"
                fontFamily={CONDENSED}
                fontSize={470}
                fill="#2A5036"
                textLength={1560}
                lengthAdjust="spacingAndGlyphs"
            >
                PRIVILEGE
            </text>
            <text
                x={860}
                y={690}
                textAnchor="middle"
                fontFamily={CONDENSED}
                fontSize={470}
                fill="#EDE6D2"
                stroke="#3E704F"
                strokeWidth={6}
                textLength={1560}
                lengthAdjust="spacingAndGlyphs"
            >
                PRIVILEGE
            </text>
            <g stroke="#8B5A2B" strokeWidth={10} strokeLinecap="round">
                <line x1={600} y1={430} x2={560} y2={970} />
                <line x1={690} y1={430} x2={656} y2={970} />
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <line key={i} x1={598 - i * 5.5} y1={470 + i * 72} x2={686 - i * 4.6} y2={470 + i * 72} />
                ))}
            </g>
            <Rabbit x={650} y={420} s={1.1} fill="#8FC28F" ink="#5E9A66" />
            <text x={1000} y={860} fontFamily={SERIF} fontSize={30} fill="#EDE6D2">
                Address Privilege
            </text>
            <g fontFamily={SERIF} fontSize={18} fill="#CFE3D3">
                <text x={1000} y={896}>Be clear and honest about the advantages of</text>
                <text x={1000} y={922}>white people because of their color.</text>
            </g>
        </g>
    ),
    // 4 — Diversify your HEROES (blue)
    (u) => (
        <g>
            <rect width={1720} height={1000} fill="#434F9E" />
            <rect width={1720} height={620} fill={`url(#${u}-stripes)`} opacity={0.5} />
            <rect y={620} width={1720} height={380} fill="#5A66B0" />
            <rect y={616} width={1720} height={8} fill="#333954" />
            <text x={150} y={150} fontFamily={SCRIPT} fontSize={66} fill="#262B5C">
                Diversify your
            </text>
            <rect x={1180} y={200} width={400} height={16} fill="#262B5C" />
            <rect x={1210} y={130} width={60} height={70} rx={8} fill="#7E86AF" />
            <circle cx={1330} cy={168} r={32} fill="#C9CDEA" />
            <rect x={1390} y={110} width={40} height={90} rx={6} fill="#333954" />
            <path d="M 1460 200 L 1500 120 L 1540 200 Z" fill="#7E86AF" />
            <g fontFamily={CONDENSED} fontSize={440} fill="#D4D7EE" stroke="#9CA2CC" strokeWidth={4}>
                <text x={170} y={760} textLength={780} lengthAdjust="spacingAndGlyphs">
                    HER
                </text>
                <text x={1355} y={760} textLength={340} lengthAdjust="spacingAndGlyphs">
                    ES
                </text>
            </g>
            <circle cx={1150} cy={580} r={185} fill="#2E3470" />
            <ellipse cx={1150} cy={580} rx={185} ry={70} stroke="#4A52A0" strokeWidth={6} fill="none" />
            <ellipse cx={1150} cy={580} rx={70} ry={185} stroke="#4A52A0" strokeWidth={6} fill="none" />
            <ellipse cx={1088} cy={505} rx={52} ry={30} fill="#6A72C0" opacity={0.6} />
            <Cat x={420} y={790} s={1.05} fill="#E9EBF7" ink="#9CA2CC" cape />
            <Cat x={1600} y={800} s={1} fill="#262B5C" ink="#11163A" mask />
            <rect x={640} y={900} width={150} height={26} rx={4} fill="#262B5C" />
            <rect x={660} y={876} width={120} height={24} rx={4} fill="#7E86AF" />
            <text x={960} y={880} fontFamily={SERIF} fontSize={32} fill="#F2F2FA">
                Diversify Your Heroes
            </text>
            <g fontFamily={SERIF} fontSize={18} fill="#E0E2F2">
                <text x={960} y={914}>Look for non-white heroes in entertainment,</text>
                <text x={960} y={940}>books, toys, games, mythology, etc.</text>
            </g>
        </g>
    ),
    // 5 — Make NEW FRIENDS (orange)
    (u) => (
        <g>
            <rect width={1720} height={1000} fill={`url(#${u}-p5)`} />
            <circle cx={1300} cy={250} r={260} fill="#F8D08A" opacity={0.5} filter={`url(#${u}-blur)`} />
            <path d="M0 800 Q 430 700 860 780 T 1720 760 L1720 1000 L0 1000Z" fill="#C98A44" />
            <path d="M0 900 Q 500 840 900 900 T 1720 880 L1720 1000 L0 1000Z" fill="#B06A30" />
            <text x={250} y={170} fontFamily={SCRIPT} fontSize={76} fill="#7A4A22">
                Make
            </text>
            <g fontFamily={ROUNDED} fontWeight={700} textAnchor="middle" strokeLinejoin="round">
                <text x={860} y={430} fontSize={260} fill="#FBEBD0" stroke="#FBEBD0" strokeWidth={34} textLength={700} lengthAdjust="spacingAndGlyphs">
                    NEW
                </text>
                <text x={860} y={430} fontSize={260} fill="#F1D7AE" textLength={700} lengthAdjust="spacingAndGlyphs">
                    NEW
                </text>
                <text x={860} y={750} fontSize={300} fill="#FBEBD0" stroke="#FBEBD0" strokeWidth={34} textLength={1460} lengthAdjust="spacingAndGlyphs">
                    FRIENDS
                </text>
                <text x={860} y={750} fontSize={300} fill="#F1D7AE" textLength={1460} lengthAdjust="spacingAndGlyphs">
                    FRIENDS
                </text>
            </g>
            <line x1={1560} y1={700} x2={1690} y2={920} stroke="#7A4A22" strokeWidth={10} />
            <line x1={1600} y1={700} x2={1600} y2={920} stroke="#7A4A22" strokeWidth={8} />
            <Squirrel x={560} y={880} s={0.95} />
            <Fox x={860} y={890} s={0.85} />
            <text x={1120} y={880} fontFamily={SERIF} fontSize={30} fill="#FFF4E2">
                Make New Friends
            </text>
            <g fontFamily={SERIF} fontSize={18} fill="#FBE6C8">
                <text x={1120} y={914}>Seek out friendships with people who</text>
                <text x={1120} y={940}>look different from you and your family.</text>
            </g>
        </g>
    ),
]

function Defs({ u }: { u: string }) {
    return (
        <svg width={0} height={0} style={{ position: "absolute", pointerEvents: "none" }} aria-hidden>
            <defs>
                <filter id={`${u}-blur`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="16" />
                </filter>
                <filter id={`${u}-soft`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="8" />
                </filter>
                <filter id={`${u}-chalk`} x="-5%" y="-5%" width="110%" height="110%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
                    <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" result="d" />
                    <feComponentTransfer in="n" result="m">
                        <feFuncA type="discrete" tableValues="0 1 1 1 1 1" />
                    </feComponentTransfer>
                    <feComposite in="d" in2="m" operator="in" />
                </filter>
                <filter id={`${u}-grain`} x="0" y="0" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
                    <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" />
                </filter>
                <radialGradient id={`${u}-p1`} cx="0.32" cy="0.62" r="0.8">
                    <stop offset="0" stopColor="#F6D6CC" />
                    <stop offset="0.45" stopColor="#E7B2A6" />
                    <stop offset="1" stopColor="#D99A8E" />
                </radialGradient>
                <linearGradient id={`${u}-p2`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#CF5C42" />
                    <stop offset="1" stopColor="#B84A34" />
                </linearGradient>
                <linearGradient id={`${u}-p3`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#46805B" />
                    <stop offset="1" stopColor="#315C40" />
                </linearGradient>
                <linearGradient id={`${u}-p5`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#F0B65C" />
                    <stop offset="1" stopColor="#C2804A" />
                </linearGradient>
                <radialGradient id={`${u}-cover`} cx="0.55" cy="0.45" r="0.75">
                    <stop offset="0" stopColor="#1C1C1C" />
                    <stop offset="0.35" stopColor="#121212" />
                    <stop offset="1" stopColor="#060606" />
                </radialGradient>
                <pattern id={`${u}-dots`} width="26" height="26" patternUnits="userSpaceOnUse">
                    <circle cx="13" cy="13" r="3.4" fill="#A1412F" />
                </pattern>
                <pattern id={`${u}-stripes`} width="84" height="20" patternUnits="userSpaceOnUse">
                    <rect width="42" height="20" fill="#4C58A8" />
                </pattern>
            </defs>
        </svg>
    )
}

const Half = memo(function Half({ art, side, pw, ph, radius, src, ok, u, fill, fit, posX, posY }: any) {
    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                borderRadius: side === "L" ? `${radius}px 0 0 ${radius}px` : `0 ${radius}px ${radius}px 0`,
            }}
        >
            <div style={{ position: "absolute", top: 0, left: side === "L" ? 0 : -pw, width: pw * 2, height: ph }}>
                {ok ? (
                    <>
                        <div style={{ position: "absolute", inset: 0, background: fill }} />
                        <img
                            src={src}
                            alt=""
                            draggable={false}
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: fit === "contain" ? "contain" : "cover",
                                objectPosition: fit === "contain" ? "50% 50%" : `${num(posX, 50)}% ${num(posY, 50)}%`,
                                display: "block",
                            }}
                        />
                    </>
                ) : (
                    <svg width="100%" height="100%" viewBox="0 0 1720 1000" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
                        {SPREAD_ART[art % SPREAD_ART.length](u)}
                    </svg>
                )}
            </div>
        </div>
    )
})

const CoverFace = memo(function CoverFace({ u, src, ok, fill, radius, fit, posX, posY }: any) {
    const isCover = fit !== "contain"
    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: `0 ${radius}px ${radius}px 0` }}>
            {ok ? (
                <>
                    <div style={{ position: "absolute", inset: 0, background: fill }} />
                    <img
                        src={src}
                        alt=""
                        draggable={false}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: isCover ? "cover" : "contain",
                            objectPosition: isCover ? `${posX}% ${posY}%` : "50% 50%",
                            display: "block",
                        }}
                    />
                </>
            ) : (
                <svg width="100%" height="100%" viewBox="0 0 860 1000" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
                    <rect width={860} height={1000} fill={`url(#${u}-cover)`} />
                    <g filter={`url(#${u}-soft)`} opacity={0.6}>
                        <ellipse cx={200} cy={250} rx={40} ry={220} fill="#1E1E1E" transform="rotate(33 200 250)" />
                        <ellipse cx={650} cy={760} rx={50} ry={260} fill="#1A1A1A" transform="rotate(33 650 760)" />
                        <ellipse cx={420} cy={880} rx={30} ry={180} fill="#1C1C1C" transform="rotate(33 420 880)" />
                    </g>
                    <g filter={`url(#${u}-chalk)`}>
                        <g textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={66} fill="#EDEDED" letterSpacing={2}>
                            <text x={430} y={392}>
                                HOW
                                <tspan fontFamily={SCRIPT} fontWeight={400} fontSize={50} fill="#A8A8A8" dx={10}>
                                    to
                                </tspan>
                            </text>
                            <text x={440} y={477}>
                                TALK
                                <tspan fontFamily={SCRIPT} fontWeight={400} fontSize={50} fill="#A8A8A8" dx={10}>
                                    to
                                </tspan>
                                <tspan dx={10}>WHITE</tspan>
                            </text>
                            <text x={430} y={562}>
                                KIDS
                                <tspan fontFamily={SCRIPT} fontWeight={400} fontSize={50} fill="#A8A8A8" dx={10}>
                                    about
                                </tspan>
                            </text>
                            <text x={420} y={647}>
                                RACISM
                            </text>
                        </g>
                        <g stroke="#8C8C8C" strokeWidth={3} fill="none" strokeLinecap="round">
                            <ellipse cx={400} cy={370} rx={92} ry={42} transform="rotate(-6 400 370)" />
                            <path d="M 520 330 C 530 290 560 290 555 320 C 550 350 580 340 592 300" />
                            <path d="M 712 470 L 630 540 M 630 540 L 660 538 M 630 540 L 636 512" />
                            <path d="M 730 600 L 620 598 M 620 598 L 646 585 M 620 598 L 646 612" />
                            <path d="M 290 690 L 330 668 L 342 700 L 372 666 L 386 700 L 570 682" />
                        </g>
                    </g>
                    <text x={430} y={820} textAnchor="middle" fontFamily={SERIF} fontSize={22} fill="#9A9A9A">
                        A simple illustrated guide
                    </text>
                    <line x1={1.5} y1={0} x2={1.5} y2={1000} stroke="#1E1E1E" strokeWidth={3} />
                </svg>
            )}
        </div>
    )
})


// ── component ─────────────────────────────────────────────────────────────

export default function Effect3DPageFlipBook(props: any) {
    props = withMovedControls(props)
    if (props.images === undefined) props = { ...props, images: DEFAULT_SPREADS }
    const {
        background = "#000000",
        speed = 50,
        autoplay = true,
        pause = 7,
        size = 600,
        rounded = 15,
        perspective = 500,
        showArrows = true,
        images,
        image = DEFAULT_IMAGE,
        coverFit = "cover",
        coverX = 50,
        coverY = 50,
        style,
    } = props
    const adv = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }

    const rootRef = useRef<HTMLDivElement>(null)
    const propsRef = useRef<any>(props)
    propsRef.current = props
    const uid = useRef("pfb" + Math.random().toString(36).slice(2, 8)).current
    const [dims, setDims] = useState<Box>({ w: 1200, h: 800, bx: 0, by: 0, bw: 1200, bh: 800 })
    const dimsRef = useRef(dims)
    dimsRef.current = dims
    const [, setTick] = useState(0)

    const rt = RenderTarget.current()
    const isStatic = rt === RenderTarget.thumbnail || rt === RenderTarget.export

    const sim = useRef<any>(null)
    if (!sim.current) {
        sim.current = {
            cur: isStatic ? 0 : 1,
            anim: null,
            rest: ADVANCED_DEFAULTS.startRestMs / 1000,
            dir: 1,
            hold: 0,
            liftL: 0,
            liftR: 0,
            arrL: 0,
            arrR: 0,
            reduced: false,
        }
    }
    const ptr = useRef({ x: 0, y: 0, inside: false, down: false })
    const dragRef = useRef<{ x0: number; d: number; moved: boolean } | null>(null)
    const releaseRef = useRef<() => void>(() => {})

    // pictures: load each src once
    const spreadItems = spreadItemsOf(props)
    const spreadSrcs = spreadItems.map((it) => it.src)
    const coverSrc = srcOf(image)
    const allSrcs = [...spreadSrcs, ...(coverSrc ? [coverSrc] : [])]
    const srcKey = allSrcs.join("|")
    const [loaded, setLoaded] = useState<Record<string, boolean>>({})
    const requested = useRef<Set<string>>(new Set())
    useEffect(() => {
        let alive = true
        for (const src of allSrcs) {
            if (requested.current.has(src)) continue
            requested.current.add(src)
            const im = new Image()
            im.onload = () => alive && setLoaded((m) => ({ ...m, [src]: true }))
            im.onerror = () => alive && setLoaded((m) => ({ ...m, [src]: false }))
            im.src = src
        }
        return () => {
            alive = false
            // a cancelled run (strict-mode remount, changed sources) must be able to request again
            requested.current.clear()
        }
    }, [srcKey])

    // size: the root, and the part of it its parent actually shows
    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const par = el.parentElement
        const measure = () => {
            const w = el.offsetWidth || 1200
            const h = el.offsetHeight || 800
            let bw = w,
                bh = h
            if (par) {
                const pw = par.clientWidth
                const ph = par.clientHeight
                if (pw > 0 && pw < w) bw = pw
                if (ph > 0 && ph < h) bh = ph
            }
            let bx = (w - bw) / 2
            let by = (h - bh) / 2
            if (par && el.offsetParent === par) {
                if (bw < w) bx = clamp(-el.offsetLeft, 0, w - bw)
                if (bh < h) by = clamp(-el.offsetTop, 0, h - bh)
            }
            const d = dimsRef.current
            if (w !== d.w || h !== d.h || bw !== d.bw || bh !== d.bh || bx !== d.bx || by !== d.by) {
                setDims({ w, h, bx, by, bw, bh })
            }
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        if (par) ro.observe(par)
        return () => ro.disconnect()
    }, [])

    const startTurn = (to: number, a: any, drag = false) => {
        const s = sim.current
        const N = countOf(propsRef.current)
        if (s.anim || to < 0 || to > N || to === s.cur) return
        const hk = clamp(num(a.hover, 50), 0, 100) / 50
        const lift = num(a.liftDeg, 12) * hk
        if (s.reduced) {
            s.cur = to
            s.rest = to === 0 ? a.coverRestMs / 1000 : num(propsRef.current.pause, 7) / 10
            return
        }
        const a0 = to > s.cur ? -lift * s.liftR : -180 + lift * s.liftL
        s.anim = { from: s.cur, to, t: 0, a0, p0: 0, back: false, drag, p: 0, dur: 1 }
        s.liftL = 0
        s.liftR = 0
    }

    const regionAt = (x: number, y: number) => {
        const s = sim.current
        const d = dimsRef.current
        const p = propsRef.current
        const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
        if (x < d.bx + d.bw * 0.13) return "AL"
        if (x > d.bx + d.bw * 0.87) return "AR"
        const L = layoutOf(d, p, a)
        const spine = d.bx + d.bw / 2 + txOf(s, L.pageW, easeOf(s, a))
        if (y < L.bookTop || y > L.bookTop + L.pageH) return null
        if (x >= spine && x <= spine + L.pageW) return "R"
        if (x < spine && x >= spine - L.pageW && s.cur > 0) return "L"
        return null
    }

    // frame loop
    useEffect(() => {
        if (isStatic) return
        const s = sim.current
        const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
        if (mq && mq.matches) {
            s.reduced = true
            s.cur = 0
        }
        let raf = 0
        let last = -1
        let alive = true
        const up = () => releaseRef.current()
        window.addEventListener("pointerup", up)
        window.addEventListener("pointercancel", up)

        const step = (now: number) => {
            if (!alive) return
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            last = now
            const p = propsRef.current
            const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
            const N = countOf(p)
            if (s.cur > N) {
                s.cur = N
                s.anim = null
            }
            const spd = clamp(num(p.speed, 50), 0, 100) / 50
            const turnS = Math.max(0.05, num(a.turnMs, 480) / 1000)

            if (s.anim) {
                if (!s.anim.drag) {
                    s.anim.t += (dt * (spd > 0 ? spd : 1)) / (turnS * num(s.anim.dur, 1))
                    if (s.anim.t >= 1) {
                        if (s.anim.back) {
                            s.anim = null
                            s.rest = clamp(num(p.pause, 7), 0, 100) / 10
                        } else {
                            s.cur = s.anim.to
                            s.anim = null
                            s.rest = s.cur === 0 ? num(a.coverRestMs, 2400) / 1000 : clamp(num(p.pause, 7), 0, 100) / 10
                        }
                    }
                }
            } else if (!s.reduced && spd > 0 && p.autoplay !== false) {
                if (s.hold > 0) s.hold -= dt
                else {
                    s.rest -= dt * spd
                    if (s.rest <= 0) {
                        if (s.dir > 0 && s.cur >= N) s.dir = -1
                        if (s.dir < 0 && s.cur <= 0) s.dir = 1
                        startTurn(s.cur + s.dir, a)
                    }
                }
            }

            // pointer response, eased in and out
            const hk = clamp(num(a.hover, 50), 0, 100) / 50
            const pr = ptr.current
            const region = pr.inside ? regionAt(pr.x, pr.y) : null
            const k = 1 - Math.exp(-dt * 9)
            const boost = pr.down ? 1.5 : 1
            const tR = !s.anim && hk > 0 && region === "R" ? boost : 0
            const tL = !s.anim && hk > 0 && region === "L" ? boost : 0
            s.liftR += (tR - s.liftR) * k
            s.liftL += (tL - s.liftL) * k
            s.arrL += ((region === "AL" ? 1 : 0) - s.arrL) * k
            s.arrR += ((region === "AR" ? 1 : 0) - s.arrR) * k

            setTick((t) => (t + 1) % 1000000)
            raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
        return () => {
            alive = false
            cancelAnimationFrame(raf)
            window.removeEventListener("pointerup", up)
            window.removeEventListener("pointercancel", up)
        }
    }, [])

    const onMove = (e: any) => {
        ptr.current.x = e.nativeEvent.offsetX
        ptr.current.y = e.nativeEvent.offsetY
        ptr.current.inside = true
        const g = dragRef.current
        const an = sim.current.anim
        if (!g || !an || !an.drag) return
        const dx = ptr.current.x - g.x0
        if (Math.abs(dx) > 4) g.moved = true
        const p = propsRef.current
        const a = { ...ADVANCED_DEFAULTS, ...(p.advanced ?? {}) }
        const L = layoutOf(dimsRef.current, p, a)
        an.p = clamp((-dx * g.d) / (L.pageW * 1.2), 0, 1)
    }
    // Let go of a dragged leaf: a tap or a pull past 30% finishes the turn,
    // anything less falls back.
    const release = () => {
        ptr.current.down = false
        const g = dragRef.current
        dragRef.current = null
        const s = sim.current
        const an = s.anim
        if (!g || !an || !an.drag) return
        const a = { ...ADVANCED_DEFAULTS, ...(propsRef.current.advanced ?? {}) }
        const p = clamp(num(an.p, 0), 0, 1)
        const commit = !g.moved || p > 0.3
        an.drag = false
        an.t = 0
        an.p0 = p
        an.back = !commit
        an.dur = Math.max(0.3, commit ? 1 - p : p)
        s.hold = num(a.holdMs, 4000) / 1000
    }
    releaseRef.current = release
    const onLeave = () => {
        ptr.current.inside = false
    }
    const onDown = (e: any) => {
        onMove(e)
        ptr.current.down = true
        const s = sim.current
        const a = { ...ADVANCED_DEFAULTS, ...(propsRef.current.advanced ?? {}) }
        const region = regionAt(ptr.current.x, ptr.current.y)
        let d = 0
        if (region === "AR" || region === "R") d = 1
        else if (region === "AL" || region === "L") d = -1
        if (!d || s.anim) return
        const before = s.cur
        startTurn(s.cur + d, a, region === "R" || region === "L")
        if (s.anim || s.cur !== before) {
            s.dir = d
            s.hold = num(a.holdMs, 4000) / 1000
        }
        if (s.anim && s.anim.drag) {
            dragRef.current = { x0: ptr.current.x, d, moved: false }
            try {
                rootRef.current?.setPointerCapture(e.pointerId)
            } catch {}
        }
    }

    // ── render ──
    const s = sim.current
    const N = countOf(props)
    const cur = Math.min(s.cur, N)
    const L = layoutOf(dims, props, adv)
    const e = easeOf(s, adv)
    const tx = txOf(s, L.pageW, e)
    const P = (clamp(num(perspective, 500), 100, 1000) / 100) * L.pageH
    const radius = (clamp(num(rounded, 15), 0, 100) / 100) * (L.pageW / 2)
    const hk = clamp(num(adv.hover, 50), 0, 100) / 50
    const lift = num(adv.liftDeg, 12) * hk
    const fill = adv.pageFill

    const angleOf = (k: number) => {
        if (s.anim) {
            const { from, to, a0 } = s.anim
            if (k === Math.min(from, to)) {
                const target = to > from ? -180 : 0
                return a0 + (target - a0) * e
            }
        }
        if (k < cur) return k === cur - 1 ? -180 + lift * s.liftL : -180
        return k === cur ? -lift * s.liftR : 0
    }
    const isMoving = (k: number) => !!s.anim && k === Math.min(s.anim.from, s.anim.to)

    const spreadItem = (i: number) => (spreadItems.length ? spreadItems[(i - 1) % spreadItems.length] : undefined)
    const target = s.anim ? s.anim.to : cur
    const lo = Math.max(0, Math.min(cur, target) - 1)
    const hi = Math.min(N, Math.max(cur, target) + 1)
    const shadeK = clamp(num(adv.shade, 25), 0, 100) / 100
    const spineK = clamp(num(adv.spineShade, 18), 0, 100) / 100

    const leaves: any[] = []
    for (let k = lo; k <= hi; k++) {
        const ang = angleOf(k)
        const front = ang > -90
        const z = isMoving(k) ? 1000 : k < cur ? 200 + k : 100 - k
        const rad = front ? `0 ${radius}px ${radius}px 0` : `${radius}px 0 0 ${radius}px`
        let face: any
        let isSpread = true
        if (front) {
            if (k === 0) {
                isSpread = false
                face = (
                    <CoverFace
                        u={uid}
                        src={coverSrc}
                        ok={!!coverSrc && loaded[coverSrc] === true}
                        fill={fill}
                        radius={radius}
                        fit={coverFit}
                        posX={clamp(num(coverX, 50), 0, 100)}
                        posY={clamp(num(coverY, 50), 0, 100)}
                    />
                )
            } else {
                const it = spreadItem(k)
                const src = it?.src
                face = (
                    <Half
                        art={k - 1}
                        side="R"
                        pw={L.pageW}
                        ph={L.pageH}
                        radius={radius}
                        src={src}
                        ok={!!src && loaded[src] === true}
                        u={uid}
                        fill={fill}
                        fit={it?.fit}
                        posX={it?.x}
                        posY={it?.y}
                    />
                )
            }
        } else if (k < N) {
            const it = spreadItem(k + 1)
            const src = it?.src
            face = (
                <Half
                    art={k}
                    side="L"
                    pw={L.pageW}
                    ph={L.pageH}
                    radius={radius}
                    src={src}
                    ok={!!src && loaded[src] === true}
                    u={uid}
                    fill={fill}
                    fit={it?.fit}
                    posX={it?.x}
                    posY={it?.y}
                />
            )
        } else {
            isSpread = false
            face = <div style={{ position: "absolute", inset: 0, background: "#0E0E10", borderRadius: rad }} />
        }
        const shadeOp = shadeK * Math.abs(Math.sin((ang * Math.PI) / 180))
        leaves.push(
            <div
                key={k}
                style={{
                    position: "absolute",
                    left: L.pageW,
                    top: 0,
                    width: L.pageW,
                    height: L.pageH,
                    transformOrigin: "0px 50%",
                    transform: `rotateY(${ang}deg)`,
                    zIndex: z,
                }}
            >
                <div style={{ position: "absolute", inset: 0, transform: front ? undefined : "scaleX(-1)" }}>
                    {face}
                    {isSpread && spineK > 0 && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: rad,
                                background: `linear-gradient(to ${front ? "right" : "left"}, rgba(0,0,0,${spineK}) 0%, rgba(0,0,0,0) 9%)`,
                            }}
                        />
                    )}
                    {shadeOp > 0.002 && (
                        <div style={{ position: "absolute", inset: 0, borderRadius: rad, background: "#000", opacity: shadeOp }} />
                    )}
                </div>
            </div>
        )
    }

    // arrows, placed in the visible box
    const W = dims.w
    const H = dims.h
    const aLen = (dims.bw * clamp(num(adv.arrowSize, 45), 5, 200)) / 1000
    const aInset = (dims.bw * clamp(num(adv.arrowInset, 30), 0, 300)) / 1000
    const aY = dims.by + dims.bh * 0.515
    const aW = Math.max(1, (num(adv.arrowWeight, 2) * dims.bw) / 1200)
    const atStart = cur === 0 && !s.anim
    const atEnd = cur === N && !s.anim
    const opL = Math.min(1, (atStart ? adv.arrowDim : adv.arrowOpacity) / 100 + 0.12 * hk * s.arrL)
    const opR = Math.min(1, (atEnd ? adv.arrowDim : adv.arrowOpacity) / 100 + 0.12 * hk * s.arrR)
    const nudgeL = -aLen * 0.14 * hk * s.arrL
    const nudgeR = aLen * 0.14 * hk * s.arrR
    const lcx = dims.bx + aInset + aLen / 2 + nudgeL
    const rcx = dims.bx + dims.bw - aInset - aLen / 2 + nudgeR

    const grain = clamp(num(adv.grain, 6), 0, 100) / 100
    const vignette = clamp(num(adv.vignette, 15), 0, 100) / 100

    return (
        <div
            ref={rootRef}
            onPointerMove={onMove}
            onPointerEnter={onMove}
            onPointerLeave={onLeave}
            onPointerDown={onDown}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 1200,
                minHeight: 800,
                ...style,
                overflow: "hidden",
                background,
                isolation: "isolate",
                cursor: dragRef.current ? "grabbing" : "grab",
                userSelect: "none",
                touchAction: "pan-y",
            }}
        >
            <Defs u={uid} />
            <div
                style={{
                    position: "absolute",
                    left: L.bookLeft,
                    top: L.bookTop,
                    width: L.pageW * 2,
                    height: L.pageH,
                    transform: `translateX(${tx}px)`,
                    perspective: `${P}px`,
                    perspectiveOrigin: `${L.pageW}px 50%`,
                    pointerEvents: "none",
                }}
            >
                {leaves}
            </div>
            {showArrows && (
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    <g
                        filter={`url(#${uid}-chalk)`}
                        stroke={adv.arrowColor}
                        strokeWidth={aW}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <g opacity={opL}>
                            <path d={`M ${lcx + aLen / 2} ${aY + aLen * 0.02} Q ${lcx} ${aY - aLen * 0.07} ${lcx - aLen / 2} ${aY}`} />
                            <path
                                d={`M ${lcx - aLen / 2 + aLen * 0.28} ${aY - aLen * 0.16} L ${lcx - aLen / 2} ${aY} L ${lcx - aLen / 2 + aLen * 0.26} ${aY + aLen * 0.12}`}
                            />
                        </g>
                        <g opacity={opR}>
                            <path d={`M ${rcx - aLen / 2} ${aY + aLen * 0.03} Q ${rcx} ${aY - aLen * 0.08} ${rcx + aLen / 2} ${aY}`} />
                            <path
                                d={`M ${rcx + aLen / 2 - aLen * 0.3} ${aY - aLen * 0.15} L ${rcx + aLen / 2} ${aY} L ${rcx + aLen / 2 - aLen * 0.3} ${aY + aLen * 0.1}`}
                            />
                            <path d={`M ${rcx + aLen / 2 - aLen * 0.22} ${aY - aLen * 0.05} L ${rcx + aLen / 2} ${aY}`} />
                        </g>
                    </g>
                </svg>
            )}
            {vignette > 0 && (
                <div
                    style={{
                        position: "absolute",
                        left: dims.bx,
                        top: dims.by,
                        width: dims.bw,
                        height: dims.bh,
                        pointerEvents: "none",
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${vignette}) 100%)`,
                    }}
                />
            )}
            {grain > 0 && (
                <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: grain * 0.6 }}>
                    <rect width="100%" height="100%" filter={`url(#${uid}-grain)`} />
                </svg>
            )}
        </div>
    )
}

addPropertyControls(Effect3DPageFlipBook, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        description: "Colour behind the book.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        description: "How fast pages turn and the book plays. 50 is the shipped rate, 0 stops autoplay.",
    },
    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Turn pages by themselves. Off, pages turn only by click or drag.",
    },
    pause: {
        type: ControlType.Number,
        title: "Pause",
        min: 2,
        max: 40,
        step: 1,
        defaultValue: 7,
        hidden: (p: any) => p.autoplay === false,
        description: "Rest between page turns, in tenths of a second.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 200,
        max: 1200,
        step: 1,
        unit: "px",
        defaultValue: 600,
        description: "Height of the book. It never grows past the frame.",
    },
    rounded: {
        type: ControlType.Number,
        title: "Rounded",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 15,
        description: "Roundness of the pages' outer corners.",
    },
    perspective: {
        type: ControlType.Number,
        title: "Perspective",
        min: 100,
        max: 1000,
        step: 1,
        unit: "%",
        defaultValue: 500,
        description: "Camera distance as a % of the page height. Lower makes turning pages swing out more.",
    },
    showArrows: {
        type: ControlType.Boolean,
        title: "Arrows",
        defaultValue: true,
        description: "Show the chalk arrows at the sides.",
    },
    images: {
        defaultValue: DEFAULT_SPREADS,
        type: ControlType.Array,
        title: "Images",
        maxCount: 12,
        control: {
            type: ControlType.Object,
            controls: {
                image: {
                    type: ControlType.ResponsiveImage, title: "Image" },
                fit: {
                    type: ControlType.Enum,
                    title: "Fit",
                    options: ["cover", "contain"],
                    optionTitles: ["Cover", "Contain"],
                    displaySegmentedControl: true,
                    defaultValue: "cover",
                },
                x: {
                    type: ControlType.Number,
                    title: "Offset X",
                    min: 0,
                    max: 100,
                    step: 1,
                    unit: "%",
                    defaultValue: 50,
                    hidden: (p: any) => p?.fit === "contain",
                    description: "Which part of the picture shows across: 0 is its left edge, 100 its right.",
                },
                y: {
                    type: ControlType.Number,
                    title: "Offset Y",
                    min: 0,
                    max: 100,
                    step: 1,
                    unit: "%",
                    defaultValue: 50,
                    hidden: (p: any) => p?.fit === "contain",
                    description: "Which part of the picture shows down: 0 is its top edge, 100 its bottom.",
                },
            },
        },
        description: "Your own double-page spreads, one picture per spread. Each picks Cover (fills the spread, crops; Offset X/Y choose the part shown) or Contain (whole picture, Page Fill around it). Leave empty for the built-in book.",
    },
    image: {
        defaultValue: DEFAULT_IMAGE,
        type: ControlType.ResponsiveImage,
        title: "Cover Image",
        description: "Picture on the front cover of the closed book. Leave empty for the chalkboard cover.",
    },
    coverFit: {
        type: ControlType.Enum,
        title: "Cover Fit",
        options: ["cover", "contain"],
        optionTitles: ["Cover", "Contain"],
        displaySegmentedControl: true,
        defaultValue: "cover",
        hidden: (p: any) => !p.image,
        description: "Cover fills the whole cover and crops the picture. Contain shows the whole picture with Page Fill around it.",
    },
    coverX: {
        type: ControlType.Number,
        title: "Offset X",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 50,
        hidden: (p: any) => !p.image || p.coverFit === "contain",
        description: "Which part of the picture shows across: 0 is its left edge, 100 its right.",
    },
    coverY: {
        type: ControlType.Number,
        title: "Offset Y",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: 44,
        hidden: (p: any) => !p.image || p.coverFit === "contain",
        description: "Which part of the picture shows down: 0 is its top edge, 100 its bottom.",
    },
    hover: { type: ControlType.Number, title: "Hover", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "How strongly pages and arrows answer the pointer. 0 is off." },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values.",
        controls: {
            turnMs: { type: ControlType.Number, title: "Turn", min: 100, max: 3000, step: 10, unit: "ms", defaultValue: 480, description: "Length of one page turn." },
            startRestMs: { type: ControlType.Number, title: "First Rest", min: 0, max: 5000, step: 10, unit: "ms", defaultValue: 670, description: "Wait before the first turn." },
            coverRestMs: { type: ControlType.Number, title: "Cover Rest", min: 0, max: 10000, step: 10, unit: "ms", defaultValue: 2400, description: "How long the closed cover rests." },
            holdMs: { type: ControlType.Number, title: "Click Hold", min: 0, max: 20000, step: 100, unit: "ms", defaultValue: 4000, description: "Autoplay pause after a click." },
            easeX1: { type: ControlType.Number, title: "Ease X1", min: 0, max: 100, step: 1, defaultValue: 30, description: "Turn easing, first handle x." },
            easeY1: { type: ControlType.Number, title: "Ease Y1", min: -50, max: 150, step: 1, defaultValue: 70, description: "Turn easing, first handle y." },
            easeX2: { type: ControlType.Number, title: "Ease X2", min: 0, max: 100, step: 1, defaultValue: 30, description: "Turn easing, second handle x." },
            easeY2: { type: ControlType.Number, title: "Ease Y2", min: -50, max: 150, step: 1, defaultValue: 100, description: "Turn easing, second handle y." },
            pageAspect: { type: ControlType.Number, title: "Page Aspect", min: 40, max: 140, step: 1, unit: "%", defaultValue: 86, description: "Page width as a % of its height." },
            maxWidth: { type: ControlType.Number, title: "Max Width", min: 20, max: 100, step: 1, unit: "%", defaultValue: 64, description: "Widest the open spread may be, % of the visible frame." },
            maxHeight: { type: ControlType.Number, title: "Max Height", min: 20, max: 100, step: 1, unit: "%", defaultValue: 82, description: "Tallest the book may be, % of the visible frame." },
            offsetY: { type: ControlType.Number, title: "Offset Y", min: -30, max: 30, step: 1, unit: "%", defaultValue: 0, description: "Moves the book up or down." },
            shade: { type: ControlType.Number, title: "Turn Shade", min: 0, max: 100, step: 1, unit: "%", defaultValue: 25, description: "Darkening of a leaf as it stands upright." },
            spineShade: { type: ControlType.Number, title: "Spine Shade", min: 0, max: 100, step: 1, unit: "%", defaultValue: 18, description: "Shadow at the spine." },
            liftDeg: { type: ControlType.Number, title: "Hover Lift", min: 0, max: 45, step: 1, unit: "°", defaultValue: 12, description: "How far a hovered page lifts." },
            arrowColor: { type: ControlType.Color, title: "Arrow Colour", defaultValue: "#EDEDED", description: "Chalk arrow colour." },
            arrowOpacity: { type: ControlType.Number, title: "Arrow Opacity", min: 0, max: 100, step: 1, unit: "%", defaultValue: 88, description: "Opacity of an active arrow." },
            arrowDim: { type: ControlType.Number, title: "Arrow Dim", min: 0, max: 100, step: 1, unit: "%", defaultValue: 45, description: "Opacity of an arrow with nowhere to go." },
            arrowWeight: { type: ControlType.Number, title: "Arrow Weight", min: 1, max: 10, step: 1, unit: "px", defaultValue: 2, description: "Arrow line width at 1200 px wide." },
            arrowSize: { type: ControlType.Number, title: "Arrow Size", min: 5, max: 200, step: 1, unit: "‰", defaultValue: 45, description: "Arrow length in thousandths of the width." },
            arrowInset: { type: ControlType.Number, title: "Arrow Inset", min: 0, max: 300, step: 1, unit: "‰", defaultValue: 30, description: "Arrow distance from the edge, thousandths of the width." },
            pageFill: { type: ControlType.Color, title: "Page Fill", defaultValue: "#121214", description: "Behind uploaded pictures." },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 15, description: "Edge darkening." },
        },
    },
})
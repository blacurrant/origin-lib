import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from "framer-motion"

/**
 * LiqToggle: a liquid toggle switch. The thumb is a drop of liquid: while it
 * moves, a lagging second blob is melted into it with an SVG goo filter so it
 * stretches into the track, squashes on press and settles with a spring. The
 * track fills with the accent behind it. It is a real `role="switch"` button,
 * so Space and Enter toggle it from the keyboard.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 220
 * @framerIntrinsicHeight 42
 */

type Theme = "dark" | "light"
type Size = "sm" | "md" | "lg"

interface LiqToggleProps {
    checked: boolean
    size: Size
    label: string
    disabled: boolean
    accent: string
    theme: Theme
    sound: boolean
    soundVolume: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { off: "#cfcbc2", text: "#141413", faint: "#76736d", thumb: "#ffffff" }
        : { off: "#38393b", text: "#f7f7f7", faint: "#8a8c8f", thumb: "#ffffff" }
}

const SIZES: Record<Size, { w: number; h: number; font: number }> = {
    sm: { w: 46, h: 26, font: 13 },
    md: { w: 62, h: 34, font: 15 },
    lg: { w: 82, h: 44, font: 17 },
}
const PAD = 4

/* ---- Sound ---------------------------------------------------------------
 * Tiny synthesized cues, no files and no network. Silent unless the `sound`
 * prop is on, and only ever played from a real user action (pointer or key),
 * never from autoplay, timers or demo cursors. One shared AudioContext lives
 * on window so many components do not each open their own. */
type Cue = "tick" | "click" | "pop" | "on" | "off" | "whoosh" | "drop" | "success" | "error" | "type"
const cueAt: Record<string, number> = {}

function playCue(cue: Cue, volume = 0.5, minGap = 45, pitch = 1) {
    if (typeof window === "undefined" || volume <= 0) return
    const stamp = Date.now()
    if (stamp - (cueAt[cue] || 0) < minGap) return
    cueAt[cue] = stamp
    try {
        const w = window as any
        const AC = w.AudioContext || w.webkitAudioContext
        if (!AC) return
        const ctx: AudioContext = (w.__okAudio = w.__okAudio || new AC())
        if (ctx.state === "suspended") ctx.resume()
        const t0 = ctx.currentTime
        const out = ctx.createGain()
        out.gain.value = Math.min(1, volume) * 0.4
        out.connect(ctx.destination)
        const tone = (type: OscillatorType, f0: number, f1: number, dur: number, gain = 1, delay = 0) => {
            const o = ctx.createOscillator()
            const g = ctx.createGain()
            const s = t0 + delay
            o.type = type
            o.frequency.setValueAtTime(f0 * pitch, s)
            o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), s + dur)
            g.gain.setValueAtTime(0.0001, s)
            g.gain.exponentialRampToValueAtTime(gain, s + 0.006)
            g.gain.exponentialRampToValueAtTime(0.0001, s + dur)
            o.connect(g)
            g.connect(out)
            o.start(s)
            o.stop(s + dur + 0.02)
        }
        const noise = (dur: number, f0: number, f1: number, gain = 1, delay = 0) => {
            const n = Math.max(1, Math.floor(ctx.sampleRate * dur))
            const buf = ctx.createBuffer(1, n, ctx.sampleRate)
            const d = buf.getChannelData(0)
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
            const src = ctx.createBufferSource()
            const f = ctx.createBiquadFilter()
            const g = ctx.createGain()
            const s = t0 + delay
            src.buffer = buf
            f.type = "bandpass"
            f.Q.value = 0.9
            f.frequency.setValueAtTime(f0 * pitch, s)
            f.frequency.exponentialRampToValueAtTime(Math.max(40, f1 * pitch), s + dur)
            g.gain.setValueAtTime(0.0001, s)
            g.gain.exponentialRampToValueAtTime(gain, s + 0.01)
            g.gain.exponentialRampToValueAtTime(0.0001, s + dur)
            src.connect(f)
            f.connect(g)
            g.connect(out)
            src.start(s)
        }
        if (cue === "tick") tone("triangle", 2300, 1900, 0.035, 0.55)
        else if (cue === "click") {
            noise(0.025, 3200, 2400, 0.7)
            tone("sine", 190, 120, 0.04, 0.5)
        } else if (cue === "pop") tone("sine", 540, 190, 0.12, 0.9)
        else if (cue === "on") {
            tone("sine", 520, 520, 0.09, 0.6)
            tone("sine", 780, 780, 0.12, 0.6, 0.07)
        } else if (cue === "off") {
            tone("sine", 650, 650, 0.09, 0.5)
            tone("sine", 420, 420, 0.12, 0.5, 0.07)
        } else if (cue === "whoosh") noise(0.24, 500, 2600, 0.8)
        else if (cue === "drop") {
            tone("sine", 170, 55, 0.16, 0.95)
            noise(0.05, 900, 400, 0.4)
        } else if (cue === "success") {
            tone("triangle", 523, 523, 0.11, 0.55)
            tone("triangle", 659, 659, 0.11, 0.55, 0.075)
            tone("triangle", 784, 784, 0.18, 0.6, 0.15)
        } else if (cue === "error") {
            tone("square", 160, 120, 0.13, 0.35)
            tone("square", 150, 110, 0.15, 0.35, 0.16)
        } else if (cue === "type") {
            noise(0.014, 3800, 3000, 0.55)
            tone("square", 1500 + Math.random() * 300, 1100, 0.02, 0.18)
        }
    } catch {
        /* audio blocked or unsupported: stay silent */
    }
}
/* ---- end Sound ---------------------------------------------------------- */

export default function LiqToggle({
    checked = true,
    size = "md",
    label = "Notifications",
    disabled = false,
    accent = "#fa7319",
    theme = "dark",
    sound = false,
    soundVolume = 0.5,
}: Partial<LiqToggleProps>) {
    const p = palette(theme)
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const reduce = useReducedMotion()
    const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "")
    const filterId = `liq-${uid}`
    const s = SIZES[size] ?? SIZES.md
    const d = s.h - PAD * 2
    const xOff = PAD
    const xOn = s.w - PAD - d

    const [on, setOn] = React.useState(checked)
    const [focusVisible, setFocusVisible] = React.useState(false)
    React.useEffect(() => setOn(checked), [checked])

    const target = on ? xOn : xOff
    const head = useSpring(target, { stiffness: 380, damping: 26, mass: 0.9 })
    const tail = useSpring(target, { stiffness: 90, damping: 12, mass: 1 })
    const press = useSpring(0, { stiffness: 500, damping: 28 })
    const first = React.useRef(true)

    React.useEffect(() => {
        if (first.current || reduce) {
            head.jump(target)
            tail.jump(target)
            first.current = false
            return
        }
        head.set(target)
        tail.set(target)
    }, [target, reduce, head, tail])

    // Squash and stretch from the head's velocity, plus a widening grip while pressed.
    const vel = useVelocity(head)
    const stretch = useTransform(vel, (v) => Math.min(Math.abs(v) / 2000, 0.45))
    const headScaleX = useTransform([stretch, press] as any, ([st, pr]: number[]) => 1 + st + pr * 0.16)
    const headScaleY = useTransform([stretch, press] as any, ([st, pr]: number[]) => 1 - st * 0.45 - pr * 0.06)
    const tailScale = useTransform(vel, (v) => 0.86 - Math.min(Math.abs(v) / 5000, 0.2))

    // The accent fill chases the head: its right cap travels with the drop.
    const fillX = useTransform(head, (x) => {
        const prog = Math.min(1, Math.max(0, (x - xOff) / (xOn - xOff || 1)))
        return prog * s.w - s.w
    })

    const blur = d * 0.24

    return (
        <MotionConfig reducedMotion="user">
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label ? undefined : "Toggle"}
                disabled={disabled}
                onClick={() => {
                    cue(on ? "off" : "on", 60)
                    setOn((v) => !v)
                }}
                onPointerDown={() => press.set(1)}
                onPointerUp={() => press.set(0)}
                onPointerLeave={() => press.set(0)}
                onPointerCancel={() => press.set(0)}
                onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                onBlur={() => setFocusVisible(false)}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 0,
                    background: "none",
                    borderWidth: 0,
                    borderStyle: "none",
                    color: p.text,
                    fontFamily: "inherit",
                    fontSize: s.font,
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                    textAlign: "left",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.45 : 1,
                    borderRadius: 999,
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: 4,
                    touchAction: "manipulation",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTapHighlightColor: "transparent",
                }}
            >
                <span style={{ position: "relative", display: "inline-block", width: s.w, height: s.h, flexShrink: 0 }}>
                    {/* accent glow behind the track */}
                    <motion.span
                        aria-hidden
                        initial={false}
                        animate={{ opacity: on ? 0.38 : 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            position: "absolute",
                            inset: 2,
                            borderRadius: 999,
                            background: accent,
                            filter: "blur(9px)",
                            pointerEvents: "none",
                        }}
                    />
                    <span
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 999,
                            overflow: "hidden",
                            background: p.off,
                            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.28)",
                        }}
                    >
                        <motion.span
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                width: s.w,
                                height: s.h,
                                borderRadius: 999,
                                background: accent,
                                x: fillX,
                            }}
                        />
                        <span style={{ position: "absolute", inset: 0, filter: `url(#${filterId})` }}>
                            <motion.span
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: (s.h - d * 0.9) / 2,
                                    width: d * 0.9,
                                    height: d * 0.9,
                                    marginLeft: d * 0.05,
                                    borderRadius: "50%",
                                    background: p.thumb,
                                    x: tail,
                                    scale: tailScale,
                                }}
                            />
                            <motion.span
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: PAD,
                                    width: d,
                                    height: d,
                                    borderRadius: "50%",
                                    background: p.thumb,
                                    x: head,
                                    scaleX: headScaleX,
                                    scaleY: headScaleY,
                                }}
                            />
                        </span>
                    </span>
                    <svg aria-hidden width={0} height={0} style={{ position: "absolute", pointerEvents: "none" }}>
                        <defs>
                            <filter id={filterId} x="-15%" y="-40%" width="130%" height="180%" colorInterpolationFilters="sRGB">
                                <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
                                <feColorMatrix
                                    in="blur"
                                    mode="matrix"
                                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
                                    result="goo"
                                />
                                <feDropShadow in="goo" dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.3" />
                            </filter>
                        </defs>
                    </svg>
                </span>
                {label ? <span>{label}</span> : null}
            </button>
        </MotionConfig>
    )
}

addPropertyControls(LiqToggle, {
    checked: { type: ControlType.Boolean, title: "On", defaultValue: true },
    size: {
        type: ControlType.Enum,
        title: "Size",
        options: ["sm", "md", "lg"],
        optionTitles: ["Small", "Medium", "Large"],
        defaultValue: "md",
    },
    label: { type: ControlType.String, title: "Label", defaultValue: "Notifications" },
    disabled: { type: ControlType.Boolean, title: "Disabled", defaultValue: false },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

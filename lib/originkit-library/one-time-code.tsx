import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion"

/**
 * OneTimeCode: an N-digit code input. It auto-advances, spreads pasted digits
 * across the boxes, steps back on backspace and moves with the arrow keys.
 * This is a demo of the whole flow: once every box is filled it compares the
 * code with `correctCode` and shows a success state (check, accent to green)
 * or a shake and error state, then lets you reset. Nothing is sent anywhere.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 120
 */

type Theme = "dark" | "light"
type Status = "idle" | "checking" | "success" | "error"

interface OneTimeCodeProps {
    length: number
    groupSize: number
    correctCode: string
    autoFocus: boolean
    showHint: boolean
    accent: string
    theme: Theme
    radius: number
    sound: boolean
    soundVolume: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? {
              surface: "#ffffff",
              line: "#d4d0c7",
              lineHover: "#b9b5ab",
              text: "#141413",
              soft: "#5c5a55",
              faint: "#76736d",
              danger: "#c42a1d",
              success: "#12794a",
          }
        : {
              surface: "#161617",
              line: "#303132",
              lineHover: "#464849",
              text: "#f7f7f7",
              soft: "#b7b7b8",
              faint: "#8a8c8f",
              danger: "#ff7a70",
              success: "#3dd68c",
          }
}

const BOX_SPRING = { type: "spring" as const, stiffness: 620, damping: 22 }

function emptyDigits(n: number) {
    return Array.from({ length: n }, () => "")
}

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

export default function OneTimeCode({
    length = 6,
    groupSize = 3,
    correctCode = "123456",
    autoFocus = false,
    showHint = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
    sound = false,
    soundVolume = 0.5,
}: Partial<OneTimeCodeProps>) {
    const p = palette(theme)
    const reduce = useReducedMotion()
    const sfx = React.useRef({ sound, soundVolume })
    sfx.current = { sound, soundVolume }
    const cue = React.useCallback((c: Cue, gap?: number, pitch?: number) => {
        if (sfx.current.sound) playCue(c, sfx.current.soundVolume, gap, pitch)
    }, [])
    const uid = React.useId()
    const n = Math.max(2, Math.min(10, Math.round(length)))
    const group = Math.round(groupSize) > 0 && Math.round(groupSize) < n ? Math.round(groupSize) : 0

    const [digits, setDigits] = React.useState<string[]>(() => emptyDigits(n))
    const [status, setStatus] = React.useState<Status>("idle")
    const [active, setActive] = React.useState<number | null>(null)
    const [hover, setHover] = React.useState<number | null>(null)
    const [shake, setShake] = React.useState(0)
    const [resetFocus, setResetFocus] = React.useState(false)
    const refs = React.useRef<Array<HTMLInputElement | null>>([])

    // Resize when `length` changes.
    React.useEffect(() => {
        setDigits(emptyDigits(n))
        setStatus("idle")
    }, [n])

    React.useEffect(() => {
        if (autoFocus) refs.current[0]?.focus()
    }, [autoFocus])

    const code = digits.join("")
    const complete = digits.every((d) => d !== "")

    // Once complete, "verify" after a short beat. Editing cancels the timer.
    React.useEffect(() => {
        if (!complete || status !== "idle") return
        setStatus("checking")
    }, [complete, status])

    React.useEffect(() => {
        if (status !== "checking") return
        const t = setTimeout(() => {
            if (code === correctCode) {
                setStatus("success")
                cue("success", 0)
            } else {
                cue("error", 0)
                setStatus("error")
                setShake((s) => s + 1)
            }
        }, 700)
        return () => clearTimeout(t)
    }, [status, code, correctCode, cue])

    const focusBox = (i: number) => {
        const idx = Math.max(0, Math.min(n - 1, i))
        const el = refs.current[idx]
        if (el) {
            el.focus()
            el.select()
        }
    }

    const commit = (next: string[], focusAt: number) => {
        setDigits(next)
        if (status === "error" || status === "checking") setStatus("idle")
        focusBox(focusAt)
    }

    // Writes `chars` into the boxes starting at `start`; returns the new array and where focus goes.
    const distribute = (start: number, chars: string) => {
        const next = digits.slice()
        let i = start
        for (const c of chars) {
            if (i >= n) break
            next[i] = c
            i += 1
        }
        return { next, focusAt: Math.min(n - 1, i) }
    }

    const reset = () => {
        cue("click", 60)
        setDigits(emptyDigits(n))
        setStatus("idle")
        setResetFocus(true)
    }
    React.useEffect(() => {
        if (resetFocus) {
            setResetFocus(false)
            focusBox(0)
        }
    })

    const locked = status === "success"
    const firstEmpty = digits.findIndex((d) => d === "")
    const tabStop = firstEmpty === -1 ? n - 1 : firstEmpty

    const onKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        if (locked) {
            if (e.key !== "Tab") e.preventDefault()
            return
        }
        if (/^\d$/.test(e.key)) {
            e.preventDefault()
            cue("type", 30)
            const { next, focusAt } = distribute(i, e.key)
            commit(next, focusAt)
        } else if (e.key === "Backspace") {
            e.preventDefault()
            if (digits[i] || i > 0) cue("tick", 30)
            if (digits[i]) {
                const next = digits.slice()
                next[i] = ""
                commit(next, i)
            } else if (i > 0) {
                const next = digits.slice()
                next[i - 1] = ""
                commit(next, i - 1)
            }
        } else if (e.key === "Delete") {
            e.preventDefault()
            if (digits[i]) cue("tick", 30)
            const next = digits.slice()
            next[i] = ""
            commit(next, i)
        } else if (e.key === "ArrowLeft") {
            e.preventDefault()
            focusBox(i - 1)
        } else if (e.key === "ArrowRight") {
            e.preventDefault()
            focusBox(i + 1)
        } else if (e.key === "Home") {
            e.preventDefault()
            focusBox(0)
        } else if (e.key === "End") {
            e.preventDefault()
            focusBox(n - 1)
        } else if (e.key.length === 1) {
            e.preventDefault() // ignore letters and symbols
        }
    }

    const onPaste = (i: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault()
        if (locked) return
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "")
        if (!pasted) return
        cue("type", 30)
        const { next, focusAt } = distribute(pasted.length >= n ? 0 : i, pasted.slice(0, n))
        commit(next, focusAt)
    }

    // Fallback for input methods that bypass keydown (mobile keyboards, SMS autofill).
    const onChange = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (locked) return
        let typed = e.target.value.replace(/\D/g, "")
        cue(typed ? "type" : "tick", 30)
        const prev = digits[i]
        if (typed.length > 1 && prev) {
            if (typed.startsWith(prev)) typed = typed.slice(1)
            else if (typed.endsWith(prev)) typed = typed.slice(0, -1)
        }
        if (!typed) {
            const next = digits.slice()
            next[i] = ""
            commit(next, i)
            return
        }
        const { next, focusAt } = distribute(typed.length >= n ? 0 : i, typed.slice(0, n))
        commit(next, focusAt)
    }

    const toneFor = (i: number) => {
        if (status === "success") return p.success
        if (status === "error") return p.danger
        if (active === i) return accent
        return null
    }

    const cells: React.ReactNode[] = []
    for (let i = 0; i < n; i++) {
        if (group && i > 0 && i % group === 0) {
            cells.push(
                <span
                    key={`div-${i}`}
                    aria-hidden
                    style={{ flex: "0 0 auto", width: 10, height: 2, borderRadius: 2, background: p.line, alignSelf: "center" }}
                />
            )
        }
        const tone = toneFor(i)
        const isActive = active === i && !locked
        const filled = digits[i] !== ""
        const border = tone ?? (hover === i ? p.lineHover : p.line)
        const showGlow = !!tone && (status === "success" || status === "error" || isActive)
        const tint = status === "success" ? p.success : status === "error" ? p.danger : "transparent"
        cells.push(
            <motion.div
                key={`cell-${i}`}
                initial={false}
                animate={{
                    borderColor: border,
                    y: status === "checking" && !reduce ? [0, -4, 0] : 0,
                    scale: status === "success" ? [1, 1.1, 1] : 1,
                }}
                transition={{
                    default: { duration: 0.16 },
                    y:
                        status === "checking" && !reduce
                            ? { duration: 0.7, delay: i * 0.06, repeat: Infinity, repeatDelay: 0.1, ease: "easeInOut" }
                            : { type: "spring", stiffness: 500, damping: 30 },
                    scale: status === "success" ? { duration: 0.45, delay: i * 0.05, ease: "easeOut" } : { duration: 0.16 },
                }}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover((h) => (h === i ? null : h))}
                style={{
                    position: "relative",
                    flex: "1 1 0",
                    minWidth: 0,
                    maxWidth: 52,
                    height: 58,
                    boxSizing: "border-box",
                    borderRadius: radius,
                    borderWidth: 1.5,
                    borderStyle: "solid",
                    borderColor: p.line,
                    background: p.surface,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <motion.span
                    aria-hidden
                    initial={false}
                    animate={{ opacity: showGlow ? (isActive ? 0.26 : 0.18) : 0, scale: showGlow ? 1 : 0.96 }}
                    transition={{ duration: 0.16 }}
                    style={{
                        position: "absolute",
                        inset: -4.5,
                        borderRadius: radius + 3,
                        borderWidth: 3,
                        borderStyle: "solid",
                        borderColor: tone ?? "transparent",
                        pointerEvents: "none",
                    }}
                />
                <motion.span
                    aria-hidden
                    initial={false}
                    animate={{ opacity: status === "success" ? 0.12 : status === "error" ? 0.1 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ position: "absolute", inset: 0, borderRadius: Math.max(0, radius - 2), background: tint, pointerEvents: "none" }}
                />
                <AnimatePresence initial={false}>
                    {filled ? (
                        <motion.span
                            key={digits[i] + "-" + i}
                            aria-hidden
                            initial={{ scale: 0.3, opacity: 0, y: 8 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.1 } }}
                            transition={BOX_SPRING}
                            style={{
                                position: "absolute",
                                fontSize: 24,
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                                color: status === "success" ? p.success : status === "error" ? p.danger : p.text,
                                transition: "color 160ms",
                                pointerEvents: "none",
                            }}
                        >
                            {digits[i]}
                        </motion.span>
                    ) : null}
                </AnimatePresence>
                {isActive && !filled ? (
                    <motion.span
                        aria-hidden
                        initial={{ opacity: 1 }}
                        animate={reduce ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
                        transition={reduce ? undefined : { duration: 1.05, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                        style={{ position: "absolute", width: 2, height: 26, borderRadius: 2, background: accent, pointerEvents: "none" }}
                    />
                ) : null}
                <input
                    ref={(el) => {
                        refs.current[i] = el
                    }}
                    id={`${uid}-${i}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    aria-label={`Digit ${i + 1} of ${n}`}
                    aria-invalid={status === "error"}
                    readOnly={locked}
                    tabIndex={i === tabStop ? 0 : -1}
                    value={digits[i]}
                    onChange={onChange(i)}
                    onKeyDown={onKeyDown(i)}
                    onPaste={onPaste(i)}
                    onFocus={(e) => {
                        setActive(i)
                        e.currentTarget.select()
                    }}
                    onBlur={() => setActive((a) => (a === i ? null : a))}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        padding: 0,
                        margin: 0,
                        background: "transparent",
                        borderWidth: 0,
                        borderStyle: "none",
                        outline: "none",
                        color: "transparent",
                        caretColor: "transparent",
                        textAlign: "center",
                        fontFamily: "inherit",
                        fontSize: 24,
                        cursor: locked ? "default" : "text",
                    }}
                />
            </motion.div>
        )
    }

    return (
        <MotionConfig reducedMotion="user">
            <div style={{ width: "100%", maxWidth: 380, fontFamily: "inherit", color: p.text }}>
                <motion.div
                    role="group"
                    aria-label={`${n} digit verification code`}
                    animate={{ x: status === "error" && shake > 0 ? [0, -10, 9, -7, 5, -2, 0] : 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    {cells}
                </motion.div>
                <div
                    role="status"
                    aria-live="polite"
                    style={{ position: "relative", minHeight: 34, marginTop: 14, fontSize: 13, lineHeight: "18px" }}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={status}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                            transition={{ type: "spring", stiffness: 500, damping: 34 }}
                            style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 30 }}
                        >
                            {status === "success" || status === "error" ? (
                                <>
                                    <span
                                        aria-hidden
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: 20,
                                            height: 20,
                                            borderRadius: "50%",
                                            background: status === "success" ? p.success : p.danger,
                                            flexShrink: 0,
                                        }}
                                    >
                                        <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                                            <motion.path
                                                d={status === "success" ? "M2.5 6.3l2.4 2.4 4.6-5" : "M3 3l6 6M9 3l-6 6"}
                                                stroke={theme === "light" ? "#ffffff" : "#0c0c0d"}
                                                strokeWidth={1.8}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
                                            />
                                        </svg>
                                    </span>
                                    <span style={{ color: status === "success" ? p.success : p.danger, fontWeight: 500 }}>
                                        {status === "success" ? "Code verified" : "That code is not right"}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={reset}
                                        style={{
                                            marginLeft: "auto",
                                            height: 28,
                                            padding: "0 12px",
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            borderStyle: "solid",
                                            borderColor: p.line,
                                            background: "transparent",
                                            color: p.soft,
                                            fontFamily: "inherit",
                                            fontSize: 12,
                                            fontWeight: 500,
                                            cursor: "pointer",
                                        }}
                                        onFocus={(e) => {
                                            if (e.currentTarget.matches(":focus-visible")) e.currentTarget.style.outline = `2px solid ${accent}`
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.outline = "none"
                                        }}
                                    >
                                        {status === "success" ? "Reset" : "Try again"}
                                    </button>
                                </>
                            ) : status === "checking" ? (
                                <span style={{ color: accent, fontWeight: 500 }}>Verifying</span>
                            ) : (
                                <span style={{ color: p.faint }}>
                                    {showHint ? `Enter the ${n} digit code. Demo code: ${correctCode}` : `Enter the ${n} digit code`}
                                </span>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(OneTimeCode, {
    length: { type: ControlType.Number, title: "Digits", defaultValue: 6, min: 3, max: 8, step: 1 },
    groupSize: { type: ControlType.Number, title: "Group size", defaultValue: 3, min: 0, max: 6, step: 1 },
    correctCode: { type: ControlType.String, title: "Correct code", defaultValue: "123456" },
    autoFocus: { type: ControlType.Boolean, title: "Auto focus", defaultValue: false },
    showHint: { type: ControlType.Boolean, title: "Show demo hint", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 26 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

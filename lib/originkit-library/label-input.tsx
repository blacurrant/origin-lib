import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * LabelInput: a text field whose label starts inside the field as the
 * placeholder, then floats up and shrinks with a spring on focus or once the
 * field has a value. Helper text, an error state, an optional leading hint,
 * and a show and hide toggle for passwords.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 96
 */

type Theme = "dark" | "light"
type InputType = "text" | "email" | "password"

interface LabelInputProps {
    label: string
    value: string
    type: InputType
    hint: string
    helper: string
    error: string
    validate: boolean
    disabled: boolean
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
          }
        : {
              surface: "#161617",
              line: "#303132",
              lineHover: "#464849",
              text: "#f7f7f7",
              soft: "#b7b7b8",
              faint: "#8a8c8f",
              danger: "#ff7a70",
          }
}

const FIELD_H = 58
const SPRING = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.8 }

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

export default function LabelInput({
    label = "Email address",
    value = "",
    type = "email",
    hint = "",
    helper = "We will only use it to send your receipt.",
    error = "",
    validate = true,
    disabled = false,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
    sound = false,
    soundVolume = 0.5,
}: Partial<LabelInputProps>) {
    const p = palette(theme)
    const cue = (c: Cue, gap?: number, pitch?: number) => {
        if (sound) playCue(c, soundVolume, gap, pitch)
    }
    const uid = React.useId()
    const inputId = `${uid}-input`
    const noteId = `${uid}-note`

    const [text, setText] = React.useState(value)
    const [focused, setFocused] = React.useState(false)
    const [hover, setHover] = React.useState(false)
    const [touched, setTouched] = React.useState(false)
    const [reveal, setReveal] = React.useState(false)
    const [toggleFocus, setToggleFocus] = React.useState(false)
    React.useEffect(() => setText(value), [value])

    const isPassword = type === "password"
    const floated = focused || text !== ""

    let message = error
    if (!message && validate && touched && text !== "" && type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        message = "Enter a valid email address."
    }
    const invalid = message !== ""
    const note = invalid ? message : helper
    const ringColor = invalid ? p.danger : accent
    const borderColor = invalid ? p.danger : focused ? accent : hover && !disabled ? p.lineHover : p.line
    const labelColor = invalid ? p.danger : focused ? accent : p.faint

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    maxWidth: 360,
                    fontFamily: "inherit",
                    opacity: disabled ? 0.5 : 1,
                }}
            >
                <motion.div
                    initial={false}
                    animate={{
                        borderColor,
                    }}
                    transition={{ duration: 0.16 }}
                    onPointerEnter={() => setHover(true)}
                    onPointerLeave={() => setHover(false)}
                    style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "flex-end",
                        height: FIELD_H,
                        boxSizing: "border-box",
                        borderRadius: radius,
                        borderWidth: 1.5,
                        borderStyle: "solid",
                        borderColor: p.line,
                        background: p.surface,
                        cursor: disabled ? "not-allowed" : "text",
                    }}
                >
                    <motion.span
                        aria-hidden
                        initial={false}
                        animate={{ opacity: focused || invalid ? (invalid && !focused ? 0.18 : 0.26) : 0, scale: focused || invalid ? 1 : 0.985 }}
                        transition={{ duration: 0.16 }}
                        style={{
                            position: "absolute",
                            inset: -4.5,
                            borderRadius: radius + 3,
                            borderWidth: 3,
                            borderStyle: "solid",
                            borderColor: ringColor,
                            pointerEvents: "none",
                        }}
                    />
                    <motion.label
                        htmlFor={inputId}
                        initial={false}
                        animate={{ y: floated ? -12 : 0, scale: floated ? 0.76 : 1, color: labelColor }}
                        transition={{ ...SPRING, color: { duration: 0.16 } }}
                        style={{
                            position: "absolute",
                            left: 14,
                            top: 0,
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            fontSize: 16,
                            fontWeight: 500,
                            lineHeight: 1,
                            whiteSpace: "nowrap",
                            transformOrigin: "0% 50%",
                            pointerEvents: "none",
                            userSelect: "none",
                            WebkitUserSelect: "none",
                        }}
                    >
                        {label}
                    </motion.label>
                    {hint ? (
                        <motion.span
                            aria-hidden
                            initial={false}
                            animate={{ opacity: floated ? 1 : 0, x: floated ? 0 : -6 }}
                            transition={{ ...SPRING }}
                            style={{
                                paddingLeft: 14,
                                paddingBottom: 9,
                                fontSize: 15,
                                lineHeight: "22px",
                                color: p.faint,
                                whiteSpace: "nowrap",
                                userSelect: "none",
                                WebkitUserSelect: "none",
                            }}
                        >
                            {hint}
                        </motion.span>
                    ) : null}
                    <input
                        id={inputId}
                        type={isPassword && reveal ? "text" : type}
                        value={text}
                        disabled={disabled}
                        autoComplete={type === "email" ? "email" : type === "password" ? "current-password" : "off"}
                        aria-invalid={invalid}
                        aria-describedby={note ? noteId : undefined}
                        onChange={(e) => {
                            const next = e.target.value
                            const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
                            if (type === "email" && validate && !emailOk(text) && emailOk(next)) cue("on", 200)
                            else cue("type", 30)
                            setText(next)
                        }}
                        onFocus={() => setFocused(true)}
                        onBlur={() => {
                            setFocused(false)
                            setTouched(true)
                        }}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            height: 34,
                            boxSizing: "border-box",
                            padding: hint ? "0 14px 8px 4px" : "0 14px 8px 14px",
                            background: "transparent",
                            borderWidth: 0,
                            borderStyle: "none",
                            outline: "none",
                            color: p.text,
                            caretColor: ringColor,
                            fontFamily: "inherit",
                            fontSize: 16,
                            lineHeight: "22px",
                        }}
                    />
                    {isPassword ? (
                        <button
                            type="button"
                            disabled={disabled}
                            aria-label={reveal ? "Hide password" : "Show password"}
                            aria-pressed={reveal}
                            onClick={() => setReveal((v) => !v)}
                            onFocus={(e) => setToggleFocus(e.currentTarget.matches(":focus-visible"))}
                            onBlur={() => setToggleFocus(false)}
                            style={{
                                alignSelf: "center",
                                marginRight: 8,
                                height: 30,
                                padding: "0 10px",
                                borderWidth: 0,
                                borderStyle: "none",
                                borderRadius: Math.max(6, radius - 4),
                                background: "transparent",
                                color: reveal ? accent : p.soft,
                                fontFamily: "inherit",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                outline: toggleFocus ? `2px solid ${accent}` : "none",
                                outlineOffset: 1,
                                transition: "color 140ms",
                            }}
                        >
                            {reveal ? "Hide" : "Show"}
                        </button>
                    ) : null}
                </motion.div>
                <div style={{ minHeight: 22, padding: "6px 2px 0", fontSize: 13, lineHeight: "16px" }}>
                    <AnimatePresence mode="wait" initial={false}>
                        {note ? (
                            <motion.div
                                key={invalid ? "error" : "helper"}
                                id={noteId}
                                role={invalid ? "alert" : undefined}
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
                                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                                style={{ color: invalid ? p.danger : p.faint }}
                            >
                                {note}
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(LabelInput, {
    label: { type: ControlType.String, title: "Label", defaultValue: "Email address" },
    value: { type: ControlType.String, title: "Value", defaultValue: "" },
    type: {
        type: ControlType.Enum,
        title: "Type",
        options: ["text", "email", "password"],
        optionTitles: ["Text", "Email", "Password"],
        defaultValue: "email",
    },
    hint: { type: ControlType.String, title: "Leading hint", defaultValue: "" },
    helper: { type: ControlType.String, title: "Helper", defaultValue: "We will only use it to send your receipt." },
    error: { type: ControlType.String, title: "Error", defaultValue: "" },
    validate: { type: ControlType.Boolean, title: "Validate email", defaultValue: true },
    disabled: { type: ControlType.Boolean, title: "Disabled", defaultValue: false },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 29 },
    sound: { type: ControlType.Boolean, title: "Sound", defaultValue: false },
    soundVolume: { type: ControlType.Number, title: "Sound volume", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
})

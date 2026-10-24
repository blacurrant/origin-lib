import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * PromptComposer: a prompt box that grows with its content up to `maxRows`.
 * Enter sends, Shift+Enter adds a line, and Enter during IME composition is
 * left alone. While `isRunning` is on, the send button becomes a stop button.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 108
 */

type Theme = "dark" | "light"

interface PromptComposerProps {
    placeholder: string
    isRunning: boolean
    maxRows: number
    accent: string
    theme: Theme
    onSend?: () => void
    onStop?: () => void
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", raised: "#ece9e3", strong: "#c9c5bc", text: "#141413", soft: "#5c5a55", faint: "#76736d" }
        : { surface: "#1b1c1d", raised: "#2d2f30", strong: "#3e3f40", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f" }
}

const LINE_HEIGHT = 22

export default function PromptComposer({
    placeholder = "Ask about your data…",
    isRunning = false,
    maxRows = 6,
    accent = "#fa7319",
    theme = "dark",
    onSend,
    onStop,
}: Partial<PromptComposerProps>) {
    const p = palette(theme)
    const ref = React.useRef<HTMLTextAreaElement | null>(null)
    const [value, setValue] = React.useState("")
    const [focused, setFocused] = React.useState(false)
    const canSend = value.trim().length > 0 && !isRunning

    React.useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        el.style.height = "auto"
        el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT * Math.max(maxRows, 1))}px`
    }, [value, maxRows])

    const send = () => {
        if (!canSend) return
        onSend?.()
        setValue("")
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            send()
        }
    }

    return (
        <MotionConfig reducedMotion="user">
            <motion.div
                animate={{
                    borderColor: focused ? accent : p.strong,
                    boxShadow: focused
                        ? `0 0 0 3px color-mix(in srgb, ${accent} 24%, transparent)`
                        : "0 0 0 0px rgba(0,0,0,0)",
                }}
                transition={{ duration: 0.12 }}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    width: "100%",
                    padding: "10px 10px 10px 14px",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderStyle: "solid",
                    background: p.surface,
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                }}
            >
                <textarea
                    ref={ref}
                    value={value}
                    rows={1}
                    placeholder={placeholder}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    aria-label="Message"
                    style={{
                        width: "100%",
                        resize: "none",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: p.text,
                        fontSize: 15,
                        lineHeight: `${LINE_HEIGHT}px`,
                        fontFamily: "inherit",
                        padding: "4px 0",
                        overflowY: "auto",
                    }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: p.faint }}>Enter to send · Shift + Enter for a new line</span>
                    <motion.button
                        type="button"
                        onClick={isRunning ? onStop : send}
                        disabled={!isRunning && !canSend}
                        aria-label={isRunning ? "Stop generating" : "Send message"}
                        whileTap={{ scale: 0.94 }}
                        animate={{
                            backgroundColor: isRunning ? p.text : canSend ? accent : p.raised,
                        }}
                        transition={{ duration: 0.14 }}
                        style={{
                            color: isRunning ? (theme === "light" ? "#ffffff" : "#141413") : canSend ? "#141413" : `color-mix(in srgb, ${accent} 60%, ${p.faint})`,
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            border: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            cursor: !isRunning && !canSend ? "not-allowed" : "pointer",
                        }}
                    >
                        {isRunning ? (
                            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                                <rect width="11" height="11" rx="2" fill="currentColor" />
                            </svg>
                        ) : (
                            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
                                <path d="M8 13V3.2M3.8 7.2 8 3l4.2 4.2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </motion.button>
                </div>
            </motion.div>
        </MotionConfig>
    )
}

addPropertyControls(PromptComposer, {
    placeholder: { type: ControlType.String, title: "Placeholder", defaultValue: "Ask about your data…" },
    isRunning: { type: ControlType.Boolean, title: "Running", defaultValue: false },
    maxRows: { type: ControlType.Number, title: "Max rows", defaultValue: 6, min: 1, max: 12 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    onSend: { type: ControlType.EventHandler, title: "On send" },
    onStop: { type: ControlType.EventHandler, title: "On stop" },
})

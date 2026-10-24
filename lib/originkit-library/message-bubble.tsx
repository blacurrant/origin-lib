import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * MessageBubble: one chat message. The user's message sits in a raised bubble
 * on the right. The assistant's message is plain text on the page with a small
 * label, which reads better for long answers. Copy confirms in place.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 96
 */

type Theme = "dark" | "light"
type Role = "user" | "assistant"

interface MessageBubbleProps {
    role: Role
    text: string
    name: string
    timestamp: string
    showActions: boolean
    accent: string
    theme: Theme
}

function palette(theme: Theme) {
    return theme === "light"
        ? { raised: "#ece9e3", text: "#141413", soft: "#5c5a55", faint: "#76736d" }
        : { raised: "#262829", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f" }
}

export default function MessageBubble({
    role = "assistant",
    text = "Revenue is up 12% on the quarter, led by the enterprise tier. Churn fell to 2.1%, the lowest it has been this year.",
    name = "",
    timestamp = "10:42",
    showActions = true,
    accent = "#fa7319",
    theme = "dark",
}: Partial<MessageBubbleProps>) {
    const p = palette(theme)
    const isUser = role === "user"
    const [copied, setCopied] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const label = name || (isUser ? "You" : "Assistant")

    const copy = () => {
        if (typeof navigator === "undefined" || !navigator.clipboard) return
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        })
    }

    return (
        <MotionConfig reducedMotion="user">
            <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    gap: 6,
                    width: "100%",
                    fontFamily: "inherit",
                }}
            >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12, color: p.faint }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: p.soft }}>
                        <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />
                        {label}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{timestamp}</span>
                </div>
                <div
                    style={{
                        maxWidth: isUser ? "80%" : "100%",
                        padding: isUser ? "9px 14px" : "0 0 0 12px",
                        borderLeft: isUser ? "none" : `2px solid ${accent}`,
                        borderRadius: isUser ? 14 : 2,
                        borderTopRightRadius: isUser ? 4 : 2,
                        background: isUser ? accent : "transparent",
                        color: isUser ? "#141413" : p.text,
                        fontSize: 15,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {text}
                </div>
                {showActions && !isUser && (
                    <button
                        type="button"
                        onClick={copy}
                        onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                        onBlur={() => setFocusVisible(false)}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            height: 26,
                            padding: "0 8px",
                            marginLeft: -8,
                            borderRadius: 6,
                            border: "none",
                            background: "none",
                            color: copied ? p.text : p.faint,
                            fontSize: 12,
                            fontWeight: 500,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            outline: focusVisible ? `2px solid ${accent}` : "none",
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                            {copied ? (
                                <path d="M2.5 7.4 5.6 10.4 11.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            ) : (
                                <g fill="none" stroke="currentColor" strokeWidth="1.3">
                                    <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" />
                                    <path d="M9.5 2.5h-6a1 1 0 0 0-1 1v6" strokeLinecap="round" />
                                </g>
                            )}
                        </svg>
                        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
                    </button>
                )}
            </motion.div>
        </MotionConfig>
    )
}

addPropertyControls(MessageBubble, {
    role: {
        type: ControlType.Enum,
        title: "Role",
        options: ["assistant", "user"],
        optionTitles: ["Assistant", "User"],
        defaultValue: "assistant",
    },
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue:
            "Revenue is up 12% on the quarter, led by the enterprise tier. Churn fell to 2.1%, the lowest it has been this year.",
        displayTextArea: true,
    },
    name: { type: ControlType.String, title: "Name", defaultValue: "", placeholder: "You / Assistant" },
    timestamp: { type: ControlType.String, title: "Time", defaultValue: "10:42" },
    showActions: { type: ControlType.Boolean, title: "Show copy", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
})

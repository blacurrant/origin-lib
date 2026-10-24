import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * ChatThread: a scrollable conversation. It follows new messages while the
 * reader is at the bottom, and leaves them alone (with a "Jump to latest"
 * button) once they scroll up to read. Messages are props, nothing is fetched.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 440
 * @framerIntrinsicHeight 360
 */

type Theme = "dark" | "light"
type Role = "user" | "assistant"

interface ChatMessage {
    role: Role
    text: string
}

interface ChatThreadProps {
    messages: ChatMessage[]
    accent: string
    theme: Theme
    height: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", raised: "#ece9e3", line: "#e4e1db", text: "#141413", soft: "#5c5a55", faint: "#76736d" }
        : { surface: "#141415", raised: "#262829", line: "#2d2d2f", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f" }
}

const SAMPLE: ChatMessage[] = [
    { role: "user", text: "Summarize the Q3 report." },
    { role: "assistant", text: "Revenue grew 12% quarter over quarter, led by the enterprise tier. Churn fell to 2.1%." },
    { role: "user", text: "What drove the churn drop?" },
    { role: "assistant", text: "Two changes: a fix to the onboarding flow, and fewer billing failures after card retries were added." },
    { role: "user", text: "Which of those mattered more?" },
    { role: "assistant", text: "Billing. About 60% of the recovered accounts were failed payments that retried successfully." },
]

export default function ChatThread({
    messages = SAMPLE,
    accent = "#fa7319",
    theme = "dark",
    height = 360,
}: Partial<ChatThreadProps>) {
    const p = palette(theme)
    const scroller = React.useRef<HTMLDivElement | null>(null)
    const [pinned, setPinned] = React.useState(true)
    const [focusVisible, setFocusVisible] = React.useState(false)

    React.useEffect(() => {
        const el = scroller.current
        if (el && pinned) el.scrollTo({ top: el.scrollHeight })
    }, [messages, pinned])

    const onScroll = () => {
        const el = scroller.current
        if (el) setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 40)
    }

    const jump = () => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
        setPinned(true)
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height,
                    borderRadius: 12,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                <div
                    ref={scroller}
                    onScroll={onScroll}
                    role="log"
                    aria-live="polite"
                    aria-label="Conversation"
                    tabIndex={0}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    style={{
                        height: "100%",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 18,
                        padding: 18,
                        boxSizing: "border-box",
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: -2,
                    }}
                >
                    {messages.length === 0 && (
                        <div style={{ margin: "auto", color: p.faint, fontSize: 14 }}>No messages yet.</div>
                    )}
                    {messages.map((m, i) => {
                        const isUser = m.role === "user"
                        return (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: p.faint }}>{isUser ? "You" : "Assistant"}</span>
                                <div
                                    style={{
                                        maxWidth: isUser ? "82%" : "100%",
                                        padding: isUser ? "8px 13px" : "0 0 0 12px",
                                        borderLeft: isUser ? "none" : `2px solid ${accent}`,
                                        borderRadius: isUser ? 14 : 2,
                                        borderTopRightRadius: isUser ? 4 : 2,
                                        background: isUser ? accent : "transparent",
                                        color: isUser ? "#141413" : p.text,
                                        fontSize: 14,
                                        lineHeight: 1.6,
                                    }}
                                >
                                    {m.text}
                                </div>
                            </div>
                        )
                    })}
                </div>
                <AnimatePresence>
                    {!pinned && (
                        <motion.button
                            type="button"
                            onClick={jump}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.14 }}
                            style={{
                                position: "absolute",
                                left: "50%",
                                bottom: 14,
                                x: "-50%",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                height: 30,
                                padding: "0 12px",
                                borderRadius: 999,
                                border: `1px solid ${p.line}`,
                                background: p.raised,
                                color: p.text,
                                fontSize: 12,
                                fontWeight: 500,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                boxShadow: "0 8px 20px -10px rgba(0,0,0,0.5)",
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                                <path d="M6 2.5v7M3 6.8 6 9.8l3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Jump to latest
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(ChatThread, {
    messages: {
        type: ControlType.Array,
        title: "Messages",
        control: {
            type: ControlType.Object,
            controls: {
                role: {
                    type: ControlType.Enum,
                    title: "Role",
                    options: ["user", "assistant"],
                    optionTitles: ["User", "Assistant"],
                    defaultValue: "user",
                },
                text: { type: ControlType.String, title: "Text", defaultValue: "" },
            },
        },
        defaultValue: SAMPLE,
    },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    height: { type: ControlType.Number, title: "Height", defaultValue: 360, min: 160, max: 800 },
})

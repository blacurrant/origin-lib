import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion, useReducedMotion } from "framer-motion"

/**
 * StreamingText: reveals a reply word by word, the way a model streams tokens.
 * Change `text` to start a new stream. With reduced motion on, the full text
 * shows at once. Screen readers get the finished text, not each word.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 96
 */

type Theme = "dark" | "light"

interface StreamingTextProps {
    text: string
    speed: number
    cursor: boolean
    accent: string
    theme: Theme
}

export default function StreamingText({
    text = "Revenue grew 12% quarter over quarter, led by the enterprise tier. Churn fell to 2.1%, the lowest this year, mostly from fewer failed payments.",
    speed = 40,
    cursor = true,
    accent = "#fa7319",
    theme = "dark",
}: Partial<StreamingTextProps>) {
    const reduced = useReducedMotion()
    const tokens = React.useMemo(() => text.split(/(\s+)/).filter((t) => t.length > 0), [text])
    const [shown, setShown] = React.useState(0)
    const color = theme === "light" ? "#141413" : "#f7f7f7"

    React.useEffect(() => setShown(0), [text])

    React.useEffect(() => {
        if (typeof window === "undefined" || reduced || shown >= tokens.length) return
        const timer = window.setTimeout(() => setShown((n) => n + 1), speed)
        return () => window.clearTimeout(timer)
    }, [shown, tokens.length, speed, reduced])

    const count = reduced ? tokens.length : shown
    const done = count >= tokens.length

    return (
        <MotionConfig reducedMotion="user">
            <p
                style={{ margin: 0, fontFamily: "inherit", fontSize: 15, lineHeight: 1.65, color, whiteSpace: "pre-wrap" }}
            >
                <span aria-hidden>{tokens.slice(0, count).join("")}</span>
                <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                    {done ? text : ""}
                </span>
                {cursor && !reduced && (
                    <motion.span
                        aria-hidden
                        animate={{ opacity: done ? [1, 0, 1] : 1 }}
                        transition={done ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
                        style={{
                            display: "inline-block",
                            width: 2,
                            height: "1.05em",
                            marginLeft: 2,
                            verticalAlign: "text-bottom",
                            background: accent,
                        }}
                    />
                )}
            </p>
        </MotionConfig>
    )
}

addPropertyControls(StreamingText, {
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue:
            "Revenue grew 12% quarter over quarter, led by the enterprise tier. Churn fell to 2.1%, the lowest this year, mostly from fewer failed payments.",
        displayTextArea: true,
    },
    speed: { type: ControlType.Number, title: "Speed (ms/word)", defaultValue: 40, min: 10, max: 300 },
    cursor: { type: ControlType.Boolean, title: "Cursor", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
})

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * TextInput: a field with a visible label above it, helper text, and an error
 * state announced to screen readers. Password fields get a show and hide toggle.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 84
 */

type Theme = "dark" | "light"

interface TextInputProps {
    label: string
    helper: string
    error: string
    placeholder: string
    type: "text" | "email" | "password" | "url"
    required: boolean
    disabled: boolean
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", strong: "#c9c5bc", text: "#141413", soft: "#5c5a55", faint: "#76736d", danger: "#c42a1d" }
        : { surface: "#141415", strong: "#3e3f40", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f", danger: "#ff7a70" }
}

const ICONS: Record<string, React.ReactNode> = {
    email: (
        <>
            <rect x="2" y="3.5" width="12" height="9" rx="1.8" />
            <path d="m2.6 5 5.4 4 5.4-4" />
        </>
    ),
    password: (
        <>
            <rect x="3.2" y="7" width="9.6" height="6.4" rx="1.6" />
            <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" />
        </>
    ),
    url: <path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M9.4 6.6a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" />,
    text: <path d="M3 4.5h10M8 4.5v7.5M5.6 12h4.8" />,
}

export default function TextInput({
    label = "Work email",
    helper = "We only use this to send your receipts.",
    error = "",
    placeholder = "name@company.com",
    type = "email",
    required = true,
    disabled = false,
    accent = "#fa7319",
    theme = "dark",
    radius = 8,
}: Partial<TextInputProps>) {
    const p = palette(theme)
    const uid = React.useId()
    const inputId = `${uid}-input`
    const noteId = `${uid}-note`
    const [value, setValue] = React.useState("")
    const [focused, setFocused] = React.useState(false)
    const [revealed, setRevealed] = React.useState(false)
    const isPassword = type === "password"
    const note = error || helper
    const ringColor = error ? p.danger : accent
    const accentInk = theme === "light" ? `color-mix(in srgb, ${accent} 62%, #141413)` : accent

    return (
        <MotionConfig reducedMotion="user">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", fontFamily: "inherit" }}>
                <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 500, color: p.text, letterSpacing: "-0.005em" }}>
                    {label}
                    {required && (
                        <span aria-hidden style={{ marginLeft: 3, color: accentInk }}>
                            *
                        </span>
                    )}
                </label>
                <motion.div
                    animate={{
                        borderColor: error ? p.danger : focused ? accent : p.strong,
                        boxShadow: focused
                            ? `0 0 0 3px color-mix(in srgb, ${ringColor} 28%, transparent)`
                            : "0 0 0 0px rgba(0,0,0,0)",
                    }}
                    transition={{ duration: 0.12 }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        height: 38,
                        borderRadius: radius,
                        borderWidth: 1,
                        borderStyle: "solid",
                        background: p.surface,
                        opacity: disabled ? 0.5 : 1,
                    }}
                >
                    <span aria-hidden style={{ display: "inline-flex", paddingLeft: 12, color: accentInk }}>
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                            {ICONS[type] ?? ICONS.text}
                        </svg>
                    </span>
                    <input
                        id={inputId}
                        type={isPassword && revealed ? "text" : type}
                        disabled={disabled}
                        placeholder={placeholder}
                        value={value}
                        aria-required={required || undefined}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={note ? noteId : undefined}
                        onChange={(e) => setValue(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            height: "100%",
                            padding: "0 12px 0 9px",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: p.text,
                            fontSize: 14,
                            fontFamily: "inherit",
                        }}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setRevealed((v) => !v)}
                            aria-pressed={revealed}
                            style={{
                                height: "100%",
                                padding: "0 12px",
                                background: "none",
                                border: "none",
                                color: p.soft,
                                fontSize: 12,
                                fontWeight: 500,
                                fontFamily: "inherit",
                                cursor: "pointer",
                            }}
                        >
                            {revealed ? "Hide" : "Show"}
                        </button>
                    )}
                </motion.div>
                {note ? (
                    <span
                        id={noteId}
                        role={error ? "alert" : undefined}
                        style={{ fontSize: 12, lineHeight: 1.4, color: error ? p.danger : p.faint }}
                    >
                        {note}
                    </span>
                ) : null}
            </div>
        </MotionConfig>
    )
}

addPropertyControls(TextInput, {
    label: { type: ControlType.String, title: "Label", defaultValue: "Work email" },
    helper: { type: ControlType.String, title: "Helper", defaultValue: "We only use this to send your receipts." },
    error: { type: ControlType.String, title: "Error", defaultValue: "" },
    placeholder: { type: ControlType.String, title: "Placeholder", defaultValue: "name@company.com" },
    type: {
        type: ControlType.Enum,
        title: "Type",
        options: ["text", "email", "password", "url"],
        optionTitles: ["Text", "Email", "Password", "URL"],
        defaultValue: "email",
    },
    required: { type: ControlType.Boolean, title: "Required mark", defaultValue: true },
    disabled: { type: ControlType.Boolean, title: "Disabled", defaultValue: false },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 8, min: 0, max: 20 },
})

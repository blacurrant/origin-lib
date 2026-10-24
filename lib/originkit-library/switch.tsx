import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * Switch: an on and off setting with a label and optional description. The
 * whole row is the click target.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 280
 * @framerIntrinsicHeight 40
 */

type Theme = "dark" | "light"

interface SwitchProps {
    checked: boolean
    label: string
    description: string
    disabled: boolean
    accent: string
    theme: Theme
}

function palette(theme: Theme) {
    return theme === "light"
        ? { off: "#c9c5bc", text: "#141413", faint: "#76736d" }
        : { off: "#3e3f40", text: "#f7f7f7", faint: "#8a8c8f" }
}

export default function Switch({
    checked = true,
    label = "Email notifications",
    description = "Get a summary when a deploy finishes.",
    disabled = false,
    accent = "#fa7319",
    theme = "dark",
}: Partial<SwitchProps>) {
    const p = palette(theme)
    const [on, setOn] = React.useState(checked)
    const [focusVisible, setFocusVisible] = React.useState(false)
    React.useEffect(() => setOn(checked), [checked])

    return (
        <MotionConfig reducedMotion="user">
            <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={disabled}
                onClick={() => setOn((v) => !v)}
                onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                onBlur={() => setFocusVisible(false)}
                style={{
                    display: "inline-flex",
                    alignItems: description ? "flex-start" : "center",
                    gap: 12,
                    padding: 0,
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    color: p.text,
                    fontFamily: "inherit",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.45 : 1,
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: 4,
                    borderRadius: 6,
                }}
            >
                <motion.span
                    aria-hidden
                    animate={{ backgroundColor: on ? accent : p.off }}
                    transition={{ duration: 0.16 }}
                    style={{ position: "relative", width: 36, height: 20, borderRadius: 999, flexShrink: 0, marginTop: description ? 1 : 0 }}
                >
                    <motion.span
                        animate={{ x: on ? 18 : 2 }}
                        transition={{ type: "spring", stiffness: 600, damping: 36 }}
                        style={{
                            position: "absolute",
                            top: 2,
                            left: 0,
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "#ffffff",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
                        }}
                    />
                </motion.span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {label ? <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em" }}>{label}</span> : null}
                    {description ? <span style={{ fontSize: 13, lineHeight: 1.4, color: p.faint }}>{description}</span> : null}
                </span>
            </button>
        </MotionConfig>
    )
}

addPropertyControls(Switch, {
    checked: { type: ControlType.Boolean, title: "On", defaultValue: true },
    label: { type: ControlType.String, title: "Label", defaultValue: "Email notifications" },
    description: { type: ControlType.String, title: "Description", defaultValue: "Get a summary when a deploy finishes." },
    disabled: { type: ControlType.Boolean, title: "Disabled", defaultValue: false },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
})

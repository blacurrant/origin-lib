import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * Checkbox: a native checkbox restyled, so keyboard and screen reader behavior
 * stay correct. Set `indeterminate` for a partly selected group.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 280
 * @framerIntrinsicHeight 40
 */

type Theme = "dark" | "light"

interface CheckboxProps {
    checked: boolean
    indeterminate: boolean
    label: string
    description: string
    disabled: boolean
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { border: "#a39f96", text: "#141413", faint: "#76736d" }
        : { border: "#5a5c5e", text: "#f7f7f7", faint: "#8a8c8f" }
}

export default function Checkbox({
    checked = true,
    indeterminate = false,
    label = "I agree to the terms",
    description = "You can change this later in settings.",
    disabled = false,
    accent = "#fa7319",
    theme = "dark",
    radius = 4,
}: Partial<CheckboxProps>) {
    const p = palette(theme)
    const [on, setOn] = React.useState(checked)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const ref = React.useRef<HTMLInputElement | null>(null)
    React.useEffect(() => setOn(checked), [checked])
    React.useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate
    }, [indeterminate])

    const filled = on || indeterminate

    return (
        <MotionConfig reducedMotion="user">
            <label
                style={{
                    display: "inline-flex",
                    alignItems: "flex-start",
                    gap: 10,
                    color: p.text,
                    fontFamily: "inherit",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.45 : 1,
                }}
            >
                <input
                    ref={ref}
                    type="checkbox"
                    checked={on}
                    disabled={disabled}
                    onChange={(e) => setOn(e.target.checked)}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    style={{ position: "absolute", opacity: 0, width: 18, height: 18, margin: 0 }}
                />
                <motion.span
                    aria-hidden
                    animate={{ backgroundColor: filled ? accent : "rgba(0,0,0,0)", borderColor: filled ? accent : p.border }}
                    transition={{ duration: 0.12 }}
                    style={{
                        width: 18,
                        height: 18,
                        marginTop: 1,
                        borderRadius: radius,
                        borderWidth: 1.5,
                        borderStyle: "solid",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: 2,
                    }}
                >
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <motion.path
                            d="M2.5 6.4 L5 8.8 L9.6 3.4"
                            fill="none"
                            stroke="#141413"
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={false}
                            animate={{ pathLength: on && !indeterminate ? 1 : 0, opacity: on && !indeterminate ? 1 : 0 }}
                            transition={{ duration: 0.18 }}
                        />
                        <motion.path
                            d="M2.8 6 L9.2 6"
                            fill="none"
                            stroke="#141413"
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            initial={false}
                            animate={{ pathLength: indeterminate ? 1 : 0, opacity: indeterminate ? 1 : 0 }}
                            transition={{ duration: 0.14 }}
                        />
                    </svg>
                </motion.span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {label ? <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em" }}>{label}</span> : null}
                    {description ? <span style={{ fontSize: 13, lineHeight: 1.4, color: p.faint }}>{description}</span> : null}
                </span>
            </label>
        </MotionConfig>
    )
}

addPropertyControls(Checkbox, {
    checked: { type: ControlType.Boolean, title: "Checked", defaultValue: true },
    indeterminate: { type: ControlType.Boolean, title: "Indeterminate", defaultValue: false },
    label: { type: ControlType.String, title: "Label", defaultValue: "I agree to the terms" },
    description: { type: ControlType.String, title: "Description", defaultValue: "You can change this later in settings." },
    disabled: { type: ControlType.Boolean, title: "Disabled", defaultValue: false },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 4, min: 0, max: 9 },
})

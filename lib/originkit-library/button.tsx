import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * Button: primary, secondary, ghost, and destructive. Loading keeps the label
 * in place and blocks repeat clicks. Focus ring shows for keyboard users only.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 120
 * @framerIntrinsicHeight 36
 */

type Theme = "dark" | "light"
type Variant = "primary" | "secondary" | "ghost" | "destructive"

interface ButtonProps {
    label: string
    variant: Variant
    size: "sm" | "md" | "lg"
    loading: boolean
    disabled: boolean
    accent: string
    theme: Theme
    radius: number
    onClick?: () => void
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", raised: "#f1efeb", strong: "#c9c5bc", text: "#141413" }
        : { surface: "#1b1c1d", raised: "#262829", strong: "#3e3f40", text: "#f7f7f7" }
}

const ON_ACCENT = "#141413"

const SIZES = {
    sm: { height: 32, padX: 12, font: 13 },
    md: { height: 36, padX: 14, font: 14 },
    lg: { height: 44, padX: 18, font: 15 },
}

export default function Button({
    label = "Continue",
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    accent = "#fa7319",
    theme = "dark",
    radius = 8,
    onClick,
}: Partial<ButtonProps>) {
    const p = palette(theme)
    const s = SIZES[size] ?? SIZES.md
    const inert = disabled || loading
    const [focusVisible, setFocusVisible] = React.useState(false)

    const look: Record<Variant, React.CSSProperties> = {
        primary: { backgroundColor: accent, color: ON_ACCENT, border: "1px solid transparent" },
        secondary: { backgroundColor: p.raised, color: p.text, border: `1px solid ${p.strong}` },
        ghost: { backgroundColor: "rgba(128,128,128,0)", color: p.text, border: "1px solid transparent" },
        destructive: { backgroundColor: "#d92d20", color: "#ffffff", border: "1px solid transparent" },
    }

    return (
        <MotionConfig reducedMotion="user">
            <motion.button
                type="button"
                disabled={disabled}
                aria-disabled={inert || undefined}
                aria-busy={loading || undefined}
                onClick={inert ? undefined : onClick}
                onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                onBlur={() => setFocusVisible(false)}
                whileHover={
                    inert
                        ? undefined
                        : variant === "ghost"
                          ? { backgroundColor: "rgba(128,128,128,0.16)" }
                          : { filter: "brightness(1.08)" }
                }
                whileTap={inert ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{
                    ...look[variant],
                    height: s.height,
                    padding: `0 ${s.padX}px`,
                    fontSize: s.font,
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                    fontFamily: "inherit",
                    borderRadius: radius,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    whiteSpace: "nowrap",
                    cursor: disabled ? "not-allowed" : loading ? "progress" : "pointer",
                    opacity: disabled ? 0.4 : 1,
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: 2,
                }}
            >
                {loading && (
                    <motion.span
                        aria-hidden
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            borderWidth: 1.5,
                            borderStyle: "solid",
                            borderTopColor: "currentColor",
                            borderLeftColor: "currentColor",
                            borderBottomColor: "currentColor",
                            borderRightColor: "transparent",
                            display: "inline-block",
                        }}
                    />
                )}
                {label}
            </motion.button>
        </MotionConfig>
    )
}

addPropertyControls(Button, {
    label: { type: ControlType.String, title: "Label", defaultValue: "Continue" },
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        options: ["primary", "secondary", "ghost", "destructive"],
        optionTitles: ["Primary", "Secondary", "Ghost", "Destructive"],
        defaultValue: "primary",
    },
    size: {
        type: ControlType.Enum,
        title: "Size",
        options: ["sm", "md", "lg"],
        optionTitles: ["Small", "Medium", "Large"],
        defaultValue: "md",
    },
    loading: { type: ControlType.Boolean, title: "Loading", defaultValue: false },
    disabled: { type: ControlType.Boolean, title: "Disabled", defaultValue: false },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 8, min: 0, max: 24 },
    onClick: { type: ControlType.EventHandler, title: "On click" },
})

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"

/**
 * Badge: a small status label. Color is never the only signal, so keep the
 * label text meaningful ("Failed", not just a red chip).
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 64
 * @framerIntrinsicHeight 22
 */

type Theme = "dark" | "light"
type Tone = "neutral" | "accent" | "success" | "warning" | "danger"

interface BadgeProps {
    label: string
    tone: Tone
    dot: boolean
    accent: string
    theme: Theme
    radius: number
}

function tones(theme: Theme, accent: string): Record<Tone, string> {
    const dark = theme !== "light"
    return {
        neutral: dark ? "#b7b7b8" : "#5c5a55",
        accent: dark ? accent : `color-mix(in srgb, ${accent} 62%, #141413)`,
        success: dark ? "#3dd68c" : "#12794a",
        warning: dark ? "#f5b14a" : "#9a5b00",
        danger: dark ? "#ff7a70" : "#c42a1d",
    }
}

export default function Badge({
    label = "New",
    tone = "accent",
    dot = false,
    accent = "#fa7319",
    theme = "dark",
    radius = 5,
}: Partial<BadgeProps>) {
    const color = tones(theme, accent)[tone] ?? tones(theme, accent).neutral
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 22,
                padding: "0 8px",
                borderRadius: radius,
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                color,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.005em",
                whiteSpace: "nowrap",
            }}
        >
            {dot && <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />}
            {label}
        </span>
    )
}

addPropertyControls(Badge, {
    label: { type: ControlType.String, title: "Label", defaultValue: "New" },
    tone: {
        type: ControlType.Enum,
        title: "Tone",
        options: ["neutral", "accent", "success", "warning", "danger"],
        optionTitles: ["Neutral", "Accent", "Success", "Warning", "Danger"],
        defaultValue: "accent",
    },
    dot: { type: ControlType.Boolean, title: "Dot", defaultValue: false },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 5, min: 0, max: 12 },
})

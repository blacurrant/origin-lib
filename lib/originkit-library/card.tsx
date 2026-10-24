import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * Card: a container with an eyebrow, title, body, and footer. Turn on
 * `interactive` when the whole card is a link, and the border responds to hover.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 340
 * @framerIntrinsicHeight 190
 */

type Theme = "dark" | "light"

interface CardProps {
    eyebrow: string
    title: string
    body: string
    footer: string
    interactive: boolean
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", line: "#e4e1db", hover: "#b9b4aa", text: "#141413", soft: "#5c5a55", faint: "#76736d" }
        : { surface: "#1b1c1d", line: "#2d2d2f", hover: "#505254", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f" }
}

export default function Card({
    eyebrow = "Team plan",
    title = "Everything a small team needs",
    body = "Unlimited projects, shared environment variables, and audit history for every member.",
    footer = "$24 per seat, billed monthly",
    interactive = false,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
}: Partial<CardProps>) {
    const p = palette(theme)
    const [focusVisible, setFocusVisible] = React.useState(false)

    return (
        <MotionConfig reducedMotion="user">
            <motion.div
                tabIndex={interactive ? 0 : undefined}
                onFocus={(e) => setFocusVisible(interactive && e.currentTarget.matches(":focus-visible"))}
                onBlur={() => setFocusVisible(false)}
                whileHover={interactive ? { borderColor: p.hover } : undefined}
                transition={{ duration: 0.14 }}
                style={{
                    width: "100%",
                    background: p.surface,
                    color: p.text,
                    borderRadius: radius,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: p.line,
                    cursor: interactive ? "pointer" : "default",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    outline: focusVisible ? `2px solid ${accent}` : "none",
                    outlineOffset: 2,
                }}
            >
                <div style={{ padding: "20px 20px 18px" }}>
                    {eyebrow ? (
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 500,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: theme === "light" ? `color-mix(in srgb, ${accent} 62%, #141413)` : accent,
                                fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
                            }}
                        >
                            {eyebrow}
                        </div>
                    ) : null}
                    {title ? (
                        <div style={{ marginTop: eyebrow ? 10 : 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                            {title}
                        </div>
                    ) : null}
                    {body ? <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: p.soft }}>{body}</div> : null}
                </div>
                {footer ? (
                    <div
                        style={{
                            padding: "12px 20px",
                            borderTop: `1px solid ${p.line}`,
                            fontSize: 13,
                            color: p.faint,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <span>{footer}</span>
                        {interactive ? <span aria-hidden>→</span> : null}
                    </div>
                ) : null}
            </motion.div>
        </MotionConfig>
    )
}

addPropertyControls(Card, {
    eyebrow: { type: ControlType.String, title: "Eyebrow", defaultValue: "Team plan" },
    title: { type: ControlType.String, title: "Title", defaultValue: "Everything a small team needs" },
    body: {
        type: ControlType.String,
        title: "Body",
        defaultValue: "Unlimited projects, shared environment variables, and audit history for every member.",
        displayTextArea: true,
    },
    footer: { type: ControlType.String, title: "Footer", defaultValue: "$24 per seat, billed monthly" },
    interactive: { type: ControlType.Boolean, title: "Interactive", defaultValue: false },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 28 },
})

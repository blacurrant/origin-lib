import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * SegmentedControl: a compact single choice from 2 to 5 options. Arrow keys
 * move the selection, Home and End jump to the ends, and the selected segment
 * slides between options.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 240
 * @framerIntrinsicHeight 36
 */

type Theme = "dark" | "light"

interface SegmentedControlProps {
    options: string[]
    defaultValue: string
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    return theme === "light"
        ? { track: "#ece9e3", pill: "#ffffff", pillBorder: "#d8d4cc", text: "#141413", soft: "#5c5a55" }
        : { track: "#141415", pill: "#2d2f30", pillBorder: "#3e3f40", text: "#f7f7f7", soft: "#b7b7b8" }
}

export default function SegmentedControl({
    options = ["Day", "Week", "Month"],
    defaultValue = "Week",
    accent = "#fa7319",
    theme = "dark",
    radius = 8,
}: Partial<SegmentedControlProps>) {
    const p = palette(theme)
    const id = React.useId()
    const list = options.slice(0, 5)
    const [value, setValue] = React.useState(defaultValue)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const refs = React.useRef<(HTMLButtonElement | null)[]>([])
    React.useEffect(() => setValue(defaultValue), [defaultValue])

    const index = Math.max(list.indexOf(value), 0)

    const move = (next: number) => {
        const i = (next + list.length) % list.length
        setValue(list[i])
        refs.current[i]?.focus()
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") move(index + 1)
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(index - 1)
        else if (e.key === "Home") move(0)
        else if (e.key === "End") move(list.length - 1)
        else return
        e.preventDefault()
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                role="radiogroup"
                aria-label="Options"
                onKeyDown={onKeyDown}
                style={{
                    display: "inline-flex",
                    padding: 3,
                    gap: 2,
                    borderRadius: radius + 3,
                    background: p.track,
                    fontFamily: "inherit",
                }}
            >
                {list.map((opt, i) => {
                    const active = i === index
                    return (
                        <button
                            key={opt}
                            ref={(el) => {
                                refs.current[i] = el
                            }}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            tabIndex={active ? 0 : -1}
                            onClick={() => setValue(opt)}
                            onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                            onBlur={() => setFocusVisible(false)}
                            style={{
                                position: "relative",
                                height: 28,
                                padding: "0 14px",
                                border: "none",
                                background: "none",
                                color: active ? p.text : p.soft,
                                fontSize: 13,
                                fontWeight: 500,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                borderRadius: radius,
                                outline: focusVisible && active ? `2px solid ${accent}` : "none",
                                outlineOffset: 1,
                            }}
                        >
                            {active && (
                                <motion.span
                                    layoutId={`seg-${id}`}
                                    transition={{ type: "spring", stiffness: 520, damping: 38 }}
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        borderRadius: radius,
                                        background: p.pill,
                                        border: `1px solid color-mix(in srgb, ${accent} 60%, ${p.pillBorder})`,
                                        zIndex: 0,
                                    }}
                                />
                            )}
                            <span style={{ position: "relative", zIndex: 1 }}>{opt}</span>
                        </button>
                    )
                })}
            </div>
        </MotionConfig>
    )
}

addPropertyControls(SegmentedControl, {
    options: {
        type: ControlType.Array,
        title: "Options",
        control: { type: ControlType.String },
        defaultValue: ["Day", "Week", "Month"],
        maxCount: 5,
    },
    defaultValue: { type: ControlType.String, title: "Selected", defaultValue: "Week" },
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

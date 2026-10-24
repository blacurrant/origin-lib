import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * SuggestionChips: follow-up prompts shown under an agent reply. Picking one
 * marks it and calls `onPick`. They are buttons in a group, so they work with
 * keyboard and screen readers.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 420
 * @framerIntrinsicHeight 34
 */

type Theme = "dark" | "light"

interface SuggestionChipsProps {
    items: string[]
    accent: string
    theme: Theme
    onPick?: () => void
}

function palette(theme: Theme) {
    return theme === "light"
        ? { chip: "#ffffff", hover: "#f1efeb", line: "#d8d4cc", text: "#141413", soft: "#5c5a55" }
        : { chip: "#1b1c1d", hover: "#262829", line: "#3e3f40", text: "#f7f7f7", soft: "#b7b7b8" }
}

const SAMPLE = ["Which accounts recovered?", "Show it by month", "Draft a note to finance"]

export default function SuggestionChips({
    items = SAMPLE,
    accent = "#fa7319",
    theme = "dark",
    onPick,
}: Partial<SuggestionChipsProps>) {
    const p = palette(theme)
    const list = items.length ? items : SAMPLE
    const [picked, setPicked] = React.useState<string | null>(null)
    const [focused, setFocused] = React.useState<string | null>(null)

    return (
        <MotionConfig reducedMotion="user">
            <div role="group" aria-label="Suggested follow-ups" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontFamily: "inherit" }}>
                {list.map((item) => {
                    const active = item === picked
                    return (
                        <motion.button
                            key={item}
                            type="button"
                            aria-pressed={active}
                            whileHover={{ backgroundColor: p.hover }}
                            whileTap={{ scale: 0.98 }}
                            animate={{ borderColor: active ? accent : p.line, backgroundColor: p.chip }}
                            transition={{ duration: 0.12 }}
                            onClick={() => {
                                setPicked(item)
                                onPick?.()
                            }}
                            onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible") ? item : null)}
                            onBlur={() => setFocused(null)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                height: 32,
                                padding: "0 12px",
                                borderRadius: 8,
                                borderWidth: 1,
                                borderStyle: "solid",
                                color: active ? p.text : p.soft,
                                fontSize: 13,
                                fontWeight: 500,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                outline: focused === item ? `2px solid ${accent}` : "none",
                                outlineOffset: 2,
                            }}
                        >
                            {active && (
                                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ color: accent }}>
                                    <path d="M2.4 6.2 5 8.6 9.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                            {!active && (
                                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden style={{ color: accent }}>
                                    <path d="M3.4 8.6 8.6 3.4M4.6 3.4h4v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                            {item}
                        </motion.button>
                    )
                })}
            </div>
        </MotionConfig>
    )
}

addPropertyControls(SuggestionChips, {
    items: {
        type: ControlType.Array,
        title: "Suggestions",
        control: { type: ControlType.String },
        defaultValue: SAMPLE,
        maxCount: 6,
    },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    onPick: { type: ControlType.EventHandler, title: "On pick" },
})

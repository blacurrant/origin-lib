import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * Tabs: an underlined tab list with one panel per tab. Arrow keys, Home and
 * End move between tabs, and the underline slides to the active one.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 440
 * @framerIntrinsicHeight 150
 */

type Theme = "dark" | "light"

interface TabsProps {
    tabs: string[]
    panels: string[]
    defaultTab: string
    accent: string
    theme: Theme
}

function palette(theme: Theme) {
    return theme === "light"
        ? { line: "#e4e1db", text: "#141413", soft: "#5c5a55" }
        : { line: "#2d2d2f", text: "#f7f7f7", soft: "#a5a7a9" }
}

const TABS = ["Overview", "Activity", "Settings"]
const PANELS = [
    "A summary of the workspace: members, plan, and the last deploy.",
    "Every change in the last 30 days, newest first, with who made it.",
    "Name, billing contact, and the region your data is stored in.",
]

export default function Tabs({
    tabs = TABS,
    panels = PANELS,
    defaultTab = "Overview",
    accent = "#fa7319",
    theme = "dark",
}: Partial<TabsProps>) {
    const p = palette(theme)
    const uid = React.useId()
    const list = tabs.length ? tabs : TABS
    const [active, setActive] = React.useState(list.includes(defaultTab) ? defaultTab : list[0])
    const [focusVisible, setFocusVisible] = React.useState(false)
    const refs = React.useRef<(HTMLButtonElement | null)[]>([])
    React.useEffect(() => {
        if (list.includes(defaultTab)) setActive(defaultTab)
    }, [defaultTab])

    const index = Math.max(list.indexOf(active), 0)

    const move = (next: number) => {
        const i = (next + list.length) % list.length
        setActive(list[i])
        refs.current[i]?.focus()
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowRight") move(index + 1)
        else if (e.key === "ArrowLeft") move(index - 1)
        else if (e.key === "Home") move(0)
        else if (e.key === "End") move(list.length - 1)
        else return
        e.preventDefault()
    }

    return (
        <MotionConfig reducedMotion="user">
            <div style={{ width: "100%", fontFamily: "inherit", color: p.text }}>
                <div
                    role="tablist"
                    aria-label="Sections"
                    onKeyDown={onKeyDown}
                    style={{ display: "flex", gap: 24, borderBottom: `1px solid ${p.line}` }}
                >
                    {list.map((tab, i) => {
                        const selected = i === index
                        return (
                            <button
                                key={tab}
                                ref={(el) => {
                                    refs.current[i] = el
                                }}
                                id={`${uid}-tab-${i}`}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                aria-controls={`${uid}-panel-${i}`}
                                tabIndex={selected ? 0 : -1}
                                onClick={() => setActive(tab)}
                                onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                                onBlur={() => setFocusVisible(false)}
                                style={{
                                    position: "relative",
                                    background: "none",
                                    border: "none",
                                    padding: "10px 0 11px",
                                    color: selected ? p.text : p.soft,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    letterSpacing: "-0.005em",
                                    fontFamily: "inherit",
                                    cursor: "pointer",
                                    outline: focusVisible && selected ? `2px solid ${accent}` : "none",
                                    outlineOffset: 2,
                                    borderRadius: 4,
                                }}
                            >
                                {tab}
                                {selected && (
                                    <motion.span
                                        layoutId={`tabline-${uid}`}
                                        transition={{ type: "spring", stiffness: 520, damping: 40 }}
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: -1,
                                            height: 2,
                                            background: accent,
                                        }}
                                    />
                                )}
                            </button>
                        )
                    })}
                </div>
                <div style={{ paddingTop: 16, minHeight: 56 }}>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={active}
                            id={`${uid}-panel-${index}`}
                            role="tabpanel"
                            aria-labelledby={`${uid}-tab-${index}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.14 }}
                            style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: p.soft }}
                        >
                            {panels[index] ?? ""}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(Tabs, {
    tabs: {
        type: ControlType.Array,
        title: "Tabs",
        control: { type: ControlType.String },
        defaultValue: TABS,
        maxCount: 6,
    },
    panels: {
        type: ControlType.Array,
        title: "Panels",
        control: { type: ControlType.String },
        defaultValue: PANELS,
        maxCount: 6,
    },
    defaultTab: { type: ControlType.String, title: "Default tab", defaultValue: "Overview" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
})

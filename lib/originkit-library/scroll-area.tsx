import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * ScrollArea: a fixed-height list that scrolls, with soft fades at the top and
 * bottom that appear only when there is more to see in that direction. The
 * region is focusable, so keyboard users can scroll it with the arrow keys.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 240
 */

type Theme = "dark" | "light"

interface ScrollAreaProps {
    title: string
    items: string[]
    height: number
    fades: boolean
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        surfaceRaw: dark ? "27,28,29" : "255,255,255",
        head: dark ? "#161718" : "#f6f4f0",
        line: dark ? "#2d2d2f" : "#e4e1db",
        thumb: dark ? "#4a4c4e" : "#c9c5bc",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#b7b7b8" : "#5c5a55",
        faint: dark ? "#8a8c8f" : "#76736d",
    }
}

const ITEMS = [
    "Deploy 4128 · production · 2m ago",
    "Deploy 4127 · preview · 18m ago",
    "Deploy 4126 · production · 1h ago",
    "Rollback to 4124 · production · 3h ago",
    "Deploy 4125 · preview · 3h ago",
    "Deploy 4124 · production · 5h ago",
    "Deploy 4123 · preview · yesterday",
    "Deploy 4122 · production · yesterday",
    "Deploy 4121 · preview · 2 days ago",
    "Deploy 4120 · production · 2 days ago",
    "Deploy 4119 · preview · 3 days ago",
    "Deploy 4118 · production · 4 days ago",
]

export default function ScrollArea({
    title = "Recent deploys",
    items = ITEMS,
    height = 240,
    fades = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
}: Partial<ScrollAreaProps>) {
    const p = palette(theme)
    const el = React.useRef<HTMLDivElement | null>(null)
    const [edge, setEdge] = React.useState({ top: false, bottom: false })
    const [focusVisible, setFocusVisible] = React.useState(false)

    const measure = React.useCallback(() => {
        const n = el.current
        if (!n) return
        setEdge({ top: n.scrollTop > 2, bottom: n.scrollTop + n.clientHeight < n.scrollHeight - 2 })
    }, [])
    React.useEffect(measure, [items, height, measure])

    const fade = (side: "top" | "bottom"): React.CSSProperties => ({
        position: "absolute",
        left: 0,
        right: 0,
        [side]: 0,
        height: 36,
        pointerEvents: "none",
        background: `linear-gradient(${side === "top" ? "to bottom" : "to top"}, rgba(${p.surfaceRaw},1), rgba(${p.surfaceRaw},0))`,
    })

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    borderRadius: radius,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    color: p.text,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                {title ? (
                    <div style={{ padding: "11px 16px", background: p.head, borderBottom: `1px solid ${p.line}`, fontSize: 13, fontWeight: 600 }}>{title}</div>
                ) : null}
                <div style={{ position: "relative" }}>
                    <div
                        ref={el}
                        onScroll={measure}
                        role="region"
                        aria-label={title || "Scrollable list"}
                        tabIndex={0}
                        onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                        onBlur={() => setFocusVisible(false)}
                        style={{
                            height: Math.max(height - (title ? 41 : 0), 80),
                            overflowY: "auto",
                            scrollbarWidth: "thin",
                            scrollbarColor: `${p.thumb} transparent`,
                            outline: focusVisible ? `2px solid ${accent}` : "none",
                            outlineOffset: -2,
                        }}
                    >
                        <ul style={{ margin: 0, padding: "4px 0", listStyle: "none" }}>
                            {items.map((it, i) => (
                                <li
                                    key={`${it}-${i}`}
                                    style={{ padding: "9px 16px", fontSize: 13.5, boxShadow: i === 0 ? `inset 2px 0 0 ${accent}` : "none", color: i === 0 ? p.text : p.soft, borderBottom: i === items.length - 1 ? "none" : `1px solid ${p.line}` }}
                                >
                                    {i === 0 && <span aria-hidden style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: accent, marginRight: 10, verticalAlign: "middle" }} />}
                                    {it}
                                </li>
                            ))}
                        </ul>
                    </div>
                    {fades && (
                        <>
                            <motion.div aria-hidden animate={{ opacity: edge.top ? 1 : 0 }} transition={{ duration: 0.15 }} style={fade("top")} />
                            <motion.div aria-hidden animate={{ opacity: edge.bottom ? 1 : 0 }} transition={{ duration: 0.15 }} style={fade("bottom")} />
                        </>
                    )}
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(ScrollArea, {
    title: { type: ControlType.String, title: "Title", defaultValue: "Recent deploys" },
    items: {
        type: ControlType.Array,
        title: "Items",
        control: { type: ControlType.String },
        defaultValue: ITEMS,
    },
    height: { type: ControlType.Number, title: "Height", defaultValue: 240, min: 120, max: 520 },
    fades: { type: ControlType.Boolean, title: "Edge fades", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 24 },
})

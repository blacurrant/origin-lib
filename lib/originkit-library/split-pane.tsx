import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig } from "framer-motion"

/**
 * SplitPane: two panes divided by a draggable handle. The handle is a real
 * separator: focus it and use the arrow keys (Shift for bigger steps), Home,
 * and End. The first pane lists items, and choosing one fills the second pane.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 560
 * @framerIntrinsicHeight 260
 */

type Theme = "dark" | "light"

interface SplitPaneProps {
    direction: "horizontal" | "vertical"
    initial: number
    min: number
    max: number
    startLabel: string
    endLabel: string
    items: string[]
    height: number
    accent: string
    theme: Theme
    radius: number
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        head: dark ? "#161718" : "#f6f4f0",
        hover: dark ? "#262829" : "#f1efeb",
        line: dark ? "#2d2d2f" : "#e4e1db",
        strong: dark ? "#4a4c4e" : "#b9b4aa",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#b7b7b8" : "#5c5a55",
        faint: dark ? "#8a8c8f" : "#76736d",
    }
}

const ITEMS = ["app/page.tsx", "app/layout.tsx", "lib/billing.ts", "lib/retry.ts", "components/nav.tsx"]

export default function SplitPane({
    direction = "horizontal",
    initial = 38,
    min = 20,
    max = 80,
    startLabel = "Files",
    endLabel = "Preview",
    items = ITEMS,
    height = 260,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
}: Partial<SplitPaneProps>) {
    const p = palette(theme)
    const horizontal = direction !== "vertical"
    const lo = Math.min(min, max)
    const hi = Math.max(min, max)
    const clamp = (n: number) => Math.min(Math.max(n, lo), hi)
    const box = React.useRef<HTMLDivElement | null>(null)
    const [pct, setPct] = React.useState(clamp(initial))
    const [dragging, setDragging] = React.useState(false)
    const [focused, setFocused] = React.useState(false)
    const [hover, setHover] = React.useState(false)
    const [chosen, setChosen] = React.useState(0)
    React.useEffect(() => setPct(clamp(initial)), [initial, lo, hi])

    const fromPointer = (e: React.PointerEvent) => {
        const r = box.current?.getBoundingClientRect()
        if (!r) return
        const raw = horizontal ? ((e.clientX - r.left) / r.width) * 100 : ((e.clientY - r.top) / r.height) * 100
        setPct(clamp(raw))
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        const big = e.shiftKey ? 10 : 2
        const back = horizontal ? "ArrowLeft" : "ArrowUp"
        const fwd = horizontal ? "ArrowRight" : "ArrowDown"
        if (e.key === back) setPct((v) => clamp(v - big))
        else if (e.key === fwd) setPct((v) => clamp(v + big))
        else if (e.key === "Home") setPct(lo)
        else if (e.key === "End") setPct(hi)
        else return
        e.preventDefault()
    }

    const list = items.length ? items : ITEMS
    const active = dragging || focused || hover
    const paneHead: React.CSSProperties = {
        padding: "9px 14px",
        background: p.head,
        borderBottom: `1px solid ${p.line}`,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: p.faint,
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                ref={box}
                style={{
                    display: "flex",
                    flexDirection: horizontal ? "row" : "column",
                    width: "100%",
                    height,
                    borderRadius: radius,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    color: p.text,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    userSelect: dragging ? "none" : "auto",
                }}
            >
                <div style={{ flex: `0 0 ${pct}%`, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                    <div style={paneHead}>{startLabel}</div>
                    <ul style={{ margin: 0, padding: 6, listStyle: "none", overflow: "auto", flex: 1 }}>
                        {list.map((it, i) => (
                            <li key={`${it}-${i}`}>
                                <button
                                    type="button"
                                    aria-pressed={i === chosen}
                                    onClick={() => setChosen(i)}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "6px 8px",
                                        border: "none",
                                        borderRadius: 6,
                                        background: i === chosen ? p.hover : "transparent",
                                        boxShadow: i === chosen ? `inset 2px 0 0 ${accent}` : "none",
                                        color: i === chosen ? p.text : p.soft,
                                        fontSize: 12.5,
                                        fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {it}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div
                    role="separator"
                    aria-label="Resize panes"
                    aria-orientation={horizontal ? "vertical" : "horizontal"}
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={lo}
                    aria-valuemax={hi}
                    tabIndex={0}
                    onPointerDown={(e) => {
                        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                        setDragging(true)
                        fromPointer(e)
                    }}
                    onPointerMove={(e) => dragging && fromPointer(e)}
                    onPointerUp={(e) => {
                        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                        setDragging(false)
                    }}
                    onPointerEnter={() => setHover(true)}
                    onPointerLeave={() => setHover(false)}
                    onKeyDown={onKeyDown}
                    onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocused(false)}
                    style={{
                        position: "relative",
                        flex: "0 0 11px",
                        cursor: horizontal ? "col-resize" : "row-resize",
                        touchAction: "none",
                        outline: "none",
                        background: active ? `color-mix(in srgb, ${accent} 14%, transparent)` : "transparent",
                    }}
                >
                    <span
                        aria-hidden
                        style={{
                            position: "absolute",
                            ...(horizontal ? { top: 0, bottom: 0, left: 5, width: active ? 2 : 1 } : { left: 0, right: 0, top: 5, height: active ? 2 : 1 }),
                            background: active ? accent : p.line,
                        }}
                    />
                </div>

                <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                    <div style={paneHead}>{endLabel}</div>
                    <div style={{ padding: 14, overflow: "auto", flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace', overflowWrap: "anywhere" }}>
                            {list[chosen] ?? list[0]}
                        </div>
                        <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55, color: p.soft }}>
                            Drag the handle, or focus it and use the arrow keys. This pane gets whatever space is left.
                        </p>
                    </div>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(SplitPane, {
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["horizontal", "vertical"],
        optionTitles: ["Side by side", "Stacked"],
        defaultValue: "horizontal",
    },
    initial: { type: ControlType.Number, title: "Start size (%)", defaultValue: 38, min: 5, max: 95 },
    min: { type: ControlType.Number, title: "Min (%)", defaultValue: 20, min: 5, max: 50 },
    max: { type: ControlType.Number, title: "Max (%)", defaultValue: 80, min: 50, max: 95 },
    startLabel: { type: ControlType.String, title: "Start label", defaultValue: "Files" },
    endLabel: { type: ControlType.String, title: "End label", defaultValue: "Preview" },
    items: {
        type: ControlType.Array,
        title: "Items",
        control: { type: ControlType.String },
        defaultValue: ITEMS,
    },
    height: { type: ControlType.Number, title: "Height", defaultValue: 260, min: 160, max: 520 },
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

import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * DropdownMenu: a button that opens a list of actions. Arrow keys move through
 * the items (skipping disabled ones), Home and End jump to the ends, typing a
 * letter jumps to the next match, Escape closes and returns focus to the
 * button, and clicking outside closes it.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 160
 * @framerIntrinsicHeight 36
 */

type Theme = "dark" | "light"

interface MenuItem {
    label: string
    shortcut: string
    destructive: boolean
    disabled: boolean
}

interface DropdownMenuProps {
    label: string
    items: MenuItem[]
    defaultOpen: boolean
    showResult: boolean
    accent: string
    theme: Theme
    radius: number
    onSelect?: () => void
}

function palette(theme: Theme) {
    return theme === "light"
        ? { surface: "#ffffff", raised: "#f1efeb", hover: "#f3f1ed", line: "#e4e1db", strong: "#c9c5bc", text: "#141413", soft: "#5c5a55", faint: "#76736d", danger: "#c42a1d" }
        : { surface: "#1b1c1d", raised: "#262829", hover: "#262829", line: "#2d2d2f", strong: "#3e3f40", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f", danger: "#ff7a70" }
}

const ITEMS: MenuItem[] = [
    { label: "Rename", shortcut: "F2", destructive: false, disabled: false },
    { label: "Duplicate", shortcut: "⌘D", destructive: false, disabled: false },
    { label: "Move to…", shortcut: "", destructive: false, disabled: true },
    { label: "Archive", shortcut: "⌘E", destructive: false, disabled: false },
    { label: "Delete", shortcut: "⌫", destructive: true, disabled: false },
]

export default function DropdownMenu({
    label = "Actions",
    items = ITEMS,
    defaultOpen = false,
    showResult = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 10,
    onSelect,
}: Partial<DropdownMenuProps>) {
    const p = palette(theme)
    const uid = React.useId()
    const list = (items.length ? items : ITEMS).map((it) => ({
        label: it.label ?? "",
        shortcut: it.shortcut ?? "",
        destructive: !!it.destructive,
        disabled: !!it.disabled,
    }))
    const [open, setOpen] = React.useState(defaultOpen)
    const [active, setActive] = React.useState(-1)
    const [last, setLast] = React.useState("")
    const [focusVisible, setFocusVisible] = React.useState(false)
    const root = React.useRef<HTMLDivElement | null>(null)
    const trigger = React.useRef<HTMLButtonElement | null>(null)
    const refs = React.useRef<(HTMLButtonElement | null)[]>([])
    const moveFocus = React.useRef(false)

    const enabled = list.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0)
    const first = enabled[0] ?? -1
    const lastEnabled = enabled[enabled.length - 1] ?? -1

    const openAt = (index: number) => {
        moveFocus.current = true
        setActive(index)
        setOpen(true)
    }

    const close = (returnFocus: boolean) => {
        setOpen(false)
        setActive(-1)
        if (returnFocus) trigger.current?.focus()
    }

    React.useEffect(() => {
        if (open && moveFocus.current && active >= 0) refs.current[active]?.focus()
    }, [open, active])

    React.useEffect(() => {
        if (typeof document === "undefined" || !open) return
        const onDown = (e: PointerEvent) => {
            if (root.current && !root.current.contains(e.target as Node)) close(false)
        }
        document.addEventListener("pointerdown", onDown)
        return () => document.removeEventListener("pointerdown", onDown)
    }, [open])

    const step = (from: number, dir: 1 | -1) => {
        const at = enabled.indexOf(from)
        const next = at === -1 ? (dir === 1 ? 0 : enabled.length - 1) : (at + dir + enabled.length) % enabled.length
        return enabled[next]
    }

    const onTriggerKey = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            openAt(first)
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            openAt(lastEnabled)
        }
    }

    const onMenuKey = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") setActive((a) => step(a, 1))
        else if (e.key === "ArrowUp") setActive((a) => step(a, -1))
        else if (e.key === "Home") setActive(first)
        else if (e.key === "End") setActive(lastEnabled)
        else if (e.key === "Escape") close(true)
        else if (e.key === "Tab") close(false)
        else if (e.key.length === 1 && /\S/.test(e.key)) {
            const k = e.key.toLowerCase()
            const hit = enabled.find((i) => i > active && list[i].label.toLowerCase().startsWith(k)) ?? enabled.find((i) => list[i].label.toLowerCase().startsWith(k))
            if (hit === undefined) return
            setActive(hit)
        } else return
        moveFocus.current = true
        e.preventDefault()
    }

    const choose = (i: number) => {
        setLast(list[i].label)
        onSelect?.()
        close(true)
    }

    return (
        <MotionConfig reducedMotion="user">
            <div ref={root} style={{ position: "relative", display: "inline-flex", flexDirection: "column", gap: 8, fontFamily: "inherit" }}>
                <button
                    ref={trigger}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-controls={`${uid}-menu`}
                    onClick={() => (open ? close(false) : openAt(-1))}
                    onKeyDown={onTriggerKey}
                    onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                    onBlur={() => setFocusVisible(false)}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        height: 36,
                        padding: "0 12px 0 14px",
                        borderRadius: radius,
                        border: `1px solid color-mix(in srgb, ${accent} 45%, ${p.strong})`,
                        background: open ? p.raised : p.surface,
                        color: p.text,
                        fontSize: 14,
                        fontWeight: 500,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        outline: focusVisible ? `2px solid ${accent}` : "none",
                        outlineOffset: 2,
                    }}
                >
                    {label}
                    <motion.svg width="12" height="12" viewBox="0 0 12 12" aria-hidden animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.14 }}>
                        <path d="M2.8 4.6 6 7.8l3.2-3.2" fill="none" stroke={theme === "light" ? `color-mix(in srgb, ${accent} 62%, #141413)` : accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                </button>
                {showResult && (
                    <span aria-live="polite" style={{ fontSize: 12, color: p.faint, minHeight: 16 }}>
                        {last ? `Last action: ${last}` : ""}
                    </span>
                )}

                <AnimatePresence>
                    {open && (
                        <motion.div
                            id={`${uid}-menu`}
                            role="menu"
                            aria-label={label}
                            onKeyDown={onMenuKey}
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -2, transition: { duration: 0.1 } }}
                            transition={{ duration: 0.14 }}
                            style={{
                                position: "absolute",
                                top: 42,
                                left: 0,
                                zIndex: 20,
                                minWidth: 220,
                                padding: 4,
                                borderRadius: radius + 2,
                                border: `1px solid ${p.line}`,
                                background: p.surface,
                                boxShadow: "0 16px 36px -14px rgba(0,0,0,0.55)",
                                transformOrigin: "top left",
                            }}
                        >
                            {list.map((it, i) => {
                                const on = i === active
                                return (
                                    <button
                                        key={`${it.label}-${i}`}
                                        ref={(el) => {
                                            refs.current[i] = el
                                        }}
                                        type="button"
                                        role="menuitem"
                                        tabIndex={on ? 0 : -1}
                                        aria-disabled={it.disabled || undefined}
                                        onClick={() => !it.disabled && choose(i)}
                                        onMouseMove={() => !it.disabled && active !== i && setActive(i)}
                                        style={{
                                            width: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 24,
                                            height: 32,
                                            padding: "0 10px",
                                            border: "none",
                                            borderRadius: Math.max(radius - 3, 4),
                                            background: on ? `color-mix(in srgb, ${accent} 16%, ${p.hover})` : "transparent",
                                            color: it.disabled ? p.faint : it.destructive ? p.danger : p.text,
                                            opacity: it.disabled ? 0.55 : 1,
                                            fontSize: 13.5,
                                            fontFamily: "inherit",
                                            textAlign: "left",
                                            cursor: it.disabled ? "not-allowed" : "pointer",
                                            outline: "none",
                                        }}
                                    >
                                        <span>{it.label}</span>
                                        {it.shortcut ? <span style={{ fontSize: 12, color: p.faint, fontVariantNumeric: "tabular-nums" }}>{it.shortcut}</span> : null}
                                    </button>
                                )
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(DropdownMenu, {
    label: { type: ControlType.String, title: "Label", defaultValue: "Actions" },
    items: {
        type: ControlType.Array,
        title: "Items",
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, title: "Label", defaultValue: "Item" },
                shortcut: { type: ControlType.String, title: "Shortcut", defaultValue: "" },
                destructive: { type: ControlType.Boolean, title: "Destructive", defaultValue: false },
                disabled: { type: ControlType.Boolean, title: "Disabled", defaultValue: false },
            },
        },
        defaultValue: ITEMS,
    },
    defaultOpen: { type: ControlType.Boolean, title: "Open", defaultValue: false },
    showResult: { type: ControlType.Boolean, title: "Show last action", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 10, min: 0, max: 20 },
    onSelect: { type: ControlType.EventHandler, title: "On select" },
})

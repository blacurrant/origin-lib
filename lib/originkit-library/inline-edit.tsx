import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue } from "framer-motion"

/**
 * InlineEdit: text that turns into an input on click or Enter and back on
 * Enter or blur (save) or Escape (cancel). The input is sized to its text on a
 * spring, a pencil hints at hover, a saved value flashes an accent underline
 * and a check, and an Undo chip stays for a few seconds. Single line or
 * multiline, plus a small list of labelled rows to show it off.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 420
 * @framerIntrinsicHeight 270
 */

type Theme = "dark" | "light"

interface InlineEditProps {
    value: string
    multiline: boolean
    placeholder: string
    label: string
    showList: boolean
    accent: string
    theme: Theme
    radius: number
    onChange: (value: string) => void
}

interface Pal {
    surface: string
    raised: string
    line: string
    text: string
    soft: string
    faint: string
}

function palette(theme: Theme): Pal {
    return theme === "light"
        ? { surface: "#ffffff", raised: "#f3f1ec", line: "#e4e1db", text: "#141413", soft: "#5c5a55", faint: "#76736d" }
        : { surface: "#141415", raised: "#1f2021", line: "#2d2d2f", text: "#f7f7f7", soft: "#b7b7b8", faint: "#8a8c8f" }
}

const SPRING = { type: "spring" as const, stiffness: 520, damping: 40, mass: 0.7 }
const POP = { type: "spring" as const, stiffness: 420, damping: 26 }
const UNDO_MS = 5000
const PAD_X = 8
const PAD_Y = 3
const LINE = 22

const ROWS = [
    { label: "Name", value: "Ada Lovelace", placeholder: "Add a name" },
    { label: "Role", value: "Staff engineer", placeholder: "Add a role" },
    { label: "Location", value: "London, UK", placeholder: "Add a location" },
]

interface EditableProps {
    value: string
    onCommit: (next: string) => void
    multiline: boolean
    placeholder: string
    label: string
    accent: string
    radius: number
    p: Pal
}

function Editable({ value: incoming, onCommit, multiline, placeholder, label, accent, radius, p }: EditableProps) {
    const [value, setValue] = React.useState(incoming)
    const [draft, setDraft] = React.useState(incoming)
    const [editing, setEditing] = React.useState(false)
    const [hover, setHover] = React.useState(false)
    const [focusVisible, setFocusVisible] = React.useState(false)
    const [flash, setFlash] = React.useState(0)
    const [check, setCheck] = React.useState(false)
    const [undo, setUndo] = React.useState<{ prev: string; key: number } | null>(null)
    const [ready, setReady] = React.useState(false)

    const fieldRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
    const showRef = React.useRef<HTMLButtonElement | null>(null)
    const measureRef = React.useRef<HTMLDivElement | null>(null)
    const activeRef = React.useRef(false)
    const refocus = React.useRef(false)
    const sizeMV = useMotionValue(0)
    const sized = React.useRef(false)
    const sizeAnim = React.useRef<ReturnType<typeof animate> | null>(null)

    React.useEffect(() => {
        setValue(incoming)
    }, [incoming])

    const text = (editing ? draft : value) || placeholder

    // Keep the box sized to the text (width for one line, height for multiline).
    const sync = React.useCallback(() => {
        const m = measureRef.current
        if (!m) return
        const target = multiline ? m.offsetHeight + 1 : m.offsetWidth + (editing ? 3 : 1)
        if (target <= 0) return
        if (!sized.current) {
            sized.current = true
            sizeMV.set(target)
            setReady(true)
            return
        }
        sizeAnim.current?.stop()
        sizeAnim.current = animate(sizeMV, target, SPRING)
    }, [multiline, editing, sizeMV])

    React.useEffect(() => {
        sync()
    }, [sync, text])

    React.useEffect(() => {
        const m = measureRef.current
        if (!m || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(() => sync())
        ro.observe(m)
        return () => ro.disconnect()
    }, [sync])

    React.useEffect(() => () => sizeAnim.current?.stop(), [])

    // Focus the field when editing starts, the button when it ends by keyboard.
    React.useEffect(() => {
        if (editing) {
            const el = fieldRef.current
            if (el) {
                el.focus()
                el.select()
            }
        } else if (refocus.current) {
            refocus.current = false
            showRef.current?.focus()
        }
    }, [editing])

    // Hide the check and the undo chip on a timer.
    React.useEffect(() => {
        if (!check) return
        const id = setTimeout(() => setCheck(false), 1500)
        return () => clearTimeout(id)
    }, [check, flash])

    React.useEffect(() => {
        if (!undo) return
        const id = setTimeout(() => setUndo(null), UNDO_MS)
        return () => clearTimeout(id)
    }, [undo])

    const begin = () => {
        activeRef.current = true
        setDraft(value)
        setEditing(true)
    }

    const finish = (save: boolean, viaKey: boolean) => {
        if (!activeRef.current) return
        activeRef.current = false
        refocus.current = viaKey
        setEditing(false)
        if (!save) return
        const next = draft
        if (next === value) return
        setValue(next)
        onCommit(next)
        setFlash((n) => n + 1)
        setCheck(true)
        setUndo({ prev: value, key: Date.now() })
    }

    const revert = () => {
        if (!undo) return
        const prev = undo.prev
        setValue(prev)
        onCommit(prev)
        setUndo(null)
        setCheck(false)
        setFlash((n) => n + 1)
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault()
            finish(false, true)
        } else if (e.key === "Enter" && !(multiline && e.shiftKey)) {
            e.preventDefault()
            finish(true, true)
        }
    }

    const typo: React.CSSProperties = {
        fontFamily: "inherit",
        fontSize: 15,
        lineHeight: `${LINE}px`,
        fontWeight: 500,
        letterSpacing: "0.005em",
        padding: `${PAD_Y}px ${multiline ? 30 : PAD_X}px ${PAD_Y}px ${PAD_X}px`,
        boxSizing: "border-box",
        borderWidth: 1,
        borderStyle: "solid",
        margin: 0,
    }

    const showFocus = focusVisible && !editing
    const pencilOn = (hover || showFocus) && !editing && !check
    const boxStyle: Record<string, unknown> = ready
        ? multiline
            ? { width: "100%", height: editing ? sizeMV : "auto" }
            : { width: sizeMV, maxWidth: "100%" }
        : multiline
          ? { width: "100%" }
          : { maxWidth: "100%" }

    const undoChip = (
        <motion.button
            type="button"
            onClick={revert}
            aria-label={`Undo change to ${label}`}
            initial={multiline ? false : { opacity: 0, x: -8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={multiline ? undefined : { opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
            transition={POP}
            style={{
                position: "relative",
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 22,
                padding: "0 9px 0 7px",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: p.line,
                borderRadius: 999,
                background: p.raised,
                color: p.soft,
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                overflow: "hidden",
            }}
        >
            <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                <path d="M4.5 2.5 2 5l2.5 2.5M2.4 5H7a3 3 0 010 6H5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Undo
            <motion.span
                aria-hidden
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: UNDO_MS / 1000, ease: "linear" }}
                style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: accent, transformOrigin: "0% 50%" }}
            />
        </motion.button>
    )

    return (
        <MotionConfig reducedMotion="user">
            <div
                onPointerEnter={() => setHover(true)}
                onPointerLeave={() => setHover(false)}
                style={{ position: "relative", display: "flex", flexDirection: multiline ? "column" : "row", alignItems: multiline ? "flex-start" : "center", gap: multiline ? 0 : 6, minWidth: 0, width: "100%" }}
            >
                {/* Hidden twin that measures the text with identical typography. */}
                <div
                    ref={measureRef}
                    aria-hidden
                    style={{
                        ...typo,
                        position: "absolute",
                        left: 0,
                        top: 0,
                        visibility: "hidden",
                        pointerEvents: "none",
                        whiteSpace: multiline ? "pre-wrap" : "pre",
                        wordBreak: "break-word",
                        width: multiline ? "100%" : "auto",
                        display: "block",
                        maxWidth: "100%",
                        minHeight: multiline ? LINE * 2 + PAD_Y * 2 + 2 : undefined,
                        overflow: "hidden",
                    }}
                >
                    {text + (multiline ? "​" : "")}
                </div>

                <motion.div style={{ position: "relative", minWidth: 0, flex: multiline ? "1 1 auto" : "0 1 auto", ...boxStyle }}>
                    {editing ? (
                        multiline ? (
                            <textarea
                                ref={fieldRef as React.RefObject<HTMLTextAreaElement>}
                                value={draft}
                                placeholder={placeholder}
                                aria-label={label}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={onKeyDown}
                                onBlur={() => finish(true, false)}
                                style={{
                                    ...typo,
                                    display: "block",
                                    width: "100%",
                                    height: "100%",
                                    resize: "none",
                                    overflow: "hidden",
                                    outline: "none",
                                    color: p.text,
                                    background: p.raised,
                                    borderColor: accent,
                                    borderRadius: Math.max(4, radius - 4),
                                    boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 24%, transparent)`,
                                    caretColor: accent,
                                }}
                            />
                        ) : (
                            <input
                                ref={fieldRef as React.RefObject<HTMLInputElement>}
                                type="text"
                                value={draft}
                                placeholder={placeholder}
                                aria-label={label}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={onKeyDown}
                                onBlur={() => finish(true, false)}
                                style={{
                                    ...typo,
                                    display: "block",
                                    width: "100%",
                                    outline: "none",
                                    color: p.text,
                                    background: p.raised,
                                    borderColor: accent,
                                    borderRadius: Math.max(4, radius - 4),
                                    boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 24%, transparent)`,
                                    caretColor: accent,
                                }}
                            />
                        )
                    ) : (
                        <button
                            ref={showRef}
                            type="button"
                            aria-label={`Edit ${label}: ${value || "empty"}`}
                            onClick={begin}
                            onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
                            onBlur={() => setFocusVisible(false)}
                            style={{
                                ...typo,
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                cursor: "text",
                                color: value ? p.text : p.faint,
                                fontStyle: value ? "normal" : "italic",
                                background: hover ? p.raised : "transparent",
                                borderColor: "transparent",
                                borderRadius: Math.max(4, radius - 4),
                                outline: showFocus ? `2px solid ${accent}` : "none",
                                outlineOffset: 1,
                                whiteSpace: multiline ? "pre-wrap" : "nowrap",
                                wordBreak: "break-word",
                                minHeight: multiline ? LINE * 2 + PAD_Y * 2 + 2 : undefined,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                transition: "background 140ms",
                            }}
                        >
                            {value || placeholder}
                        </button>
                    )}
                    <motion.span
                        key={flash}
                        aria-hidden
                        initial={flash === 0 ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 0 }}
                        animate={flash === 0 ? { opacity: 0, scaleX: 0 } : { opacity: [1, 1, 0], scaleX: [0, 1, 1] }}
                        transition={{ duration: 1.3, times: [0, 0.35, 1], ease: "easeOut" }}
                        style={{
                            position: "absolute",
                            left: PAD_X,
                            right: PAD_X,
                            bottom: 1,
                            height: 2,
                            borderRadius: 2,
                            background: accent,
                            boxShadow: `0 0 10px ${accent}`,
                            transformOrigin: "0% 50%",
                            pointerEvents: "none",
                        }}
                    />
                </motion.div>

                <span aria-hidden style={multiline ? { position: "absolute", right: 9, top: 7, width: 16, height: 16 } : { position: "relative", width: 16, height: 16, flex: "0 0 16px" }}>
                    <motion.svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        initial={false}
                        animate={{ opacity: pencilOn ? 1 : 0, x: pencilOn ? 0 : -4 }}
                        transition={{ duration: 0.14 }}
                        stroke={p.faint}
                        style={{ position: "absolute", left: 1, top: 1 }}
                    >
                        <path d="M2.5 11.5l.6-2.6 6.6-6.6a1.2 1.2 0 011.7 0l.3.3a1.2 1.2 0 010 1.7l-6.6 6.6-2.6.6zM8.6 3.5l1.9 1.9" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                    <AnimatePresence>
                        {check && (
                            <motion.svg
                                key="check"
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                initial={{ opacity: 0, scale: 0.4 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.14 } }}
                                transition={POP}
                                style={{ position: "absolute", left: 0, top: 0 }}
                            >
                                <circle cx="8" cy="8" r="7" fill={accent} />
                                <motion.path
                                    d="M4.8 8.2l2.3 2.3 4.2-4.6"
                                    fill="none"
                                    stroke="#141413"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.3, delay: 0.08 }}
                                />
                            </motion.svg>
                        )}
                    </AnimatePresence>
                </span>

                {multiline ? (
                    <AnimatePresence initial={false}>
                        {undo && (
                            <motion.div
                                key={`undo-${undo.key}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 30, opacity: 1 }}
                                exit={{ height: 0, opacity: 0, transition: { duration: 0.14 } }}
                                transition={SPRING}
                                style={{ overflow: "hidden", width: "100%", display: "flex", alignItems: "center" }}
                            >
                                {undoChip}
                            </motion.div>
                        )}
                    </AnimatePresence>
                ) : (
                    <AnimatePresence>{undo && <React.Fragment key={`undo-${undo.key}`}>{undoChip}</React.Fragment>}</AnimatePresence>
                )}
            </div>
        </MotionConfig>
    )
}

export default function InlineEdit({
    value = "Redesign the onboarding flow",
    multiline = false,
    placeholder = "Add a title",
    label = "Project",
    showList = true,
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
    onChange,
}: Partial<InlineEditProps>) {
    const p = palette(theme)
    const [current, setCurrent] = React.useState(value)
    React.useEffect(() => setCurrent(value), [value])

    return (
        <div
            style={{
                width: "100%",
                maxWidth: 440,
                boxSizing: "border-box",
                padding: 18,
                border: `1px solid ${p.line}`,
                borderRadius: radius,
                background: p.surface,
                color: p.text,
                fontFamily: "inherit",
            }}
        >
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: p.faint, margin: "0 0 6px 1px" }}>{label}</div>
            <Editable
                value={current}
                onCommit={(next) => {
                    setCurrent(next)
                    onChange?.(next)
                }}
                multiline={multiline}
                placeholder={placeholder}
                label={label}
                accent={accent}
                radius={radius}
                p={p}
            />
            {showList && (
                <div role="list" aria-label="Profile" style={{ marginTop: 16, borderTop: `1px solid ${p.line}` }}>
                    {ROWS.map((r) => (
                        <div
                            key={r.label}
                            role="listitem"
                            style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 42, borderBottom: `1px solid ${p.line}` }}
                        >
                            <span style={{ flex: "0 0 74px", fontSize: 12, fontWeight: 500, color: p.faint }}>{r.label}</span>
                            <Editable
                                value={r.value}
                                onCommit={() => undefined}
                                multiline={false}
                                placeholder={r.placeholder}
                                label={r.label}
                                accent={accent}
                                radius={radius}
                                p={p}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

addPropertyControls(InlineEdit, {
    value: { type: ControlType.String, title: "Value", defaultValue: "Redesign the onboarding flow" },
    multiline: { type: ControlType.Boolean, title: "Multiline", defaultValue: false },
    placeholder: { type: ControlType.String, title: "Placeholder", defaultValue: "Add a title" },
    label: { type: ControlType.String, title: "Label", defaultValue: "Project" },
    showList: { type: ControlType.Boolean, title: "Show rows", defaultValue: true },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 28 },
    onChange: { type: ControlType.EventHandler },
})

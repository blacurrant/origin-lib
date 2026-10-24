import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig } from "framer-motion"

/**
 * DataTable: a sortable table with row selection. Click a column header to
 * sort ascending, again for descending, again to clear. Sort state is exposed
 * with `aria-sort`, and the selection count is announced.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 560
 * @framerIntrinsicHeight 320
 */

type Theme = "dark" | "light"

interface Row {
    customer: string
    plan: string
    status: string
    mrr: number
}

interface DataTableProps {
    rows: Row[]
    selectable: boolean
    density: "compact" | "comfortable"
    accent: string
    theme: Theme
    radius: number
}

type SortKey = "customer" | "plan" | "status" | "mrr"
type Dir = "asc" | "desc"

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        head: dark ? "#161718" : "#f6f4f0",
        hover: dark ? "#202223" : "#f6f4f0",
        selected: dark ? "#241f1b" : "#fdf3ea",
        line: dark ? "#2d2d2f" : "#e4e1db",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#b7b7b8" : "#5c5a55",
        faint: dark ? "#8a8c8f" : "#76736d",
        statuses: {
            Active: dark ? "#3dd68c" : "#12794a",
            Trial: dark ? "#f5b14a" : "#9a5b00",
            Churned: dark ? "#ff7a70" : "#c42a1d",
        } as Record<string, string>,
    }
}

const ROWS: Row[] = [
    { customer: "Acme Corp", plan: "Team", status: "Active", mrr: 1240 },
    { customer: "Northwind", plan: "Business", status: "Active", mrr: 4800 },
    { customer: "Globex", plan: "Team", status: "Trial", mrr: 0 },
    { customer: "Initech", plan: "Starter", status: "Churned", mrr: 0 },
    { customer: "Umbrella", plan: "Business", status: "Active", mrr: 3150 },
    { customer: "Hooli", plan: "Starter", status: "Trial", mrr: 0 },
]

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "customer", label: "Customer" },
    { key: "plan", label: "Plan" },
    { key: "status", label: "Status" },
    { key: "mrr", label: "MRR", align: "right" },
]

export default function DataTable({
    rows = ROWS,
    selectable = true,
    density = "comfortable",
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
}: Partial<DataTableProps>) {
    const p = palette(theme)
    const data = rows.map((r) => ({
        customer: r.customer ?? "",
        plan: r.plan ?? "",
        status: r.status ?? "",
        mrr: Number(r.mrr) || 0,
    }))
    const [sort, setSort] = React.useState<{ key: SortKey; dir: Dir } | null>({ key: "mrr", dir: "desc" })
    const [picked, setPicked] = React.useState<Set<number>>(() => new Set([0]))
    const lastRows = React.useRef(rows)
    const [focused, setFocused] = React.useState<string | null>(null)
    const allRef = React.useRef<HTMLInputElement | null>(null)

    const order = React.useMemo(() => {
        const idx = data.map((_, i) => i)
        if (!sort) return idx
        const sign = sort.dir === "asc" ? 1 : -1
        return idx.sort((a, b) => {
            const x = data[a][sort.key]
            const y = data[b][sort.key]
            const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))
            return cmp * sign || a - b
        })
    }, [data, sort])

    // Only rows that exist count, so an empty table never reports a selection.
    const count = [...picked].filter((i) => i < data.length).length
    const everyPicked = data.length > 0 && count === data.length
    React.useEffect(() => {
        if (allRef.current) allRef.current.indeterminate = count > 0 && !everyPicked
    }, [count, everyPicked])
    React.useEffect(() => {
        // The first row starts selected so the selected state is visible. Clear only when the rows prop changes.
        if (lastRows.current === rows) return
        lastRows.current = rows
        setPicked(new Set())
    }, [rows])

    const cycle = (key: SortKey) =>
        setSort((s) => (!s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null))

    const toggle = (i: number) =>
        setPicked((s) => {
            const next = new Set(s)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
        })

    const padY = density === "compact" ? 8 : 13
    const cell: React.CSSProperties = { padding: `${padY}px 14px`, fontSize: 13.5, borderTop: `1px solid ${p.line}` }
    const ring = (k: string): React.CSSProperties => (focused === k ? { outline: `2px solid ${accent}`, outlineOffset: -2 } : {})
    const bind = (k: string) => ({
        onFocus: (e: React.FocusEvent<HTMLElement>) => setFocused(e.currentTarget.matches(":focus-visible") ? k : null),
        onBlur: () => setFocused(null),
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
                    colorScheme: theme === "light" ? "light" : "dark",
                }}
            >
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 440, borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                            <tr style={{ background: p.head }}>
                                {selectable && (
                                    <th scope="col" style={{ width: 44, padding: "0 0 0 14px" }}>
                                        <input
                                            ref={allRef}
                                            type="checkbox"
                                            aria-label="Select all rows"
                                            checked={everyPicked}
                                            onChange={() => setPicked(everyPicked ? new Set() : new Set(data.map((_, i) => i)))}
                                            {...bind("all")}
                                            style={{ accentColor: accent, width: 16, height: 16, margin: 0, verticalAlign: "middle", ...ring("all") }}
                                        />
                                    </th>
                                )}
                                {COLUMNS.map((c) => {
                                    const on = sort?.key === c.key
                                    return (
                                        <th
                                            key={c.key}
                                            scope="col"
                                            aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                                            style={{ padding: 0, textAlign: c.align ?? "left" }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => cycle(c.key)}
                                                {...bind(c.key)}
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    width: "100%",
                                                    justifyContent: c.align === "right" ? "flex-end" : "flex-start",
                                                    padding: "11px 14px",
                                                    border: "none",
                                                    background: "none",
                                                    color: on ? p.text : p.faint,
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    letterSpacing: "0.02em",
                                                    fontFamily: "inherit",
                                                    cursor: "pointer",
                                                    ...ring(c.key),
                                                }}
                                            >
                                                {c.label}
                                                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ opacity: on ? 1 : 0.4, color: on ? (theme === "light" ? `color-mix(in srgb, ${accent} 62%, #141413)` : accent) : "currentColor" }}>
                                                    <path
                                                        d={on && sort!.dir === "desc" ? "M2 3.5 5 7l3-3.5" : on ? "M2 6.5 5 3l3 3.5" : "M2 4 5 1.5 8 4M2 6 5 8.5 8 6"}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.3"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {order.map((i) => {
                                const r = data[i]
                                const on = picked.has(i)
                                return (
                                    <tr key={i} aria-selected={selectable ? on : undefined} style={{ background: on ? `color-mix(in srgb, ${accent} 13%, ${p.surface})` : "transparent" }}>
                                        {selectable && (
                                            <td style={{ ...cell, width: 44, paddingRight: 0 }}>
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${r.customer}`}
                                                    checked={on}
                                                    onChange={() => toggle(i)}
                                                    {...bind(`row-${i}`)}
                                                    style={{ accentColor: accent, width: 16, height: 16, margin: 0, verticalAlign: "middle", ...ring(`row-${i}`) }}
                                                />
                                            </td>
                                        )}
                                        <td style={{ ...cell, fontWeight: 500 }}>{r.customer}</td>
                                        <td style={{ ...cell, color: p.soft }}>{r.plan}</td>
                                        <td style={cell}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: p.statuses[r.status] ?? p.soft }}>
                                                <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                                                {r.status}
                                            </span>
                                        </td>
                                        <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.mrr ? p.text : p.faint }}>
                                            {r.mrr ? `$${r.mrr.toLocaleString("en-US")}` : "—"}
                                        </td>
                                    </tr>
                                )
                            })}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={selectable ? 5 : 4} style={{ ...cell, textAlign: "center", color: p.faint, padding: "28px 14px" }}>
                                        No customers match.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {selectable && (
                    <div
                        aria-live="polite"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 14px",
                            borderTop: `1px solid ${p.line}`,
                            background: p.head,
                            fontSize: 12.5,
                            color: p.faint,
                        }}
                    >
                        <span>{count ? `${count} of ${data.length} selected` : `${data.length} customers`}</span>
                        {count > 0 && (
                            <button
                                type="button"
                                onClick={() => setPicked(new Set())}
                                {...bind("clear")}
                                style={{
                                    border: "none",
                                    background: "none",
                                    padding: "2px 4px",
                                    color: p.soft,
                                    fontSize: 12.5,
                                    fontWeight: 500,
                                    fontFamily: "inherit",
                                    textDecoration: "underline",
                                    textUnderlineOffset: 3,
                                    cursor: "pointer",
                                    ...ring("clear"),
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                )}
            </div>
        </MotionConfig>
    )
}

addPropertyControls(DataTable, {
    rows: {
        type: ControlType.Array,
        title: "Rows",
        control: {
            type: ControlType.Object,
            controls: {
                customer: { type: ControlType.String, title: "Customer", defaultValue: "" },
                plan: { type: ControlType.String, title: "Plan", defaultValue: "Team" },
                status: { type: ControlType.String, title: "Status", defaultValue: "Active" },
                mrr: { type: ControlType.Number, title: "MRR", defaultValue: 0, min: 0, max: 100000 },
            },
        },
        defaultValue: ROWS,
    },
    selectable: { type: ControlType.Boolean, title: "Selectable", defaultValue: true },
    density: {
        type: ControlType.Enum,
        title: "Density",
        options: ["compact", "comfortable"],
        optionTitles: ["Compact", "Comfortable"],
        defaultValue: "comfortable",
    },
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

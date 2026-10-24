import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * PricingTable: plans side by side with a monthly and annual switch. The
 * annual price is the monthly price minus the discount, and the card says what
 * is billed. One plan is highlighted. Plans stack on narrow widths.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 760
 * @framerIntrinsicHeight 460
 */

type Theme = "dark" | "light"
type Billing = "monthly" | "annual"

interface Plan {
    name: string
    price: number
    description: string
    features: string
    cta: string
}

interface PricingTableProps {
    plans: Plan[]
    defaultBilling: Billing
    discount: number
    currency: string
    highlight: number
    accent: string
    theme: Theme
    radius: number
    onSelect?: () => void
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        track: dark ? "#141415" : "#ece9e3",
        pill: dark ? "#2d2f30" : "#ffffff",
        pillLine: dark ? "#3e3f40" : "#d8d4cc",
        raised: dark ? "#262829" : "#f1efeb",
        line: dark ? "#2d2d2f" : "#e4e1db",
        strong: dark ? "#3e3f40" : "#c9c5bc",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#b7b7b8" : "#5c5a55",
        faint: dark ? "#8a8c8f" : "#76736d",
        success: dark ? "#3dd68c" : "#12794a",
    }
}

const PLANS: Plan[] = [
    { name: "Starter", price: 0, description: "For side projects and trying things out.", features: "1 project; 100 GB bandwidth; Community support", cta: "Start free" },
    { name: "Team", price: 24, description: "For small teams shipping every week.", features: "Unlimited projects; 1 TB bandwidth; Shared environment variables; Audit history", cta: "Start 14-day trial" },
    { name: "Business", price: 99, description: "For companies that need control.", features: "Everything in Team; SSO and SCIM; 99.99% uptime SLA; Priority support", cta: "Talk to sales" },
]

export default function PricingTable({
    plans = PLANS,
    defaultBilling = "monthly",
    discount = 20,
    currency = "$",
    highlight = 1,
    accent = "#fa7319",
    theme = "dark",
    radius = 14,
    onSelect,
}: Partial<PricingTableProps>) {
    const p = palette(theme)
    const list = (plans.length ? plans : PLANS).map((pl) => ({
        name: pl.name ?? "",
        price: Number(pl.price) || 0,
        description: pl.description ?? "",
        features: String(pl.features ?? "").split(";").map((f) => f.trim()).filter(Boolean),
        cta: pl.cta ?? "Choose plan",
    }))
    const uid = React.useId()
    const [billing, setBilling] = React.useState<Billing>(defaultBilling)
    const [focused, setFocused] = React.useState<string | null>(null)
    React.useEffect(() => setBilling(defaultBilling), [defaultBilling])
    const annual = billing === "annual"
    const bind = (k: string) => ({
        onFocus: (e: React.FocusEvent<HTMLElement>) => setFocused(e.currentTarget.matches(":focus-visible") ? k : null),
        onBlur: () => setFocused(null),
    })
    const ring = (k: string): React.CSSProperties => (focused === k ? { outline: `2px solid ${accent}`, outlineOffset: 2 } : {})
    const refs = React.useRef<(HTMLButtonElement | null)[]>([])
    const options: { value: Billing; label: string }[] = [
        { value: "monthly", label: "Monthly" },
        { value: "annual", label: "Annual" },
    ]
    const onKey = (e: React.KeyboardEvent) => {
        const at = options.findIndex((o) => o.value === billing)
        let next = at
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (at + 1) % options.length
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (at - 1 + options.length) % options.length
        else return
        e.preventDefault()
        setBilling(options[next].value)
        refs.current[next]?.focus()
    }

    const priceFor = (base: number) => (annual ? Math.round(base * (1 - Math.min(Math.max(discount, 0), 90) / 100)) : base)

    return (
        <MotionConfig reducedMotion="user">
            <div style={{ width: "100%", fontFamily: "inherit", color: p.text }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
                    <div role="radiogroup" aria-label="Billing period" onKeyDown={onKey} style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 999, background: p.track }}>
                        {options.map((o, i) => {
                            const on = o.value === billing
                            return (
                                <button
                                    key={o.value}
                                    ref={(el) => {
                                        refs.current[i] = el
                                    }}
                                    type="button"
                                    role="radio"
                                    aria-checked={on}
                                    tabIndex={on ? 0 : -1}
                                    onClick={() => setBilling(o.value)}
                                    {...bind(`bill-${o.value}`)}
                                    style={{ position: "relative", height: 30, padding: "0 16px", border: "none", borderRadius: 999, background: "none", color: on ? p.text : p.soft, fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", ...ring(`bill-${o.value}`) }}
                                >
                                    {on && (
                                        <motion.span
                                            layoutId={`pricing-pill-${uid}`}
                                            transition={{ type: "spring", stiffness: 520, damping: 38 }}
                                            style={{ position: "absolute", inset: 0, borderRadius: 999, background: p.pill, border: `1px solid ${p.pillLine}`, zIndex: 0 }}
                                        />
                                    )}
                                    <span style={{ position: "relative", zIndex: 1 }}>{o.label}</span>
                                </button>
                            )
                        })}
                    </div>
                    {discount > 0 && (
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: annual ? p.success : p.faint }}>Save {discount}% with annual billing</span>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(164px, 1fr))", gap: 14, alignItems: "stretch" }}>
                    {list.map((pl, i) => {
                        const featured = i === highlight
                        const price = priceFor(pl.price)
                        return (
                            <section
                                key={`${pl.name}-${i}`}
                                aria-label={`${pl.name} plan`}
                                style={{
                                    position: "relative",
                                    display: "flex",
                                    flexDirection: "column",
                                    padding: 22,
                                    borderRadius: radius,
                                    borderWidth: featured ? 1.5 : 1,
                                    borderStyle: "solid",
                                    borderColor: featured ? accent : p.line,
                                    background: p.surface,
                                    boxSizing: "border-box",
                                }}
                            >
                                {featured && (
                                    <span style={{ position: "absolute", top: -11, left: 20, padding: "2px 9px", borderRadius: 999, background: accent, color: "#141413", fontSize: 11.5, fontWeight: 600 }}>
                                        Most popular
                                    </span>
                                )}
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em" }}>{pl.name}</h3>
                                <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.5, color: p.soft, minHeight: 40 }}>{pl.description}</p>
                                <div style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 6 }}>
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.span
                                            key={`${billing}-${price}`}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.12 }}
                                            style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}
                                        >
                                            {price === 0 ? "Free" : `${currency}${price}`}
                                        </motion.span>
                                    </AnimatePresence>
                                    {price > 0 && <span style={{ fontSize: 13.5, color: p.faint }}>/ month</span>}
                                </div>
                                <div style={{ marginTop: 2, minHeight: 18, fontSize: 12.5, color: p.faint }}>
                                    {price > 0 ? (annual ? `Billed ${currency}${price * 12} per year` : "Billed monthly") : "No card needed"}
                                </div>
                                <button
                                    type="button"
                                    onClick={onSelect}
                                    {...bind(`cta-${i}`)}
                                    style={{
                                        marginTop: 18,
                                        height: 38,
                                        borderRadius: Math.max(radius - 6, 6),
                                        border: featured ? "1px solid transparent" : `1px solid ${p.strong}`,
                                        background: featured ? accent : p.raised,
                                        color: featured ? "#141413" : p.text,
                                        fontSize: 14,
                                        fontWeight: 500,
                                        fontFamily: "inherit",
                                        cursor: "pointer",
                                        ...ring(`cta-${i}`),
                                    }}
                                >
                                    {pl.cta}
                                </button>
                                <ul style={{ margin: "20px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                                    {pl.features.map((f) => (
                                        <li key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.45, color: p.soft }}>
                                            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ marginTop: 2, flexShrink: 0, color: p.success }}>
                                                <path d="M2.8 7.4 5.6 10.2 11.2 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )
                    })}
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(PricingTable, {
    plans: {
        type: ControlType.Array,
        title: "Plans",
        control: {
            type: ControlType.Object,
            controls: {
                name: { type: ControlType.String, title: "Name", defaultValue: "Plan" },
                price: { type: ControlType.Number, title: "Monthly price", defaultValue: 0, min: 0, max: 9999 },
                description: { type: ControlType.String, title: "Description", defaultValue: "" },
                features: { type: ControlType.String, title: "Features (split with ;)", defaultValue: "", displayTextArea: true },
                cta: { type: ControlType.String, title: "Button", defaultValue: "Choose plan" },
            },
        },
        defaultValue: PLANS,
    },
    defaultBilling: {
        type: ControlType.Enum,
        title: "Billing",
        options: ["monthly", "annual"],
        optionTitles: ["Monthly", "Annual"],
        defaultValue: "monthly",
    },
    discount: { type: ControlType.Number, title: "Annual discount (%)", defaultValue: 20, min: 0, max: 60 },
    currency: { type: ControlType.String, title: "Currency", defaultValue: "$" },
    highlight: { type: ControlType.Number, title: "Highlight plan #", defaultValue: 1, min: 0, max: 5 },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 14, min: 0, max: 28 },
    onSelect: { type: ControlType.EventHandler, title: "On select" },
})

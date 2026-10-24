import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * SignInForm: a sign-in or sign-up form with validation that explains itself.
 * Errors appear on submit, attach to their field, and focus moves to the first
 * one. The submit button shows progress while it works. Nothing is sent
 * anywhere: it ends in a success state so you can wire up your own handler.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 380
 * @framerIntrinsicHeight 460
 */

type Theme = "dark" | "light"

interface SignInFormProps {
    mode: "signin" | "signup"
    title: string
    subtitle: string
    providerLabel: string
    showProvider: boolean
    submitLabel: string
    accent: string
    theme: Theme
    radius: number
    onSubmit?: () => void
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        field: dark ? "#141415" : "#ffffff",
        raised: dark ? "#262829" : "#f1efeb",
        line: dark ? "#2d2d2f" : "#e4e1db",
        strong: dark ? "#3e3f40" : "#c9c5bc",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#b7b7b8" : "#5c5a55",
        faint: dark ? "#8a8c8f" : "#76736d",
        danger: dark ? "#ff7a70" : "#c42a1d",
        success: dark ? "#3dd68c" : "#12794a",
    }
}

type Errors = Partial<Record<"name" | "email" | "password", string>>

export default function SignInForm({
    mode = "signin",
    title = "",
    subtitle = "",
    providerLabel = "Continue with Google",
    showProvider = true,
    submitLabel = "",
    accent = "#fa7319",
    theme = "dark",
    radius = 12,
    onSubmit,
}: Partial<SignInFormProps>) {
    const p = palette(theme)
    const uid = React.useId()
    const signup = mode === "signup"
    const heading = title || (signup ? "Create your account" : "Welcome back")
    const sub = subtitle || (signup ? "Free for 14 days. No card needed." : "Sign in to continue to your workspace.")
    const cta = submitLabel || (signup ? "Create account" : "Sign in")

    const [name, setName] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [reveal, setReveal] = React.useState(false)
    const [errors, setErrors] = React.useState<Errors>({})
    const [busy, setBusy] = React.useState(false)
    const [done, setDone] = React.useState(false)
    const [focused, setFocused] = React.useState<string | null>(null)
    const [ringed, setRinged] = React.useState<string | null>(null)
    const refs = { name: React.useRef<HTMLInputElement | null>(null), email: React.useRef<HTMLInputElement | null>(null), password: React.useRef<HTMLInputElement | null>(null) }
    const timer = React.useRef<number | null>(null)
    React.useEffect(() => () => {
        if (timer.current !== null) window.clearTimeout(timer.current)
    }, [])
    React.useEffect(() => {
        setErrors({})
        setDone(false)
    }, [mode])

    const validate = (): Errors => {
        const e: Errors = {}
        if (signup && !name.trim()) e.name = "Enter your name."
        if (!email.trim()) e.email = "Enter your email address."
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "That doesn't look like an email address."
        if (!password) e.password = "Enter your password."
        else if (signup && password.length < 8) e.password = "Use at least 8 characters."
        return e
    }

    const submit = (ev: React.FormEvent) => {
        ev.preventDefault()
        if (busy) return
        const e = validate()
        setErrors(e)
        const firstBad = (["name", "email", "password"] as const).find((k) => e[k])
        if (firstBad) {
            refs[firstBad].current?.focus()
            return
        }
        setBusy(true)
        timer.current = window.setTimeout(() => {
            setBusy(false)
            setDone(true)
            onSubmit?.()
        }, 900)
    }

    const field = (key: "name" | "email" | "password", label: string, type: string, autoComplete: string, value: string, set: (v: string) => void, placeholder: string) => {
        const err = errors[key]
        const id = `${uid}-${key}`
        const isPassword = key === "password"
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500 }}>
                    {label}
                </label>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        height: 38,
                        borderRadius: Math.max(radius - 4, 6),
                        border: `1px solid ${err ? p.danger : focused === key ? accent : p.strong}`,
                        boxShadow: focused === key ? `0 0 0 3px color-mix(in srgb, ${err ? p.danger : accent} 26%, transparent)` : "none",
                        background: p.field,
                    }}
                >
                    <input
                        ref={refs[key]}
                        id={id}
                        type={isPassword && reveal ? "text" : type}
                        autoComplete={autoComplete}
                        value={value}
                        placeholder={placeholder}
                        aria-invalid={err ? true : undefined}
                        aria-describedby={err ? `${id}-err` : undefined}
                        onChange={(e) => set(e.target.value)}
                        onFocus={() => setFocused(key)}
                        onBlur={() => setFocused(null)}
                        style={{ flex: 1, minWidth: 0, height: "100%", padding: "0 12px", border: "none", outline: "none", background: "transparent", color: p.text, fontSize: 14, fontFamily: "inherit" }}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            aria-pressed={reveal}
                            onClick={() => setReveal((v) => !v)}
                            onFocus={(e) => setRinged(e.currentTarget.matches(":focus-visible") ? "reveal" : null)}
                            onBlur={() => setRinged(null)}
                            style={{ height: "100%", padding: "0 12px", border: "none", background: "none", color: p.soft, fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", outline: ringed === "reveal" ? `2px solid ${accent}` : "none", outlineOffset: -2, borderRadius: 6 }}
                        >
                            {reveal ? "Hide" : "Show"}
                        </button>
                    )}
                </div>
                {err ? (
                    <span id={`${id}-err`} role="alert" style={{ fontSize: 12.5, color: p.danger }}>
                        {err}
                    </span>
                ) : null}
            </div>
        )
    }

    const buttonBase: React.CSSProperties = {
        width: "100%",
        height: 40,
        borderRadius: Math.max(radius - 4, 6),
        fontSize: 14,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
    }
    const ring = (k: string): React.CSSProperties => (ringed === k ? { outline: `2px solid ${accent}`, outlineOffset: 2 } : {})
    const bindRing = (k: string) => ({
        onFocus: (e: React.FocusEvent<HTMLElement>) => setRinged(e.currentTarget.matches(":focus-visible") ? k : null),
        onBlur: () => setRinged(null),
    })

    return (
        <MotionConfig reducedMotion="user">
            <div
                style={{
                    width: "100%",
                    padding: 28,
                    borderRadius: radius,
                    border: `1px solid ${p.line}`,
                    background: p.surface,
                    color: p.text,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {done ? (
                        <motion.div key="done" role="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} style={{ textAlign: "center", padding: "20px 0" }}>
                            <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden style={{ color: p.success }}>
                                <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M11 18.4 16 23l9-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div style={{ marginTop: 14, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>{signup ? "Account created" : "You're signed in"}</div>
                            <p style={{ margin: "6px 0 0", fontSize: 14, color: p.soft }}>{email}</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setDone(false)
                                    setPassword("")
                                }}
                                {...bindRing("back")}
                                style={{ marginTop: 18, border: "none", background: "none", color: p.soft, fontSize: 13, fontWeight: 500, fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", ...ring("back") }}
                            >
                                Back to the form
                            </button>
                        </motion.div>
                    ) : (
                        <motion.form key="form" noValidate onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em" }}>{heading}</h2>
                                <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: p.soft }}>{sub}</p>
                            </div>

                            {showProvider && (
                                <>
                                    <button type="button" {...bindRing("provider")} style={{ ...buttonBase, border: `1px solid ${p.strong}`, background: p.raised, color: p.text, ...ring("provider") }}>
                                        {providerLabel}
                                    </button>
                                    <div aria-hidden style={{ display: "flex", alignItems: "center", gap: 12, color: p.faint, fontSize: 12 }}>
                                        <span style={{ flex: 1, height: 1, background: p.line }} />
                                        or
                                        <span style={{ flex: 1, height: 1, background: p.line }} />
                                    </div>
                                </>
                            )}

                            {signup && field("name", "Full name", "text", "name", name, setName, "Ada Lovelace")}
                            {field("email", "Email", "email", "email", email, setEmail, "name@company.com")}
                            {field("password", "Password", "password", signup ? "new-password" : "current-password", password, setPassword, signup ? "At least 8 characters" : "Your password")}

                            {!signup && (
                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -6 }}>
                                    <button type="button" {...bindRing("forgot")} style={{ border: "none", background: "none", padding: "2px 0", color: p.soft, fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, ...ring("forgot") }}>
                                        Forgot password?
                                    </button>
                                </div>
                            )}

                            <button
                                type="submit"
                                aria-busy={busy || undefined}
                                aria-disabled={busy || undefined}
                                {...bindRing("submit")}
                                style={{ ...buttonBase, border: "1px solid transparent", background: accent, color: "#141413", cursor: busy ? "progress" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, ...ring("submit") }}
                            >
                                {busy && (
                                    <motion.span
                                        aria-hidden
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                                        style={{ width: 13, height: 13, borderRadius: "50%", borderWidth: 1.5, borderStyle: "solid", borderTopColor: "currentColor", borderLeftColor: "currentColor", borderBottomColor: "currentColor", borderRightColor: "transparent", display: "inline-block" }}
                                    />
                                )}
                                {busy ? (signup ? "Creating account" : "Signing in") : cta}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(SignInForm, {
    mode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["signin", "signup"],
        optionTitles: ["Sign in", "Sign up"],
        defaultValue: "signin",
    },
    title: { type: ControlType.String, title: "Title", defaultValue: "", placeholder: "Uses the mode's default" },
    subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "", placeholder: "Uses the mode's default" },
    providerLabel: { type: ControlType.String, title: "Provider label", defaultValue: "Continue with Google" },
    showProvider: { type: ControlType.Boolean, title: "Show provider", defaultValue: true },
    submitLabel: { type: ControlType.String, title: "Submit label", defaultValue: "", placeholder: "Uses the mode's default" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 12, min: 0, max: 28 },
    onSubmit: { type: ControlType.EventHandler, title: "On submit" },
})

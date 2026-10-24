import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * ApprovalCard: asks the user to approve or reject an action before an agent
 * runs it. It says what will happen, to what, and how risky it is, and nothing
 * runs until the user decides. After deciding, the choice stays visible and
 * can be changed until the agent has acted.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 420
 * @framerIntrinsicHeight 190
 */

type Theme = "dark" | "light"
type Risk = "low" | "medium" | "high"
type Decision = "pending" | "approved" | "rejected"

interface ApprovalCardProps {
    action: string
    details: string
    risk: Risk
    accent: string
    theme: Theme
    onApprove?: () => void
    onReject?: () => void
}

function palette(theme: Theme) {
    const dark = theme !== "light"
    return {
        surface: dark ? "#1b1c1d" : "#ffffff",
        raised: dark ? "#262829" : "#f1efeb",
        line: dark ? "#2d2d2f" : "#e4e1db",
        strong: dark ? "#3e3f40" : "#c9c5bc",
        text: dark ? "#f7f7f7" : "#141413",
        soft: dark ? "#b7b7b8" : "#5c5a55",
        faint: dark ? "#8a8c8f" : "#76736d",
        success: dark ? "#3dd68c" : "#12794a",
        danger: dark ? "#ff7a70" : "#c42a1d",
        risk: {
            low: dark ? "#3dd68c" : "#12794a",
            medium: dark ? "#f5b14a" : "#9a5b00",
            high: dark ? "#ff7a70" : "#c42a1d",
        } as Record<Risk, string>,
    }
}

const RISK_LABEL: Record<Risk, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" }

export default function ApprovalCard({
    action = "Email 214 customers about the price change",
    details = "Subject: Your plan is changing on Nov 1. Sent from billing@acme.com. Recipients are every customer on the Team plan.",
    risk = "medium",
    accent = "#fa7319",
    theme = "dark",
    onApprove,
    onReject,
}: Partial<ApprovalCardProps>) {
    const p = palette(theme)
    const [decision, setDecision] = React.useState<Decision>("pending")

    const decide = (next: Decision) => {
        setDecision(next)
        if (next === "approved") onApprove?.()
        if (next === "rejected") onReject?.()
    }

    const btn: React.CSSProperties = {
        height: 34,
        padding: "0 14px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                role="group"
                aria-label="Approval request"
                style={{
                    width: "100%",
                    padding: 16,
                    borderRadius: 12,
                    background: p.surface,
                    border: `1px solid ${p.line}`,
                    color: p.text,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 12 }}>
                    <span style={{ fontWeight: 500, color: p.soft }}>Approval needed</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500, color: p.risk[risk] ?? p.soft }}>
                        <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                        {RISK_LABEL[risk] ?? RISK_LABEL.medium}
                    </span>
                </div>
                <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.3 }}>{action}</div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, color: p.soft }}>{details}</div>

                <div style={{ marginTop: 16, minHeight: 34 }}>
                    <AnimatePresence mode="wait" initial={false}>
                        {decision === "pending" ? (
                            <motion.div
                                key="choose"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                                style={{ display: "flex", gap: 8 }}
                            >
                                <button
                                    type="button"
                                    onClick={() => decide("approved")}
                                    style={{ ...btn, background: accent, color: "#141413", border: "1px solid transparent" }}
                                >
                                    Approve
                                </button>
                                <button
                                    type="button"
                                    onClick={() => decide("rejected")}
                                    style={{ ...btn, background: p.raised, color: p.text, border: `1px solid ${p.strong}` }}
                                >
                                    Reject
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="decided"
                                role="status"
                                initial={{ opacity: 0, y: 3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, height: 34 }}
                            >
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: decision === "approved" ? p.success : p.danger,
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                                        <path
                                            d={decision === "approved" ? "M2.8 7.4 5.6 10.2 11.2 4" : "M3.8 3.8l6.4 6.4M10.2 3.8l-6.4 6.4"}
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.7"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    {decision === "approved" ? "Approved. The agent will send it." : "Rejected. Nothing was sent."}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setDecision("pending")}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        padding: "4px 2px",
                                        color: p.soft,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        fontFamily: "inherit",
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                        textUnderlineOffset: 3,
                                    }}
                                >
                                    Change
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </MotionConfig>
    )
}

addPropertyControls(ApprovalCard, {
    action: { type: ControlType.String, title: "Action", defaultValue: "Email 214 customers about the price change" },
    details: {
        type: ControlType.String,
        title: "Details",
        defaultValue:
            "Subject: Your plan is changing on Nov 1. Sent from billing@acme.com. Recipients are every customer on the Team plan.",
        displayTextArea: true,
    },
    risk: {
        type: ControlType.Enum,
        title: "Risk",
        options: ["low", "medium", "high"],
        optionTitles: ["Low", "Medium", "High"],
        defaultValue: "medium",
    },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    onApprove: { type: ControlType.EventHandler, title: "On approve" },
    onReject: { type: ControlType.EventHandler, title: "On reject" },
})

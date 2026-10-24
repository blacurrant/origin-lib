import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { MotionConfig, motion } from "framer-motion"

/**
 * AgentStatus: what an agent is doing right now. Each state has its own label
 * and color, and active states pulse so the user can tell work is happening.
 * Never rely on the color alone: the label always carries the meaning.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 140
 * @framerIntrinsicHeight 22
 */

type Theme = "dark" | "light"
type State = "idle" | "thinking" | "waiting" | "error"

interface AgentStatusProps {
    state: State
    label: string
    accent: string
    theme: Theme
}

const LABELS: Record<State, string> = {
    idle: "Idle",
    thinking: "Working",
    waiting: "Needs your input",
    error: "Run failed",
}

export default function AgentStatus({
    state = "thinking",
    label = "",
    accent = "#fa7319",
    theme = "dark",
}: Partial<AgentStatusProps>) {
    const dark = theme !== "light"
    const colors: Record<State, string> = {
        idle: dark ? "#8a8c8f" : "#76736d",
        thinking: accent,
        waiting: dark ? "#f5b14a" : "#9a5b00",
        error: dark ? "#ff7a70" : "#c42a1d",
    }
    const color = colors[state] ?? colors.idle
    const active = state === "thinking" || state === "waiting"

    return (
        <MotionConfig reducedMotion="user">
            <div
                role="status"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 500,
                    color: dark ? "#f7f7f7" : "#141413",
                }}
            >
                <span style={{ position: "relative", width: 8, height: 8, display: "inline-block" }}>
                    {active && (
                        <motion.span
                            aria-hidden
                            animate={{ scale: [1, 2.4], opacity: [0.45, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                            style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }}
                        />
                    )}
                    <motion.span
                        aria-hidden
                        animate={{ backgroundColor: color }}
                        transition={{ duration: 0.16 }}
                        style={{ position: "absolute", inset: 0, borderRadius: "50%" }}
                    />
                </span>
                {label || LABELS[state] || LABELS.idle}
            </div>
        </MotionConfig>
    )
}

addPropertyControls(AgentStatus, {
    state: {
        type: ControlType.Enum,
        title: "State",
        options: ["idle", "thinking", "waiting", "error"],
        optionTitles: ["Idle", "Working", "Needs input", "Failed"],
        defaultValue: "thinking",
    },
    label: { type: ControlType.String, title: "Label", defaultValue: "", placeholder: "Uses the state's default" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
})

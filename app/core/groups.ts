/** Entries built for each component type, in display order. */
export const BUILT_BY_GROUP: Record<string, string[]> = {
  foundations: ["button", "badge"],
  forms: ["text-input", "switch", "checkbox", "segmented-control"],
  navigation: ["tabs", "dropdown-menu"],
  overlays: ["dialog", "tooltip"],
  feedback: ["toast", "alert"],
  data: ["card", "data-table"],
  layout: ["split-pane", "scroll-area"],
  media: ["carousel", "image-viewer"],
  patterns: ["sign-in-form", "pricing-table"],
  "agent-core": [
    "message-bubble",
    "chat-thread",
    "streaming-text",
    "prompt-composer",
    "reasoning-trace",
    "tool-call-card",
    "suggestion-chips",
  ],
  "agent-control": ["approval-card", "plan-list", "agent-status"],
  "agent-work": ["diff-review", "terminal-output"],
};

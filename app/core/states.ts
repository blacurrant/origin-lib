/** Per-component layout hints and the "all states" strip shown under each preview. */

export type Meta = {
  /** Fill the stage width (cards, threads) instead of centering at natural size. */
  block?: boolean;
  /** Stage width slider for block demos: default, min, max in px. */
  width?: { def: number; min: number; max: number };
  /** Minimum stage height in px, for demos that open popups. */
  minHeight?: number;
  /** Align the demo to the top of the stage instead of the middle. */
  top?: boolean;
  /** Label for a button that remounts the demo (state that ends on its own). */
  replay?: string;
  /** Keys the demo handles itself. */
  exclude?: string[];
};

export const META: Record<string, Meta> = {
  "text-input": { block: true },
  tabs: { block: true },
  dialog: { exclude: ["open"] },
  toast: { block: true, replay: "Replay" },
  card: { block: true },
  "message-bubble": { block: true },
  "chat-thread": { block: true },
  "streaming-text": { block: true, replay: "Replay" },
  "prompt-composer": { block: true },
  "reasoning-trace": { block: true },
  "tool-call-card": { block: true },
  "approval-card": { block: true, replay: "Reset decision" },
  "plan-list": { block: true },
  "dropdown-menu": { minHeight: 320, top: true },
  tooltip: { minHeight: 240 },
  alert: { block: true, replay: "Show again", width: { def: 460, min: 300, max: 560 } },
  "data-table": { block: true, width: { def: 600, min: 420, max: 760 } },
  "split-pane": { block: true, width: { def: 560, min: 360, max: 760 } },
  "scroll-area": { block: true, width: { def: 380, min: 280, max: 560 } },
  carousel: { block: true, width: { def: 480, min: 300, max: 640 } },
  "image-viewer": { block: true, width: { def: 460, min: 300, max: 640 } },
  "diff-review": { block: true, replay: "Reset review", width: { def: 540, min: 360, max: 680 } },
  "terminal-output": { block: true, replay: "Replay", width: { def: 540, min: 360, max: 680 } },
  "sign-in-form": { block: true, width: { def: 400, min: 320, max: 480 } },
  "pricing-table": { block: true, width: { def: 760, min: 320, max: 900 } },
};

export type StateCell = { label: string; props: Record<string, unknown> };
export type StateSet = {
  min: number;
  block?: boolean;
  /** Minimum height of each cell's demo area, for popups. */
  minHeight?: number;
  /** Extra space around the demo, for tooltips that sit outside their trigger. */
  pad?: number;
  /** Align each demo to the top of its cell, for popups that open downward. */
  top?: boolean;
  /** Center each demo horizontally in its cell. */
  center?: boolean;
  cells: StateCell[];
};

export const STATES: Record<string, StateSet> = {
  button: {
    min: 150,
    cells: [
      { label: "Primary", props: { variant: "primary" } },
      { label: "Secondary", props: { variant: "secondary" } },
      { label: "Ghost", props: { variant: "ghost" } },
      { label: "Destructive", props: { variant: "destructive", label: "Delete" } },
      { label: "Loading", props: { loading: true, label: "Saving" } },
      { label: "Disabled", props: { disabled: true } },
      { label: "Small", props: { size: "sm" } },
      { label: "Large", props: { size: "lg" } },
    ],
  },
  "text-input": {
    min: 250,
    block: true,
    cells: [
      { label: "Error", props: { error: "Enter a valid email address." } },
      { label: "Disabled", props: { disabled: true } },
      {
        label: "Password",
        props: { type: "password", label: "Password", helper: "At least 12 characters.", placeholder: "••••••••••••" },
      },
    ],
  },
  switch: {
    min: 250,
    cells: [
      { label: "On", props: { checked: true } },
      { label: "Off", props: { checked: false } },
      { label: "Disabled", props: { disabled: true } },
    ],
  },
  checkbox: {
    min: 250,
    cells: [
      { label: "Unchecked", props: { checked: false } },
      { label: "Checked", props: { checked: true } },
      { label: "Indeterminate", props: { indeterminate: true } },
      { label: "Disabled", props: { disabled: true } },
    ],
  },
  "segmented-control": {
    min: 240,
    cells: [
      { label: "Two options", props: { options: ["List", "Grid"], defaultValue: "List" } },
      { label: "Five options", props: { options: ["1D", "1W", "1M", "1Y", "All"], defaultValue: "1M" } },
    ],
  },
  toast: {
    min: 300,
    block: true,
    cells: [
      { label: "Info", props: { severity: "info", message: "Sync started", description: "We'll tell you when it's done.", duration: 0 } },
      { label: "Success", props: { severity: "success", duration: 0 } },
      { label: "Warning", props: { severity: "warning", message: "Storage almost full", description: "You've used 92% of your plan.", duration: 0 } },
      { label: "Error", props: { severity: "error", message: "Deploy failed", description: "The build exited with code 1.", duration: 0 } },
    ],
  },
  badge: {
    min: 130,
    cells: [
      { label: "Neutral", props: { tone: "neutral", label: "Draft" } },
      { label: "Accent", props: { tone: "accent", label: "New" } },
      { label: "Success", props: { tone: "success", label: "Live" } },
      { label: "Warning", props: { tone: "warning", label: "Degraded" } },
      { label: "Danger", props: { tone: "danger", label: "Failed" } },
    ],
  },
  card: {
    min: 280,
    block: true,
    cells: [{ label: "Interactive", props: { interactive: true } }],
  },
  "message-bubble": {
    min: 300,
    block: true,
    cells: [
      { label: "User", props: { role: "user", text: "Which accounts recovered?", timestamp: "10:41" } },
      { label: "Named, no actions", props: { name: "Billing analyst", showActions: false } },
    ],
  },
  "chat-thread": {
    min: 300,
    block: true,
    cells: [{ label: "Empty", props: { messages: [], height: 160 } }],
  },
  "prompt-composer": {
    min: 300,
    block: true,
    cells: [{ label: "Running", props: { isRunning: true } }],
  },
  "agent-status": {
    min: 170,
    cells: [
      { label: "Idle", props: { state: "idle" } },
      { label: "Working", props: { state: "thinking" } },
      { label: "Needs input", props: { state: "waiting" } },
      { label: "Failed", props: { state: "error" } },
    ],
  },
  "reasoning-trace": {
    min: 300,
    block: true,
    cells: [
      { label: "Running", props: { running: true, defaultOpen: true } },
      { label: "Collapsed", props: { defaultOpen: false } },
    ],
  },
  "tool-call-card": {
    min: 330,
    block: true,
    cells: [
      { label: "Running", props: { status: "running" } },
      { label: "Failed", props: { status: "failed", output: "Request timed out after 30s.", seconds: 30 } },
      { label: "Collapsed", props: { defaultOpen: false } },
    ],
  },
  "approval-card": {
    min: 330,
    block: true,
    cells: [
      { label: "Low risk", props: { risk: "low", action: "Rename 3 files", details: "Moves drafts/ to archive/ in the shared drive." } },
      {
        label: "High risk",
        props: { risk: "high", action: "Delete 214 customer records", details: "Removes the records and all linked invoices. This can't be undone." },
      },
    ],
  },
  "dropdown-menu": {
    min: 300,
    minHeight: 270,
    top: true,
    cells: [{ label: "Open", props: { defaultOpen: true, showResult: false } }],
  },
  tooltip: {
    min: 260,
    pad: 34,
    center: true,
    cells: [
      { label: "Top", props: { side: "top", forceOpen: true, label: "Top" } },
      { label: "Bottom", props: { side: "bottom", forceOpen: true, label: "Bottom" } },
      { label: "Right", props: { side: "right", forceOpen: true, label: "Right" } },
      { label: "No shortcut", props: { side: "top", forceOpen: true, shortcut: "", content: "Share this page", label: "Share" } },
    ],
  },
  alert: {
    min: 340,
    block: true,
    cells: [
      { label: "Info", props: { severity: "info", title: "Scheduled maintenance", description: "Deploys pause tonight from 01:00 to 01:30 UTC.", actionLabel: "", dismissible: false } },
      { label: "Success", props: { severity: "success", title: "Domain verified", description: "acme.com now points at your project.", actionLabel: "", dismissible: false } },
      { label: "Error", props: { severity: "error", title: "Deploy failed", description: "The build exited with code 1.", actionLabel: "View logs", dismissible: true } },
    ],
  },
  "data-table": {
    min: 480,
    block: true,
    cells: [
      { label: "Compact", props: { density: "compact" } },
      { label: "No selection", props: { selectable: false } },
      { label: "Empty", props: { rows: [] } },
    ],
  },
  "split-pane": {
    min: 340,
    block: true,
    cells: [{ label: "Stacked", props: { direction: "vertical", height: 240, initial: 45 } }],
  },
  "scroll-area": {
    min: 300,
    block: true,
    cells: [{ label: "No fades", props: { fades: false, height: 180 } }],
  },
  carousel: {
    min: 340,
    block: true,
    cells: [
      { label: "Autoplay, with pause", props: { autoplay: true, interval: 4000, height: 200 } },
      { label: "No loop", props: { loop: false, height: 200 } },
    ],
  },
  "diff-review": {
    min: 420,
    block: true,
    cells: [{ label: "Single change", props: { file: "README.md", hunks: [{ title: "Fix typo", before: "recieve updates", after: "receive updates" }] } }],
  },
  "terminal-output": {
    min: 420,
    block: true,
    cells: [
      { label: "Streaming", props: { status: "running", stream: true, speed: 500, height: 180 } },
      {
        label: "Passed",
        props: {
          status: "passed",
          height: 180,
          seconds: 3.1,
          lines: ["✓ billing/retry.test.ts (6 tests) 112ms", "✓ billing/charge.test.ts (9 tests) 204ms", "Tests  15 passed (15)"],
        },
      },
    ],
  },
  "sign-in-form": {
    min: 360,
    block: true,
    cells: [
      { label: "Sign up", props: { mode: "signup" } },
      { label: "No provider", props: { showProvider: false } },
    ],
  },
  "pricing-table": {
    min: 600,
    block: true,
    cells: [{ label: "Annual billing", props: { defaultBilling: "annual" } }],
  },
};

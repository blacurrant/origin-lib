export type Theme = "dark" | "light";

export type Control = {
  key: string;
  label: string;
  type: string;
  default?: unknown;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
};

export type CoreEntry = {
  name: string;
  displayName: string;
  description: string;
  /** First line is `import Name from "./slug"`; used to build the usage snippet. */
  usage: string;
  tweakSchema: Control[];
};

/** One of the 12 component types, with the entries built for it. */
export type CoreGroup = {
  id: string;
  title: string;
  note: string;
  track: "basic" | "agentic";
  entries: CoreEntry[];
};

export type PlannedGroup = { id: string; title: string; note: string; track: "basic" | "agentic" };
export type PlannedItem = { group: string; name: string; purpose: string; tier: "Core" | "Next" | "Later" };
export type Planned = { groups: PlannedGroup[]; items: PlannedItem[] };

/** Props every demo shares: the page-level theme, accent, and corner choice. */
export type Shared = { theme: Theme; accent: string; radius?: number };

export const DEFAULT_ACCENT = "#fa7319";

export const ACCENTS: { name: string; value: string }[] = [
  { name: "Orange", value: DEFAULT_ACCENT },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Ink", value: "#f7f7f7" },
];

export type Corners = "default" | "square" | "soft" | "round";

export const CORNER_RADIUS: Record<Corners, number | undefined> = {
  default: undefined,
  square: 0,
  soft: 8,
  round: 16,
};

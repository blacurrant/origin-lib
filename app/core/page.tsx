import type { Metadata } from "next";
import registryJson from "@/lib/originkit-library/registry.json";
import { CoreShowcase, type CoreEntry, type CoreGroup, type Planned } from "./CoreShowcase";
import { BUILT_BY_GROUP } from "./groups";
import planned from "./planned.json";

export const metadata: Metadata = {
  title: "Core components · Originkit",
  description: "Core UI and agentic UI components, grouped by type, with live previews.",
};

type Control = { key: string; label: string; type: string; default?: unknown; options?: string[]; min?: number; max?: number; step?: number };
type LibraryEntry = { name: string; displayName: string; description: string; usage?: string; tweakSchema?: Control[] };

const registry = registryJson as unknown as LibraryEntry[];

function pick(slugs: string[]): CoreEntry[] {
  return slugs.flatMap((slug) => {
    const entry = registry.find((e) => e.name === slug);
    if (!entry) return [];
    return [
      {
        name: entry.name,
        displayName: entry.displayName,
        description: entry.description,
        usage: entry.usage ?? "",
        tweakSchema: (entry.tweakSchema ?? []).map((c) => ({
          key: c.key,
          label: c.label,
          type: c.type,
          default: c.default,
          options: c.options,
          min: c.min,
          max: c.max,
          step: c.step,
        })),
      },
    ];
  });
}

export default function CorePage() {
  const groups: CoreGroup[] = (planned as Planned).groups
    .map((g) => ({ ...g, entries: pick(BUILT_BY_GROUP[g.id] ?? []) }))
    .filter((g) => g.entries.length > 0);

  return (
    <main className="min-h-screen bg-[#0f0f10]">
      <CoreShowcase groups={groups} planned={planned as Planned} />
    </main>
  );
}

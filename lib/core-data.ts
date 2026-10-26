import registryJson from "@/lib/originkit-library/registry.json";
import { BUILT_BY_GROUP } from "@/app/core/groups";
import planned from "@/app/core/planned.json";
import type { CoreEntry, CoreGroup, Planned } from "@/app/core/types";

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

/** The foundation components, grouped by type, in display order. Shared by /core and /gallery. */
export function loadCoreGroups(): { groups: CoreGroup[]; planned: Planned } {
  const groups: CoreGroup[] = (planned as Planned).groups
    .map((g) => ({ ...g, entries: pick(BUILT_BY_GROUP[g.id] ?? []) }))
    .filter((g) => g.entries.length > 0);
  return { groups, planned: planned as Planned };
}

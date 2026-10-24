import type { Metadata } from "next";
import registryJson from "@/lib/originkit-library/registry.json";
import { loadLibraryData } from "@/lib/library-data";
import { BUILT_BY_GROUP } from "./core/groups";
import planned from "./core/planned.json";
import { Landing, type LandingData } from "@/components/Landing";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Originkit · Every component your product needs",
  description: "Preview foundation and animation components live.",
};

export default async function LibraryPage() {
  const byName = new Map((registryJson as { name: string; displayName: string }[]).map((e) => [e.name, e.displayName]));
  const groups = (planned.groups as { id: string; title: string; note: string; track: "basic" | "agentic" }[])
    .map((g) => ({
      ...g,
      names: (BUILT_BY_GROUP[g.id] ?? []).map((name) => ({ name, displayName: byName.get(name) ?? name })),
    }))
    .filter((g) => g.names.length > 0);

  const { animation, pages } = await loadLibraryData();

  const data: LandingData = {
    foundation: {
      groups,
      total: groups.reduce((n, g) => n + g.names.length, 0),
      planned: planned.items.length,
    },
    animation,
    pages,
  };

  return (
    <main className="min-h-screen bg-[#0f0f10]">
      <Landing data={data} />
    </main>
  );
}

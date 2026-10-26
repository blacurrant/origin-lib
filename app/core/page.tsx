import type { Metadata } from "next";
import { loadCoreGroups } from "@/lib/core-data";
import { CoreShowcase } from "./CoreShowcase";

export const metadata: Metadata = {
  title: "Core components · Originkit",
  description: "Core UI and agentic UI components, grouped by type, with live previews.",
};

export default function CorePage() {
  const { groups, planned } = loadCoreGroups();
  return (
    <main className="min-h-screen bg-[#0f0f10]">
      <CoreShowcase groups={groups} planned={planned} />
    </main>
  );
}

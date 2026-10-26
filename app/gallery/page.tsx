import type { Metadata } from "next";
import { loadCoreGroups } from "@/lib/core-data";
import { Gallery } from "./Gallery";

export const metadata: Metadata = {
  title: "Gallery · Originkit",
  description: "Every foundation and agentic component, live in a grid. Pick a type, then open one.",
};

export default function GalleryPage() {
  const { groups } = loadCoreGroups();
  return <Gallery groups={groups} />;
}

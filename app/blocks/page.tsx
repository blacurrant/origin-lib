import type { Metadata } from "next"
import { Blocks } from "./Blocks"

export const metadata: Metadata = {
  title: "Blocks · Originkit",
  description: "Interactive blocks you can feel before you copy: hover, press, drag, slide, swipe, type and select.",
}

export default function BlocksPage() {
  return <Blocks />
}

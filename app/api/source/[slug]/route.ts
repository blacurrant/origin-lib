import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-static"

const DIR = path.join(process.cwd(), "lib", "originkit-library")

export async function generateStaticParams() {
  const files = await readdir(DIR)
  return files.filter((f) => f.endsWith(".tsx")).map((f) => ({ slug: f.replace(/\.tsx$/, "") }))
}

/** The same component, ready for Framer (as written) and for a plain React or Next.js project. */
function toFramer(src: string) {
  return src.replace('from "./framer-shim"', 'from "framer"')
}

function toReact(src: string) {
  let s = src.replace(/^import \{[^}]*\} from "\.\/framer-shim"\n/m, "")
  const at = s.indexOf("\naddPropertyControls(")
  if (at !== -1) s = s.slice(0, at)
  s = s
    .split("\n")
    .filter((line) => !/^\s\*\s@framer/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
  return `"use client"\n\n${s}\n`
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  if (!/^[a-z0-9-]+$/.test(params.slug)) return NextResponse.json({ error: "Bad slug" }, { status: 400 })
  try {
    const src = await readFile(path.join(DIR, `${params.slug}.tsx`), "utf8")
    const framer = toFramer(src)
    const react = toReact(src)
    return NextResponse.json({ slug: params.slug, framer, react })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

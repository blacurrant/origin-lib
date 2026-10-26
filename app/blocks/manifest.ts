export type Interaction = "Hover" | "Press" | "Drag" | "Slide" | "Swipe" | "Type" | "Select" | "Loading"

export const INTERACTIONS: Interaction[] = ["Hover", "Press", "Drag", "Slide", "Swipe", "Type", "Select", "Loading"]

/** Tile height in px at a 520px column: small, medium, large. */
export type Size = "s" | "m" | "l"
export const TILE_HEIGHT: Record<Size, number> = { s: 340, m: 440, l: 560 }

export type Block = { slug: string; title: string; interaction: Interaction; size: Size; keywords: string }

export const BLOCKS: Block[] = [
  { slug: "card-swap", title: "Card swap", interaction: "Swipe", size: "l", keywords: "stack deck cards 3d" },
  { slug: "spiral-3d-slider", title: "Spiral 3D slider", interaction: "Drag", size: "l", keywords: "helix rotate" },
  { slug: "like", title: "Like", interaction: "Press", size: "s", keywords: "heart favourite burst" },
  { slug: "wake-slider", title: "Wake slider", interaction: "Slide", size: "s", keywords: "range ticks" },
  { slug: "rolling-counter", title: "Rolling counter", interaction: "Press", size: "s", keywords: "stepper odometer number" },
  { slug: "dock", title: "Dock", interaction: "Hover", size: "s", keywords: "magnify toolbar" },
  { slug: "tilt", title: "Tilt", interaction: "Hover", size: "m", keywords: "3d card glare" },
  { slug: "liq-toggle", title: "Liquid toggle", interaction: "Press", size: "s", keywords: "switch goo" },
  { slug: "orbit-card-stack", title: "Orbit card stack", interaction: "Select", size: "l", keywords: "carousel rotate" },
  { slug: "label-input", title: "Label input", interaction: "Type", size: "s", keywords: "floating label field" },
  { slug: "one-time-code", title: "One-time code", interaction: "Type", size: "s", keywords: "otp pin verify" },
  { slug: "seek", title: "Seek", interaction: "Slide", size: "s", keywords: "scrubber media timeline" },
  { slug: "snap-carousel", title: "Snap carousel", interaction: "Swipe", size: "m", keywords: "slider" },
  { slug: "glass-carousel", title: "Glass carousel", interaction: "Drag", size: "m", keywords: "liquid glass lens" },
  { slug: "coverflow-drag", title: "Coverflow drag", interaction: "Drag", size: "m", keywords: "carousel cover flow" },
  { slug: "text-repel", title: "Text repel", interaction: "Hover", size: "m", keywords: "letters cursor push" },
  { slug: "letter-cascade", title: "Letter cascade", interaction: "Loading", size: "s", keywords: "text intro stagger" },
  { slug: "magnetic-dock", title: "Magnetic dock", interaction: "Hover", size: "s", keywords: "toolbar attract" },
  { slug: "layered-stack", title: "Layered stack", interaction: "Hover", size: "m", keywords: "fan cards" },
  { slug: "signature", title: "Signature", interaction: "Drag", size: "m", keywords: "draw pad sign" },
  { slug: "accordionos", title: "Accordion OS", interaction: "Select", size: "l", keywords: "steps expand" },
  { slug: "corner-video", title: "Corner video", interaction: "Drag", size: "l", keywords: "pip floating player" },
  { slug: "dynamic-grid-gallery", title: "Dynamic grid gallery", interaction: "Select", size: "l", keywords: "photos expand grid" },
  { slug: "infinite-grid", title: "Infinite grid", interaction: "Drag", size: "l", keywords: "canvas pan" },
  { slug: "inline-edit", title: "Inline edit", interaction: "Type", size: "m", keywords: "editable text" },
]

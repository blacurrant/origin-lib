export type Interaction = "Hover" | "Press" | "Drag" | "Slide" | "Swipe" | "Type" | "Select" | "Loading"

export const INTERACTIONS: Interaction[] = ["Hover", "Press", "Drag", "Slide", "Swipe", "Type", "Select", "Loading"]

/** Masonry tile shape (width / height): small, medium, large. */
export type Size = "s" | "m" | "l"
export const TILE_ASPECT: Record<Size, number> = { s: 1.5, m: 1.2, l: 0.95 }

export type Block = { slug: string; title: string; interaction: Interaction; size: Size; keywords: string; hint: string }

export const BLOCKS: Block[] = [
  { slug: "card-swap", title: "Card swap", interaction: "Swipe", size: "l", keywords: "stack deck cards 3d", hint: "Click the stack, or use the arrows." },
  { slug: "spiral-3d-slider", title: "Spiral 3D slider", interaction: "Drag", size: "l", keywords: "helix rotate", hint: "Drag, scroll, or use the arrow keys." },
  { slug: "like", title: "Like", interaction: "Press", size: "s", keywords: "heart favourite burst", hint: "Press to like, press again to undo." },
  { slug: "wake-slider", title: "Wake slider", interaction: "Slide", size: "s", keywords: "range ticks", hint: "Drag, click, or use the arrow keys." },
  { slug: "rolling-counter", title: "Rolling counter", interaction: "Press", size: "s", keywords: "stepper odometer number", hint: "Press and hold + or −." },
  { slug: "dock", title: "Dock", interaction: "Hover", size: "s", keywords: "magnify toolbar", hint: "Move across the icons." },
  { slug: "tilt", title: "Tilt", interaction: "Hover", size: "m", keywords: "3d card glare", hint: "Move your pointer over the card." },
  { slug: "liq-toggle", title: "Liquid toggle", interaction: "Press", size: "s", keywords: "switch goo", hint: "Click, or press Space." },
  { slug: "orbit-card-stack", title: "Orbit card stack", interaction: "Select", size: "l", keywords: "carousel rotate", hint: "Drag to spin, click a card to bring it forward." },
  { slug: "label-input", title: "Label input", interaction: "Type", size: "s", keywords: "floating label field", hint: "Focus the field and type." },
  { slug: "one-time-code", title: "One-time code", interaction: "Type", size: "s", keywords: "otp pin verify", hint: "Type or paste 123456." },
  { slug: "seek", title: "Seek", interaction: "Slide", size: "s", keywords: "scrubber media timeline", hint: "Drag the bar, or use the arrow keys." },
  { slug: "snap-carousel", title: "Snap carousel", interaction: "Swipe", size: "m", keywords: "slider", hint: "Drag, flick, or use the arrow keys." },
  { slug: "glass-carousel", title: "Glass carousel", interaction: "Drag", size: "m", keywords: "liquid glass lens", hint: "Drag the row, click the centre to expand." },
  { slug: "coverflow-drag", title: "Coverflow drag", interaction: "Drag", size: "m", keywords: "carousel cover flow", hint: "Drag, or click a side card." },
  { slug: "text-repel", title: "Text repel", interaction: "Hover", size: "m", keywords: "letters cursor push", hint: "Move your pointer through the text." },
  { slug: "letter-cascade", title: "Letter cascade", interaction: "Loading", size: "s", keywords: "text intro stagger", hint: "Hover to replay." },
  { slug: "magnetic-dock", title: "Magnetic dock", interaction: "Hover", size: "s", keywords: "toolbar attract", hint: "Move across the buttons." },
  { slug: "layered-stack", title: "Layered stack", interaction: "Hover", size: "m", keywords: "fan cards", hint: "Hover to fan out, click a layer." },
  { slug: "signature", title: "Signature", interaction: "Drag", size: "m", keywords: "draw pad sign", hint: "Draw with your pointer." },
  { slug: "accordionos", title: "Accordion OS", interaction: "Select", size: "l", keywords: "steps expand", hint: "Click a step, or use the arrow keys." },
  { slug: "corner-video", title: "Corner video", interaction: "Drag", size: "l", keywords: "pip floating player", hint: "Drag it to another corner." },
  { slug: "dynamic-grid-gallery", title: "Dynamic grid gallery", interaction: "Select", size: "l", keywords: "photos expand grid", hint: "Hover a tile, click to pin it." },
  { slug: "infinite-grid", title: "Infinite grid", interaction: "Drag", size: "l", keywords: "canvas pan", hint: "Drag or scroll to pan." },
  { slug: "inline-edit", title: "Inline edit", interaction: "Type", size: "m", keywords: "editable text", hint: "Click any text to edit it." },
]

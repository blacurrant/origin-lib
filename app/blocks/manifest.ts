export type Interaction = "Hover" | "Press" | "Drag" | "Slide" | "Swipe" | "Type" | "Select" | "Loading"

export const INTERACTIONS: Interaction[] = ["Hover", "Press", "Drag", "Slide", "Swipe", "Type", "Select", "Loading"]

/** Masonry tile shape (width / height): small, medium, large. */
export type Size = "s" | "m" | "l"
export const TILE_ASPECT: Record<Size, number> = { s: 1.5, m: 1.2, l: 0.95 }

/**
 * A tile's width / height. Blocks that pin a preview frame take its shape, so the tile fits the
 * frame (plus the padding Fit leaves round it) instead of shrinking it; the rest use their size class.
 */
export function tileAspect(b: Block): number {
  const st = b.props?.style as { width?: number; height?: number } | undefined
  if (st?.width && st?.height) return Math.min(2, Math.max(0.6, (st.width + 56) / (st.height + 120)))
  return TILE_ASPECT[b.size]
}

export type Block = {
  slug: string
  title: string
  interaction: Interaction
  size: Size
  keywords: string
  hint: string
  /** Props the preview always renders with, under any the inspector sets. An `accent` here keeps the page accent off the block. */
  props?: Record<string, unknown>
}

export const BLOCKS: Block[] = [
  {
    slug: "pixel-swarm-dropdown",
    title: "Pixel swarm dropdown",
    interaction: "Select",
    size: "m",
    keywords: "select dropdown menu pixel cells swarm scramble picker options",
    hint: "Click the pill to open the menu, then pick an option.",
    // The pill and menu scale down to the frame; 480 × 460 fits the pill plus all five rows.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 460 } },
  },
  {
    slug: "flip-invite-ticket",
    title: "Flip invite ticket",
    interaction: "Press",
    size: "m",
    keywords: "invite code copy ticket pill flip hinge button reveal",
    hint: "Click the pill to flip it between the invite and its code.",
    // It scales its capsule and the label above it to the frame, so 480 × 300 keeps both inside the preview.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 300 } },
  },
  {
    slug: "button-morph-card",
    title: "Button morph card",
    interaction: "Press",
    size: "m",
    keywords: "button morph card expand pill flight dialog modal open",
    hint: "Click the pill to grow it into a card; click the card or its close button to shrink it back.",
    // It fits its card to the frame (the card is 587 × 403 at size 516), so 480 × 360 holds the open flight card.
    props: { size: 400, background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 360 } },
  },
  {
    slug: "mirror-flip-carousel",
    title: "Mirror flip carousel",
    interaction: "Swipe",
    size: "m",
    keywords: "carousel cards flip 3d barrel wide angle fringe webgl slider",
    hint: "Drag, use the arrows, or wait for it to flip on its own.",
    // The cards fit their frame's height and flare to its edges; 480 × 360 keeps them large with the arrows inside.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 360 } },
  },
  {
    slug: "crumple-paper-carousel",
    title: "Crumple carousel",
    interaction: "Swipe",
    size: "m",
    keywords: "paper crumple posters carousel slider webgl 3d balls",
    hint: "Swipe or scroll to step; the posters crumple as they leave the centre.",
    // It scales its 1200 × 800 stage to the frame, so keep that 3:2 shape at the 480px preview width.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 320 } },
  },
  {
    slug: "scribble-loop-nav",
    title: "Scribble loop nav",
    interaction: "Hover",
    size: "s",
    keywords: "nav menu links scribble loop circle hand drawn underline",
    hint: "Move across the links; the loop follows on one stroke.",
    // Five labels run about 560px at 24px type, so shrink the type and gap to fit the 480px preview.
    props: { size: 13, gap: 30, strokeWidth: 2, background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 170 } },
  },
  {
    slug: "page-flip-book",
    title: "Page flip book",
    interaction: "Swipe",
    size: "m",
    keywords: "book pages flip turn 3d perspective spread cover picture book",
    hint: "Click the sides or drag a page to turn it; it also turns by itself.",
    // The book is width-limited to about 64% of the frame, so a wide 480 x 280 frame keeps it large without dead space above and below.
    props: { autoplay: true, background: "transparent", advanced: { vignette: 0, grain: 0 }, style: { minWidth: 0, minHeight: 0, width: 480, height: 280 } },
  },
  {
    slug: "water-ripple-refraction",
    title: "Water ripple refraction",
    interaction: "Loading",
    size: "m",
    keywords: "water ripple rings refraction painting image shader webgl waves ambient",
    hint: "Rings flow out of the bottom of a painting and bend it; swap in your own image.",
    // The rings scale with the frame height; a 4:3 frame at 480 x 360 keeps several rings visible in the preview.
    props: { style: { minWidth: 0, minHeight: 0, width: 480, height: 360 } },
  },
  {
    slug: "status-dot-picker",
    title: "Status dot picker",
    interaction: "Hover",
    size: "m",
    keywords: "status avatar presence dot online focus dnd do not disturb pill tooltip picker",
    hint: "Hover the avatar to grow its status dot into a pill, then click a status to pick it.",
    // Everything scales by min(width/1200, height/800), so a 3:2 frame at 480x320 gives a 0.4 scale and keeps the open pill and tooltip inside it.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 320 } },
  },
  {
    slug: "photo-card-globe",
    title: "Photo card globe",
    interaction: "Drag",
    size: "l",
    keywords: "globe sphere photos cards webgl 3d rotate product",
    hint: "Drag to spin the globe, hover to lean it.",
    // It fits the globe to its frame (about 85% of the height), so a square 480px frame keeps it large in the preview.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 480 } },
  },
  {
    slug: "gooey-delete-confirm",
    title: "Gooey delete",
    interaction: "Press",
    size: "m",
    keywords: "delete trash confirm cancel gooey metaball button pills",
    hint: "Click the trash to split it into Confirm and Cancel; click Cancel to merge it back.",
    // It draws at its own pixel size (196 by default) and centres itself, so the open pills run about 4.6x the size wide, so 96 keeps them inside the 480px frame.
    props: { size: 96, background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 300 } },
  },
  {
    slug: "bouncing-dot-tabs",
    title: "Bouncing dot tabs",
    interaction: "Press",
    size: "s",
    keywords: "tabs filter dot bounce arc squash segmented",
    hint: "Click a tab and the dot hops to it.",
    // Authored at a 32px type size for the 1200 × 800 frame; scale the row down so five tabs fit the 480px preview.
    props: { background: "transparent",
      font: { fontSize: 17 },
      size: 11,
      advanced: { wordGap: 18, dotGap: 6, dotLead: 6, pointerSize: 12, minArc: 14, wander: 80 },
      style: { minWidth: 0, minHeight: 0, width: 480, height: 160 },
    },
  },
  {
    slug: "liquid-glass-clock",
    title: "Liquid glass clock",
    interaction: "Hover",
    size: "m",
    keywords: "clock time glass liquid tubes needle loader",
    hint: "Move the pointer near the hands and the needle; press to brighten the liquid.",
    // The clock is drawn at its own pixel size (670 by default), so size it to fit the 480px preview.
    props: { background: "transparent", size: 440, style: { minWidth: 0, minHeight: 0, width: 480, height: 480 } },
  },
  {
    slug: "stretch-pill-toggle",
    title: "Stretch toggle",
    interaction: "Press",
    size: "m",
    keywords: "toggle switch pill stretch knob segmented",
    hint: "Click the track to toggle, or pick Plain / Stretch.",
    // The toggle is sized by its track width; 420 keeps the track and the segmented control inside the 480px preview.
    props: { background: "transparent", size: 420, style: { minWidth: 0, minHeight: 0, width: 480, height: 530 } },
  },
  {
    slug: "qr-code-assemble",
    title: "QR assemble",
    interaction: "Press",
    size: "l",
    keywords: "qr code scan fan dust particles build",
    hint: "Click the button to rebuild the code.",
    // It scales its code to the frame; 480 × 560 fits the code and the button under it inside the 480px preview width.
    props: { background: "#131314", style: { minWidth: 0, minHeight: 0, width: 480, height: 640 } },
  },
  {
    slug: "photo-stack-lightbox",
    title: "Photo stack",
    interaction: "Press",
    size: "l",
    keywords: "photos gallery lightbox stack cards caption spread",
    hint: "Click the stack to spread it, click a photo to open it.",
    // It scales its 1200 × 800 stage to the frame, so keep that 3:2 shape at the 480px preview width.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 320 } },
  },
  {
    slug: "draggable-cloth-print",
    title: "Cloth print",
    interaction: "Drag",
    size: "l",
    keywords: "paper cloth sheet fold physics webgl print",
    hint: "Grab the paper and pull it around.",
    // It sizes the sheet to its frame; the sheet is sized at 75% of the frame height (the same ratio as its own 1200 × 800 frame at size 600) so the ghost hand has room to lift and carry it (same 3:2 as its 1200 × 800 Framer frame).
    props: { background: "#131314", size: 240, style: { minWidth: 0, minHeight: 0, width: 480, height: 320 } },
  },
  {
    slug: "garden-progress-slider",
    title: "Garden progress",
    interaction: "Slide",
    size: "s",
    keywords: "progress loader flowers bee grow",
    hint: "Press and drag across the garden.",
    // Its green stems are the look, and its 1200 × 800 Framer frame would leave the garden tiny, so frame it
    // tight inside the 480px preview width. The drawing scales with `size`, so this is the same garden, smaller.
    props: { accent: "#6C8462", background: "transparent", size: 440, style: { minWidth: 0, minHeight: 0, width: 480, height: 170 } },
  },
  {
    slug: "radial-action-menu",
    title: "Radial menu",
    interaction: "Press",
    size: "m",
    keywords: "radial menu plus toggle fab action buttons gooey liquid hover",
    hint: "Click the + to open it, then touch a button.",
    // The ring fits itself to its frame; 480 × 440 keeps it from shrinking inside the 1200 × 800 Framer frame.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 440 } },
  },
  {
    slug: "peel-sticker",
    title: "Peel sticker",
    interaction: "Drag",
    size: "m",
    keywords: "sticker vinyl peel curl holographic die-cut",
    hint: "Drag an edge to peel it back, let go to stick it down.",
    // The sticker fits itself to its frame; 480 × 460 keeps it from shrinking inside the 1200 × 800 Framer frame.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 460 } },
  },
  {
    slug: "holo-card-dispenser",
    title: "Holo card dispenser",
    interaction: "Press",
    size: "l",
    keywords: "membership card reader slot hologram foil modal",
    hint: "Hover to move the sheen, press the button to reissue the card.",
    // The modal fits itself to its frame; this just keeps it from shrinking inside the 1200 × 800 Framer frame.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 320 } },
  },
  {
    slug: "holo-flip-badge",
    title: "Holo flip badge",
    interaction: "Press",
    size: "l",
    keywords: "lanyard id card hologram 3d flip tilt",
    hint: "Hover to tilt it, click to flip it.",
    // Its 1200 × 800 Framer frame would leave the badge tiny; this frame just holds the cord and the swinging card.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 620 } },
  },
  {
    slug: "bookshelf-cover-flip",
    title: "Bookshelf",
    interaction: "Hover",
    size: "m",
    keywords: "books spines cover flip 3d shelf",
    hint: "Move along the spines to open each book.",
    // The shelf fits itself to its frame; 480 × 460 keeps it from shrinking inside the 1200 × 800 Framer frame.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 460 } },
  },
  {
    slug: "app-icon-paddle-wheel",
    title: "App icon wheel",
    interaction: "Drag",
    size: "m",
    keywords: "paddle wheel icons 3d spin carousel",
    hint: "Drag to spin it, press and hold to speed it up.",
    // It scales its 1200 × 800 stage to the frame, so keep that 3:2 shape at the 480px preview width.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 320 } },
  },
  {
    slug: "bloom-wave-text",
    title: "Bloom wave text",
    interaction: "Loading",
    size: "s",
    keywords: "flowers thinking text sweep wave",
    hint: "Hover the word to bloom it, click to replay the sweep.",
    // The word fits itself to the frame; a short 480 × 180 frame keeps it large instead of floating in 1200 × 800.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 180 } },
  },
  {
    slug: "swinging-lanyard-badge",
    title: "Lanyard badge",
    interaction: "Drag",
    size: "l",
    keywords: "id card lanyard swing physics clip",
    hint: "Grab the card: swing it, pull it down, or throw it.",
    // The card is drawn at its own pixel size (400px), so the frame is tall enough for it to hang and swing in.
    props: { background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 700 } },
  },
  {
    slug: "scroll-progress-outline",
    title: "Scroll outline",
    interaction: "Loading",
    size: "m",
    keywords: "table of contents toc outline on this page scroll progress arrow path autoplay",
    hint: "The arrow walks down the outline on its own; hover a row to pull it over, click to jump.",
    // It scales its 1200 × 800 stage to the frame; Auto keeps it off the page scroll so the grid doesn't drive it.
    props: { trigger: "auto", background: "transparent", style: { minWidth: 0, minHeight: 0, width: 480, height: 320 } },
  },
  { slug: "card-swap", title: "Card swap", interaction: "Swipe", size: "l", keywords: "stack deck cards 3d", hint: "Drag the front card either way, click a side, or use the arrows." },
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
